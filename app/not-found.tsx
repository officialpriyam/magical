'use client'

import Link from 'next/link'
import { ArrowLeft, Home, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NotFound() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#080809] px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.06]">
          <span className="text-4xl font-bold text-white/80">404</span>
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-white">Page not found</h1>
        <p className="mb-8 max-w-md text-sm text-white/50">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="mb-6 w-full max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`)
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.12]"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
