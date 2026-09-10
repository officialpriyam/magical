import { NextResponse } from 'next/server'
import staticModels from '@/lib/models.json'
import { hasProviderEnvironmentCredentials, type LLMModel } from '@/lib/models'

export const dynamic = 'force-dynamic'

type OpenRouterModel = {
  id: string
  name?: string
  description?: string
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
  owned_by?: string
}

// Model IDs/names that cannot do code generation — hidden from the picker
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'

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
    if (model.providerId !== 'nvidia' && isCodingCapableModel(model)) {
      models.set(model.id, model)
    }
  }

  const [googleModels, nvidiaModels, openRouterModels] = await Promise.all([
    fetchGoogleModels(),
    fetchNvidiaModels(),
    fetchOpenRouterModels(),
  ])

  for (const model of [...googleModels, ...nvidiaModels, ...openRouterModels]) {
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
