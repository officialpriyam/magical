import type { Model3DResult, SearchOptions } from './types'
import { getCached, setCache } from './cache'

interface PolyHavenAsset {
  name: string
  slug: string
  categories: string[]
  type: string
}

interface PolyHavenFiles {
  gltf: { [key: string]: { url: string } }
}

export async function searchPolyHaven(
  query: string,
  options: SearchOptions = {}
): Promise<Model3DResult[]> {
  const { limit = 10, category } = options

  const cacheKey = `polyhaven:${query}:${limit}:${category || 'any'}`
  const cached = getCached<Model3DResult[]>(cacheKey)
  if (cached) return cached

  try {
    const params = new URLSearchParams({ type: 'models' })
    if (category) params.set('categories', category)

    const listRes = await fetch(
      `https://api.polyhaven.com/assets?${params}`
    )
    if (!listRes.ok) return []
    const assets: PolyHavenAsset[] = await listRes.json()

    const filtered = assets
      .filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.categories.some((c) =>
            c.toLowerCase().includes(query.toLowerCase())
          )
      )
      .slice(0, limit)

    const results: Model3DResult[] = await Promise.all(
      filtered.map(async (asset) => {
        try {
          const fileRes = await fetch(
            `https://api.polyhaven.com/files/${asset.slug}`
          )
          if (!fileRes.ok)
            return {
              name: asset.name,
              thumbnailUrl: '',
              source: 'polyhaven' as const,
            }
          const files: PolyHavenFiles = await fileRes.json()
          const gltfKey = Object.keys(files.gltf)[0]
          return {
            name: asset.name,
            thumbnailUrl: '',
            gltfUrl: gltfKey ? files.gltf[gltfKey].url : undefined,
            source: 'polyhaven' as const,
          }
        } catch {
          return {
            name: asset.name,
            thumbnailUrl: '',
            source: 'polyhaven' as const,
          }
        }
      })
    )

    setCache(cacheKey, results)
    return results
  } catch {
    return []
  }
}
