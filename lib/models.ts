import { createAnthropic } from '@ai-sdk/anthropic'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createOllama } from 'ollama-ai-provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import bundledModels from '@/lib/models.json'

export type LLMModel = {
  id: string
  name: string
  provider: string
  providerId: string
  isBeta?: boolean
}

export type LLMModelConfig = {
  model?: string
  apiKey?: string
  baseURL?: string
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
}

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'

export function getAutoModel(config: LLMModelConfig): LLMModel | null {
  const allModels = bundledModels.models as LLMModel[]

  for (const model of allModels) {
    if (hasProviderCredentials(model.providerId, config)) {
      return model
    }
  }

  return null
}

export function getAllConfiguredModels(config: LLMModelConfig): LLMModel[] {
  const allModels = bundledModels.models as LLMModel[]
  return allModels.filter((m) => hasProviderCredentials(m.providerId, config))
}

export function getFallbackChain(model: LLMModel, config: LLMModelConfig): LLMModel[] {
  const chain: LLMModel[] = []
  const seenIds = new Set<string>()

  if (model.id !== 'auto' && hasProviderCredentials(model.providerId, config)) {
    chain.push(model)
    seenIds.add(model.id)
  }

  const allModels = getAllConfiguredModels(config)

  for (const candidate of allModels) {
    if (chain.length >= 20) break
    if (!seenIds.has(candidate.id)) {
      chain.push(candidate)
      seenIds.add(candidate.id)
    }
  }

  if (chain.length === 0) {
    const fallbackIds = [
      'models/gemini-2.0-flash',
      'qwen/qwen3-coder',
      'anthropic/claude-haiku-4.5',
      'claude-3-5-haiku-latest',
      'gpt-4o-mini',
      'deepseek/deepseek-chat',
      'mistralai/mistral-small-latest',
      'groq/llama-3.1-8b-instant',
      'togetherai/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'fireworks/accounts/fireworks/models/llama-v3p1-8b-instruct',
    ]

    for (const fallbackId of fallbackIds) {
      const fallbackModel = (bundledModels.models as LLMModel[]).find(
        (candidate) => candidate.id === fallbackId,
      )

      if (fallbackModel && hasProviderCredentials(fallbackModel.providerId, config)) {
        chain.push(fallbackModel)
      }
    }
  }

  return chain
}

export function hasProviderEnvironmentCredentials(providerId: string) {
  switch (providerId) {
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY)
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY)
    case 'google':
      return Boolean(process.env.GOOGLE_AI_API_KEY)
    case 'vertex':
      return Boolean(process.env.GOOGLE_VERTEX_CREDENTIALS || process.env.GOOGLE_AI_API_KEY)
    case 'mistral':
      return Boolean(process.env.MISTRAL_API_KEY)
    case 'groq':
      return Boolean(process.env.GROQ_API_KEY)
    case 'togetherai':
      return Boolean(process.env.TOGETHER_API_KEY)
    case 'fireworks':
      return Boolean(process.env.FIREWORKS_API_KEY)
    case 'xai':
      return Boolean(process.env.XAI_API_KEY)
    case 'deepseek':
      return Boolean(process.env.DEEPSEEK_API_KEY)
    case 'openrouter':
      return Boolean(process.env.OPENROUTER_API_KEY)
    case 'nvidia':
      return Boolean(process.env.NVIDIA_API_KEY)
    case 'llm_gateway':
      return Boolean(process.env.LLM_GATEWAY_API_KEY)
    case 'orcarouter':
      return Boolean(process.env.ORCAROUTER_API_KEY)
    case 'requesty':
      return Boolean(process.env.REQUESTY_API_KEY)
    default:
      return false
  }
}

export function hasProviderCredentials(providerId: string, config: LLMModelConfig) {
  if (config.apiKey) return true
  if (providerId === 'ollama') return Boolean(config.baseURL)

  return hasProviderEnvironmentCredentials(providerId)
}

export function getModelClient(model: LLMModel, config: LLMModelConfig) {
  const { providerId } = model
  const modelNameString = getProviderModelName(model)
  const { apiKey, baseURL } = config

  const providerConfigs = {
    anthropic: () =>
      createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL,
      })(modelNameString),
    openai: () =>
      createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
        baseURL,
      })(modelNameString),
    google: () =>
      createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_AI_API_KEY,
        baseURL,
      })(modelNameString),
    mistral: () =>
      createMistral({
        apiKey: apiKey || process.env.MISTRAL_API_KEY,
        baseURL,
      })(modelNameString),
    groq: () =>
      createOpenAI({
        apiKey: apiKey || process.env.GROQ_API_KEY,
        baseURL: baseURL || 'https://api.groq.com/openai/v1',
      })(modelNameString),
    togetherai: () =>
      createOpenAI({
        apiKey: apiKey || process.env.TOGETHER_API_KEY,
        baseURL: baseURL || 'https://api.together.xyz/v1',
      })(modelNameString),
    ollama: () => createOllama({ baseURL })(modelNameString),
    fireworks: () =>
      createFireworks({
        apiKey: apiKey || process.env.FIREWORKS_API_KEY,
        baseURL: baseURL || 'https://api.fireworks.ai/inference/v1',
      })(modelNameString),
    vertex: () => {
      const vertexCredentials = process.env.GOOGLE_VERTEX_CREDENTIALS;
      
      // Handle both API key and JSON credentials
      if (!vertexCredentials) {
        // Fallback to Google AI SDK if no Vertex credentials
        return createGoogleGenerativeAI({ 
          apiKey: apiKey || process.env.GOOGLE_AI_API_KEY 
        })(modelNameString);
      }
      
      // Try to parse as JSON first (service account credentials)
      try {
        const credentials = JSON.parse(vertexCredentials);
        return createVertex({
          googleAuthOptions: { credentials },
        })(modelNameString);
      } catch {
        // If not JSON, treat as API key and use Google AI SDK instead
        return createGoogleGenerativeAI({ 
          apiKey: vertexCredentials || apiKey || process.env.GOOGLE_AI_API_KEY 
        })(modelNameString);
      }
    },
    xai: () =>
      createOpenAI({
        apiKey: apiKey || process.env.XAI_API_KEY,
        baseURL: baseURL || 'https://api.x.ai/v1',
      })(modelNameString),
    deepseek: () =>
      createOpenAI({
        apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
        baseURL: baseURL || 'https://api.deepseek.com/v1',
      })(modelNameString),
    openrouter: () =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        baseURL: baseURL || 'https://openrouter.ai/api/v1',
      })(modelNameString),
    nvidia: () =>
      createOpenAI({
        apiKey: apiKey || process.env.NVIDIA_API_KEY,
        baseURL: baseURL || process.env.NVIDIA_BASE_URL || NVIDIA_BASE_URL,
      })(modelNameString),
    llm_gateway: () =>
      createOpenAI({
        apiKey: apiKey || process.env.LLM_GATEWAY_API_KEY,
        baseURL: baseURL || 'https://api.llmgateway.ai/v1',
      })(modelNameString),
    orcarouter: () =>
      createOpenAI({
        apiKey: apiKey || process.env.ORCAROUTER_API_KEY,
        baseURL: baseURL || 'https://api.orcarouter.ai/v1',
      })(modelNameString),
    requesty: () =>
      createOpenAI({
        apiKey: apiKey || process.env.REQUESTY_API_KEY,
        baseURL: baseURL || 'https://router.requesty.ai/v1',
      })(modelNameString),
  }

  const createClient =
    providerConfigs[providerId as keyof typeof providerConfigs]

  if (!createClient) {
    throw new Error(`Unsupported provider: ${providerId}`)
  }

  return createClient()
}

function getProviderModelName(model: LLMModel) {
  if (model.providerId === 'google') {
    return model.id.replace(/^models\//, '')
  }

  return model.id
}
