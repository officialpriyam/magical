'use client'

import { useState } from 'react'
import { Search, Plus, Check } from 'lucide-react'
import Link from 'next/link'

interface Connector {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  connected?: boolean
  active?: boolean
  upcoming?: boolean
}

const connectors: Connector[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with Postgres',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.7 21.8c-.3.3-.8.1-.8-.3V13h8.1c.7 0 1.1.8.7 1.3l-8 7.5zM10.3 2.2c.3-.3.8-.1.8.3V11H3c-.7 0-1.1-.8-.7-1.3l8-7.5z" opacity="0.8"/><path d="M11.1 21.8c-.3.3-.8.1-.8-.3V13h8.1c.7 0 1.1.8.7 1.3l-8 7.5z"/><path d="M7.7 2.2c.3-.3.8-.1.8.3V11H.4c-.7 0-1.1-.8-.7-1.3l7.4-7.5z"/></svg>,
    connected: true,
    active: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Code hosting and collaboration platform',
    icon: <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>,
    connected: true,
    active: true,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Frontend cloud platform for Next.js apps',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L24 22H0L12 1z"/></svg>,
    upcoming: true,
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Web development platform for modern sites',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.934 8.519a1.044 1.044 0 0 1 .303.22l2.089-3.622A.683.683 0 0 0 19.292 4.5H4.708a.686.686 0 0 0-.59.341L1.26 11.39c-.078.133-.074.289.006.417l5.24 8.265c.049.077.133.12.22.12h7.04c.087 0 .171-.043.22-.12l5.24-8.265a.468.468 0 0 0 .006-.417l-2.09-3.621a1.04 1.04 0 0 1 .302-.22zM12 14.267L7.72 6.5h8.56L12 14.267z"/></svg>,
    upcoming: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Financial infrastructure for the internet',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>,
    upcoming: true,
  },
  {
    id: 'clerk',
    name: 'Clerk',
    description: 'Authentication and user management',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm0 4.8c1.548 0 2.8 1.252 2.8 2.8S13.548 10.4 12 10.4 9.2 9.148 9.2 7.6s1.252-2.8 2.8-2.8zm0 14.4c-3.2 0-6-1.6-6-4.8 0-2.4 2.4-3.6 6-3.6s6 1.2 6 3.6c0 3.2-2.8 4.8-6 4.8z"/></svg>,
    upcoming: true,
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Modern email API for developers',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>,
    upcoming: true,
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Serverless Postgres with branching',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.802 8.598v6.804c0 .51-.26.986-.688 1.255l-5.118 3.022c-.427.253-.953.253-1.38 0L5.498 16.657c-.428-.253-.688-.73-.688-1.24V8.598c0-.51.26-.987.688-1.255l5.118-3.022c.427-.253.953-.253 1.38 0l5.118 3.022c.428.268.688.744.688 1.255zM12 2.764L5.498 6.548 12 10.332l6.502-3.784L12 2.764z"/></svg>,
    upcoming: true,
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'Document database for modern applications',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.889 9.884l.07.05A73.49 73.49 0 0 1 11.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 0 0 3.639-8.464c.01-.814-.103-1.662-.197-2.218z"/></svg>,
    upcoming: true,
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Customer engagement platform',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6.426 14.265A4.623 4.623 0 0 1 4.66 9.374c.006-.45.082-.896.223-1.318a4.648 4.648 0 0 1 3.243-2.868c.44-.1.897-.143 1.35-.126a4.623 4.623 0 0 1 4.548 3.762 4.62 4.62 0 0 1-1.3 4.572 4.62 4.62 0 0 1-4.763 1.386 4.62 4.62 0 0 1-1.535-.517z"/></svg>,
    upcoming: true,
  },
  {
    id: 'aws-s3',
    name: 'AWS S3',
    description: 'Cloud object storage',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.75 13.554v3.225c0 .612-.132 1.186-.37 1.704l2.024 2.024c.37-.623.596-1.332.596-2.09v-2.87c0-.66-.11-1.294-.31-1.884l-1.94.017zM6.375 13.554v3.225c0 .612.132 1.186.37 1.704l-2.024 2.024a5.98 5.98 0 0 1-.596-2.09v-2.87c0-.66.11-1.294.31-1.884l1.94.017z"/></svg>,
    upcoming: true,
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    description: 'Image and video management',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.956 8.268a5.34 5.34 0 0 0-1.473-2.136 5.354 5.354 0 0 0-2.16-1.29A5.255 5.255 0 0 0 2.625 4.5C1.175 4.5 0 5.67 0 7.12a5.31 5.31 0 0 0 .945 2.993 5.34 5.34 0 0 0 2.16 1.658c.336.106.688.168 1.05.188a5.374 5.374 0 0 0 2.176-.281 5.34 5.34 0 0 0 2.38-1.66l.024-.027.002.002a.192.192 0 0 1 .067-.08l.009-.005a.188.188 0 0 1 .083-.036l.013-.002a.18.18 0 0 1 .077.01l.014.006a.186.186 0 0 1 .067.064l.004.008a.185.185 0 0 1 .023.081l-.003.018a5.359 5.359 0 0 0 .384 3.033A5.37 5.37 0 0 0 9.375 21c1.38 0 2.643-.6 3.51-1.548a5.35 5.35 0 0 0 1.35-2.136 5.314 5.314 0 0 0-.003-2.14 5.339 5.339 0 0 0-1.35-2.136A5.37 5.37 0 0 0 9.375 12c-.674 0-1.315.145-1.89.404l-.006.003-.003-.006-.014-.01a.185.185 0 0 1-.033-.07l-.002-.014a.18.18 0 0 1 .013-.098l.006-.01a.188.188 0 0 1 .064-.07l.01-.005a.184.184 0 0 1 .083-.03l.017-.002c.028 0 .055.006.08.017l.009.004a.184.184 0 0 1 .068.065l.003.008a.187.187 0 0 1 .022.082l-.002.015-.001.008z"/></svg>,
    upcoming: true,
  },
  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Product analytics platform',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.8c1.548 0 2.8 1.252 2.8 2.8S13.548 10.4 12 10.4 9.2 9.148 9.2 7.6s1.252-2.8 2.8-2.8zm0 14.4c-3.2 0-6-1.6-6-4.8 0-2.4 2.4-3.6 6-3.6s6 1.2 6 3.6c0 3.2-2.8 4.8-6 4.8z"/></svg>,
    upcoming: true,
  },
  {
    id: 'contentful',
    name: 'Contentful',
    description: 'Headless content management',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.144 10.236V5.37h-3.28v4.866h-1.64V5.37H9.944v4.866H8.304V5.37H5.024v13.26h3.28v-4.866h1.64v4.866h3.28v-4.866h1.64v4.866h3.28V5.37h-3.28v4.866h-1.64z"/></svg>,
    upcoming: true,
  },
]

export default function ConnectorsPage() {
  const [search, setSearch] = useState('')

  const activeConnectors = connectors.filter((c) => c.active && (c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())))
  const upcomingConnectors = connectors.filter((c) => c.upcoming && (c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Connectors</h1>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ea580c]"
        >
          <Plus className="h-4 w-4" />
          Create connector
        </button>
      </div>
      <p className="mb-6 text-sm text-white/50">
        Connect your favorite tools and services to your workspace.
      </p>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search connectors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-[#f97316]/50"
        />
      </div>

      {/* Active */}
      {activeConnectors.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Available</h2>
          <div className="space-y-2">
            {activeConnectors.map((connector) => (
              <div
                key={connector.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:bg-white/[0.05]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                  {connector.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{connector.name}</span>
                    {connector.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-medium text-[#22c55e]">
                        <Check className="h-2.5 w-2.5" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{connector.description}</p>
                </div>
                <Link
                  href="/settings/integrations"
                  className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.1]"
                >
                  {connector.connected ? 'Settings' : 'Install'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingConnectors.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Upcoming</h2>
          <div className="space-y-2">
            {upcomingConnectors.map((connector) => (
              <div
                key={connector.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 opacity-60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/40">
                  {connector.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/60">{connector.name}</span>
                    <span className="rounded bg-[#f97316]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#f97316]">
                      Upcoming
                    </span>
                  </div>
                  <p className="text-xs text-white/30">{connector.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
