import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import {
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
  resolveGenerationModel,
} from '@/lib/models'
import { generateText, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

export async function POST(req: Request) {
  const {
    messages,
    userID,
    teamID,
    model,
    config,
  }: {
    messages: ModelMessage[]
    userID: string | undefined
    teamID: string | undefined
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

    const result = await generateText({
      model: modelClient as LanguageModel,
      system: [
        'You are Magical AI in Plan mode.',
        'Use the existing chat history as project memory.',
        'Return a concise implementation plan, not code.',
        'Mention important files, UI states, data/storage changes, and verification steps when relevant.',
        'Ask at most one blocking question only when the work cannot proceed safely without it.',
      ].join(' '),
      messages,
      maxRetries: 0,
      ...modelParams,
    })

    return Response.json({ plan: result.text })
  } catch (error: any) {
    return handleAPIError(error, { hasOwnApiKey: !!config.apiKey })
  }
}
