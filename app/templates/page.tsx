'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { njtTemplates, njtCategories, type NJTTemplate } from '@/lib/nextjstemplates-data'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { ExternalLink, GitFork, Loader2, X, Search, Rocket, GitBranch } from 'lucide-react'

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedTemplate, setSelectedTemplate] = useState<NJTTemplate | null>(null)
  const [cloning, setCloning] = useState(false)
  const [cloningTemplate, setCloningTemplate] = useState<NJTTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [cloningProgress, setCloningProgress] = useState('')

  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session: authSession } }: { data: { session: { user: { id: string } } | null } }) => {
      setAuthChecked(true)
      if (!authSession) {
        // Allow browsing, but cloning requires auth
      }
    })
  }, [supabase])

  const filteredTemplates = njtTemplates.filter(t => {
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const handleUseTemplate = async (template: NJTTemplate) => {
    // Check auth
    const { data: { session: sess } } = await supabase!.auth.getSession()
    if (!sess) {
      router.push('/auth/login')
      return
    }

    // Start cloning flow
    setCloningTemplate(template)
    setCloning(true)
    setSelectedTemplate(null)
    setCloningProgress('Starting sandbox...')

    try {
      setCloningProgress('Cloning repository...')

      // Call the clone API — this starts a sandbox, clones the repo, saves files to RustFS
      const response = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'nextjs-developer',
          githubRepo: template.githubRepo,
          templateName: template.name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Clone failed')
      }

      setCloningProgress(`Installing dependencies...`)

      // Show completion for a moment
      setTimeout(() => {
        setCloningProgress(`Cloned! ${data.fileCount || 0} files ready`)
      }, 1000)

      // Redirect to chat — files are already in RustFS storage, sandbox will hydrate from there
      setTimeout(() => {
        router.push(`/chat/${data.projectId}`)
      }, 2000)
    } catch (error) {
      console.error('Failed to clone template:', error)
      setCloning(false)
      setCloningTemplate(null)
      setCloningProgress('')
      alert('Failed to clone template. Please try again.')
    }
  }

  return (
    <div className="bg-[#0a0a0b] min-h-screen">
      {/* Cloning Overlay */}
      {cloning && cloningTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0b]/95 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6 max-w-md mx-auto px-6">
            {/* Animated spinner */}
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
                <GitBranch className="h-8 w-8 text-purple-400 animate-pulse" />
              </div>
              {/* Orbiting dots */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-purple-400" />
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-400" />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">
                Cloning {cloningTemplate.name}
              </h2>
              <p className="text-sm text-white/50">
                {cloningProgress || `Setting up your project with ${cloningTemplate.name} template...`}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-xs">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                  style={{
                    animation: 'cloneProgress 2.2s ease-in-out forwards',
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-white/30">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cloning from GitHub...
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Templates</h1>
            <p className="text-sm text-white/50 mt-1">
              Start from a template — clone a real Next.js project and start building
            </p>
          </div>
          <a
            href="https://nextjstemplates.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Powered by NextJSTemplates
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Search + Category Tabs */}
      <div className="px-6 py-4 border-b border-white/[0.06] space-y-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-purple-500/50 focus:bg-white/[0.06]"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto">
          {njtCategories.map(category => (
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
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-lg">No templates found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => setSelectedTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedTemplate(null)}
        >
          <div
            className="relative w-full max-w-2xl mx-4 bg-[#111213] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-lg font-semibold text-white truncate">{selectedTemplate.name}</h2>
                <div className="flex gap-1.5">
                  {selectedTemplate.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/10 text-white/50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview Image */}
            <div className="aspect-video bg-white/5 overflow-hidden">
              <img
                src={selectedTemplate.previewImage}
                alt={selectedTemplate.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-white/60 mb-4">{selectedTemplate.description}</p>

              {/* GitHub Link */}
              <a
                href={selectedTemplate.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mb-6"
              >
                <GitFork className="h-3.5 w-3.5" />
                {selectedTemplate.githubRepo.replace('https://github.com/', '')}
              </a>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleUseTemplate(selectedTemplate)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-blue-500"
                >
                  <Rocket className="h-4 w-4" />
                  Use this template
                </button>
                {selectedTemplate.demoUrl && (
                  <a
                    href={selectedTemplate.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Live demo
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clone progress animation keyframes */}
      <style jsx>{`
        @keyframes cloneProgress {
          0% { width: 0%; }
          20% { width: 15%; }
          50% { width: 60%; }
          80% { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}

function TemplateCard({ template, onClick }: { template: NJTTemplate; onClick: () => void }) {
  const [imageError, setImageError] = useState(false)

  return (
    <button
      onClick={onClick}
      className="group text-left"
    >
      <div className="aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/[0.06] group-hover:border-purple-500/30 transition-all relative">
        {!imageError ? (
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

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white text-xs font-medium">
            <Rocket className="h-3.5 w-3.5" />
            Use template
          </div>
        </div>
      </div>

      <div className="mt-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white text-sm">{template.name}</h3>
          {template.tags[0] && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-white/5 text-white/30">
              {template.tags[0]}
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-1 line-clamp-2">{template.description}</p>
      </div>
    </button>
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
