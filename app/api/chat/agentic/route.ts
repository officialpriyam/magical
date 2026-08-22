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

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })

  function emit(event: Record<string, any>) {
    if (!controller) return
    try {
      controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
    } catch {
      // Stream may be closed
    }
  }

  function emitAction(actionType: string, content: string, detail?: string) {
    emit({ type: 'action', action_type: actionType, content, detail })
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
    if (controller) {
      try { controller.close() } catch {}
      controller = null
    }
  }

  return { stream, emit, emitAction, emitTodos, emitProgress, emitFragment, emitError, close }
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

  // Auto web search: detect if the query needs up-to-date information
  const autoSearchQuery = detectAutoSearchQuery(messages)
  let enrichedMessages = [...messages]
  if (autoSearchQuery) {
    try {
      const searchResults = await fetchWebSearch(autoSearchQuery)
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
    } catch {
      // Web search failed, continue without it
    }
  }

  // Auto-fetch URLs from user messages
  const fetchedUrls = await fetchUrlsFromMessages(messages)
  if (fetchedUrls.length > 0) {
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

  const { stream, emitAction, emitTodos, emitProgress, emitFragment, emitError, close } = createSSEStream()

  // Run the pipeline in background and stream events
  const pipelinePromise = runPipeline({
    messages: enrichedMessages,
    model,
    config,
    template,
    supabaseContext,
    fallbackChain,
    emitAction,
    emitTodos,
    emitProgress,
    emitFragment,
    emitError,
  }).finally(close)

  // Don't await — return the stream immediately
  void pipelinePromise

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
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
  emitAction,
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
  emitAction: (type: string, content: string, detail?: string) => void
  emitTodos: (todos: { id: string; text: string; completed: boolean }[]) => void
  emitProgress: (completed: number, total: number) => void
  emitFragment: (data: Record<string, any>) => void
  emitError: (message: string) => void
}) {
  try {
    // ── Step 1: Analyze complexity ────────────────────────────
    emitAction('thinking', 'Analyzing your request to determine the best approach...')

    const complexity = await analyzeComplexity(messages, model, config)
    const agentsNeeded = EXECUTION_PLANS[complexity]
    const totalSteps = agentsNeeded.length

    console.log(`[Agentic] Complexity: ${complexity}, Agents: ${agentsNeeded.length}`)

    emitAction('commentary', `Task complexity: ${complexity}. Dispatching ${agentsNeeded.length} agents...`)
    emitProgress(0, totalSteps)

    // No initial todos — real tasks will be emitted from agent output

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

    for (const group of plan) {
      const contextMessages = buildAgentMessages(messages, agentResults, latestFragment)
      const context: Record<string, any> = {
        supabase: supabaseContext,
      }

      const plannerResult = agentResults.find(r => r.role === 'planner')
      if (plannerResult) context.plan = plannerResult.output

      const architectResult = agentResults.find(r => r.role === 'architect')
      if (architectResult?.fragment) context.architecture = architectResult.fragment

      if (latestFragment.code) context.existingCode = latestFragment.code
      if (latestFragment.files?.length) context.files = latestFragment.files

      for (const role of group) {
        // Emit real thinking action for agent start
        emitAction('thinking', `${AGENT_DISPLAY_NAMES[role]}: Analyzing and generating...`)
        emitAction('status', `Running ${AGENT_DISPLAY_NAMES[role]}...`)

        console.log(`[Agentic] Running ${AGENT_DISPLAY_NAMES[role]}...`)

        // Create event emitter for live streaming
        const agentEmitter: AgentEventEmitter = {
          emitThinking: (content) => emitAction('thinking', content),
          emitFileRead: (path) => emitAction('file_read', `Reading ${path}`),
          emitFileWrite: (path, purpose) => emitAction('file_write', `Writing ${path}`, purpose),
          emitWebSearch: (query) => emitAction('web_search', `Searching ${query}`),
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

          // Emit REAL file paths from the agent's fragment
          if (result.fragment) {
            const fragment = result.fragment as Record<string, any>
            if (Array.isArray(fragment.files)) {
              for (const file of fragment.files) {
                if (file?.path) {
                  emitAction('file_write', file.path, file.purpose || undefined)
                }
              }
            }
            // Also emit main file_path if no files array
            if (fragment.file_path && (!fragment.files || fragment.files.length === 0)) {
              emitAction('file_write', fragment.file_path)
            }
          }

          // Extract real todos from planner output
          if (role === 'planner' && result.output) {
            const realTodos = extractTodosFromPlan(result.output)
            if (realTodos.length > 0) {
              emitTodos(realTodos)
            }
          }

          // Emit thinking with real agent summary
          emitAction('thinking', `${AGENT_DISPLAY_NAMES[role]} completed — ${result.fragment ? 'generated code' : 'analysis done'}${result.duration ? ` in ${(result.duration / 1000).toFixed(1)}s` : ''}`)
        } else {
          emitAction('thinking', `${AGENT_DISPLAY_NAMES[role]} failed: ${result.errors?.join(', ') || 'unknown error'}`)
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

    emitAction('commentary', `Completed using ${agentsUsed.length} agents in ${(totalDuration / 1000).toFixed(1)}s.`)

    // Mark all real todos as completed (from planner output)
    // Emit a completion action so the UI knows we're done
    emitAction('thinking', `Pipeline complete — ${agentsUsed.length} agents in ${(totalDuration / 1000).toFixed(1)}s`)

    // Emit final fragment
    emitFragment(finalFragment)
  } catch (error: any) {
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
          // Extract steps from the plan
          if (Array.isArray(parsed.steps)) {
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
          // Also extract pages/components if present
          if (parsed.architecture) {
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

// ─── Auto web search detection ─────────────────────────────
const WEB_SEARCH_SIGNALS = [
  /\b(current|latest|newest|recent|today|yesterday|this week|this month|this year|right now|now)\b/i,
  /\b(version|release|update|changelog|breaking change)\s+(\d|v)/i,
  /\b(what is|what are|who is|who are|how much|how many|when did|when was|where is)\b/i,
  /\b(news|announcement|release|launch|outage|incident|status)\b/i,
  /\b(price|pricing|cost|subscription|plan|free tier|rate limit|quota)\b/i,
  /\b(documentation|docs|api|endpoint|sdk|library|framework|package)\b.*\b(latest|current|new|version|install)\b/i,
  /\b(202[4-9]|203[0-9])\b/,
  /\b(compare|vs|versus|alternative|better than|replaced by)\b/i,
  /\b(weather|stock|price|exchange rate|live|real.?time)\b/i,
]

const SEARCH_SKIP_PATTERNS = [
  /\b(build|create|generate|make|code|write|implement|design|style)\b/i,
  /^\[Search:/,
  /^\[Think:/,
  /^\[Canvas:/,
]

function detectAutoSearchQuery(messages: ModelMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const cleaned = content.replace(/^\[\w+:\s*.+?\]\s*/, '').trim()
    if (!cleaned) continue
    if (SEARCH_SKIP_PATTERNS.some(p => p.test(cleaned))) return null
    if (WEB_SEARCH_SIGNALS.some(p => p.test(cleaned))) {
      return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
    }
    break
  }
  return null
}

async function fetchWebSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch {
    return []
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
