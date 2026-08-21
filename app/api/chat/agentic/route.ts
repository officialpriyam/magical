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
import {
  getFallbackChain as getChain,
  getModelClient as getClient,
} from '@/lib/models'
import {
  streamObject,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from 'ai'
import {
  AgentRole,
  AgentResult,
  AgentStatus,
  TaskComplexity,
} from '@/lib/agents/types'
import {
  COMPLEXITY_ANALYSIS_PROMPT,
  AGENT_DISPLAY_NAMES,
  AGENT_STATUS_MESSAGES,
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
  moderate: [['planner'], ['architect'], ['frontend'], ['reviewer']],
  complex: [['planner'], ['architect'], ['frontend', 'backend'], ['reviewer'], ['optimizer']],
  enterprise: [['planner'], ['architect'], ['frontend', 'backend'], ['reviewer'], ['optimizer'], ['reviewer']],
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

  const modelParams = { ...config }
  delete modelParams.model
  delete modelParams.apiKey
  delete modelParams.baseURL

  // ─── Streaming response ────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send a partial fragment update in the AI SDK streaming format
      // useObject expects: 0:{json}\n for each partial update
      const sendFragment = (fragment: Record<string, any>) => {
        try {
          const json = JSON.stringify(fragment)
          controller.enqueue(encoder.encode(`0:${json}\n`))
        } catch {}
      }

      // Helper to build the commentary for each agent step
      const buildCommentary = (activeRole: AgentRole, extra?: string) => {
        const name = AGENT_DISPLAY_NAMES[activeRole] || activeRole
        const label = extra || AGENT_STATUS_MESSAGES[activeRole]?.generating || 'working...'
        return `${name}: ${label}`
      }

      try {
        // ── Step 1: Analyze complexity ───────────────────────
        sendFragment({
          commentary: 'Analyzing your request to determine the best approach...',
          template: 'default',
          title: 'Planning',
          description: 'Determining task complexity and agent allocation',
          additional_dependencies: [],
          has_additional_dependencies: false,
          install_dependencies_command: '',
          port: null,
          file_path: '',
          code: '',
          files: [],
        })

        const complexity = await analyzeComplexity(messages, model, config)

        sendFragment({
          commentary: `Task complexity: ${complexity}. Dispatching ${EXECUTION_PLANS[complexity].length} agents...`,
          template: 'default',
          title: 'Planning',
          description: `Using ${complexity} pipeline with ${EXECUTION_PLANS[complexity].length} agents`,
          additional_dependencies: [],
          has_additional_dependencies: false,
          install_dependencies_command: '',
          port: null,
          file_path: '',
          code: '',
          files: [],
        })

        // ── Step 2: Run agents ──────────────────────────────
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

        for (const group of plan) {
          // Build messages for this agent group
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

          // Run agents in this group
          for (const role of group) {
            // Send "starting" commentary
            sendFragment({
              ...latestFragment,
              commentary: buildCommentary(role, 'starting...'),
            })

            const agentInput = {
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
            }

            const result = await runAgent(agentInput, (status) => {
              // Send live status updates as agents progress
              sendFragment({
                ...latestFragment,
                commentary: buildCommentary(role, status.message),
              })
            })

            agentResults.push(result)

            // Merge agent output into the fragment
            if (result.success && result.fragment) {
              const fragment = result.fragment as Record<string, any>

              // Update commentary
              if (fragment.commentary) {
                latestFragment.commentary = `${AGENT_DISPLAY_NAMES[role]}: ${fragment.commentary}`
              }

              // Update template
              if (fragment.template && fragment.template !== 'default') {
                latestFragment.template = fragment.template
              }

              // Update title/description
              if (fragment.title) latestFragment.title = fragment.title
              if (fragment.description) latestFragment.description = fragment.description

              // Update code and file_path
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
                    // Update existing file
                    latestFragment.files = latestFragment.files.map((f: any) =>
                      f.path === file.path ? file : f
                    )
                  }
                }
              }

              // Update dependencies
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

              // Send the updated fragment
              sendFragment({ ...latestFragment })
            }
          }
        }

        // ── Step 3: Send final result ────────────────────────
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
          commentary: `Completed using ${agentsUsed.length} agents in ${(totalDuration / 1000).toFixed(1)}s. ${latestFragment.commentary}`,
        }

        sendFragment(finalFragment)
        controller.close()
      } catch (error: any) {
        console.error('[Agentic] Streaming error:', error)

        // Send error state
        sendFragment({
          commentary: `Error: ${error?.message || 'Agentic generation failed'}. Falling back...`,
          template: 'default',
          title: 'Error',
          description: 'Agentic pipeline failed',
          additional_dependencies: [],
          has_additional_dependencies: false,
          install_dependencies_command: '',
          port: null,
          file_path: 'src/App.tsx',
          code: '',
          files: [],
        })

        // Fallback: try single-model generation
        try {
          const fallbackFragment = await generateFallback(
            messages, model, config, template, supabaseContext
          )
          sendFragment(fallbackFragment)
        } catch (fallbackError) {
          console.error('[Agentic] Fallback also failed:', fallbackError)
        }

        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
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
