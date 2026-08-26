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
import { streamObject, streamText, isStepCount, type LanguageModel } from 'ai'
import { agentTools } from './tools'
import { toPrompt, PromptContext } from '@/lib/prompt'
import { Templates } from '@/lib/templates'

// Providers that support streamObject (structured JSON output) reliably
// All others default to streamText (plain text with JSON parsing)
const STREAM_OBJECT_PROVIDER_IDS = new Set([
  'openai',
  'anthropic',
])
// Convenience: everything else uses streamText as fallback
const STREAM_TEXT_PROVIDER_IDS = new Set([
  'orcarouter', 'requesty', 'llm_gateway', 'deepseek', 'nvidia',
  'openrouter', 'google', 'vertex', 'mistral', 'groq', 'fireworks',
  'togetherai', 'xai', 'ollama',
])

// ─── Status Callback Type ───────────────────────────────────────
export type StatusCallback = (status: AgentStatus) => void

// ─── Event Emitter Type (for live streaming) ─────────────────────
export type AgentEventEmitter = {
  emitThinking: (content: string) => void
  emitFileRead: (path: string) => void
  emitFileWrite: (path: string, purpose?: string) => void
  emitCommand: (command: string, detail?: string) => void
  emitWebSearch: (query: string) => void
  emitCommentary: (content: string) => void
}

// ─── Run a single agent ────────────────────────────────────────
export async function runAgent(
  input: AgentInput,
  onStatus?: StatusCallback,
  eventEmitter?: AgentEventEmitter,
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

      const agentAbort = AbortSignal.timeout(120000) // 120s timeout per agent
      if (useFallback) {
        const result = streamText({
          model: modelClient as any,
          system: fullSystemPrompt + '\n\nYou MUST respond with ONLY a valid JSON object. No markdown, no explanation.',
          messages: input.messages,
          tools: agentTools,
          stopWhen: isStepCount(10),
          maxRetries: 0,
          abortSignal: agentAbort,
          ...modelParams,
        })

        text = await readStreamWithEvents(result.textStream, eventEmitter, role)
        // Process tool invocations from the stream
        try {
          const toolCalls = await result.toolCalls
          for (const tc of toolCalls) {
            if (eventEmitter && 'input' in tc) {
              const input = tc.input as any
              if (tc.toolName === 'read_file') eventEmitter.emitFileRead(input.path)
              if (tc.toolName === 'create_file') eventEmitter.emitFileWrite(input.path, 'Created')
              if (tc.toolName === 'edit_file') eventEmitter.emitFileWrite(input.path, 'Edited')
              if (tc.toolName === 'run_command') eventEmitter.emitCommand(input.command)
            }
          }
        } catch {
          // Tool calls may not be available for all providers
        }
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
          abortSignal: agentAbort,
          ...modelParams,
        })

        text = await readStreamWithEvents(result.textStream, eventEmitter, role)
      }

      // Parse the response
      const parsed = parseAgentResponse(text, role)

      // Check if we got meaningful output
      const hasFragment = parsed.fragment && (
        (parsed.fragment.files && parsed.fragment.files.length > 0) ||
        (typeof parsed.fragment.code === 'string' && parsed.fragment.code.length > 10)
      )

      if (!hasFragment && (!text || text.length < 20)) {
        console.warn(`[Agent] ${role} from ${candidate.id}: empty response (${text.length} chars)`)
        lastError = new Error(`Empty response from ${candidate.id}`)
        continue
      }

      console.log(`[Agent] ${role} from ${candidate.id}: success (${text.length} chars, fragment: ${hasFragment ? 'yes' : 'no'})`)

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

  console.error(`[Agent] ${AGENT_DISPLAY_NAMES[role]} FAILED after ${fallbackChain.length} model(s). Last error:`, lastError?.message)

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

// Read stream and emit live events as patterns are detected in the text
async function readStreamWithEvents(
  stream: ReadableStream<string>,
  emitter?: AgentEventEmitter,
  role?: AgentRole,
): Promise<string> {
  if (!emitter) return readStreamToText(stream)

  const reader = stream.getReader()
  let text = ''
  let lastEmitTime = Date.now()
  let lastCommentaryEmitLen = 0
  let thinkingEmittedCount = 0
  const emittedThinkingTexts = new Set<string>()
  const EMIT_INTERVAL = 250 // Emit commentary every 250ms for live streaming feel

  // Track commentary extraction state across chunks
  // For streamObject: track position inside the "commentary" JSON field
  let commentaryStartIdx = -1 // Index in `text` where commentary value starts
  let commentaryFieldFound = false

  // For streamText: track last emitted line
  let lastEmittedLine = ''

  // Track what we've already emitted to avoid duplicates
  const emittedPaths = new Set<string>()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += value

      const now = Date.now()
      if (now - lastEmitTime > EMIT_INTERVAL && text.length > 10) {
        // ── streamObject path: extract commentary from JSON field ──
        if (!commentaryFieldFound) {
          // Look for the start of the "commentary" field in the accumulated text
          const fieldMatch = text.match(/"commentary"\s*:\s*"/)
          if (fieldMatch) {
            commentaryFieldFound = true
            commentaryStartIdx = text.indexOf('"commentary"') + fieldMatch[0].length
          }
        }

        if (commentaryFieldFound && commentaryStartIdx >= 0) {
          // Extract commentary text from after the opening quote to the current position
          const raw = text.slice(commentaryStartIdx)
          // Find the closing quote (accounting for escapes)
          let endIdx = -1
          let escaped = false
          for (let i = 0; i < raw.length; i++) {
            if (escaped) { escaped = false; continue }
            if (raw[i] === '\\') { escaped = true; continue }
            if (raw[i] === '"') { endIdx = i; break }
          }
          const commentaryText = endIdx >= 0 ? raw.slice(0, endIdx) : raw
          // Decode JSON escapes
          const decoded = commentaryText
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim()

          if (decoded.length > lastCommentaryEmitLen && decoded.length > 5) {
            emitter.emitCommentary(decoded.slice(0, 600))
            lastCommentaryEmitLen = decoded.length
          }

          // If we found the closing quote, stop looking
          if (endIdx >= 0) {
            commentaryFieldFound = false
          }
        }

        // ── streamText path: emit meaningful lines as commentary chunks ──
        if (!commentaryFieldFound && lastCommentaryEmitLen === 0) {
          const lines = text.split('\n').filter(l => l.trim().length > 10)
          const lastLine = lines[lines.length - 1]
          if (lastLine && !lastLine.startsWith('{') && !lastLine.startsWith('"') && lastLine !== lastEmittedLine) {
            const trimmed = lastLine.trim()
            emitter.emitCommentary(trimmed.slice(0, 400))
            lastEmittedLine = lastLine
          }
        }

        // ── Emit real thinking from the stream ──
        // For streamObject: extract reasoning from commentary field
        // For streamText: extract natural language paragraphs
        // Emit up to 3 thinking entries per agent (enough for real reasoning)
        if (thinkingEmittedCount < 3 && text.length > 50) {
          // For streamObject: emit commentary text as thinking (it IS the reasoning)
          if (commentaryFieldFound && commentaryStartIdx >= 0 && commentaryStartIdx < text.length) {
            const raw = text.slice(commentaryStartIdx)
            let endIdx = -1
            let escaped = false
            for (let i = 0; i < Math.min(raw.length, 600); i++) {
              if (escaped) { escaped = false; continue }
              if (raw[i] === '\\') { escaped = true; continue }
              if (raw[i] === '"') { endIdx = i; break }
            }
            const commentaryText = (endIdx >= 0 ? raw.slice(0, endIdx) : raw.slice(0, 800))
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .trim()
            if (commentaryText.length > 30) {
              // Split into paragraphs and emit each as a thinking block
              const paragraphs = commentaryText.split(/\n\n+/).filter(p => p.trim().length > 20)
              for (const para of paragraphs) {
                const clean = para.replace(/\s+/g, ' ').trim()
                if (clean.length > 20 && clean.length < 600 && thinkingEmittedCount < 3) {
                  const isNaturalLanguage = !clean.startsWith('/')
                    && !clean.startsWith('{')
                    && !clean.match(/^[A-Z]:\\/)
                    && clean.split(' ').length > 3
                  if (isNaturalLanguage && !emittedThinkingTexts.has(clean)) {
                    emittedThinkingTexts.add(clean)
                    emitter.emitThinking(clean)
                    thinkingEmittedCount++
                  }
                }
              }
            }
          }

          // For streamText: extract meaningful paragraphs as thinking
          if (!commentaryFieldFound && lastCommentaryEmitLen === 0) {
            const trimmedText = text.trim()
            const isPureJson = trimmedText.startsWith('{') && trimmedText.includes('"commentary"')
            if (!isPureJson && trimmedText.length > 100) {
              const paragraphs = trimmedText
                .split(/\n\n+/)
                .filter(p => {
                  const t = p.trim()
                  return t.length > 30
                    && !t.startsWith('{')
                    && !t.startsWith('[')
                    && !t.startsWith('"')
                    && !t.startsWith('```')
                    && !t.startsWith('import ')
                    && !t.startsWith('export ')
                    && !t.startsWith('const ')
                    && !t.startsWith('function ')
                })
              for (const para of paragraphs) {
                const clean = para.replace(/\s+/g, ' ').trim()
                if (clean.length > 30 && clean.length < 500 && !emittedThinkingTexts.has(clean)) {
                  emittedThinkingTexts.add(clean)
                  emitter.emitThinking(clean)
                  thinkingEmittedCount++
                  break
                }
              }
            }
          }
        }

        // ── Detect file paths ONLY from actual JSON "path" fields ──
        // Must be inside a "files" array context to avoid false positives
        const pathMatches = text.matchAll(/"path"\s*:\s*"([\w\/\._\-]+\.[\w]+)"/g)
        for (const match of pathMatches) {
          const filePath = match[1]
          const matchIdx = match.index ?? 0
          // Only emit if we can confirm this is inside a "files" array context
          const precedingContext = text.slice(Math.max(0, matchIdx - 200), matchIdx).toLowerCase()
          if (precedingContext.includes('"files"') || precedingContext.includes('[{')) {
            if (!emittedPaths.has(`write:${filePath}`)) {
              emittedPaths.add(`write:${filePath}`)
              emitter.emitFileWrite(filePath)
            }
          }
        }

        lastEmitTime = now
      }
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
