'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motionsitesTemplates, getCategories, type MotionSitesTemplate } from '@/lib/motionsites-templates'
import { X, Copy, Check } from 'lucide-react'

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<MotionSitesTemplate | null>(null)
  const [copied, setCopied] = useState(false)
  const categories = getCategories()
  const router = useRouter()

  const filteredTemplates = selectedCategory === 'all'
    ? motionsitesTemplates
    : motionsitesTemplates.filter(t => t.category === selectedCategory)

  const handleUseTemplate = (template: MotionSitesTemplate) => {
    setSelectedTemplate(template)
    setCopied(false)
  }

  const handleCopyAndRedirect = async () => {
    if (!selectedTemplate) return
    try {
      await navigator.clipboard.writeText(selectedTemplate.prompt)
      setCopied(true)
      setTimeout(() => {
        router.push('/')
      }, 500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = selectedTemplate.prompt
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => {
        router.push('/')
      }, 500)
    }
  }

  return (
    <div className="bg-[#0a0a0b]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-5">
        <h1 className="text-2xl font-bold text-white">Templates</h1>
        <p className="text-sm text-white/50 mt-1">Start from a template to build your next project</p>
      </div>

      {/* Category Tabs */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-white text-black font-medium'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => handleUseTemplate(template)}
            />
          ))}
        </div>
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedTemplate(null)}
        >
          <div
            className="relative w-full max-w-4xl mx-4 bg-[#111211] rounded-xl overflow-hidden border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">{selectedTemplate.name}</h2>
                <span className="text-sm text-white/40">by Magical AI</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyAndRedirect}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy prompt & start
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="aspect-video rounded-lg overflow-hidden bg-white/5">
                {selectedTemplate.previewImage && !selectedTemplate.previewImage.includes('undefined') ? (
                  <img
                    src={selectedTemplate.previewImage}
                    alt={selectedTemplate.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        const fallback = document.createElement('div')
                        fallback.className = 'w-full h-full flex items-center justify-center text-white/50 text-sm font-medium'
                        fallback.style.background = getGradientFromName(selectedTemplate.name)
                        fallback.textContent = selectedTemplate.name
                        parent.appendChild(fallback)
                      }
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white/50 text-sm font-medium"
                    style={{ background: getGradientFromName(selectedTemplate.name) }}
                  >
                    {selectedTemplate.name}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-white/60">{selectedTemplate.description}</p>
                <p className="text-xs text-white/30 mt-2">Category: {selectedTemplate.category}</p>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 mb-2">Prompt preview:</p>
                <p className="text-sm text-white/70 line-clamp-3">{selectedTemplate.prompt}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getGradientFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h1 = Math.abs(hash) % 360
  const h2 = (h1 + 40) % 360
  return `linear-gradient(135deg, hsl(${h1}, 60%, 25%), hsl(${h2}, 50%, 15%))`
}

function TemplateCard({ template, onClick }: { template: MotionSitesTemplate; onClick: () => void }) {
  const [imageError, setImageError] = useState(false)

  return (
    <button
      onClick={onClick}
      className="group text-left"
    >
      <div className="aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/[0.06] group-hover:border-white/20 transition-all">
        {!imageError && template.previewImage ? (
          <img
            src={template.previewImage}
            alt={template.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white/50 text-sm font-medium"
            style={{ background: getGradientFromName(template.name) }}
          >
            {template.name}
          </div>
        )}
      </div>
      <div className="mt-3 px-1">
        <h3 className="font-medium text-white text-sm">{template.name}</h3>
        <p className="text-xs text-white/40 mt-1 line-clamp-1">{template.description}</p>
      </div>
    </button>
  )
}
