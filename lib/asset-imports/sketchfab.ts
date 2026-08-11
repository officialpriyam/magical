import type { Model3DResult, SearchOptions } from './types'
import { getCached, setCache } from './cache'

interface SketchfabModel {
  uid: string
  name: string
  thumbnails: { images: { url: string }[] }
  isDownloadable: boolean
}

interface SketchfabResponse {
  results: SketchfabModel[]
}

export async function searchSketchfab(
  query: string,
  options: SearchOptions = {}
): Promise<Model3DResult[]> {
  const { limit = 10 } = options
  const token = process.env.SKETCHFAB_API_TOKEN
  if (!token) return []

  const cacheKey = `sketchfab:${query}:${limit}`
  const cached = getCached<Model3DResult[]>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    type: 'models',
    q: query,
    downloadable: 'true',
    count: String(limit),
  })

  try {
    const res = await fetch(
      `https://api.sketchfab.com/v3/search?${params}`,
      {
        headers: { Authorization: `Token ${token}` },
      }
    )
    if (!res.ok) return []
    const data: SketchfabResponse = await res.json()

    const results: Model3DResult[] = (data.results || []).map((m) => ({
      name: m.name,
      thumbnailUrl: m.thumbnails?.images?.[0]?.url || '',
      downloadUrl: m.isDownloadable
        ? `https://api.sketchfab.com/v3/models/${m.uid}/download`
        : undefined,
      source: 'sketchfab' as const,
    }))

    setCache(cacheKey, results)
    return results
  } catch {
    return []
  }
}
