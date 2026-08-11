'use client'

import { useState } from 'react'
import { motionsitesTemplates, getCategories, type MotionSitesTemplate } from '@/lib/motionsites-templates'

export function MotionSitesGallery() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const categories = getCategories()

  const filteredTemplates = selectedCategory === 'all'
    ? motionsitesTemplates
    : motionsitesTemplates.filter(t => t.category === selectedCategory)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Website Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Premium templates from MotionSites.ai — copy, paste, and launch
          </p>
        </div>
        <a
          href="https://motionsites.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse all on MotionSites.ai →
        </a>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTemplates.map(template => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ template }: { template: MotionSitesTemplate }) {
  const [imageError, setImageError] = useState(false)

  return (
    <a
      href={template.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative rounded-lg overflow-hidden bg-muted border border-border hover:border-foreground/20 transition-all"
    >
      <div className="aspect-video relative overflow-hidden">
        {!imageError ? (
          <img
            src={template.previewImage}
            alt={template.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
            Preview unavailable
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-white/80">Click to view on MotionSites.ai</span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{template.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{template.category}</p>
      </div>
    </a>
  )
}
