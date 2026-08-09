import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import {
  getFallbackChain,
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
} from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import { fragmentSchema as schema } from '@/lib/schema'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'
import { Templates } from '@/lib/templates'
import { streamObject, type LanguageModel, type ModelMessage } from 'ai'

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

  let lastError: any = null

  for (const candidate of fallbackChain) {
    try {
      const modelClient = getModelClient(candidate, config)

      const result = streamObject({
        model: modelClient as LanguageModel,
        schema,
        system: toPrompt(template, {
          supabase: {
            connected: supabaseStatus.connected,
            projectRef: supabaseStatus.projectRef,
            source: supabaseStatus.source,
            projectsMode: supabaseStatus.projectsMode,
          },
        }),
        messages,
        maxRetries: 0,
        ...modelParams,
      })

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk))
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
