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
import { runAgent } from '@/lib/agents/agent-runner'

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

const AGENT_TOOL_DESCRIPTIONS: Record<AgentRole, { action_type: string; content: string; detail?: string }[]> = {
  orchestrator: [
    { action_type: 'thinking', content: 'Analyzing request complexity...' },
  ],
  planner: [
    { action_type: 'thinking', content: 'Creating implementation plan...' },
    { action_type: 'todo', content: 'Map file structure and component hierarchy' },
  ],
  architect: [
    { action_type: 'thinking', content: 'Designing project architecture...' },
    { action_type: 'todo', content: 'Design data flow and state management' },
  ],
  frontend: [
    { action_type: 'todo', content: 'Build UI components' },
    { action_type: 'file_write', content: 'Writing UI components...' },
  ],
  backend: [
    { action_type: 'todo', content: 'Build API routes and data layer' },
    { action_type: 'file_write', content: 'Writing API routes...' },
  ],
  reviewer: [
    { action_type: 'thinking', content: 'Reviewing code quality...' },
  ],
  optimizer: [
    { action_type: 'thinking', content: 'Optimizing performance...' },
  ],
  fixer: [
    { action_type: 'thinking', content: 'Fixing issues...' },
  ],
}

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

  const { stream, emitAction, emitTodos, emitProgress, emitFragment, emitError, close } = createSSEStream()

  // Run the pipeline in background and stream events
  const pipelinePromise = runPipeline({
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

    // Build initial todo list from agent plan
    const initialTodos = agentsNeeded.map((role, i) => ({
      id: `agent-${i}-${role}`,
      text: AGENT_DISPLAY_NAMES[role],
      completed: false,
    }))
    emitTodos(initialTodos)

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
        // Emit agent start action
        const agentDesc = AGENT_TOOL_DESCRIPTIONS[role] || []
        for (const desc of agentDesc) {
          emitAction(desc.action_type, desc.content, desc.detail)
        }

        emitAction('status', `Running ${AGENT_DISPLAY_NAMES[role]}...`)

        console.log(`[Agentic] Running ${AGENT_DISPLAY_NAMES[role]}...`)
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
        })

        agentResults.push(result)
        completedAgents++

        // Emit progress
        emitProgress(completedAgents, totalSteps)

        // Mark this agent's todo as completed
        const updatedTodos = agentsNeeded.map((r, i) => ({
          id: `agent-${i}-${r}`,
          text: AGENT_DISPLAY_NAMES[r],
          completed: agentResults.some(ar => ar.role === r && ar.success),
        }))
        emitTodos(updatedTodos)

        // Emit agent completion
        if (result.success) {
          emitAction('commentary', `${AGENT_DISPLAY_NAMES[role]} completed`)

          // Emit file actions for any files this agent created
          if (result.fragment) {
            const fragment = result.fragment as Record<string, any>
            if (Array.isArray(fragment.files)) {
              for (const file of fragment.files) {
                if (file?.path) {
                  emitAction('file_write', `Writing ${file.path}...`)
                }
              }
            }
          }
        } else {
          emitAction('thinking', `${AGENT_DISPLAY_NAMES[role]} encountered an issue: ${result.errors?.join(', ') || 'unknown error'}`)
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

    // Mark all todos as completed
    const finalTodos = agentsNeeded.map((r, i) => ({
      id: `agent-${i}-${r}`,
      text: AGENT_DISPLAY_NAMES[r],
      completed: true,
    }))
    emitTodos(finalTodos)

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
