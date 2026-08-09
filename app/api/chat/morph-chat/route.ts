import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import {
  getFallbackChain,
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
} from '@/lib/models'
import { applyPatch } from '@/lib/morph'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import { FragmentSchema, morphEditSchema, MorphEditSchema } from '@/lib/schema'
import { streamObject, type LanguageModel, type ModelMessage } from 'ai'
import { sanitizeJsonTextStream } from '@/lib/json-stream'

export const maxDuration = 300


export async function POST(req: Request) {
  const {
    messages,
    userID,
    teamID,
    model,
    config,
    currentFragment,
  }: {
    messages: ModelMessage[]
    userID: string | undefined
    teamID: string | undefined
    model: LLMModel
    config: LLMModelConfig
    currentFragment: FragmentSchema
  } = await req.json()

  if (!model?.id || !model?.providerId) {
    return new Response('No AI model selected. Please choose a valid model.', { status: 400 })
  }

  const limit = await applyChatRateLimit({ req, config, userID, teamID })

  if (limit) {
    return createRateLimitResponse(limit)
  }

  const morphApiKey = config.apiKey || process.env.MORPH_API_KEY
  if (!morphApiKey) {
    return new Response(
      'Morph API key is not configured. Disable "Use Morph" in settings or add MORPH_API_KEY environment variable.',
      { status: 400 },
    )
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

  const contextualSystemPrompt = `You are a code editor. Generate a JSON response with exactly these fields:

{
  "commentary": "Explain what changes you are making",
  "instruction": "One line description of the change", 
  "edit": "The code changes with // ... existing code ... for unchanged parts",
  "file_path": "${currentFragment.file_path}"
}

Current file: ${currentFragment.file_path}
Current code:
\`\`\`
${currentFragment.code}
\`\`\`

`

  let lastError: any = null

  for (const candidate of fallbackChain) {
    try {
      const modelClient = getModelClient(candidate, config)

      const result = streamObject({
        model: modelClient as LanguageModel,
        system: contextualSystemPrompt,
        messages,
        schema: morphEditSchema,
        maxRetries: 0,
        ...modelParams,
      })

      let accumulated = ''
      const reader = result.textStream.pipeThrough(sanitizeJsonTextStream()).getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += value
        }
      } finally {
        reader.releaseLock()
      }

      let editInstructions: MorphEditSchema
      try {
        const cleaned = accumulated.replace(/^data:\s*/gm, '').trim()
        const jsonStr = cleaned.split('\n').filter(l => l.trim()).pop() || cleaned
        editInstructions = JSON.parse(jsonStr)
      } catch {
        editInstructions = JSON.parse(accumulated)
      }

      const morphResult = await applyPatch({
        targetFile: currentFragment.file_path,
        instructions: editInstructions.instruction,
        initialCode: currentFragment.code,
        codeEdit: editInstructions.edit,
      })

      const updatedFragment: FragmentSchema = {
        ...currentFragment,
        code: morphResult.code,
        commentary: editInstructions.commentary,
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const json = JSON.stringify(updatedFragment)
          controller.enqueue(encoder.encode(json))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    } catch (error: any) {
      lastError = error
      console.error(`Morph model ${candidate.id} (${candidate.providerId}) failed:`, error?.message || error)
      continue
    }
  }

  return handleAPIError(lastError, { hasOwnApiKey: !!config.apiKey })
}
