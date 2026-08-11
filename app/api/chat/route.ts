import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import {
  getFallbackChain,
  getModelClient,
  LLMModel,
  LLMModelConfig,
} from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import { fragmentSchema as schema } from '@/lib/schema'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'
import { Templates } from '@/lib/templates'
import { streamObject, streamText, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

const STREAM_TEXT_PROVIDER_IDS = new Set([
  'orcarouter',
  'requesty',
  'llm_gateway',
  'deepseek',
  'nvidia',
])

const JSON_SCHEMA_PROMPT = `You MUST respond with ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no text before or after the JSON. Start your response with { and end with }.
{
  "commentary": "string - describe what you're about to do and the steps",
  "template": "string - name of the template",
  "title": "string - short title, max 3 words",
  "description": "string - short description, max 1 sentence",
  "additional_dependencies": ["string"],
  "has_additional_dependencies": false,
  "install_dependencies_command": "string",
  "port": null,
  "file_path": "string - relative path including file name",
  "code": "string - the actual runnable code, not wrapped in backticks"
}`

interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

async function performWebSearch(query: string): Promise<WebSearchResult[]> {
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

function extractSearchQuery(messages: ModelMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const searchMatch = content.match(/^\[Search:\s*(.+?)\]\s*$/)
    if (searchMatch) return searchMatch[1]
    break
  }
  return null
}

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

function extractJson(text: string): string {
  // First try to find JSON in markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim()
    const start = inner.indexOf('{')
    if (start !== -1) {
      const extracted = extractJsonObject(inner, start)
      if (extracted) return extracted
    }
  }

  // Try direct JSON extraction
  const start = text.indexOf('{')
  if (start === -1) {
    throwObjectGenerationError('NoObjectGeneratedError', 'The model returned an empty response.')
  }

  const extracted = extractJsonObject(text, start)
  if (extracted) return extracted

  throwObjectGenerationError('NoObjectGeneratedError', 'The model returned incomplete JSON.')
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

function throwObjectGenerationError(name: string, message: string): never {
  const error = new Error(message) as Error & { cause?: unknown }
  error.name = name
  throw error
}

function parseAndValidateFragment(text: string) {
  const json = extractJson(text)

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (cause) {
    // Try to fix common JSON issues
    const fixed = json
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/\n/g, ' ')     // Remove newlines
      .replace(/\t/g, ' ')     // Remove tabs
    
    try {
      parsed = JSON.parse(fixed)
    } catch {
      throwObjectGenerationError('JSONParseError', 'The model returned invalid JSON.')
    }
  }

  // Ensure parsed is an object
  if (typeof parsed !== 'object' || parsed === null) {
    throwObjectGenerationError('TypeValidationError', 'The model response is not an object.')
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    // Try to fill in missing fields with defaults
    const data = parsed as Record<string, unknown>
    const filledData = {
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
    }

    // If we have code, try to use the filled data
    if (filledData.code) {
      return filledData as any
    }

    throwObjectGenerationError('TypeValidationError', 'The model response failed schema validation.')
  }

  return result.data
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
    return new Response('No AI model selected. Please choose a valid model.', { status: 400 })
  }

  const limit = await applyChatRateLimit({ req, config, userID, teamID })

  if (limit) {
    return createRateLimitResponse(limit)
  }

  const fallbackChain = getFallbackChain(model, config)

  if (fallbackChain.length === 0) {
    return new Response(
      'No AI providers are configured. Add an API key in Vercel environment variables or in chat settings.',
      { status: 400 },
    )
  }

  const modelParams = { ...config }
  delete modelParams.model
  delete modelParams.apiKey
  delete modelParams.baseURL
  const supabaseStatus = await getSupabaseConnectionStatus(userID, projectID)

  const systemPrompt = toPrompt(template, {
    supabase: {
      connected: supabaseStatus.connected,
      projectRef: supabaseStatus.projectRef,
      source: supabaseStatus.source,
      projectsMode: supabaseStatus.projectsMode,
    },
  })

  const searchQuery = extractSearchQuery(messages)
  let finalSystemPrompt = systemPrompt

  if (searchQuery) {
    const searchResults = await performWebSearch(searchQuery)
    if (searchResults.length > 0) {
      const searchContext = searchResults
        .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`)
        .join('\n\n')

      finalSystemPrompt += `\n\nWeb search results for "${searchQuery}":\n\n${searchContext}\n\nUse these search results as reference when answering the user's question. Cite sources when relevant.`

      const cleanedMessages = messages.map((msg) => {
        if (msg.role === 'user' && typeof msg.content === 'string') {
          return { ...msg, content: msg.content.replace(/^\[Search:\s*.+?\]\s*/, '') }
        }
        return msg
      })
      messages.length = 0
      messages.push(...cleanedMessages)
    }
  }

  let lastError: any = null

  console.log(`Fallback chain: ${fallbackChain.map(m => `${m.id} (${m.providerId})`).join(' → ')}`)

  for (const candidate of fallbackChain) {
    try {
      console.log(`Trying model: ${candidate.id} (${candidate.providerId})`)
      const modelClient = getModelClient(candidate, config)
      const useFallback = STREAM_TEXT_PROVIDER_IDS.has(candidate.providerId)
      let text: string

      if (useFallback) {
        const result = streamText({
          model: modelClient as any,
          system: finalSystemPrompt + '\n\n' + JSON_SCHEMA_PROMPT,
          messages,
          maxRetries: 0,
          ...modelParams,
        })

        text = await readStreamToText(result.textStream)
      } else {
        const result = streamObject({
          model: modelClient as LanguageModel,
          schema,
          system: finalSystemPrompt,
          messages,
          maxRetries: 0,
          ...modelParams,
        })

        text = await readStreamToText(result.textStream)
      }

      const fragment = parseAndValidateFragment(text)

      return new Response(JSON.stringify(fragment), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch (error: any) {
      lastError = error
      console.error(`Model ${candidate.id} (${candidate.providerId}) failed:`, error?.message || error)
      continue
    }
  }

  return handleAPIError(lastError, { hasOwnApiKey: !!config.apiKey })
}
