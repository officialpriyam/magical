'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, FolderOpen, Clock3, GitBranch, Grid3X3, List, LayoutGrid, ChevronDown, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { getProjects, Project } from '@/lib/database'
import { useAuth } from '@/lib/auth'
import { useUserTeam } from '@/lib/user-team-provider'
import { getProjectGitHubWorkspace } from '@/lib/database'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

type ProjectShelfView = 'all' | 'recent' | 'github'

export default function ProjectsPage() {
  const { session } = useAuth(() => {}, () => {})
  const { userTeam } = useUserTeam()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<ProjectShelfView>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'last-edited' | 'name'>('last-edited')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'public'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [gridLayout, setGridLayout] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (!session?.user?.id) return

    async function loadProjects() {
      setIsLoading(true)
      try {
        const allProjects = await getProjects(supabase, session!.user.id)
        setProjects(allProjects || [])
      } catch (error) {
        console.error('Failed to load projects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProjects()
  }, [session?.user?.id, supabase])

  const filteredProjects = useMemo(() => {
    let filtered = [...projects]

    // View filter
    if (view === 'github') {
      filtered = filtered.filter((p) => getProjectGitHubWorkspace(p))
    } else if (view === 'recent') {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      filtered = filtered.filter((p) => new Date(p.updated_at) >= fourteenDaysAgo)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) => p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
      )
    }

    // Sort
    if (sortBy === 'last-edited') {
      filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    } else {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }

    return filtered
  }, [projects, view, searchQuery, sortBy])

  // Group by time
  const groupedProjects = useMemo(() => {
    const now = new Date()
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const active: Project[] = []
    const recent: Project[] = []
    const inactive: Project[] = []

    filteredProjects.forEach((p) => {
      const updated = new Date(p.updated_at)
      if (updated >= fourteenDaysAgo) {
        active.push(p)
      } else if (updated >= sixtyDaysAgo) {
        recent.push(p)
      } else {
        inactive.push(p)
      }
    })

    return { active, recent, inactive }
  }, [filteredProjects])

  const githubCount = projects.filter((p) => getProjectGitHubWorkspace(p)).length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Top nav */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f97316] text-[10px] font-bold text-white">
                M
              </div>
              <span className="text-sm font-medium text-white">All Projects</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search your projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-[#f97316]/50"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 outline-none"
            >
              <option value="last-edited">Last edited</option>
              <option value="name">Name</option>
            </select>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as typeof visibilityFilter)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 outline-none"
            >
              <option value="all">Any visibility</option>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 outline-none"
            >
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
              <button
                type="button"
                onClick={() => setGridLayout('grid')}
                className={cn(
                  'rounded-md p-1.5 transition',
                  gridLayout === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setGridLayout('list')}
                className={cn(
                  'rounded-md p-1.5 transition',
                  gridLayout === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white',
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* View tabs */}
        <div className="mb-6 flex items-center gap-1 text-xs text-white/60">
          <button
            type="button"
            onClick={() => setView('all')}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 font-medium transition',
              view === 'all'
                ? 'border-[#f97316]/50 bg-[#f97316]/15 text-[#f97316]'
                : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white',
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            All projects
            <span className="ml-1 text-[10px] text-white/40">{projects.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setView('recent')}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 font-medium transition',
              view === 'recent'
                ? 'border-[#f97316]/50 bg-[#f97316]/15 text-[#f97316]'
                : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white',
            )}
          >
            <Clock3 className="h-3.5 w-3.5" />
            Active in last 14 days
          </button>
          <button
            type="button"
            onClick={() => setView('github')}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 font-medium transition',
              view === 'github'
                ? 'border-[#f97316]/50 bg-[#f97316]/15 text-[#f97316]'
                : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white',
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Connected to GitHub
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-sm text-white/55">Loading projects...</div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-white/5 p-3">
              <FolderOpen className="h-6 w-6 text-white/30" />
            </div>
            <p className="text-sm text-white/50">
              {searchQuery ? 'No projects match your search.' : 'No projects yet. Start building to see them here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupedProjects.active.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-medium text-white/70">Active in last 14 days</h2>
                <div className={gridLayout === 'grid' ? 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
                  {groupedProjects.active.map((project) => (
                    <ProjectCard key={project.id} project={project} layout={gridLayout} />
                  ))}
                </div>
              </section>
            )}

            {groupedProjects.recent.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-medium text-white/70">Active in last 60 days</h2>
                <div className={gridLayout === 'grid' ? 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
                  {groupedProjects.recent.map((project) => (
                    <ProjectCard key={project.id} project={project} layout={gridLayout} />
                  ))}
                </div>
              </section>
            )}

            {groupedProjects.inactive.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-medium text-white/70">Inactive 60+ days</h2>
                <div className={gridLayout === 'grid' ? 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
                  {groupedProjects.inactive.map((project) => (
                    <ProjectCard key={project.id} project={project} layout={gridLayout} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, layout }: { project: Project; layout: 'grid' | 'list' }) {
  const githubWorkspace = getProjectGitHubWorkspace(project)
  const previewUrl = project.metadata && typeof project.metadata === 'object'
    ? (project.metadata as Record<string, any>).previewImageUrl ||
      (project.metadata as Record<string, any>).imageUrl ||
      (project.metadata as Record<string, any>).thumbnailUrl
    : null

  if (layout === 'list') {
    return (
      <Link
        href={`/?projectId=${project.id}`}
        className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
      >
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/30">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{project.title || 'Untitled project'}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
            <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
            {githubWorkspace && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <GitBranch className="h-3 w-3" />
                <span>GitHub</span>
              </>
            )}
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50">
          Local project
        </span>
      </Link>
    )
  }

  return (
    <Link
      href={`/?projectId=${project.id}`}
      className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#0b0d0b]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover opacity-85 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/25">No image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d0b]/70 via-transparent to-transparent" />
        <div className="absolute bottom-2 right-2">
          <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur-sm">
            {githubWorkspace ? 'GitHub' : 'Local project'}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-white">{project.title || 'Untitled project'}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
          <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  )
}
