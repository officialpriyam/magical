import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import { Duration } from '@/lib/duration'
import {
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
  resolveGenerationModel,
} from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { fragmentSchema as schema } from '@/lib/schema'
import { Templates } from '@/lib/templates'
import { streamObject, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

const rateLimitMaxRequests = process.env.RATE_LIMIT_MAX_REQUESTS
  ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
  : 10
const ratelimitWindow = process.env.RATE_LIMIT_WINDOW
  ? (process.env.RATE_LIMIT_WINDOW as Duration)
  : '1d'

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

  const limit = !config.apiKey
    ? await ratelimit(
        req.headers.get('x-forwarded-for'),
        rateLimitMaxRequests,
        ratelimitWindow,
      )
    : false

  if (limit) {
    return createRateLimitResponse(limit)
  }

  console.log('userID', userID)
  console.log('teamID', teamID)
  // console.log('template', template)
  console.log('model', model)
  // console.log('config', config)

  try {
    const resolvedModel = resolveGenerationModel(model, config)

    if (!hasProviderCredentials(resolvedModel.providerId, config)) {
      return new Response(
        `No API key is configured for ${resolvedModel.provider}. Add the provider key in Vercel environment variables or enter your own API key in chat settings.`,
        { status: 400 },
      )
    }

    const { model: modelNameString, apiKey: modelApiKey, ...modelParams } = config
    const modelClient = getModelClient(resolvedModel, config)

    const stream = await streamObject({
      model: modelClient as LanguageModel,
      schema,
      system: toPrompt(template),
      messages,
      maxRetries: 0, // do not retry on errors
      ...modelParams,
    })

    return stream.toTextStreamResponse()
  } catch (error: any) {
    return handleAPIError(error, { hasOwnApiKey: !!config.apiKey })
  }
}
