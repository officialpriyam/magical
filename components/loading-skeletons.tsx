'use client'

import { Skeleton } from '@/components/ui/skeleton'

// ─── Chat area skeleton ──────────────────────────────────────
export function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4 animate-in fade-in duration-300">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[70%] space-y-2">
          <Skeleton className="h-4 w-32 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-48 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-24 rounded-lg bg-white/[0.06]" />
        </div>
      </div>

      {/* Assistant message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[80%] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-6 w-6 rounded-full bg-purple-500/10" />
            <Skeleton className="h-3 w-20 rounded bg-white/[0.06]" />
          </div>
          <Skeleton className="h-4 w-full rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-[90%] rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-[75%] rounded-lg bg-white/[0.06]" />
          {/* Code block skeleton */}
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <Skeleton className="h-3 w-16 rounded bg-white/[0.04]" />
            <Skeleton className="h-3 w-full rounded bg-white/[0.04]" />
            <Skeleton className="h-3 w-[85%] rounded bg-white/[0.04]" />
            <Skeleton className="h-3 w-[60%] rounded bg-white/[0.04]" />
            <Skeleton className="h-3 w-[90%] rounded bg-white/[0.04]" />
            <Skeleton className="h-3 w-[40%] rounded bg-white/[0.04]" />
          </div>
        </div>
      </div>

      {/* Second user message */}
      <div className="flex justify-end">
        <div className="max-w-[60%] space-y-2">
          <Skeleton className="h-4 w-40 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-28 rounded-lg bg-white/[0.06]" />
        </div>
      </div>

      {/* Second assistant skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[80%] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-6 w-6 rounded-full bg-purple-500/10" />
            <Skeleton className="h-3 w-20 rounded bg-white/[0.06]" />
          </div>
          <Skeleton className="h-4 w-full rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-[70%] rounded-lg bg-white/[0.06]" />
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard project card skeleton ──────────────────────────
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
      {/* Preview thumbnail skeleton */}
      <Skeleton className="aspect-video w-full rounded-lg bg-white/[0.04]" />
      {/* Title */}
      <Skeleton className="h-4 w-3/4 rounded bg-white/[0.06]" />
      {/* Description */}
      <Skeleton className="h-3 w-1/2 rounded bg-white/[0.04]" />
      {/* Meta row */}
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-3 w-12 rounded bg-white/[0.04]" />
        <Skeleton className="h-1 w-1 rounded-full bg-white/[0.10]" />
        <Skeleton className="h-3 w-16 rounded bg-white/[0.04]" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Tab filters skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full bg-white/[0.04]" />
        <Skeleton className="h-8 w-28 rounded-full bg-white/[0.04]" />
        <Skeleton className="h-8 w-32 rounded-full bg-white/[0.04]" />
      </div>
      {/* Project grid skeleton */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar chat history skeleton ────────────────────────────
export function SidebarChatSkeleton() {
  return (
    <div className="space-y-1 px-2 animate-in fade-in duration-200">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Skeleton className="h-3.5 w-3.5 shrink-0 rounded bg-white/[0.06]" />
          <Skeleton className="h-3.5 flex-1 rounded bg-white/[0.06]" style={{ width: `${60 + Math.random() * 30}%` }} />
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar workspace skeleton ───────────────────────────────
export function SidebarWorkspaceSkeleton() {
  return (
    <div className="space-y-3 px-3 py-2 animate-in fade-in duration-200">
      {/* Logo + name */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-4 w-24 rounded bg-white/[0.06]" />
      </div>
      {/* Workspace dropdown */}
      <Skeleton className="h-9 w-full rounded-lg bg-white/[0.04]" />
    </div>
  )
}

// ─── Message streaming skeleton (typing indicator) ────────────
export function StreamingSkeleton() {
  return (
    <div className="flex justify-start py-2">
      <div className="max-w-[80%] space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-white/30">Magical AI is thinking...</span>
        </div>
      </div>
    </div>
  )
}

// ─── Templates page skeleton ──────────────────────────────────
export function TemplatesSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-300">
      {/* Search + filters */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-48 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-8 w-16 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-8 w-20 rounded-lg bg-white/[0.04]" />
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-xl bg-white/[0.04]" />
            <Skeleton className="h-4 w-2/3 rounded bg-white/[0.06]" />
            <Skeleton className="h-3 w-full rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  )
}
