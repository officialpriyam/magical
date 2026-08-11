import type { FontResult } from './types'
import { getCached, setCache } from './cache'

const COMMON_FONTS: { family: string; category: string; variants: string[] }[] = [
  { family: 'Inter', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Roboto', category: 'sans-serif', variants: ['300', '400', '500', '700'] },
  { family: 'Open Sans', category: 'sans-serif', variants: ['300', '400', '600', '700'] },
  { family: 'Lato', category: 'sans-serif', variants: ['300', '400', '700'] },
  { family: 'Montserrat', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Poppins', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Playfair Display', category: 'serif', variants: ['400', '500', '600', '700'] },
  { family: 'Merriweather', category: 'serif', variants: ['300', '400', '700'] },
  { family: 'Source Code Pro', category: 'monospace', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Fira Code', category: 'monospace', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Space Grotesk', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Sora', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800'] },
  { family: 'DM Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Libre Baskerville', category: 'serif', variants: ['400', '700'] },
  { family: 'Barlow Condensed', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Alfa Slab One', category: 'display', variants: ['400'] },
  { family: 'Bebas Neue', category: 'display', variants: ['400'] },
  { family: 'Oswald', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Raleway', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Nunito', category: 'sans-serif', variants: ['300', '400', '600', '700'] },
  { family: 'Work Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Fraunces', category: 'serif', variants: ['400', '500', '600', '700'] },
  { family: 'Space Mono', category: 'monospace', variants: ['400', '700'] },
  { family: 'Josefin Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
  { family: 'Quicksand', category: 'sans-serif', variants: ['300', '400', '500', '600', '700'] },
]

export function searchGoogleFonts(
  query: string,
  limit = 10
): FontResult[] {
  const cacheKey = `fonts:${query}:${limit}`
  const cached = getCached<FontResult[]>(cacheKey)
  if (cached) return cached

  const q = query.toLowerCase()
  const results: FontResult[] = COMMON_FONTS.filter(
    (f) =>
      f.family.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
  )
    .slice(0, limit)
    .map((f) => ({
      family: f.family,
      url: `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, '+')}&display=swap`,
      category: f.category,
      variants: f.variants,
    }))

  setCache(cacheKey, results)
  return results
}

export function getFontLinkTag(family: string): string {
  const encoded = family.replace(/ /g, '+')
  return `<link href="https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap" rel="stylesheet" />`
}
