import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import {
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
  resolveGenerationModel,
} from '@/lib/models'
import { AI_GENERATION_GUIDE } from '@/lib/ai-generation-guide'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'
import { generateText, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

type PlanPayload = {
  plan: string
  question?: string
  options?: string[]
  allowCustomInput?: boolean
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePlanPayload(value: unknown, fallbackText: string): PlanPayload {
  if (!value || typeof value !== 'object') {
    return {
      plan: fallbackText.trim() || 'I could not create a plan for that request.',
      options: [],
      allowCustomInput: true,
    }
  }

  const payload = value as Record<string, unknown>
  const plan = cleanString(payload.plan) || fallbackText.trim() || 'I could not create a plan for that request.'
  const question = cleanString(payload.question)
  const options = Array.isArray(payload.options)
    ? payload.options
        .map(cleanString)
        .filter(Boolean)
        .slice(0, 4)
    : []

  return {
    plan,
    ...(question ? { question } : {}),
    options,
    allowCustomInput: payload.allowCustomInput === false ? false : true,
  }
}

function parsePlanPayload(text: string): PlanPayload {
  const trimmed = text.trim()
  const jsonText = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return normalizePlanPayload(JSON.parse(jsonText), text)
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return normalizePlanPayload(JSON.parse(jsonMatch[0]), text)
      } catch {
        // Fall through to plain text.
      }
    }
  }

  return normalizePlanPayload(undefined, text)
}

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
    const supabaseStatus = userID
      ? await getSupabaseConnectionStatus(userID)
      : { connected: false }
    const supabaseInstruction = supabaseStatus.connected
      ? `Supabase is connected for project ref ${supabaseStatus.projectRef || 'unknown'}. If schema changes are needed, mention the migration files/SQL the build step should generate.`
      : 'Supabase is not connected. If the request needs auth, persistence, relational data, or migrations, ask whether the user wants to connect Supabase or proceed with mock/local data.'

    const result = await generateText({
      model: modelClient as LanguageModel,
      system: [
        'You are Magical AI in Plan mode.',
        'Use the existing chat history as project memory.',
        'Return JSON only with keys: plan, question, options, allowCustomInput.',
        'The plan must be a concise implementation plan, not code.',
        'Mention important files, UI states, data/storage changes, and verification steps when relevant.',
        'Set question only when the work cannot proceed safely without one blocking answer.',
        'When question is set, include 2 to 4 short option strings when likely answers exist.',
        'Set allowCustomInput to true unless the listed options are exhaustive.',
        AI_GENERATION_GUIDE,
        supabaseInstruction,
      ].join(' '),
      messages,
      maxRetries: 0,
      ...modelParams,
    })

    return Response.json(parsePlanPayload(result.text))
  } catch (error: any) {
    return handleAPIError(error, { hasOwnApiKey: !!config.apiKey })
  }
}
