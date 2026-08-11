import type { ImageResult, SearchOptions } from './types'
import { getCached, setCache } from './cache'

interface PexelsPhoto {
  src: { large: string; medium: string; small: string }
  photographer: string
  photographer_url: string
  avg_color: string
}

interface PexelsResponse {
  photos: PexelsPhoto[]
}

export async function searchPexels(
  query: string,
  options: SearchOptions = {}
): Promise<ImageResult[]> {
  const { limit = 10, orientation } = options
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []

  const cacheKey = `pexels:${query}:${limit}:${orientation || 'any'}`
  const cached = getCached<ImageResult[]>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    query,
    per_page: String(limit),
  })
  if (orientation) params.set('orientation', orientation)

  try {
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) return []
    const data: PexelsResponse = await res.json()

    const results: ImageResult[] = (data.photos || []).map((p) => ({
      url: p.src.large,
      thumbUrl: p.src.medium,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      avgColor: p.avg_color,
      source: 'pexels' as const,
    }))

    setCache(cacheKey, results)
    return results
  } catch {
    return []
  }
}
