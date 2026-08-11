export interface ImageResult {
  url: string
  thumbUrl: string
  photographer: string
  photographerUrl: string
  avgColor?: string
  source: 'pexels' | 'unsplash' | 'pixabay'
}

export interface Model3DResult {
  name: string
  thumbnailUrl: string
  gltfUrl?: string
  downloadUrl?: string
  source: 'polyhaven' | 'sketchfab'
}

export interface FontResult {
  family: string
  url: string
  category: string
  variants: string[]
}

export interface IconResult {
  name: string
  svg: string
  provider: string
}

export interface ComponentResult {
  name: string
  category: string
  sourceCode: string
  dependencies: string[]
  previewDescription: string
  provider: 'aceternity' | 'magicui'
}

export type AssetType = 'image' | 'model' | 'icon' | 'font' | 'component'

export type AssetResult = ImageResult | Model3DResult | FontResult | IconResult | ComponentResult

export interface SearchOptions {
  limit?: number
  page?: number
  orientation?: 'landscape' | 'portrait' | 'squarish'
  category?: string
  minSize?: number
}
