import type { ImageResult, SearchOptions } from './types'
import { getCached, setCache } from './cache'

interface UnsplashPhoto {
  urls: { full: string; regular: string; small: string }
  user: { name: string; links: { html: string } }
}

interface UnsplashResponse {
  results: UnsplashPhoto[]
}

export async function searchUnsplash(
  query: string,
  options: SearchOptions = {}
): Promise<ImageResult[]> {
  const { limit = 10, orientation } = options
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return []

  const cacheKey = `unsplash:${query}:${limit}:${orientation || 'any'}`
  const cached = getCached<ImageResult[]>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    query,
    per_page: String(limit),
  })
  if (orientation) params.set('orientation', orientation)

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
      }
    )
    if (!res.ok) return []
    const data: UnsplashResponse = await res.json()

    const results: ImageResult[] = (data.results || []).map((p) => ({
      url: p.urls.regular,
      thumbUrl: p.urls.small,
      photographer: p.user.name,
      photographerUrl: p.user.links.html,
      source: 'unsplash' as const,
    }))

    setCache(cacheKey, results)
    return results
  } catch {
    return []
  }
}
