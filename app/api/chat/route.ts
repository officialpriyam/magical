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
import { sanitizeJsonTextStream } from '@/lib/json-stream'

export const maxDuration = 300

const STREAM_TEXT_PROVIDER_IDS = new Set([
  'orcarouter',
  'requesty',
  'llm_gateway',
  'deepseek',
  'nvidia',
  'magicx_coder',
  'magicx',
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

  for (const candidate of fallbackChain) {
    try {
      const modelClient = getModelClient(candidate, config)
      const useFallback = STREAM_TEXT_PROVIDER_IDS.has(candidate.providerId)

      if (useFallback) {
        const result = streamText({
          model: modelClient as any,
          system: finalSystemPrompt + '\n\n' + JSON_SCHEMA_PROMPT,
          messages,
          maxRetries: 0,
          ...modelParams,
        })

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            const reader = result.textStream.getReader()
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                controller.enqueue(encoder.encode(value))
              }
            } finally {
              reader.releaseLock()
            }
            controller.close()
          },
        })

        return new Response(stream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }

      const result = streamObject({
        model: modelClient as LanguageModel,
        schema,
        system: finalSystemPrompt,
        messages,
        maxRetries: 0,
        ...modelParams,
      })

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const reader = result.textStream.pipeThrough(sanitizeJsonTextStream()).getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(encoder.encode(value))
            }
          } finally {
            reader.releaseLock()
          }
          controller.close()
        },
      })

      return new Response(stream, {
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
