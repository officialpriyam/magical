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
import { checkCredits } from '@/lib/credits'
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
    // Explicit [Search: ...] prefix
    const searchMatch = content.match(/^\[Search:\s*(.+?)\]\s*$/)
    if (searchMatch) return searchMatch[1]
    break
  }
  return null
}

// Auto-search triggers for queries that benefit from real-time web data
function shouldAutoSearch(query: string): boolean {
  if (/^\[Search:/i.test(query)) return true
  if (/https?:\/\//.test(query)) return true
  const isQuestion = /^\b(what is|what are|who is|who are|when did|when was|where is|how do I find|tell me about|which|compare|best|recommended|popular)\b/i.test(query)
  const hasTimeRef = /\b(current|latest|today|yesterday|this week|right now|news|outage|down|2024|2025|2026)\b/i.test(query)
  if (isQuestion && hasTimeRef) return true
  if (/\b(what is the price|how much does|is .* down|is .* available|how do I|how to)\b/i.test(query)) return true
  if (/\b(search|find|look up|research|compare|alternative|vs\.?|versus|review)\b/i.test(query)) return true
  if (/\b(landing page|website|blog|portfolio|resume|document|documentation|article|tutorial|guide|template|design|UI|UX|brand|logo|color scheme)\b/i.test(query)) return true
  return false
}

function buildSearchQuery(messages: ModelMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    if (!content.trim()) continue
    // Check explicit [Search: ...] prefix
    const searchMatch = content.match(/^\[Search:\s*(.+?)\]\s*$/)
    if (searchMatch) return searchMatch[1]
    // Check auto-detection
    const cleaned = content.replace(/^\[\w+:\s*.+?\]\s*/, '').trim()
    if (!cleaned) continue
    if (shouldAutoSearch(cleaned)) {
      return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
    }
    break
  }
  return null
}

// ─── URL detection and auto-fetch ──────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>")\]]+/gi

function extractUrls(messages: ModelMessage[]): string[] {
  const urls: string[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const content = typeof msg.content === 'string' ? msg.content : ''
    const found = content.match(URL_REGEX) || []
    for (const url of found) {
      // Clean trailing punctuation that might be part of sentence structure
      const clean = url.replace(/[.,;:!?\)]+$/, '')
      if (!urls.includes(clean)) urls.push(clean)
    }
    break // Only check the latest user message
  }
  return urls
}

async function fetchUrlContent(url: string): Promise<{ url: string; title: string; content: string } | null> {
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

async function fetchUrlContents(messages: ModelMessage[]): Promise<{ url: string; title: string; content: string }[]> {
  const urls = extractUrls(messages)
  if (urls.length === 0) return []
  // Fetch up to 3 URLs in parallel
  const results = await Promise.all(urls.slice(0, 3).map(fetchUrlContent))
  return results.filter((r): r is NonNullable<typeof r> => r !== null)
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

  if (userID) {
    const creditCheck = await checkCredits(userID)
    if (!creditCheck.ok) {
      return new Response(
        'Insufficient credits. Please claim daily credits or upgrade your plan.',
        { status: 402 },
      )
    }
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

  const searchQuery = buildSearchQuery(messages)
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

  // Auto-fetch URL content from the user's message
  const fetchedUrls = await fetchUrlContents(messages)
  if (fetchedUrls.length > 0) {
    const urlContext = fetchedUrls
      .map((f) => {
        const header = f.title ? `URL: ${f.url} (Title: ${f.title})` : `URL: ${f.url}`
        // Truncate content to keep context manageable
        const truncated = f.content.length > 4000 ? f.content.slice(0, 4000) + '...' : f.content
        return `${header}\n\nContent:\n${truncated}`
      })
      .join('\n\n---\n\n')

    finalSystemPrompt += `\n\nThe user shared the following URL(s). Use the fetched content below as context for their question:\n\n${urlContext}`
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
