import { createAnthropic } from '@ai-sdk/anthropic'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createOllama } from 'ollama-ai-provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import bundledModels from '@/lib/models.json'
import { MAGIC_FREE_MODELS, MAGIC_PLUS_MODELS } from '@/lib/magic-models'

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

export function resolveGenerationModel(model: LLMModel, config: LLMModelConfig): LLMModel {
  if (hasProviderCredentials(model.providerId, config)) {
    return model
  }

  const fallbackIds = [
    'models/gemini-2.0-flash',
    'qwen/qwen3-coder',
    'anthropic/claude-haiku-4.5',
    'claude-3-5-haiku-latest',
    'gpt-4o-mini',
  ]

  for (const fallbackId of fallbackIds) {
    const fallbackModel = (bundledModels.models as LLMModel[]).find(
      (candidate) => candidate.id === fallbackId,
    )

    if (fallbackModel && hasProviderCredentials(fallbackModel.providerId, config)) {
      return fallbackModel
    }
  }

  return model
}

export function getFallbackChain(model: LLMModel, config: LLMModelConfig): LLMModel[] {
  const chain: LLMModel[] = []

  if (hasProviderCredentials(model.providerId, config)) {
    chain.push(model)
  }

  const isMagicFree = MAGIC_FREE_MODELS.some((m) => m.id === model.id)
  const isMagicPlus = MAGIC_PLUS_MODELS.some((m) => m.id === model.id)

  if (isMagicFree || isMagicPlus) {
    const siblings = (isMagicFree ? MAGIC_FREE_MODELS : MAGIC_PLUS_MODELS).filter(
      (m) => m.id !== model.id && hasProviderCredentials(m.providerId, config),
    )
    for (const sibling of siblings) {
      if (chain.length >= 6) break
      chain.push(sibling)
    }
  }

  const fallbackIds = [
    'models/gemini-2.0-flash',
    'qwen/qwen3-coder',
    'anthropic/claude-haiku-4.5',
    'claude-3-5-haiku-latest',
    'gpt-4o-mini',
    'openrouter/auto',
    'anthropic/claude-haiku-4-5-free',
    'mistral/leanstral-1-5',
    'google/gemma-4-31b-it',
  ]

  const seenProviders = new Set<string>(chain.map((m) => m.providerId))

  for (const fallbackId of fallbackIds) {
    if (chain.length >= 8) break
    const fallbackModel = (bundledModels.models as LLMModel[]).find(
      (candidate) => candidate.id === fallbackId,
    )

    if (fallbackModel && hasProviderCredentials(fallbackModel.providerId, config) && !seenProviders.has(fallbackModel.providerId)) {
      chain.push(fallbackModel)
      seenProviders.add(fallbackModel.providerId)
    }
  }

  if (chain.length === 0) {
    const anyModel = (bundledModels.models as LLMModel[]).find((candidate) =>
      hasProviderCredentials(candidate.providerId, config),
    )
    if (anyModel) chain.push(anyModel)
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
    case 'magicx_coder':
      return true // Local server, always available
    case 'magicx':
      return true // Local server, always available
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
    magicx_coder: () =>
      createOpenAI({
        apiKey: apiKey || 'no-key',
        baseURL: baseURL || 'http://185.172.175.223:1234/v1',
      })(modelNameString),
    magicx: () =>
      createOpenAI({
        apiKey: apiKey || 'no-key',
        baseURL: baseURL || 'http://localhost:1234/api/v1',
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

export function getDefaultModelParams(model: LLMModel) {
  // Return default parameters for the model
  // This can be customized per provider/model if needed
  return {
    temperature: 0.7,
    maxTokens: 4096,
  }
}
