import { NextResponse } from 'next/server'
import staticModels from '@/lib/models.json'
import { hasProviderEnvironmentCredentials, type LLMModel } from '@/lib/models'
import { MAGIC_FREE_MODELS, MAGIC_PLUS_MODELS } from '@/lib/magic-models'

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

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
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
    if (model.providerId !== 'nvidia' && hasProviderEnvironmentCredentials(model.providerId)) {
      models.set(model.id, model)
    }
  }

  for (const model of [...MAGIC_FREE_MODELS, ...MAGIC_PLUS_MODELS]) {
    if (hasProviderEnvironmentCredentials(model.providerId)) {
      models.set(model.id, model)
    }
  }

  const [googleModels, nvidiaModels, openRouterModels] = await Promise.all([
    fetchGoogleModels(),
    fetchNvidiaModels(),
    fetchOpenRouterModels(),
  ])

  for (const model of [...googleModels, ...nvidiaModels, ...openRouterModels]) {
    models.set(model.id, model)
  }

  return NextResponse.json({
    models: Array.from(models.values()).sort((a, b) => {
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
