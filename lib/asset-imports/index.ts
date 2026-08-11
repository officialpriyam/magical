// Asset Import System
// Unified interface for searching images, 3D models, fonts, icons, and components.
// Server-side only — do not import in client components.

import type { AssetType, AssetResult, SearchOptions, ImageResult, Model3DResult } from './types'

// Import component registrations
import '../component-templates/aceternity/index'
import '../component-templates/magicui/index'
import { searchComponents } from '../component-templates/index'

// Image providers
import { searchPexels } from './pexels'
import { searchUnsplash } from './unsplash'
import { searchPixabay } from './pixabay'

// 3D model providers
import { searchPolyHaven } from './polyhaven'
import { searchSketchfab } from './sketchfab'

// Font & icon providers
import { searchGoogleFonts } from './google-fonts'
import { searchIconify } from './iconify'

export type { ImageResult, Model3DResult, FontResult, IconResult, ComponentResult } from './types'

/**
 * Unified asset search function. Routes to the appropriate provider based on type.
 *
 * - 'image': Pexels (primary) → Unsplash (fallback) → Pixabay (fallback)
 * - 'model': Poly Haven (primary, no key) → Sketchfab (fallback, needs key)
 * - 'font': Google Fonts (built-in, no key needed)
 * - 'icon': Iconify (no key needed)
 * - 'component': Internal vendored Aceternity + Magic UI components
 */
export async function searchAssets(
  type: AssetType,
  query: string,
  options: SearchOptions = {}
): Promise<AssetResult[]> {
  const { limit = 10 } = options

  switch (type) {
    case 'image':
      return searchImages(query, options)

    case 'model':
      return searchModels(query, options)

    case 'font':
      return searchGoogleFonts(query, limit)

    case 'icon':
      return searchIconify(query, limit)

    case 'component':
      return searchComponents(query, limit)

    default:
      return []
  }
}

/**
 * Search images with provider fallback: Pexels → Unsplash → Pixabay
 */
async function searchImages(
  query: string,
  options: SearchOptions
): Promise<ImageResult[]> {
  // Primary: Pexels (higher rate limit)
  const pexelsResults = await searchPexels(query, options)
  if (pexelsResults.length > 0) return pexelsResults

  // Fallback 1: Unsplash
  const unsplashResults = await searchUnsplash(query, options)
  if (unsplashResults.length > 0) return unsplashResults

  // Fallback 2: Pixabay
  return searchPixabay(query, options)
}

/**
 * Search 3D models with provider fallback: Poly Haven → Sketchfab
 */
async function searchModels(
  query: string,
  options: SearchOptions
): Promise<Model3DResult[]> {
  // Primary: Poly Haven (free, no key)
  const polyResults = await searchPolyHaven(query, options)
  if (polyResults.length > 0) return polyResults

  // Fallback: Sketchfab (needs key)
  return searchSketchfab(query, options)
}

/**
 * Get font link tag for HTML/CSS injection
 */
export { getFontLinkTag } from './google-fonts'

/**
 * Get a single icon SVG by set and name
 */
export { getIconSvg } from './iconify'

/**
 * Clear all cached search results
 */
export { clearCache } from './cache'
