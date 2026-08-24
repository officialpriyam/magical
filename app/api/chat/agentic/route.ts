import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import {
  getFallbackChain,
  getModelClient,
  LLMModel,
  LLMModelConfig,
} from '@/lib/models'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import { checkCredits } from '@/lib/credits'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'
import { Templates } from '@/lib/templates'
import { toPrompt, PromptContext } from '@/lib/prompt'
import { fragmentSchema as schema } from '@/lib/schema'
import { streamText, type LanguageModel, type ModelMessage } from 'ai'
import {
  AgentRole,
  AgentResult,
  TaskComplexity,
} from '@/lib/agents/types'
import {
  COMPLEXITY_ANALYSIS_PROMPT,
  AGENT_DISPLAY_NAMES,
} from '@/lib/agents/prompts'
import { runAgent, type AgentEventEmitter } from '@/lib/agents/agent-runner'
import { detectSkillsFromPrompt, buildSkillPrompt, getSkillById, type Skill } from '@/lib/skills/registry'

export const maxDuration = 300

const STREAM_TEXT_PROVIDER_IDS = new Set([
  'orcarouter',
  'requesty',
  'llm_gateway',
  'deepseek',
  'nvidia',
])

// ─── Agent execution plans by complexity ──────────────────────
const EXECUTION_PLANS: Record<TaskComplexity, AgentRole[]> = {
  simple: ['planner', 'frontend'],
  moderate: ['planner', 'architect', 'frontend', 'reviewer'],
  complex: ['planner', 'architect', 'frontend', 'backend', 'reviewer', 'optimizer'],
  enterprise: ['planner', 'architect', 'frontend', 'backend', 'reviewer', 'optimizer', 'reviewer'],
}

const PARALLEL_GROUPS: Record<TaskComplexity, AgentRole[][]> = {
  simple: [['planner'], ['frontend']],
  moderate: [['planner'], ['architect'], ['frontend', 'backend'], ['reviewer']],
  complex: [['planner'], ['architect'], ['frontend', 'backend'], ['reviewer'], ['optimizer']],
  enterprise: [['planner'], ['architect'], ['frontend', 'backend'], ['reviewer'], ['optimizer'], ['reviewer']],
}

// No hardcoded descriptions — real data emitted from agent output

function createSSEStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let encoder = new TextEncoder()
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
      // Send SSE comment heartbeat every 15s to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (!controller) return
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {}
      }, 15000)
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    },
  })

  function emit(event: Record<string, any>) {
    if (!controller) return
    try {
      // Use proper SSE format: data: <json>\n\n
      const data = 'data: ' + JSON.stringify(event) + '\n\n'
      controller.enqueue(encoder.encode(data))
    } catch {
      // Stream may be closed
    }
  }

  function emitAction(actionType: string, content: string, detail?: string) {
    emit({ type: 'action', action_type: actionType, content, detail })
  }

  // Throttle helper: emit with a delay so actions appear one by one
  async function emitActionThrottled(actionType: string, content: string, detail?: string, delayMs = 150) {
    emitAction(actionType, content, detail)
    await new Promise(r => setTimeout(r, delayMs))
  }

  function emitTodos(todos: { id: string; text: string; completed: boolean }[]) {
    emit({ type: 'todos', todos })
  }

  function emitProgress(completed: number, total: number) {
    emit({ type: 'progress', completed, total })
  }

  function emitFragment(data: Record<string, any>) {
    emit({ type: 'fragment', data })
  }

  function emitError(message: string) {
    emit({ type: 'error', message })
  }

  function close() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (controller) {
      try { controller.close() } catch {}
      controller = null
    }
  }

  return { stream, emit, emitAction, emitActionThrottled, emitTodos, emitProgress, emitFragment, emitError, close }
}

export async function POST(req: Request) {
  const {
    messages,
    userID,
    teamID,
    projectID,
    template,
    model,
    config,
  }: {
    messages: ModelMessage[]
    userID: string | undefined
    teamID: string | undefined
    projectID: string | undefined
    template: Templates
    model: LLMModel
    config: LLMModelConfig
  } = await req.json()

  if (!model?.id || !model?.providerId) {
    return new Response('No AI model selected.', { status: 400 })
  }

  const limit = await applyChatRateLimit({ req, config, userID, teamID })
  if (limit) return createRateLimitResponse(limit)

  if (userID) {
    const creditCheck = await checkCredits(userID)
    if (!creditCheck.ok) {
      return new Response('Insufficient credits.', { status: 402 })
    }
  }

  const fallbackChain = getFallbackChain(model, config)
  if (fallbackChain.length === 0) {
    return new Response('No AI providers configured.', { status: 400 })
  }

  const supabaseStatus = await getSupabaseConnectionStatus(userID, projectID)
  const supabaseContext: PromptContext['supabase'] = {
    connected: supabaseStatus.connected,
    projectRef: supabaseStatus.projectRef,
    source: supabaseStatus.source,
    projectsMode: supabaseStatus.projectsMode,
  }

  const { stream, emit, emitAction, emitActionThrottled, emitTodos, emitProgress, emitFragment, emitError, close } = createSSEStream()

  // Emit connected event immediately so the frontend knows the stream is alive
  emit({ type: 'connected', timestamp: Date.now() })

  // Detect agent skill from message prefix
  const detectedAgent = detectAgentFromMessage(messages)
  if (detectedAgent) {
    emitAction('commentary', `Using ${detectedAgent} agent for your request...`)
  }

  // Auto-detect skills from the user prompt
  const userPrompt = messages.find(m => m.role === 'user')?.content || ''
  const promptText = typeof userPrompt === 'string' ? userPrompt : Array.isArray(userPrompt) ? userPrompt.map(p => p.type === 'text' ? p.text : '').join(' ') : ''
  const detectedSkills = detectSkillsFromPrompt(promptText)
  if (detectedSkills.length > 0) {
    emitAction('commentary', `Applying skills: ${detectedSkills.map(s => s.name).join(', ')}`)
  }

  // Auto web search: detect if the query needs up-to-date information
  const autoSearchQuery = detectAutoSearchQuery(messages)
  let enrichedMessages = [...messages]

  // Detect mobile app request and fetch Expo/React Native docs
  const isMobileAppRequest = /\b(mobile\s*app|react\s*native|expo|ios|android|installable|install.*phone|pwa|progressive)\b/i.test(promptText)
  if (isMobileAppRequest) {
    try {
      console.log('[Mobile] Detected mobile app request, fetching Expo docs...')
      const expoDocs = await fetchWebSearch('React Native Expo tutorial 2024 app.json navigation expo-router')
      if (expoDocs.length > 0) {
        emitAction('web_search', 'React Native Expo docs', JSON.stringify(expoDocs.map(r => ({ title: r.title, url: r.url, snippet: r.snippet }))))
        const docsContext = expoDocs.map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`).join('\n\n')
        enrichedMessages = [
          ...enrichedMessages,
          {
            role: 'user' as const,
            content: `React Native Expo reference docs (use these for accurate mobile app generation):\n\n${docsContext}\n\nUse these docs as reference for generating the mobile app. Follow Expo and React Native best practices.`,
          },
        ]
      }
    } catch (err) {
      console.error('[Mobile] Failed to fetch Expo docs:', err)
    }
  }
  if (autoSearchQuery) {
    try {
      console.log(`[WebSearch] Auto-searching for: ${autoSearchQuery}`)
      const searchResults = await fetchWebSearch(autoSearchQuery)
      console.log(`[WebSearch] Got ${searchResults.length} results`)
      // Always emit the search action so frontend shows it
      emitAction('web_search', autoSearchQuery, JSON.stringify(searchResults.map(r => ({ title: r.title, url: r.url, snippet: r.snippet }))))
      if (searchResults.length > 0) {
        const searchContext = searchResults
          .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`)
          .join('\n\n')
        enrichedMessages = [
          ...messages,
          {
            role: 'user' as const,
            content: `Web search results for "${autoSearchQuery}":\n\n${searchContext}\n\nUse these search results as reference when answering the user's question.`,
          },
        ]
      }
    } catch (err) {
      console.error(`[WebSearch] Failed:`, err)
      // Still emit so the user sees a search was attempted
      emitAction('web_search', autoSearchQuery)
    }
  }

  // Auto-fetch URLs from user messages
  const fetchedUrls = await fetchUrlsFromMessages(messages)
  if (fetchedUrls.length > 0) {
    // Emit web fetch results to frontend
    for (const fetched of fetchedUrls) {
      emitAction('web_fetch', fetched.url, fetched.title || '')
    }
    const urlContext = fetchedUrls
      .map((f) => {
        const header = f.title ? `URL: ${f.url} (Title: ${f.title})` : `URL: ${f.url}`
        const truncated = f.content.length > 4000 ? f.content.slice(0, 4000) + '...' : f.content
        return `${header}\n\nContent:\n${truncated}`
      })
      .join('\n\n---\n\n')
    enrichedMessages = [
      ...enrichedMessages,
      {
        role: 'user' as const,
        content: `The user shared the following URL(s). Use the fetched content below as context:\n\n${urlContext}`,
      },
    ]
  }

  // Run the pipeline in background and stream events
  const pipelinePromise = runPipeline({
    messages: enrichedMessages,
    model,
    config,
    template,
    supabaseContext,
    fallbackChain,
    detectedAgent,
    detectedSkills,
    emitAction,
    emitActionThrottled,
    emitTodos,
    emitProgress,
    emitFragment,
    emitError,
  }).finally(close)

  // Don't await — return the stream immediately
  void pipelinePromise

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ─── Pipeline runner ─────────────────────────────────────────
async function runPipeline({
  messages,
  model,
  config,
  template,
  supabaseContext,
  fallbackChain,
  detectedAgent,
  detectedSkills,
  emitAction,
  emitActionThrottled,
  emitTodos,
  emitProgress,
  emitFragment,
  emitError,
}: {
  messages: ModelMessage[]
  model: LLMModel
  config: LLMModelConfig
  template: Templates
  supabaseContext: PromptContext['supabase']
  fallbackChain: any[]
  detectedAgent?: string | null
  detectedSkills?: Skill[]
  emitAction: (type: string, content: string, detail?: string) => void
  emitActionThrottled: (type: string, content: string, detail?: string, delayMs?: number) => Promise<void>
  emitTodos: (todos: { id: string; text: string; completed: boolean }[]) => void
  emitProgress: (completed: number, total: number) => void
  emitFragment: (data: Record<string, any>) => void
  emitError: (message: string) => void
}) {
  let flushPendingWrites: ReturnType<typeof setInterval> | undefined
  try {
    // ── Step 1: Analyze complexity ────────────────────────────
    emitAction('commentary', 'Analyzing your request to determine the best approach...')

    // If agent was explicitly selected, use it; otherwise analyze complexity
    let complexity: TaskComplexity
    let agentsNeeded: AgentRole[]

    if (detectedAgent && detectedAgent !== 'auto') {
      // Map slash command agent to agent roles
      const agentMap: Record<string, AgentRole[]> = {
        planner: ['planner', 'frontend'],
        build: ['planner', 'architect', 'frontend', 'backend', 'reviewer'],
        architect: ['planner', 'architect', 'frontend'],
        frontend: ['planner', 'frontend'],
        backend: ['planner', 'backend'],
        reviewer: ['planner', 'frontend', 'reviewer'],
        optimizer: ['planner', 'frontend', 'optimizer'],
        fixer: ['planner', 'frontend', 'fixer'],
        search: ['planner', 'frontend'],
        think: ['planner', 'architect', 'frontend'],
      }
      agentsNeeded = agentMap[detectedAgent] || EXECUTION_PLANS.simple
      complexity = detectedAgent === 'build' ? 'complex' : detectedAgent === 'planner' ? 'simple' : 'moderate'
    } else {
      complexity = await analyzeComplexity(messages, model, config)
      agentsNeeded = EXECUTION_PLANS[complexity]
    }

    const totalSteps = agentsNeeded.length

    console.log(`[Agentic] Complexity: ${complexity}, Agents: ${agentsNeeded.length}${detectedAgent ? ` (user: ${detectedAgent})` : ''}`)

    emitAction('commentary', `Task complexity: ${complexity}. Dispatching ${agentsNeeded.length} agents...`)
    emitProgress(0, totalSteps)

    // Generate initial todo list from the user prompt using LLM
    const initialTodos = await generateTodosFromPrompt(messages, model, config, agentsNeeded)
    if (initialTodos.length > 0) {
      emitTodos(initialTodos)
    }

    // ── Step 2: Run agents ────────────────────────────────────
    const plan = PARALLEL_GROUPS[complexity]
    const agentResults: AgentResult[] = []
    let latestFragment: Record<string, any> = {
      commentary: '',
      template: 'default',
      title: '',
      description: '',
      additional_dependencies: [],
      has_additional_dependencies: false,
      install_dependencies_command: '',
      port: null,
      file_path: '',
      code: '',
      files: [],
    }

    let completedAgents = 0
    const emittedFilePaths = new Set<string>()
    let currentTodos: { id: string; text: string; completed: boolean }[] = []
    let lastFileWriteTime = 0
    const pendingFileWrites: { path: string; purpose?: string; emitAt: number }[] = []

    // Flush pending file writes periodically
    flushPendingWrites = setInterval(() => {
      const now = Date.now()
      while (pendingFileWrites.length > 0 && pendingFileWrites[0].emitAt <= now) {
        const pw = pendingFileWrites.shift()!
        emitAction('file_write', pw.path, pw.purpose)
        lastFileWriteTime = Date.now()
      }
    }, 200)

    for (const group of plan) {
      const contextMessages = buildAgentMessages(messages, agentResults, latestFragment)
      const context: Record<string, any> = {
        supabase: supabaseContext,
        skills: detectedSkills && detectedSkills.length > 0 ? buildSkillPrompt(detectedSkills) : '',
      }

      const plannerResult = agentResults.find(r => r.role === 'planner')
      if (plannerResult) context.plan = plannerResult.output

      const architectResult = agentResults.find(r => r.role === 'architect')
      if (architectResult?.fragment) context.architecture = architectResult.fragment

      if (latestFragment.code) context.existingCode = latestFragment.code
      if (latestFragment.files?.length) context.files = latestFragment.files

      for (const role of group) {
        const agentName = AGENT_DISPLAY_NAMES[role]

        // Emit real status for agent start (no fake thinking)
        emitAction('status', `Running ${agentName}...`)

        // Emit file reads from context one by one with throttle
        if (latestFragment.files && latestFragment.files.length > 0) {
          emitAction('commentary', `Reading ${latestFragment.files.length} file${latestFragment.files.length === 1 ? '' : 's'}...`)
          const filesToRead = latestFragment.files.filter((f: any) => f?.path && !emittedFilePaths.has(`read:${f.path}`)).slice(0, 8)
          for (const file of filesToRead) {
            emittedFilePaths.add(`read:${file.path}`)
            await emitActionThrottled('file_read', file.path, undefined, 200)
          }
        }

        console.log(`[Agentic] Running ${agentName}...`)

        // Create event emitter for live streaming (with deduplication)
        const agentEmitter: AgentEventEmitter = {
          emitThinking: (content) => emitAction('thinking', content),
          emitFileRead: (path) => {
            if (!emittedFilePaths.has(`read:${path}`)) {
              emittedFilePaths.add(`read:${path}`)
              emitAction('file_read', path)
            }
          },
          emitFileWrite: (path, purpose) => {
            if (!emittedFilePaths.has(path)) {
              emittedFilePaths.add(path)
              // Throttle file writes to max 2 per second
              const now = Date.now()
              if (now - lastFileWriteTime > 500) {
                lastFileWriteTime = now
                emitAction('file_write', path, purpose)
              } else {
                // Queue for later emission
                pendingFileWrites.push({ path, purpose, emitAt: now + 500 })
              }
            }
          },
          emitWebSearch: (query) => emitAction('web_search', query),
          emitCommentary: (content) => emitAction('commentary_chunk', content),
        }

        const result = await runAgent({
          role,
          systemPrompt: '',
          messages: contextMessages,
          config: {
            model,
            config,
            messages: contextMessages,
            template,
            supabase: supabaseContext as any,
          },
          context,
          fallbackChain,
        }, undefined, agentEmitter)

        agentResults.push(result)
        completedAgents++

        // Emit progress
        emitProgress(completedAgents, totalSteps)

        // Emit real output from this agent
        if (result.success) {
          // Emit real commentary from the agent
          const agentCommentary = extractCommentary(result)
          if (agentCommentary) {
            emitAction('commentary', agentCommentary)
          }

          // Emit thinking from the agent's actual reasoning
          const thinkingText = extractThinking(result)
          if (thinkingText) {
            emitAction('thinking', thinkingText)
          }

          // Emit REAL file paths from the agent's fragment (deduplicated)
          // Distinguish edits from new writes based on whether the file already existed
          if (result.fragment) {
            const fragment = result.fragment as Record<string, any>
            const existingFiles = new Set((latestFragment.files || []).map((f: any) => f.path))
            if (Array.isArray(fragment.files)) {
              for (const file of fragment.files) {
                if (file?.path && !emittedFilePaths.has(file.path)) {
                  emittedFilePaths.add(file.path)
                  const isEdit = existingFiles.has(file.path)
                  emitAction(isEdit ? 'file_edit' : 'file_write', file.path, file.purpose || undefined)
                }
              }
            }
            // Also emit main file_path if no files array
            if (fragment.file_path && !fragment.files?.length && !emittedFilePaths.has(fragment.file_path)) {
              emittedFilePaths.add(fragment.file_path)
              const isEdit = existingFiles.has(fragment.file_path)
              emitAction(isEdit ? 'file_edit' : 'file_write', fragment.file_path)
            }
          }

          // Emit a commentary summary of what this agent did
          emitAction('commentary', `${agentName} completed — ${result.fragment ? `generated ${((result.fragment as any).files || []).length || 1} file(s)` : 'analysis done'}${result.duration ? ` in ${(result.duration / 1000).toFixed(1)}s` : ''}`)

          // Extract real todos from planner output
          if (role === 'planner' && result.output) {
            const realTodos = extractTodosFromPlan(result.output)
            if (realTodos.length > 0) {
              emitTodos(realTodos)
              // Store todos so we can mark them complete as agents finish
              currentTodos = realTodos
            }
          }

          // Mark the next incomplete todo as completed (sequential — agents run in order)
          if (currentTodos.length > 0) {
            const nextIncomplete = currentTodos.findIndex(t => !t.completed)
            if (nextIncomplete >= 0) {
              currentTodos[nextIncomplete] = { ...currentTodos[nextIncomplete], completed: true }
              emitTodos(currentTodos)
            }
          }

          // Emit completion status
          emitAction('status', `${AGENT_DISPLAY_NAMES[role]} completed${result.duration ? ` in ${(result.duration / 1000).toFixed(1)}s` : ''}`)
        } else {
          emitAction('status', `${AGENT_DISPLAY_NAMES[role]} failed: ${result.errors?.join(', ') || 'unknown error'}`)
        }

        // Merge agent output into the fragment
        if (result.success && result.fragment) {
          const fragment = result.fragment as Record<string, any>

          if (fragment.commentary) {
            latestFragment.commentary = `${latestFragment.commentary ? latestFragment.commentary + '\n\n' : ''}${AGENT_DISPLAY_NAMES[role]}: ${fragment.commentary}`
          }
          if (fragment.template && fragment.template !== 'default') {
            latestFragment.template = fragment.template
          }
          if (fragment.title) latestFragment.title = fragment.title
          if (fragment.description) latestFragment.description = fragment.description
          if (fragment.code) latestFragment.code = fragment.code
          if (fragment.file_path) latestFragment.file_path = fragment.file_path

          // Merge files
          if (Array.isArray(fragment.files) && fragment.files.length > 0) {
            const existingPaths = new Set(
              (latestFragment.files || []).map((f: any) => f.path)
            )
            for (const file of fragment.files) {
              if (!existingPaths.has(file.path)) {
                latestFragment.files = [...(latestFragment.files || []), file]
              } else {
                latestFragment.files = latestFragment.files.map((f: any) =>
                  f.path === file.path ? file : f
                )
              }
            }
          }

          // Merge dependencies
          if (Array.isArray(fragment.additional_dependencies)) {
            const existing = new Set(latestFragment.additional_dependencies || [])
            for (const dep of fragment.additional_dependencies) {
              existing.add(dep)
            }
            latestFragment.additional_dependencies = Array.from(existing)
            latestFragment.has_additional_dependencies = latestFragment.additional_dependencies.length > 0
          }

          if (fragment.install_dependencies_command) {
            latestFragment.install_dependencies_command = fragment.install_dependencies_command
          }
          if (fragment.port !== undefined && fragment.port !== null) {
            latestFragment.port = fragment.port
          }

          // Merge supabase migrations
          if (Array.isArray(fragment.supabase_migrations)) {
            latestFragment.supabase_migrations = [
              ...(latestFragment.supabase_migrations || []),
              ...fragment.supabase_migrations,
            ]
          }

          // Stream fragment update after each agent
          emitFragment(latestFragment)
        }
      }
    }

    // ── Step 3: Build final result ────────────────────────────
    const agentsUsed = agentResults.filter(r => r.success).map(r => r.role)
    const totalDuration = agentResults.reduce((sum, r) => sum + (r.duration || 0), 0)

    const finalFragment = {
      ...latestFragment,
      agent_metadata: {
        agents_used: agentsUsed,
        complexity,
        total_duration: totalDuration,
        agent_durations: Object.fromEntries(
          agentResults.map(r => [r.role, r.duration || 0])
        ),
      },
      commentary: latestFragment.commentary
        ? `Worked ${agentsUsed.length} steps\n\n${latestFragment.commentary}`
        : `Completed using ${agentsUsed.length} agents in ${(totalDuration / 1000).toFixed(1)}s.`,
    }

    // Flush any remaining pending file writes
    clearInterval(flushPendingWrites)
    while (pendingFileWrites.length > 0) {
      const pw = pendingFileWrites.shift()!
      emitAction('file_write', pw.path, pw.purpose)
    }

    emitAction('commentary', `Completed using ${agentsUsed.length} agents in ${(totalDuration / 1000).toFixed(1)}s.`)

    // Emit a completion status so the UI knows we're done
    emitAction('status', `Pipeline complete — ${agentsUsed.length} agents in ${(totalDuration / 1000).toFixed(1)}s`)

    // Emit final fragment
    emitFragment(finalFragment)
  } catch (error: any) {
    clearInterval(flushPendingWrites)
    console.error('[Agentic] Pipeline error:', error)
    emitError(error.message || 'Pipeline failed')

    // Fallback: try single-model generation
    try {
      const fallbackFragment = await generateFallback(
        messages, model, config, template, supabaseContext
      )
      emitFragment(fallbackFragment as Record<string, any>)
    } catch (fallbackError) {
      console.error('[Agentic] Fallback also failed:', fallbackError)
    }
  }
}

// ─── Extract real commentary from agent result ─────────────
function extractCommentary(result: AgentResult): string {
  // Use the agent's actual output/commentary, not hardcoded text
  const fragment = result.fragment as Record<string, any> | undefined
  if (fragment?.commentary) {
    // Clean up and truncate
    const text = fragment.commentary.replace(/\s+/g, ' ').trim()
    return text.length > 300 ? `${text.slice(0, 297)}...` : text
  }
  // Fallback to output text (first meaningful paragraph)
  if (result.output) {
    const firstParagraph = result.output.split('\n').find(l => l.trim().length > 20)
    if (firstParagraph) {
      const text = firstParagraph.replace(/\s+/g, ' ').trim()
      return text.length > 300 ? `${text.slice(0, 297)}...` : text
    }
  }
  return ''
}

// ─── Extract thinking/reasoning from agent output ──────────
function extractThinking(result: AgentResult): string {
  if (!result.output) return ''

  // Try to find natural language paragraphs that look like reasoning
  const lines = result.output.split('\n')
  const thinkingLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip JSON, code blocks, file paths, and short lines
    if (
      trimmed.length < 20 ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed.startsWith('"') ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('///') ||
      trimmed.match(/^[A-Z]:\\/)
    ) continue

    thinkingLines.push(trimmed)
    if (thinkingLines.length >= 3) break
  }

  if (thinkingLines.length === 0) return ''
  const thinking = thinkingLines.join(' ').replace(/\s+/g, ' ').trim()
  return thinking.length > 300 ? `${thinking.slice(0, 297)}...` : thinking
}

// ─── Extract real todos from planner output ─────────────────
function extractTodosFromPlan(output: string): { id: string; text: string; completed: boolean }[] {
  const todos: { id: string; text: string; completed: boolean }[] = []

  try {
    // Try to parse as JSON first (planner outputs JSON)
    const jsonMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : output
    const startIdx = jsonStr.indexOf('{')
    if (startIdx !== -1) {
      // Find matching closing brace
      let depth = 0, inStr = false, esc = false
      for (let i = startIdx; i < jsonStr.length; i++) {
        const c = jsonStr[i]
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
        if (c === '"') inStr = true
        else if (c === '{') depth++
        else if (c === '}') { depth--; if (depth === 0) {
          const parsed = JSON.parse(jsonStr.slice(startIdx, i + 1))
          // First, check for explicit todos array from planner
          if (Array.isArray(parsed.todos) && parsed.todos.length > 0) {
            for (const todo of parsed.todos.slice(0, 8)) {
              const text = todo.text || todo.description || todo
              if (typeof text === 'string' && text.length > 5) {
                todos.push({
                  id: `todo-${todos.length}`,
                  text: text.trim(),
                  completed: false,
                })
              }
            }
          }
          // If no explicit todos, extract from steps
          if (todos.length === 0 && Array.isArray(parsed.steps)) {
            for (const step of parsed.steps) {
              if (step.description) {
                todos.push({
                  id: `step-${step.step || todos.length}`,
                  text: step.description,
                  completed: false,
                })
              }
            }
          }
          // Also extract pages/components if still no todos
          if (todos.length === 0 && parsed.architecture) {
            if (Array.isArray(parsed.architecture.pages)) {
              for (const page of parsed.architecture.pages) {
                todos.push({
                  id: `page-${page}`,
                  text: `Create page: ${page}`,
                  completed: false,
                })
              }
            }
            if (Array.isArray(parsed.architecture.components)) {
              for (const comp of parsed.architecture.components) {
                todos.push({
                  id: `comp-${comp}`,
                  text: `Build component: ${comp}`,
                  completed: false,
                })
              }
            }
          }
          break
        }}
      }
    }
  } catch {
    // If JSON parsing fails, extract lines that look like tasks
    const lines = output.split('\n')
    for (const line of lines) {
      const trimmed = line.replace(/^[-*\d.]+\s*/, '').trim()
      if (trimmed.length > 10 && trimmed.length < 200 && (trimmed.includes('Create') || trimmed.includes('Build') || trimmed.includes('Add') || trimmed.includes('Implement') || trimmed.includes('Set up') || trimmed.includes('Configure'))) {
        todos.push({
          id: `task-${todos.length}`,
          text: trimmed,
          completed: false,
        })
      }
    }
  }

  return todos.slice(0, 15) // Limit to 15 todos
}

// ─── Generate real todos from user prompt using LLM ────────
async function generateTodosFromPrompt(
  messages: ModelMessage[],
  model: LLMModel,
  config: LLMModelConfig,
  agentsNeeded: AgentRole[],
): Promise<{ id: string; text: string; completed: boolean }[]> {
  try {
    const fallbackChain = getFallbackChain(model, config)
    if (fallbackChain.length === 0) {
      console.log('[Todos] No fallback chain, skipping')
      return []
    }
    const candidate = fallbackChain[0]
    const modelClient = getModelClient(candidate, config)
    const modelParams = { ...config }
    delete modelParams.model
    delete modelParams.apiKey
    delete modelParams.baseURL

    // Get the user's last message
    const userPrompt = messages.find(m => m.role === 'user')?.content || ''
    const promptText = typeof userPrompt === 'string' ? userPrompt : Array.isArray(userPrompt) ? userPrompt.map(p => p.type === 'text' ? p.text : '').join(' ') : ''
    if (!promptText.trim()) {
      console.log('[Todos] Empty prompt, skipping')
      return []
    }

    console.log(`[Todos] Generating todos for: ${promptText.slice(0, 100)}...`)

    const result = streamText({
      model: modelClient as any,
      system: `You are a task planner. Given a user request, generate a concise list of specific tasks to accomplish it.

Return ONLY a JSON array of objects with "text" fields. Each task should be specific and actionable.
Example: [{"text": "Create the landing page hero section"}, {"text": "Build the navigation bar"}]

Rules:
- 3-8 tasks max
- Each task must be specific to the user's request
- No generic tasks like "Review code" or "Plan approach"
- Focus on WHAT to build, not HOW
- Match the complexity: simple requests get fewer tasks, complex ones get more`,
      messages: [{ role: 'user', content: `Generate task list for: ${promptText.slice(0, 500)}` }],
      maxRetries: 0,
      ...modelParams,
    })

    const text = await readStream(result.textStream)
    console.log(`[Todos] Raw response length: ${text.length}`)
    const todos: { id: string; text: string; completed: boolean }[] = []

    // Parse JSON array from response
    const jsonMatch = text.match(/\[\s\S]*\]/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          for (const item of parsed.slice(0, 8)) {
            if (item.text && typeof item.text === 'string') {
              todos.push({
                id: `todo-${todos.length}`,
                text: item.text.trim(),
                completed: false,
              })
            }
          }
        }
      } catch (e) {
        console.error('[Todos] JSON parse failed:', e)
      }
    }

    console.log(`[Todos] Generated ${todos.length} todos:`, todos.map(t => t.text))
    return todos
  } catch (e) {
    console.error('[Todos] Generation failed:', e)
    // Fallback: generate simple todos from the prompt keywords
    const userPrompt = messages.find(m => m.role === 'user')?.content || ''
    const promptText = typeof userPrompt === 'string' ? userPrompt : Array.isArray(userPrompt) ? userPrompt.map(p => p.type === 'text' ? p.text : '').join(' ') : ''
    return generateFallbackTodos(promptText)
  }
}

// Fallback todos when LLM generation fails
function generateFallbackTodos(prompt: string): { id: string; text: string; completed: boolean }[] {
  const todos: { id: string; text: string; completed: boolean }[] = []
  const lower = prompt.toLowerCase()

  // Always start with planning
  todos.push({ id: 'todo-0', text: 'Analyze requirements and plan the approach', completed: false })

  // Extract what to build from the prompt
  if (lower.includes('landing page') || lower.includes('website') || lower.includes('portfolio')) {
    todos.push({ id: 'todo-1', text: 'Create the page layout and structure', completed: false })
    todos.push({ id: 'todo-2', text: 'Build the main content sections', completed: false })
    todos.push({ id: 'todo-3', text: 'Add styling and animations', completed: false })
    todos.push({ id: 'todo-4', text: 'Make it responsive for mobile', completed: false })
  } else if (lower.includes('app') || lower.includes('application')) {
    todos.push({ id: 'todo-1', text: 'Design the application architecture', completed: false })
    todos.push({ id: 'todo-2', text: 'Build the main UI components', completed: false })
    todos.push({ id: 'todo-3', text: 'Implement core functionality', completed: false })
    todos.push({ id: 'todo-4', text: 'Polish and optimize', completed: false })
  } else if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) {
    todos.push({ id: 'todo-1', text: 'Identify the root cause', completed: false })
    todos.push({ id: 'todo-2', text: 'Implement the fix', completed: false })
    todos.push({ id: 'todo-3', text: 'Verify the fix works', completed: false })
  } else {
    todos.push({ id: 'todo-1', text: 'Build the requested feature', completed: false })
    todos.push({ id: 'todo-2', text: 'Add proper styling and polish', completed: false })
    todos.push({ id: 'todo-3', text: 'Ensure quality and responsiveness', completed: false })
  }

  return todos
}

// ─── Analyze complexity ─────────────────────────────────────
async function analyzeComplexity(
  messages: ModelMessage[],
  model: LLMModel,
  config: LLMModelConfig,
): Promise<TaskComplexity> {
  try {
    const fallbackChain = getFallbackChain(model, config)
    if (fallbackChain.length === 0) return 'moderate'

    const candidate = fallbackChain[0]
    const modelClient = getModelClient(candidate, config)
    const useFallback = STREAM_TEXT_PROVIDER_IDS.has(candidate.providerId)

    const modelParams = { ...config }
    delete modelParams.model
    delete modelParams.apiKey
    delete modelParams.baseURL

    let text: string

    if (useFallback) {
      const result = streamText({
        model: modelClient as any,
        system: COMPLEXITY_ANALYSIS_PROMPT + '\n\nRespond with ONLY a valid JSON object.',
        messages,
        maxRetries: 0,
        ...modelParams,
      })
      text = await readStream(result.textStream)
    } else {
      const result = streamText({
        model: modelClient as LanguageModel,
        system: COMPLEXITY_ANALYSIS_PROMPT,
        messages,
        maxRetries: 0,
        ...modelParams,
      })
      text = await readStream(result.textStream)
    }

    const parsed = parseJson(text)
    const complexity = parsed?.complexity as TaskComplexity
    return ['simple', 'moderate', 'complex', 'enterprise'].includes(complexity)
      ? complexity
      : 'moderate'
  } catch {
    return 'moderate'
  }
}

// ─── Build messages for an agent group ──────────────────────
function buildAgentMessages(
  originalMessages: ModelMessage[],
  previousResults: AgentResult[],
  currentFragment: Record<string, any>,
): ModelMessage[] {
  const msgs: ModelMessage[] = [...originalMessages]

  if (previousResults.length > 0) {
    const parts: string[] = []

    const plannerResult = previousResults.find(r => r.role === 'planner')
    if (plannerResult?.output) {
      parts.push(`Planner's plan:\n${plannerResult.output.slice(0, 2000)}`)
    }

    const architectResult = previousResults.find(r => r.role === 'architect')
    if (architectResult?.output) {
      parts.push(`Architect's design:\n${architectResult.output.slice(0, 2000)}`)
    }

    if (parts.length > 0) {
      msgs.push({
        role: 'user',
        content: `Previous agent outputs:\n\n${parts.join('\n\n')}\n\nNow continue with your part of the implementation.`,
      })
    }
  }

  if (currentFragment.code || (currentFragment.files && currentFragment.files.length > 0)) {
    msgs.push({
      role: 'user',
      content: `Current project state:\n${currentFragment.title ? `Title: ${currentFragment.title}\n` : ''}${currentFragment.file_path ? `Main file: ${currentFragment.file_path}\n` : ''}${currentFragment.files?.length ? `Files: ${currentFragment.files.map((f: any) => f.path).join(', ')}\n` : ''}\nBuild upon this or create the next part.`,
    })
  }

  return msgs
}

// ─── Fallback single-model generation ──────────────────────
async function generateFallback(
  messages: ModelMessage[],
  model: LLMModel,
  config: LLMModelConfig,
  template: Templates,
  supabaseContext: PromptContext['supabase'],
): Promise<Record<string, any>> {
  const fallbackChain = getFallbackChain(model, config)
  const modelParams = { ...config }
  delete modelParams.model
  delete modelParams.apiKey
  delete modelParams.baseURL
  const systemPrompt = toPrompt(template, { supabase: supabaseContext })

  for (const candidate of fallbackChain) {
    try {
      const modelClient = getModelClient(candidate, config)
      const useFallback = STREAM_TEXT_PROVIDER_IDS.has(candidate.providerId)
      let text: string

      if (useFallback) {
        const result = streamText({
          model: modelClient as any,
          system: systemPrompt + '\n\nYou MUST respond with ONLY a valid JSON object.',
          messages,
          maxRetries: 0,
          ...modelParams,
        })
        text = await readStream(result.textStream)
      } else {
        const result = streamText({
          model: modelClient as LanguageModel,
          system: systemPrompt,
          messages,
          maxRetries: 0,
          ...modelParams,
        })
        text = await readStream(result.textStream)
      }

      const json = extractJson(text)
      if (json) {
        const parsed = JSON.parse(json)
        const result = schema.safeParse(parsed)
        if (result.success) return result.data as any
        return fillDefaults(parsed)
      }

      return {
        commentary: text.slice(0, 500),
        template: 'default',
        title: 'Generated',
        description: '',
        additional_dependencies: [],
        has_additional_dependencies: false,
        install_dependencies_command: '',
        port: null,
        file_path: 'src/App.tsx',
        code: text,
      }
    } catch (error) {
      continue
    }
  }

  throw new Error('All fallback models failed')
}

// ─── Helpers ────────────────────────────────────────────────
async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += value
    }
  } finally {
    reader.releaseLock()
  }
  return text
}

function parseJson(text: string): any {
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }
    const start = text.indexOf('{')
    if (start === -1) return null
    let depth = 0, inString = false, escaped = false
    for (let i = start; i < text.length; i++) {
      const char = text[i]
      if (inString) {
        if (escaped) { escaped = false }
        else if (char === '\\') { escaped = true }
        else if (char === '"') { inString = false }
        continue
      }
      if (char === '"') { inString = true }
      else if (char === '{') { depth++ }
      else if (char === '}') { depth--; if (depth === 0) return JSON.parse(text.slice(start, i + 1)) }
    }
    return null
  } catch { return null }
}

function extractJson(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim()
    const start = inner.indexOf('{')
    if (start !== -1) {
      const extracted = extractJsonObject(inner, start)
      if (extracted) return extracted
    }
  }
  const start = text.indexOf('{')
  if (start === -1) return null
  return extractJsonObject(text, start)
}

function extractJsonObject(text: string, start: number): string | null {
  let depth = 0, inString = false, escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) { escaped = false }
      else if (char === '\\') { escaped = true }
      else if (char === '"') { inString = false }
      continue
    }
    if (char === '"') { inString = true }
    else if (char === '{') { depth++ }
    else if (char === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

function fillDefaults(data: Record<string, any>) {
  return {
    commentary: typeof data.commentary === 'string' ? data.commentary : 'Building the requested feature',
    template: typeof data.template === 'string' ? data.template : 'default',
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    description: typeof data.description === 'string' ? data.description : '',
    additional_dependencies: Array.isArray(data.additional_dependencies) ? data.additional_dependencies : [],
    has_additional_dependencies: typeof data.has_additional_dependencies === 'boolean' ? data.has_additional_dependencies : false,
    install_dependencies_command: typeof data.install_dependencies_command === 'string' ? data.install_dependencies_command : '',
    port: data.port ?? null,
    file_path: typeof data.file_path === 'string' ? data.file_path : 'src/App.tsx',
    code: typeof data.code === 'string' ? data.code : '',
    files: Array.isArray(data.files) ? data.files : undefined,
    supabase_migrations: Array.isArray(data.supabase_migrations) ? data.supabase_migrations : undefined,
  }
}

// ─── Auto web search detection ─────────────────────────
function shouldAutoSearch(query: string): boolean {
  if (/^\[Search:/i.test(query)) return true
  if (/https?:\/\//.test(query)) return true
  // Questions
  const isQuestion = /^\b(what is|what are|who is|who are|when did|when was|where is|how do I find|tell me about|which|compare|best|recommended|popular)\b/i.test(query)
  if (isQuestion) return true
  if (/\b(what is the price|how much does|is .* down|is .* available|how do I|how to)\b/i.test(query)) return true
  // Search-related keywords
  if (/\b(search|find|look up|research|compare|alternative|vs\.?|versus|review)\b/i.test(query)) return true
  // Web/app building keywords — these benefit from seeing real examples
  if (/\b(landing page|website|blog|portfolio|resume|document|documentation|article|tutorial|guide|template|design|UI|UX|brand|logo|color scheme|web app|webpage|page|site|app|build|create|make|generate|write)\b/i.test(query)) return true
  // Time references
  const hasTimeRef = /\b(current|latest|today|yesterday|this week|right now|news|outage|down|2024|2025|2026)\b/i.test(query)
  if (hasTimeRef) return true
  return false
}

// ─── Agent detection from message prefix ─────────────────────
function detectAgentFromMessage(messages: ModelMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const agentMatch = content.match(/^\[Agent:\s*(\w+)\]/i)
    if (agentMatch) return agentMatch[1].toLowerCase()
    break
  }
  return null
}

// Strip agent/search/think/canvas prefixes from message content
function stripMessagePrefixes(content: string): string {
  return content
    .replace(/^\[Agent:\s*\w+\]\s*/i, '')
    .replace(/^\[Search:\s*[^\]]*\]\s*/i, '')
    .replace(/^\[Think:\s*[^\]]*\]\s*/i, '')
    .replace(/^\[Canvas:\s*[^\]]*\]\s*/i, '')
    .trim()
}

function detectAutoSearchQuery(messages: ModelMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const searchMatch = content.match(/^\[Search:\s*(.+?)\]\s*$/)
    if (searchMatch) return searchMatch[1]
    // Agent prefix handling
    const agentMatch = content.match(/^\[Agent:\s*(\w+)\]/i)
    if (agentMatch) {
      const agent = agentMatch[1].toLowerCase()
      const cleaned = content.replace(/^\[Agent:\s*\w+\]\s*/i, '').trim()
      // 'search' agent always triggers search
      if (agent === 'search') {
        return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
      }
      // Other agents: search if the prompt benefits from it
      if (cleaned && shouldAutoSearch(cleaned)) {
        return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
      }
    }
    // No agent prefix: strip other prefixes and check
    const cleaned = content.replace(/^\[\w+:\s*.+?\]\s*/, '').trim()
    if (!cleaned) continue
    if (!shouldAutoSearch(cleaned)) continue
    return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
  }
  return null
}

function stripAgentPrefix(text: string): string {
  return text.replace(/^\[Agent:\s*\w+\]\s*/, '').trim()
}

async function fetchWebSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  // Try self-hosted open-webSearch first (no API key needed)
  try {
    const owResults = await searchOpenWebSearch(query)
    if (owResults.length > 0) return owResults
  } catch {}
  // Fallback to other providers
  try {
    const exaResults = await searchExaDirect(query)
    if (exaResults.length > 0) return exaResults
    const braveResults = await searchBraveDirect(query)
    if (braveResults.length > 0) return braveResults
    const ddgResults = await searchDuckDuckGoDirect(query)
    return ddgResults
  } catch {
    return []
  }
}

// Direct search functions (imported from web-search route logic)
async function searchExaDirect(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) return []
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ query, type: 'neural', numResults: 5, contents: { text: { maxCharacters: 200 } } }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return []
    const data = await response.json()
    return (data.results || []).slice(0, 5).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.text || '',
    }))
  } catch { return [] }
}

async function searchBraveDirect(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) return []
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return []
    const data = await response.json()
    return (data.web?.results || []).slice(0, 5).map((r: any) => ({
      title: r.title || '', url: r.url || '', snippet: r.description || '',
    }))
  } catch { return [] }
}

async function searchDuckDuckGoDirect(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const formData = new URLSearchParams()
    formData.append('q', query)
    formData.append('kl', 'us-en')
    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      console.log(`[WebSearch/DDG] HTTP ${response.status}`)
      return []
    }
    const html = await response.text()
    console.log(`[WebSearch/DDG] Got ${html.length} bytes of HTML`)
    const results: { title: string; url: string; snippet: string }[] = []
    
    // Split by result blocks
    const resultBlocks = html.split(/class="result[ _](?:body|snippet)"/gi)
    for (let i = 1; i < resultBlocks.length && results.length < 5; i++) {
      const block = resultBlocks[i]
      const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)<\/a>/i)
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+)<\/a>/i)
      // Try uddg param for URL (DDG redirects through their own domain)
      const uddgMatch = block.match(/uddg=([^&"\s]+)/i)
      const urlMatch = block.match(/class="result__url"[^>]*>\s*([^<\s]+)/i)
      if (titleMatch) {
        let url = ''
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1])
        else if (urlMatch) {
          url = urlMatch[1].trim()
          if (!url.startsWith('http')) url = 'https://' + url
        }
        if (url && titleMatch[1].trim()) {
          results.push({
            title: titleMatch[1].trim(),
            url,
            snippet: snippetMatch ? snippetMatch[1].trim() : '',
          })
        }
      }
    }
    
    // Fallback: extract any result links if the above didn't work
    if (results.length === 0) {
      const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="result__a"[^>]*>([^<]+)<\/a>/gi
      let match
      while ((match = linkRegex.exec(html)) !== null && results.length < 5) {
        results.push({ title: match[2].trim(), url: match[1], snippet: '' })
      }
    }
    
    console.log(`[WebSearch/DDG] Parsed ${results.length} results`)
    return results
  } catch (e) {
    console.error('[WebSearch/DDG] Error:', e)
    return []
  }
}

// ─── Self-hosted open-webSearch MCP integration ──────────
// The hosted instance uses MCP SSE transport:
// 1. GET /sse → returns endpoint with sessionId
// 2. POST /messages?sessionId=... → sends JSON-RPC requests

let owSessionCache: { sessionId: string; expiresAt: number } | null = null

async function getOpenWebSearchSession(): Promise<string | null> {
  const baseUrl = process.env.OPEN_WEBSEARCH_URL
  if (!baseUrl) return null
  // Reuse cached session if still valid (5 min TTL)
  if (owSessionCache && Date.now() < owSessionCache.expiresAt) {
    return owSessionCache.sessionId
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/sse`, {
      headers: { 'Accept': 'text/event-stream' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    // Read the SSE stream to get the endpoint event
    const reader = res.body?.getReader()
    if (!reader) return null
    const decoder = new TextDecoder()
    let buffer = ''
    let sessionId = ''
    // Read until we get the endpoint event or timeout
    const readPromise = (async () => {
      const startTime = Date.now()
      while (Date.now() - startTime < 6000) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Parse SSE events
        const lines = buffer.split('\n')
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]
          if (line.startsWith('event: endpoint')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data: ')) {
              const endpoint = dataLine.slice(6).trim()
              // Extract sessionId from URL like /messages?sessionId=xxx
              const urlMatch = endpoint.match(/sessionId=([\w-]+)/)
              if (urlMatch) sessionId = urlMatch[1]
            }
          }
        }
        if (sessionId) break
      }
    })()
    await Promise.race([readPromise, new Promise(r => setTimeout(r, 7000))])
    reader.cancel().catch(() => {})
    if (sessionId) {
      owSessionCache = { sessionId, expiresAt: Date.now() + 5 * 60 * 1000 }
      console.log(`[OpenWebSearch] Got MCP session: ${sessionId.slice(0, 8)}...`)
    }
    return sessionId || null
  } catch (e) {
    console.warn('[OpenWebSearch] Failed to get session:', e)
    return null
  }
}

async function callOpenWebSearchMCP(method: string, params: Record<string, any>): Promise<any> {
  const baseUrl = process.env.OPEN_WEBSEARCH_URL
  if (!baseUrl) return null
  const sessionId = await getOpenWebSearchSession()
  if (!sessionId) return null
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: method, arguments: params },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      // Session might have expired — clear cache and retry once
      if (response.status === 400 || response.status === 403) {
        owSessionCache = null
      }
      return null
    }
    const data = await response.json()
    return data?.result || null
  } catch { return null }
}

async function searchOpenWebSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const result = await callOpenWebSearchMCP('search', { query, limit: 5 })
  if (!result) return []
  // MCP tool result format: { content: [{ type: 'text', text: '...' }] }
  let text = ''
  if (Array.isArray(result.content)) {
    text = result.content.map((c: any) => c.text || '').join('')
  } else if (typeof result === 'string') {
    text = result
  }
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    const results = Array.isArray(parsed) ? parsed : parsed.results || parsed.data || []
    return results.slice(0, 5).map((r: any) => ({
      title: r.title || '',
      url: r.url || r.link || '',
      snippet: r.description || r.snippet || r.text || '',
    }))
  } catch {
    // If not JSON, try to extract URLs from text
    const urls = text.match(/https?:\/\/[^\s"']+/g) || []
    return urls.slice(0, 5).map((url: string) => ({ title: url, url, snippet: '' }))
  }
}

async function fetchOpenWebSearchUrl(url: string): Promise<{ url: string; title: string; content: string } | null> {
  const result = await callOpenWebSearchMCP('fetchWebContent', { url, maxChars: 30000 })
  if (!result) return null
  let text = ''
  if (Array.isArray(result.content)) {
    text = result.content.map((c: any) => c.text || '').join('')
  } else if (typeof result === 'string') {
    text = result
  }
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return { url, title: parsed.title || url, content: parsed.content || parsed.text || text }
  } catch {
    return { url, title: url, content: text }
  }
}

// ─── URL auto-fetch ────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>")\]]+/gi

function extractUrlsFromMessages(messages: ModelMessage[]): string[] {
  const urls: string[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const found = content.match(URL_REGEX) || []
    for (const url of found) {
      const clean = url.replace(/[.,;:!?\)]+$/, '')
      if (!urls.includes(clean)) urls.push(clean)
    }
    break
  }
  return urls
}

async function fetchSingleUrl(url: string): Promise<{ url: string; title: string; content: string } | null> {
  // Try self-hosted open-webSearch first
  try {
    const owResult = await fetchOpenWebSearchUrl(url)
    if (owResult && owResult.content) return owResult
  } catch {}
  // Fallback to built-in web-fetch
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/web-fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.success) return null
    return data
  } catch {
    return null
  }
}

async function fetchUrlsFromMessages(messages: ModelMessage[]): Promise<{ url: string; title: string; content: string }[]> {
  const urls = extractUrlsFromMessages(messages)
  if (urls.length === 0) return []
  const results = await Promise.all(urls.slice(0, 3).map(fetchSingleUrl))
  return results.filter((r): r is NonNullable<typeof r> => r !== null)
}
