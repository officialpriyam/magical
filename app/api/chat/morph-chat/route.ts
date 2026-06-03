import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import {
  getModelClient,
  hasProviderCredentials,
  LLMModel,
  LLMModelConfig,
  resolveGenerationModel,
} from '@/lib/models'
import { applyPatch } from '@/lib/morph'
import { applyChatRateLimit } from '@/lib/chat-rate-limit'
import { FragmentSchema, morphEditSchema, MorphEditSchema } from '@/lib/schema'
import { generateObject, type LanguageModel, type ModelMessage } from 'ai'

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

    const result = await generateObject({
      model: modelClient as LanguageModel,
      system: contextualSystemPrompt,
      messages,
      schema: morphEditSchema,
      maxRetries: 0,
      ...modelParams,
    })

    const editInstructions = result.object

    // Apply edits using Morph
    const morphResult = await applyPatch({
      targetFile: currentFragment.file_path,
      instructions: editInstructions.instruction,
      initialCode: currentFragment.code,
      codeEdit: editInstructions.edit,
    })

    // Return updated fragment in standard format
    const updatedFragment: FragmentSchema = {
      ...currentFragment,
      code: morphResult.code,
      commentary: editInstructions.commentary,
    }

    // Create a streaming response that matches the AI SDK format
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
    return handleAPIError(error, { hasOwnApiKey: !!config.apiKey })
  }
}
