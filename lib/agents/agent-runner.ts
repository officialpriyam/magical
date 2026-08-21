import {
  AgentInput,
  AgentResult,
  AgentRole,
  AgentStatus,
} from './types'
import {
  getAgentPrompt,
  AGENT_DISPLAY_NAMES,
  AGENT_STATUS_MESSAGES,
} from './prompts'
import {
  getModelClient,
  getFallbackChain,
} from '@/lib/models'
import { fragmentSchema as schema } from '@/lib/schema'
import { streamObject, streamText, type LanguageModel } from 'ai'
import { toPrompt, PromptContext } from '@/lib/prompt'
import { Templates } from '@/lib/templates'

const STREAM_TEXT_PROVIDER_IDS = new Set([
  'orcarouter',
  'requesty',
  'llm_gateway',
  'deepseek',
  'nvidia',
])

// ─── Status Callback Type ───────────────────────────────────────
export type StatusCallback = (status: AgentStatus) => void

// ─── Run a single agent ────────────────────────────────────────
export async function runAgent(
  input: AgentInput,
  onStatus?: StatusCallback,
): Promise<AgentResult> {
  const startTime = Date.now()
  const { role, config, fallbackChain, context } = input

  onStatus?.({
    role,
    phase: 'starting',
    message: AGENT_STATUS_MESSAGES[role]?.starting || `${AGENT_DISPLAY_NAMES[role]} starting...`,
  })

  // Build system prompt
  const systemPrompt = getAgentPrompt(role, context)

  // Build the full system prompt with project context
  const supabaseContext: PromptContext['supabase'] = config.supabase as PromptContext['supabase'] || { connected: false }
  const basePrompt = config.template
    ? toPrompt(config.template as Templates, { supabase: supabaseContext })
    : ''

  const fullSystemPrompt = basePrompt
    ? `${basePrompt}\n\n${systemPrompt}`
    : systemPrompt

  const modelParams = { ...config.config }
  delete modelParams.model
  delete modelParams.apiKey
  delete modelParams.baseURL

  let lastError: any = null

  for (const candidate of fallbackChain) {
    try {
      onStatus?.({
        role,
        phase: 'thinking',
        message: AGENT_STATUS_MESSAGES[role]?.thinking || `${AGENT_DISPLAY_NAMES[role]} thinking...`,
      })

      const modelClient = getModelClient(candidate, config.config)
      const useFallback = STREAM_TEXT_PROVIDER_IDS.has(candidate.providerId)

      let text: string

      if (useFallback) {
        const result = streamText({
          model: modelClient as any,
          system: fullSystemPrompt + '\n\nYou MUST respond with ONLY a valid JSON object. No markdown, no explanation.',
          messages: input.messages,
          maxRetries: 0,
          ...modelParams,
        })

        text = await readStreamToText(result.textStream)
      } else {
        onStatus?.({
          role,
          phase: 'generating',
          message: AGENT_STATUS_MESSAGES[role]?.generating || `${AGENT_DISPLAY_NAMES[role]} generating...`,
        })

        const result = streamObject({
          model: modelClient as LanguageModel,
          schema,
          system: fullSystemPrompt,
          messages: input.messages,
          maxRetries: 0,
          ...modelParams,
        })

        text = await readStreamToText(result.textStream)
      }

      // Parse the response
      const parsed = parseAgentResponse(text, role)

      onStatus?.({
        role,
        phase: 'completed',
        message: AGENT_STATUS_MESSAGES[role]?.completed || `${AGENT_DISPLAY_NAMES[role]} completed!`,
      })

      return {
        role,
        success: true,
        output: text,
        fragment: parsed.fragment,
        duration: Date.now() - startTime,
      }
    } catch (error: any) {
      lastError = error
      console.error(`Agent ${role} failed with model ${candidate.id}:`, error?.message)
      continue
    }
  }

  onStatus?.({
    role,
    phase: 'error',
    message: AGENT_STATUS_MESSAGES[role]?.error || `${AGENT_DISPLAY_NAMES[role]} failed`,
  })

  return {
    role,
    success: false,
    output: '',
    errors: [lastError?.message || 'Unknown error'],
    duration: Date.now() - startTime,
  }
}

// ─── Run multiple agents in parallel ────────────────────────────
export async function runAgentsParallel(
  agents: AgentInput[],
  onStatus?: StatusCallback,
): Promise<AgentResult[]> {
  return Promise.all(
    agents.map((agent) => runAgent(agent, onStatus))
  )
}

// ─── Run multiple agents sequentially ───────────────────────────
export async function runAgentsSequential(
  agents: AgentInput[],
  onStatus?: StatusCallback,
): Promise<AgentResult[]> {
  const results: AgentResult[] = []

  for (const agent of agents) {
    const result = await runAgent(agent, onStatus)
    results.push(result)

    // If a critical agent fails, stop the chain
    if (!result.success && (agent.role === 'planner' || agent.role === 'architect')) {
      break
    }
  }

  return results
}

// ─── Helpers ────────────────────────────────────────────────────
async function readStreamToText(stream: ReadableStream<string>): Promise<string> {
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

function parseAgentResponse(text: string, role: AgentRole): { fragment?: any } {
  try {
    const json = extractJson(text)
    if (!json) return {}

    const parsed = JSON.parse(json)

    // For reviewer, parse differently
    if (role === 'reviewer') {
      return { fragment: parsed }
    }

    // Validate against fragment schema
    const result = schema.safeParse(parsed)
    if (result.success) {
      return { fragment: result.data }
    }

    // Try to fill missing fields
    const filledData = fillFragmentDefaults(parsed)
    return { fragment: filledData }
  } catch {
    return {}
  }
}

function extractJson(text: string): string | null {
  // Try code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim()
    const start = inner.indexOf('{')
    if (start !== -1) {
      const extracted = extractJsonObject(inner, start)
      if (extracted) return extracted
    }
  }

  // Direct extraction
  const start = text.indexOf('{')
  if (start === -1) return null

  return extractJsonObject(text, start)
}

function extractJsonObject(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

function fillFragmentDefaults(data: Record<string, any>) {
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
