import { NextResponse } from 'next/server'
import staticModels from '@/lib/models.json'
import type { LLMModel } from '@/lib/models'

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

export async function GET() {
  const models = new Map<string, LLMModel>()

  for (const model of staticModels.models as LLMModel[]) {
    models.set(model.id, model)
  }

  const [googleModels, openRouterModels] = await Promise.all([
    fetchGoogleModels(),
    fetchOpenRouterModels(),
  ])

  for (const model of [...googleModels, ...openRouterModels]) {
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

async function fetchOpenRouterModels(): Promise<LLMModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Accept: 'application/json',
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
