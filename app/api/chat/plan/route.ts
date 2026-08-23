import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import {
  getFallbackChain,
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
} from '@/lib/models'
import { AI_GENERATION_GUIDE } from '@/lib/ai-generation-guide'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'
import { streamText, type LanguageModel, type ModelMessage } from 'ai'

export const maxDuration = 300

type PlanQuestion = {
  question: string
  options: string[]
  allowCustomInput: boolean
}

type PlanPayload = {
  plan: string
  question?: string
  options?: string[]
  allowCustomInput?: boolean
  questions?: PlanQuestion[]
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

  // Parse questions array (dynamic, 0-N questions)
  const questions: PlanQuestion[] = Array.isArray(payload.questions)
    ? payload.questions
        .filter((q: any) => q && typeof q.question === 'string' && q.question.trim())
        .map((q: any) => ({
          question: q.question.trim(),
          options: Array.isArray(q.options) ? q.options.map(cleanString).filter(Boolean).slice(0, 6) : [],
          allowCustomInput: q.allowCustomInput !== false,
        }))
    : []

  return {
    plan,
    ...(question ? { question } : {}),
    options,
    allowCustomInput: payload.allowCustomInput === false ? false : true,
    ...(questions.length > 0 ? { questions } : {}),
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
    projectID,
    model,
    config,
  }: {
    messages: ModelMessage[]
    userID: string | undefined
    teamID: string | undefined
    projectID: string | undefined
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
  const supabaseInstruction = supabaseStatus.connected
    ? supabaseStatus.projectsMode === 'per_project'
      ? 'Supabase is connected by OAuth. If schema changes are needed, mention the migration files/SQL; Magical will create or reuse one Supabase project for this Magical project.'
      : `Supabase is connected for project ref ${supabaseStatus.projectRef || 'unknown'} via ${supabaseStatus.source === 'environment' ? 'server environment variables' : 'the user integration'}. If schema changes are needed, mention the migration files/SQL the build step should generate.`
    : 'Supabase is not connected. If the request needs auth, persistence, relational data, or migrations, ask whether the user wants to connect Supabase or proceed with mock/local data.'

  let lastError: any = null

  console.log(`[Plan] Starting plan generation with ${fallbackChain.length} model(s)`)

  for (const candidate of fallbackChain) {
    try {
      const modelClient = getModelClient(candidate, config)
      console.log(`[Plan] Trying model: ${candidate.id} (${candidate.providerId})`)

      const result = streamText({
        model: modelClient as LanguageModel,
        system: [
          'You are Magical AI in Plan mode.',
          'Use the existing chat history as project memory.',
          'Return JSON with keys: plan, question, options, allowCustomInput, questions.',
          'The plan must be a concise implementation plan, not code.',
          'Mention important files, UI states, data/storage changes, and verification steps when relevant.',
          '',
          'QUESTIONS: You MUST ask clarifying questions when the request is ambiguous or has multiple valid interpretations.',
          '- The number of questions is dynamic: ask 0 if the request is crystal clear, 1-2 for moderate ambiguity, 3-5 for complex/underspecified requests.',
          '- Each question object has: {"question": "string", "options": ["option1", "option2", ...], "allowCustomInput": boolean}',
          '- Put questions in the "questions" array field. Each option should be a short, concrete choice (not vague).',
          '- Always set allowCustomInput: true so users can type their own answer.',
          '- Example: [{"question": "How many pages do you need?", "options": ["1 page (landing)", "2-3 pages", "5+ pages"], "allowCustomInput": true}]',
          '- If no clarifications needed, return "questions": []',
          AI_GENERATION_GUIDE,
          supabaseInstruction,
        ].join(' '),
        messages,
        maxRetries: 0,
        ...modelParams,
      })

      const textStream = result.textStream
      const reader = textStream.getReader()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += value
      }

      console.log(`[Plan] Got ${accumulated.length} chars from ${candidate.id}`)
      return Response.json(parsePlanPayload(accumulated))
    } catch (error: any) {
      lastError = error
      console.error(`Plan model ${candidate.id} (${candidate.providerId}) failed:`, error?.message || error)
      continue
    }
  }

  console.error('[Plan] All models failed')
  return handleAPIError(lastError, { hasOwnApiKey: !!config.apiKey })
}
