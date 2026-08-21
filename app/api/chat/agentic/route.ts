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
import { Orchestrator } from '@/lib/agents/orchestrator'
import { Templates } from '@/lib/templates'
import { toPrompt, PromptContext } from '@/lib/prompt'
import { fragmentSchema as schema } from '@/lib/schema'
import { streamText, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

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

  // Rate limiting
  const limit = await applyChatRateLimit({ req, config, userID, teamID })
  if (limit) {
    return createRateLimitResponse(limit)
  }

  // Credit check
  if (userID) {
    const creditCheck = await checkCredits(userID)
    if (!creditCheck.ok) {
      return new Response(
        'Insufficient credits. Please claim daily credits or upgrade your plan.',
        { status: 402 },
      )
    }
  }

  // Check fallback chain
  const fallbackChain = getFallbackChain(model, config)
  if (fallbackChain.length === 0) {
    return new Response(
      'No AI providers are configured. Add an API key in Vercel environment variables or in chat settings.',
      { status: 400 },
    )
  }

  // Get Supabase context
  const supabaseStatus = await getSupabaseConnectionStatus(userID, projectID)
  const supabaseContext: PromptContext['supabase'] = {
    connected: supabaseStatus.connected,
    projectRef: supabaseStatus.projectRef,
    source: supabaseStatus.source,
    projectsMode: supabaseStatus.projectsMode,
  }

  try {
    // Create orchestrator
    const orchestrator = new Orchestrator(
      {
        model,
        config,
        messages,
        userID,
        teamID,
        projectID,
        template,
        supabase: supabaseContext,
      },
      (status) => {
        console.log(`[Agent ${status.role}] ${status.phase}: ${status.message}`)
      },
    )

    // Execute the agentic pipeline
    const result = await orchestrator.execute()

    // Return the final fragment in the standard format
    // (compatible with useObject hook)
    return new Response(JSON.stringify(result.fragment), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error: any) {
    console.error('[Agentic API] Execution failed:', error)

    // Try to generate a fallback response using a single model
    try {
      const fallbackFragment = await generateFallbackResponse(
        messages,
        model,
        config,
        template,
        supabaseContext,
      )

      return new Response(JSON.stringify(fallbackFragment), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch (fallbackError) {
      return handleAPIError(error, { hasOwnApiKey: !!config.apiKey })
    }
  }
}

// ─── Fallback Response Generator ────────────────────────────────
async function generateFallbackResponse(
  messages: ModelMessage[],
  model: LLMModel,
  config: LLMModelConfig,
  template: Templates,
  supabaseContext: PromptContext['supabase'],
) {
  const fallbackChain = getFallbackChain(model, config)
  const modelParams = { ...config }
  delete modelParams.model
  delete modelParams.apiKey
  delete modelParams.baseURL

  const systemPrompt = toPrompt(template, { supabase: supabaseContext })

  const STREAM_TEXT_PROVIDER_IDS = new Set([
    'orcarouter',
    'requesty',
    'llm_gateway',
    'deepseek',
    'nvidia',
  ])

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
        text = await readStreamToText(result.textStream)
      } else {
        const result = streamText({
          model: modelClient as LanguageModel,
          system: systemPrompt,
          messages,
          maxRetries: 0,
          ...modelParams,
        })
        text = await readStreamToText(result.textStream)
      }

      // Try to parse as fragment
      const json = extractJson(text)
      if (json) {
        const parsed = JSON.parse(json)
        const result = schema.safeParse(parsed)
        if (result.success) {
          return result.data
        }
      }

      // Return as basic fragment
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
      console.error(`Fallback model ${candidate.id} failed:`, error)
      continue
    }
  }

  throw new Error('All fallback models failed')
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
  let depth = 0
  let inString = false
  let escaped = false

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
    else if (char === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }
  return null
}
