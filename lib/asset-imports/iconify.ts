import type { IconResult } from './types'
import { getCached, setCache } from './cache'

const POPULAR_SETS = [
  'lucide',
  'heroicons',
  'ph',
  'carbon',
  'mdi',
  'tabler',
  'solar',
  'hugeicons',
]

export async function searchIconify(
  query: string,
  limit = 20
): Promise<IconResult[]> {
  const cacheKey = `iconify:${query}:${limit}`
  const cached = getCached<IconResult[]>(cacheKey)
  if (cached) return cached

  const results: IconResult[] = []

  try {
    for (const set of POPULAR_SETS) {
      if (results.length >= limit) break

      const res = await fetch(
        `https://api.iconify.design/search?query=${query}&prefixes=${set}&limit=${limit - results.length}`
      )
      if (!res.ok) continue
      const data = await res.json()
      const icons: string[] = data.icons || []

      for (const icon of icons.slice(0, limit - results.length)) {
        const svgRes = await fetch(
          `https://api.iconify.design/${icon}.svg`
        )
        if (!svgRes.ok) continue
        const svg = await svgRes.text()
        results.push({
          name: icon,
          svg,
          provider: set,
        })
      }
    }
  } catch {
    // Return whatever we collected
  }

  setCache(cacheKey, results)
  return results
}

export async function getIconSvg(iconSet: string, iconName: string): Promise<string | null> {
  const cacheKey = `icon:${iconSet}:${iconName}`
  const cached = getCached<string>(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://api.iconify.design/${iconSet}/${iconName}.svg`
    )
    if (!res.ok) return null
    const svg = await res.text()
    setCache(cacheKey, svg)
    return svg
  } catch {
    return null
  }
}
