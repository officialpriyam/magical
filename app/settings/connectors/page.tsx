'use client'

import { useState } from 'react'
import { Search, Plus, ChevronRight } from 'lucide-react'

interface Connector {
  id: string
  name: string
  description: string
  category: 'popular' | 'database' | 'auth' | 'payments' | 'messaging' | 'storage' | 'CMS' | 'analytics' | 'email' | 'hosting'
  icon: string
  connected?: boolean
  official?: boolean
  inProgress?: boolean
}

const connectors: Connector[] = [
  // Popular
  { id: 'supabase', name: 'Supabase', description: 'Open source Firebase alternative with Postgres', category: 'popular', icon: 'S', connected: true, official: true },
  { id: 'github', name: 'GitHub', description: 'Code hosting and collaboration platform', category: 'popular', icon: 'G', connected: true, official: true },
  { id: 'vercel', name: 'Vercel', description: 'Frontend cloud platform for Next.js apps', category: 'popular', icon: 'V', official: true },
  { id: 'netlify', name: 'Netlify', description: 'Web development platform for modern sites', category: 'popular', icon: 'N', official: true },
  { id: 'stripe', name: 'Stripe', description: 'Financial infrastructure for the internet', category: 'popular', icon: 'S', official: true },
  { id: 'clerk', name: 'Clerk', description: 'Authentication and user management', category: 'popular', icon: 'C', official: true },
  { id: 'resend', name: 'Resend', description: 'Modern email API for developers', category: 'popular', icon: 'R', official: true },
  { id: 'neon', name: 'Neon', description: 'Serverless Postgres with branching', category: 'popular', icon: 'N', official: true },

  // Database
  { id: 'postgres', name: 'PostgreSQL', description: 'Advanced open source relational database', category: 'database', icon: 'P', official: true },
  { id: 'mongodb', name: 'MongoDB', description: 'Document database for modern applications', category: 'database', icon: 'M', official: true },
  { id: 'redis', name: 'Redis', description: 'In-memory data structure store', category: 'database', icon: 'R', official: true },
  { id: 'planetscale', name: 'PlanetScale', description: 'Serverless MySQL platform', category: 'database', icon: 'P' },
  { id: 'turso', name: 'Turso', description: 'SQLite edge database', category: 'database', icon: 'T' },
  { id: 'upstash', name: 'Upstash', description: 'Serverless Redis and Kafka', category: 'database', icon: 'U' },

  // Auth
  { id: 'auth0', name: 'Auth0', description: 'Identity platform for developers', category: 'auth', icon: 'A', official: true },
  { id: 'firebase-auth', name: 'Firebase Auth', description: 'Google authentication service', category: 'auth', icon: 'F', official: true },
  { id: 'lucia', name: 'Lucia', description: 'Open source auth library', category: 'auth', icon: 'L' },
  { id: 'workos', name: 'WorkOS', description: 'Enterprise ready auth platform', category: 'auth', icon: 'W' },
  { id: 'kinde', name: 'Kinde', description: 'Auth and user management', category: 'auth', icon: 'K' },

  // Payments
  { id: 'lemonsqueezy', name: 'Lemon Squeezy', description: 'Merchant of record platform', category: 'payments', icon: 'L', official: true },
  { id: 'paddle', name: 'Paddle', description: 'Complete payments infrastructure', category: 'payments', icon: 'P' },
  { id: 'paypal', name: 'PayPal', description: 'Online payments platform', category: 'payments', icon: 'P' },

  // Messaging
  { id: 'twilio', name: 'Twilio', description: 'Customer engagement platform', category: 'messaging', icon: 'T', official: true },
  { id: 'slack', name: 'Slack', description: 'Team collaboration hub', category: 'messaging', icon: 'S', official: true },
  { id: 'discord', name: 'Discord', description: 'Voice and chat platform', category: 'messaging', icon: 'D' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Email delivery service', category: 'messaging', icon: 'S' },

  // Storage
  { id: 'aws-s3', name: 'AWS S3', description: 'Cloud object storage', category: 'storage', icon: 'A', official: true },
  { id: 'cloudinary', name: 'Cloudinary', description: 'Image and video management', category: 'storage', icon: 'C', official: true },
  { id: 'uploadthing', name: 'UploadThing', description: 'File uploads for Next.js', category: 'storage', icon: 'U' },
  { id: 'r2', name: 'Cloudflare R2', description: 'S3 compatible object storage', category: 'storage', icon: 'C' },
  { id: 'imgix', name: 'imgix', description: 'Image processing service', category: 'storage', icon: 'I' },

  // CMS
  { id: 'contentful', name: 'Contentful', description: 'Headless content management', category: 'CMS', icon: 'C', official: true },
  { id: 'sanity', name: 'Sanity', description: 'Content operating system', category: 'CMS', icon: 'S', official: true },
  { id: 'strapi', name: 'Strapi', description: 'Open source headless CMS', category: 'CMS', icon: 'S' },
  { id: 'wordpress', name: 'WordPress', description: 'Content management system', category: 'CMS', icon: 'W' },
  { id: 'hygraph', name: 'Hygraph', description: 'GraphQL content platform', category: 'CMS', icon: 'H' },
  { id: 'payload', name: 'Payload CMS', description: 'Open source headless CMS', category: 'CMS', icon: 'P' },

  // Analytics
  { id: 'posthog', name: 'PostHog', description: 'Product analytics platform', category: 'analytics', icon: 'P', official: true },
  { id: 'mixpanel', name: 'Mixpanel', description: 'Product analytics', category: 'analytics', icon: 'M' },
  { id: 'amplitude', name: 'Amplitude', description: 'Digital analytics platform', category: 'analytics', icon: 'A' },
  { id: 'segment', name: 'Segment', description: 'Customer data platform', category: 'analytics', icon: 'S' },

  // Email
  { id: 'mailgun', name: 'Mailgun', description: 'Email API service', category: 'email', icon: 'M' },
  { id: 'mailchimp', name: 'Mailchimp', description: 'Marketing automation platform', category: 'email', icon: 'M' },
  { id: 'loops', name: 'Loops', description: 'Email for SaaS startups', category: 'email', icon: 'L' },

  // Hosting
  { id: 'railway', name: 'Railway', description: 'Infrastructure platform', category: 'hosting', icon: 'R', official: true },
  { id: 'fly', name: 'Fly.io', description: 'Run apps close to users', category: 'hosting', icon: 'F' },
  { id: 'render', name: 'Render', description: 'Cloud application platform', category: 'hosting', icon: 'R' },
  { id: 'digitalocean', name: 'DigitalOcean', description: 'Cloud computing platform', category: 'hosting', icon: 'D' },
  { id: 'huggingface', name: 'Hugging Face', description: 'ML model hosting', category: 'hosting', icon: 'H' },
]

const categories = [
  { id: 'popular', label: 'Popular', count: 8 },
  { id: 'database', label: 'Databases', count: 6 },
  { id: 'auth', label: 'Authentication', count: 5 },
  { id: 'payments', label: 'Payments', count: 3 },
  { id: 'messaging', label: 'Messaging', count: 4 },
  { id: 'storage', label: 'Storage', count: 5 },
  { id: 'CMS', label: 'CMS', count: 6 },
  { id: 'analytics', label: 'Analytics', count: 4 },
  { id: 'email', label: 'Email', count: 3 },
  { id: 'hosting', label: 'Hosting', count: 5 },
]

export default function ConnectorsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('popular')
  const [view, setView] = useState<'popular' | 'connected' | 'upcoming' | 'workspace'>('popular')

  const filtered = connectors.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
    if (view === 'connected') return matchesSearch && c.connected
    if (view === 'popular') return matchesSearch && (c.category === 'popular' || c.official)
    return matchesSearch
  })

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Connectors</h1>
          <p className="mt-1 text-sm text-white/50">
            Connect your favorite tools and services to your workspace.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1EAEDB] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#1EAEDB]/90"
        >
          <Plus className="h-4 w-4" />
          Create connector
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {[
          { id: 'popular' as const, label: 'Popular' },
          { id: 'connected' as const, label: 'Connected' },
          { id: 'upcoming' as const, label: 'Upcoming' },
          { id: 'workspace' as const, label: 'Workspace connectors' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              view === tab.id
                ? 'bg-white/[0.12] text-white'
                : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Categories sidebar */}
      <div className="flex gap-6">
        {/* Left sidebar - categories */}
        <div className="w-48 shrink-0">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-white/35">
            Categories
          </div>
          <nav className="space-y-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition ${
                  activeCategory === cat.id
                    ? 'bg-white/[0.1] text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-[11px] text-white/30">{cat.count}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search connectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-white/20"
            />
          </div>

          {/* Connectors grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((connector) => (
              <div
                key={connector.id}
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
                  {connector.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{connector.name}</span>
                    {connector.official && (
                      <span className="rounded bg-[#1EAEDB]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#1EAEDB]">
                        Official
                      </span>
                    )}
                    {connector.connected && (
                      <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">{connector.description}</p>
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {connector.connected ? (
                    <button
                      type="button"
                      className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.1]"
                    >
                      Settings
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1EAEDB] px-3 py-1.5 text-xs font-medium text-black transition hover:bg-[#1EAEDB]/90"
                    >
                      Install
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <p className="text-sm text-white/40">No connectors found matching &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
