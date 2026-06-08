import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import {
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
  resolveGenerationModel,
} from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import { fragmentSchema as schema } from '@/lib/schema'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'
import { Templates } from '@/lib/templates'
import { generateObject, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

export async function POST(req: Request) {
  const {
    messages,
    userID,
    teamID,
    template,
    model,
    config,
  }: {
    messages: ModelMessage[]
    userID: string | undefined
    teamID: string | undefined
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

  try {
    const resolvedModel = resolveGenerationModel(model, config)

    if (!hasProviderCredentials(resolvedModel.providerId, config)) {
      return new Response(
        `No API key is configured for ${resolvedModel.provider}. Add the provider key in Vercel environment variables or enter your own API key in chat settings.`,
        { status: 400 },
      )
    }

    const modelParams = { ...config }
    delete modelParams.model
    delete modelParams.apiKey
    delete modelParams.baseURL
    const modelClient = getModelClient(resolvedModel, config)
    const supabaseStatus = userID
      ? await getSupabaseConnectionStatus(userID)
      : { connected: false }

    const result = await generateObject({
      model: modelClient as LanguageModel,
      schema,
      system: toPrompt(template, {
        supabase: {
          connected: supabaseStatus.connected,
          projectRef: supabaseStatus.projectRef,
        },
      }),
      messages,
      maxRetries: 0, // do not retry on errors
      ...modelParams,
    })

    return new Response(JSON.stringify(result.object), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  } catch (error: any) {
    return handleAPIError(error, { hasOwnApiKey: !!config.apiKey })
  }
}
