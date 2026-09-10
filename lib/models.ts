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
  multiModal?: boolean
  capabilities?: string[]
  contextLength?: number
  description?: string
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

// Curated order of proven, coding-capable models for Auto mode.
// Auto mode picks the FIRST one with provider credentials instead of
// blindly choosing the first bundled model (which may be a retired
// preview model that returns empty responses).
//
// Gemini 2.5 Pro and other thinking/deep-reasoning models are deliberately
// held out of the primary auto run order. On code generation they spend the
// output budget on reasoning tokens and frequently return truncated or empty
// responses ("Empty response from models/gemini-2.5-pro"). They remain in the
// chain as true last-resort fallbacks via FALLBACK_THINKING_IDS when nothing
// faster and more reliable is configured.
const AUTO_MODEL_PRIORITY = [
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'gpt-5',
  'gpt-5-mini',
  'gpt-4.1',
  'gpt-4o',
  'gemini-2.5-flash',
  'models/gemini-2.5-flash',
  'deepseek-chat',
  'grok-code-fast-1',
  'gpt-4o-mini',
  'claude-3-5-haiku-latest',
]

// Thinking-heavy models that are still acceptable as deep fallbacks but are
// not chosen as the first auto candidate for code generation.
const FALLBACK_THINKING_IDS = [
  'gemini-2.5-pro',
  'models/gemini-2.5-pro',
  'deepseek-reasoner',
  'o1',
  'o3',
]

export function getAutoModel(config: LLMModelConfig): LLMModel | null {
  const allModels = bundledModels.models as LLMModel[]

  // Prefer proven coding models in priority order
  for (const preferredId of AUTO_MODEL_PRIORITY) {
    const model = allModels.find((m) => m.id === preferredId)
    if (model && hasProviderCredentials(model.providerId, config)) {
      return model
    }
  }

  // Fall back to the first configured model that can actually produce text
  for (const model of allModels) {
    if (hasProviderCredentials(model.providerId, config) && isCodingCapableModel(model)) {
      return model
    }
  }

  return null
}

// Model IDs that cannot do code generation (image gen, audio, safety
// classifiers, research agents) — never used for Auto or fallback.
const NON_CODING_MODEL_PATTERNS = [
  'image',
  'audio',
  'voxtral',
  'safeguard',
  'llama-guard',
  'deep-research',
  'search-preview',
  'transcribe',
  'tts',
  'whisper',
  'dall-e',
  'sora',
]

export function isCodingCapableModel(model: LLMModel): boolean {
  const id = model.id.toLowerCase()
  const name = (model.name || '').toLowerCase()
  return !NON_CODING_MODEL_PATTERNS.some(
    (pattern) => id.includes(pattern) || name.includes(pattern),
  )
}

export function getAllConfiguredModels(config: LLMModelConfig): LLMModel[] {
  const allModels = bundledModels.models as LLMModel[]
  return allModels.filter((m) => hasProviderCredentials(m.providerId, config))
}

export function getFallbackChain(model: LLMModel, config: LLMModelConfig): LLMModel[] {
  const chain: LLMModel[] = []
  const seenIds = new Set<string>()

  // 1. Always start with the user's selected model
  if (model.id !== 'auto' && hasProviderCredentials(model.providerId, config)) {
    chain.push(model)
    seenIds.add(model.id)
  }

  // 2. If model is 'auto', add configured models in curated priority order.
  //    Fast, reliable coding models come first. Thinking-heavy models (Gemini 2.5
  //    Pro, DeepSeek Reasoner, o1/o3) are held back and only appended as true
  //    last-resort fallbacks. This avoids the old behaviour where the chain
  //    collapsed to all-Gemini with Gemini 2.5 Pro as the default and returning
  //    empty responses on code tasks.
  if (model.id === 'auto') {
    const allModels = bundledModels.models as LLMModel[]
    for (const preferredId of AUTO_MODEL_PRIORITY) {
      if (chain.length >= 5) break
      if (seenIds.has(preferredId)) continue
      const candidate = allModels.find((m) => m.id === preferredId)
      if (candidate && hasProviderCredentials(candidate.providerId, config)) {
        chain.push(candidate)
        seenIds.add(candidate.id)
      }
    }

    // Append held-out thinking models only if the chain is still hungry and
    // nothing non-thinking is configured for that provider anyway.
    if (chain.length < 10) {
      for (const thinkingId of FALLBACK_THINKING_IDS) {
        if (chain.length >= 10) break
        if (seenIds.has(thinkingId)) continue
        const candidate = allModels.find((m) => m.id === thinkingId)
        if (candidate && hasProviderCredentials(candidate.providerId, config)) {
          chain.push(candidate)
          seenIds.add(candidate.id)
        }
      }
    }
  }

  // 3. Append only curated, proven fallback models for code generation
  //    NEVER add all configured models — small vision/instruct models
  //    (like qwen3-vl-8b) return empty responses on code generation tasks
  const fallbackIds = [
    'gpt-4o-mini',
    'gemini-2.5-flash',
    'models/gemini-2.5-flash',
    'claude-3-5-haiku-latest',
    'deepseek-chat',
  ]

  for (const fallbackId of fallbackIds) {
    if (chain.length >= 10) break
    if (!seenIds.has(fallbackId)) {
      const fallbackModel = (bundledModels.models as LLMModel[]).find(
        (candidate) => candidate.id === fallbackId,
      )
      if (fallbackModel && hasProviderCredentials(fallbackModel.providerId, config)) {
        chain.push(fallbackModel)
        seenIds.add(fallbackId)
      }
    }
  }

  return chain
}

// Return the first model in a chain that is not a thinking/deep-reasoning
// model. Used by the auto path for quick classification/analysis steps so the
// request does not unnecessarily hit Gemini 2.5 Pro / DeepSeek Reasoner / o1 / o3.
// If every model in the chain is a thinking model, fall back to the first model.
export function firstNonThinkingModel(chain: LLMModel[]): LLMModel | undefined {
  for (const candidate of chain) {
    const id = candidate.id.toLowerCase()
    if (
      !THINKING_MODEL_PATTERNS.some((pattern) => id.includes(pattern))
    ) {
      return candidate
    }
  }
  return chain[0]
}

// Thinking-style models (Gemini 2.5 etc.) spend their output budget on
// reasoning tokens. When no explicit limit is configured, raise the ceiling so
// they do not return truncated or completely empty responses on long code
// generation tasks ("Empty response from models/gemini-2.5-pro").
const THINKING_MODEL_PATTERNS = [
  'gemini-2.5',
  'deepseek-reasoner',
  'o1',
  'o3',
]

export function withModelDefaults(
  model: LLMModel,
  params: Record<string, any>,
): Record<string, any> {
  const id = model.id.toLowerCase()
  const isThinkingModel = THINKING_MODEL_PATTERNS.some((pattern) => id.includes(pattern))
  if (!isThinkingModel) return params

  const next = { ...params }
  if (!next.maxOutputTokens && !next.maxTokens) {
    next.maxOutputTokens = 65536
  }
  return next
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
      }).chat(modelNameString),
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
      }).chat(modelNameString),
    togetherai: () =>
      createOpenAI({
        apiKey: apiKey || process.env.TOGETHER_API_KEY,
        baseURL: baseURL || 'https://api.together.xyz/v1',
      }).chat(modelNameString),
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
      }).chat(modelNameString),
    deepseek: () =>
      createOpenAI({
        apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
        baseURL: baseURL || 'https://api.deepseek.com/v1',
      }).chat(modelNameString),
    openrouter: () =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        baseURL: baseURL || 'https://openrouter.ai/api/v1',
      })(modelNameString),
    nvidia: () =>
      createOpenAI({
        apiKey: apiKey || process.env.NVIDIA_API_KEY,
        baseURL: baseURL || process.env.NVIDIA_BASE_URL || NVIDIA_BASE_URL,
      }).chat(modelNameString),
    llm_gateway: () =>
      createOpenAI({
        apiKey: apiKey || process.env.LLM_GATEWAY_API_KEY,
        baseURL: baseURL || 'https://api.llmgateway.ai/v1',
      }).chat(modelNameString),
    orcarouter: () =>
      createOpenAI({
        apiKey: apiKey || process.env.ORCAROUTER_API_KEY,
        baseURL: baseURL || 'https://api.orcarouter.ai/v1',
      }).chat(modelNameString),
    requesty: () =>
      createOpenAI({
        apiKey: apiKey || process.env.REQUESTY_API_KEY,
        baseURL: baseURL || 'https://router.requesty.ai/v1',
      }).chat(modelNameString),
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
