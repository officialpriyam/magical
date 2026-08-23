'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Globe, Search, ExternalLink, Loader2, FolderOpen, GitBranch } from 'lucide-react'

const CATEGORIES = ['Discover', 'Landing Page', 'Dashboard', 'Website', 'Prototype', 'Mobile App', 'Internal Tool', 'Personal'] as const

type CommunityProject = {
  id: string
  title: string
  description?: string
  template_id?: string
  is_public: boolean
  category?: string
  updated_at: string
  user_id: string
}

export default function CommunityPage() {
  const supabase = createSupabaseBrowserClient()
  const [projects, setProjects] = useState<CommunityProject[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('Discover')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function loadPublicProjects() {
      setLoading(true)
      try {
        const { data } = await supabase!
          .from('projects')
          .select('id, title, description, template_id, is_public, category, updated_at, user_id')
          .eq('is_public', true)
          .order('updated_at', { ascending: false })
          .limit(50)
        setProjects(data || [])
      } catch (err) {
        console.warn('Failed to load community projects:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPublicProjects()
  }, [supabase])

  const filteredProjects = useMemo(() => {
    let result = projects
    if (activeCategory !== 'Discover') {
      result = result.filter(p => p.category === activeCategory || (!p.category && activeCategory === 'Website'))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    }
    return result
  }, [projects, activeCategory, searchQuery])

  return (
    <div className="min-h-screen bg-[#0a0b0a]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0b0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">Magical AI</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm text-white/50 hover:text-white transition">Home</Link>
            <Link href="/community" className="text-sm text-white font-medium">Community</Link>
            <Link href="/projects" className="text-sm text-white/50 hover:text-white transition">Projects</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-600/10 rounded-full blur-[128px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-10 text-center">
          <p className="text-xs uppercase tracking-widest text-white/30 mb-4">// Featured Projects</p>
          <h1 className="text-4xl font-bold text-white mb-4 md:text-5xl">
            Featured Projects and Web Apps From The Community
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-white/40 leading-relaxed">
            A growing collection of AI-powered websites, apps, and templates built using Magical AI shared by developers, designers, and makers worldwide.
          </p>
        </div>
      </div>

      {/* Categories + Search */}
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3 overflow-x-auto">
          <div className="flex items-center gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeCategory === cat
                    ? 'bg-white text-black'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-56 rounded-full border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
            />
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            <span className="ml-3 text-sm text-white/40">Loading community projects...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
              <Globe className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/60">No public projects yet</p>
            <p className="text-xs text-white/35 mt-1">Build something and make it public to appear here!</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map(project => (
              <Link
                key={project.id}
                href={`/chat/${project.id}`}
                className="group overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[#111211]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_60%),linear-gradient(135deg,#151520,#111211_60%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111211] via-transparent to-black/10" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-white/50">
                      {project.template_id || 'Magical app'}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-white/25 group-hover:text-white/60 transition" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-white truncate">{project.title}</h3>
                  <p className="mt-1 text-xs text-white/35 line-clamp-2">{project.description || 'AI-generated project'}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/30">
                    <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    {project.category && (
                      <>
                        <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
                        <span>{project.category}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-12">
        <div className="mx-auto max-w-7xl px-4 py-8 flex items-center justify-between text-xs text-white/30">
          <span>© 2026 Magical AI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white/60 transition">Terms</a>
            <a href="#" className="hover:text-white/60 transition">Privacy</a>
            <a href="https://discord.gg/p6Sz3X3YFe" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
