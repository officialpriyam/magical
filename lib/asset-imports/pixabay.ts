import type { ImageResult, SearchOptions } from './types'
import { getCached, setCache } from './cache'

interface PixabayHit {
  largeImageURL: string
  webformatURL: string
  tags: string
  user: string
}

interface PixabayResponse {
  hits: PixabayHit[]
}

export async function searchPixabay(
  query: string,
  options: SearchOptions = {}
): Promise<ImageResult[]> {
  const { limit = 10 } = options
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return []

  const cacheKey = `pixabay:${query}:${limit}`
  const cached = getCached<ImageResult[]>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    per_page: String(limit),
    image_type: 'photo',
  })

  try {
    const res = await fetch(`https://pixabay.com/api/?${params}`)
    if (!res.ok) return []
    const data: PixabayResponse = await res.json()

    const results: ImageResult[] = (data.hits || []).map((h) => ({
      url: h.largeImageURL,
      thumbUrl: h.webformatURL,
      photographer: h.user,
      photographerUrl: '',
      source: 'pixabay' as const,
    }))

    setCache(cacheKey, results)
    return results
  } catch {
    return []
  }
}
