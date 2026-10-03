import { NextResponse } from 'next/server'
import staticModels from '@/lib/models.json'
import { hasProviderEnvironmentCredentials, type LLMModel } from '@/lib/models'

export const dynamic = 'force-dynamic'

type OpenRouterModel = {
  id: string
  name?: string
  description?: string
  pricing?: Record<string, string>
  architecture?: {
    input_modalities?: string[]
    output_modalities?: string[]
  }
}

type GoogleGenerativeModel = {
  name?: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

type OpenAICompatibleModel = {
  id?: string
  name?: string
  owned_by?: string
  type?: string
  architecture?: {
    output_modalities?: string[]
  }
}

// Model IDs/names that cannot do code generation — hidden from the picker
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const CLEANAPIS_BASE_URL = 'https://cleanapis.com/v1'

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

// OpenRouter lists per-token pricing. Keep only free entries (zero prompt and
// completion price, or an explicit `:free` suffix) so the model picker does not
// surface paid models. Every other provider is gated by the user's own API key,
// so those entries are kept as-is.
function isFreeOrDirectProviderModel(model: LLMModel): boolean {
  if (model.providerId !== 'openrouter') return true
  if (model.id.endsWith(':free')) return true

  const pricing = (model as { pricing?: Record<string, string> }).pricing
  if (!pricing) return false

  const prompt = Number(pricing.prompt ?? '0')
  const completion = Number(pricing.completion ?? '0')
  return prompt === 0 && completion === 0
}

function isCodingCapableModel(model: LLMModel): boolean {
  const id = model.id.toLowerCase()
  const name = (model.name || '').toLowerCase()
  return !NON_CODING_MODEL_PATTERNS.some(
    (pattern) => id.includes(pattern) || name.includes(pattern),
  )
}

// Derive capability badges from the model id/name when not explicitly set
function deriveCapabilities(model: LLMModel): string[] {
  if (Array.isArray(model.capabilities) && model.capabilities.length > 0) {
    return model.capabilities
  }

  const id = model.id.toLowerCase()
  const caps: string[] = ['text']

  const isReasoning =
    /(^|\/)(o[134](-|$)|qwq|thinking|reason|gpt-5|deepseek-r1|magistral)/.test(id) ||
    id.includes('sonnet') ||
    id.includes('opus') ||
    id.includes('grok-4')
  if (isReasoning) caps.push('reasoning')

  const isVision =
    model.multiModal === true ||
    id.includes('vision') ||
    id.includes('-vl-') ||
    id.includes('gemini') ||
    id.includes('gpt-4o') ||
    id.includes('gpt-5') ||
    id.includes('pixtral') ||
    id.includes('grok-4')
  if (isVision) caps.push('image')

  return caps
}
const NVIDIA_NON_CHAT_MODEL_PARTS = [
  'alphafold',
  'bevformer',
  'bge',
  'content-safety',
  'cuopt',
  'diffusion',
  'dino',
  'embed',
  'genmol',
  'gliner-pii',
  'grounding',
  'image',
  'jailbreak',
  'molmim',
  'nvclip',
  'parse',
  'protein',
  'rerank',
  'retriever',
  'safety-guard',
  'sparsedrive',
  'stable-video',
  'streampetr',
  'topic-control',
  'translate',
  'vista3d',
]

export async function GET() {
  const models = new Map<string, LLMModel>()

  for (const model of staticModels.models as LLMModel[]) {
    if (model.providerId === 'nvidia') continue
    if (!isCodingCapableModel(model)) continue
    // Drop paid-only OpenRouter entries so the selector never offers a model
    // that requires paid credit. Direct provider entries are keyed by the
    // user's own credentials and are always kept.
    if (!isFreeOrDirectProviderModel(model)) continue
    models.set(model.id, model)
  }

  const [googleModels, nvidiaModels, openRouterModels, cleanApisModels] = await Promise.all([
    fetchGoogleModels(),
    fetchNvidiaModels(),
    fetchOpenRouterModels(),
    fetchCleanApisModels(),
  ])

  for (const model of [
    ...googleModels,
    ...nvidiaModels,
    ...openRouterModels,
    ...cleanApisModels,
  ]) {
    if (!isCodingCapableModel(model)) continue
    const existing = models.get(model.id)
    // Preserve bundled capability metadata when the remote list overrides
    models.set(model.id, existing ? { ...model, capabilities: existing.capabilities } : model)
  }

  const list = Array.from(models.values())
    .map((model) => ({ ...model, capabilities: deriveCapabilities(model) }))

  return NextResponse.json({
    models: list.sort((a, b) => {
      if (a.providerId !== b.providerId) return a.providerId.localeCompare(b.providerId)
      return a.name.localeCompare(b.name)
    }),
  })
}

async function fetchGoogleModels(): Promise<LLMModel[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return []

  try {
    const models: GoogleGenerativeModel[] = []
    let pageToken = ''

    do {
      const searchParams = new URLSearchParams({
        key: apiKey,
        pageSize: '1000',
      })

      if (pageToken) {
        searchParams.set('pageToken', pageToken)
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?${searchParams.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
          next: { revalidate: 60 * 60 },
        },
      )

      if (!response.ok) {
        throw new Error(`Google models request failed: ${response.status}`)
      }

      const data = await response.json()
      models.push(...(Array.isArray(data.models) ? data.models : []))
      pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : ''
    } while (pageToken)

    return models
      .filter((model) => model.name && model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => ({
        id: model.name!,
        name: model.displayName || model.name!.replace(/^models\//, ''),
        provider: 'Google Generative AI',
        providerId: 'google',
      }))
  } catch (error) {
    console.warn('Falling back to bundled Google model list:', error)
    return []
  }
}

async function fetchNvidiaModels(): Promise<LLMModel[]> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return []

  const baseURL = (process.env.NVIDIA_BASE_URL || NVIDIA_BASE_URL).replace(/\/$/, '')

  try {
    const response = await fetch(`${baseURL}/models`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 * 60 },
    })

    if (!response.ok) {
      throw new Error(`NVIDIA models request failed: ${response.status}`)
    }

    const data = await response.json()
    const remoteModels = Array.isArray(data.data) ? (data.data as OpenAICompatibleModel[]) : []

    return remoteModels
      .filter((model): model is OpenAICompatibleModel & { id: string } => {
        return typeof model.id === 'string' && model.id.trim().length > 0
      })
      .filter((model) => isLikelyNvidiaChatModel(model.id))
      .map((model) => ({
        id: model.id,
        name: formatNvidiaModelName(model.id),
        provider: 'NVIDIA NIM',
        providerId: 'nvidia',
      }))
  } catch (error) {
    console.warn('Skipping NVIDIA model list because the live fetch failed:', error)
    return []
  }
}

async function fetchOpenRouterModels(): Promise<LLMModel[]> {
  if (!hasProviderEnvironmentCredentials('openrouter')) return []

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      next: { revalidate: 60 * 60 },
    })

    if (!response.ok) {
      throw new Error(`OpenRouter models request failed: ${response.status}`)
    }

    const data = await response.json()
    const remoteModels = Array.isArray(data.data) ? (data.data as OpenRouterModel[]) : []

    return remoteModels
      .filter((model) => {
        const outputModalities = model.architecture?.output_modalities || []
        return outputModalities.length === 0 || outputModalities.includes('text')
      })
      // Only surface free models — skip paid OpenRouter entries.
      .filter((model) => isFreeOpenRouterEntry(model))
      .map((model) => ({
        id: model.id,
        name: model.name || model.id,
        provider: model.id.split('/')[0] || 'OpenRouter',
        providerId: 'openrouter',
      }))
  } catch (error) {
    console.warn('Falling back to bundled model list:', error)
    return []
  }
}

async function fetchCleanApisModels(): Promise<LLMModel[]> {
  const apiKey = process.env.CLEANAPIS_API_KEY
  if (!apiKey) return []

  const baseURL = (process.env.CLEANAPIS_BASE_URL || CLEANAPIS_BASE_URL).replace(/\/$/, '')

  try {
    const response = await fetch(`${baseURL}/models`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 * 60 },
    })

    if (!response.ok) {
      throw new Error(`CleanAPIs models request failed: ${response.status}`)
    }

    const data = await response.json()
    const remoteModels = Array.isArray(data.data) ? (data.data as OpenAICompatibleModel[]) : []

    return remoteModels
      .filter((model): model is OpenAICompatibleModel & { id: string } => {
        if (typeof model.id !== 'string' || model.id.trim().length === 0) return false
        // Only chat/text models — skip embeddings, image, and audio endpoints.
        if (model.type && model.type !== 'chat') return false
        const outputModalities = model.architecture?.output_modalities
        if (outputModalities && !outputModalities.includes('text')) return false
        return true
      })
      .map((model) => ({
        id: model.id,
        name: model.name?.trim() || formatCleanApisModelName(model.id),
        provider: 'CleanAPIs',
        providerId: 'cleanapis',
      }))
  } catch (error) {
    console.warn('Skipping CleanAPIs model list because the live fetch failed:', error)
    return []
  }
}

function isFreeOpenRouterEntry(model: OpenRouterModel): boolean {
  if (model.id.endsWith(':free')) return true
  if (!model.pricing) return false

  const prompt = Number(model.pricing.prompt ?? '0')
  const completion = Number(model.pricing.completion ?? '0')
  return prompt === 0 && completion === 0
}

function formatCleanApisModelName(id: string) {
  const modelName = id.includes('/') ? id.split('/').slice(1).join('/') : id

  return modelName
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d+(\.\d+)?[a-z]?$/i.test(word)) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function isLikelyNvidiaChatModel(id: string) {
  const normalizedId = id.toLowerCase()

  return !NVIDIA_NON_CHAT_MODEL_PARTS.some((part) => normalizedId.includes(part))
}

function formatNvidiaModelName(id: string) {
  const modelName = id.includes('/') ? id.split('/').slice(1).join('/') : id

  return modelName
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d+(\.\d+)?[a-z]?$/i.test(word)) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
