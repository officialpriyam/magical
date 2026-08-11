import type { ComponentResult } from '../asset-imports/types'

export interface ComponentTemplate {
  name: string
  category: string
  sourceCode: string
  dependencies: string[]
  previewDescription: string
  provider: 'aceternity' | 'magicui'
  tags: string[]
}

const componentIndex: ComponentTemplate[] = []

export function registerComponents(components: ComponentTemplate[]): void {
  componentIndex.push(...components)
}

export function searchComponents(
  query: string,
  limit = 10
): ComponentResult[] {
  const q = query.toLowerCase()
  return componentIndex
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.previewDescription.toLowerCase().includes(q)
    )
    .slice(0, limit)
    .map((c) => ({
      name: c.name,
      category: c.category,
      sourceCode: c.sourceCode,
      dependencies: c.dependencies,
      previewDescription: c.previewDescription,
      provider: c.provider,
    }))
}

export function getComponentsByCategory(category: string): ComponentResult[] {
  const q = category.toLowerCase()
  return componentIndex
    .filter((c) => c.category.toLowerCase() === q)
    .map((c) => ({
      name: c.name,
      category: c.category,
      sourceCode: c.sourceCode,
      dependencies: c.dependencies,
      previewDescription: c.previewDescription,
      provider: c.provider,
    }))
}

export function getAllCategories(): string[] {
  const cats = new Set(componentIndex.map((c) => c.category))
  return Array.from(cats).sort()
}
