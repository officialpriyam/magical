'use client'

import { cn } from '@/lib/utils'
import { 
  Shield, 
  Settings as SettingsIcon,
  ChevronLeft,
  Plug,
  CreditCard,
  Users,
  BookOpen,
  GitBranch,
  Globe,
  Lock,
  Search,
  Zap,
  FileText,
  Layers,
  Server,
  ShieldCheck,
  ScrollText,
  ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'

interface NavItem {
  name: string
  href?: string
  icon: React.ElementType
  badge?: string
}

const settingsNavigation: { section: string; items: NavItem[] }[] = [
  {
    section: 'Workspace',
    items: [
      { name: 'Workspace settings', href: '/settings/workspace', icon: SettingsIcon },
      { name: 'Plans & credit usage', href: '/settings/billing', icon: CreditCard },
    ],
  },
  {
    section: 'Access',
    items: [
      { name: 'People', href: '/settings/people', icon: Users },
      { name: 'Groups', icon: Users, badge: 'Upcoming' },
      { name: 'Identity', icon: Shield, badge: 'Upcoming' },
    ],
  },
  {
    section: 'Customization',
    items: [
      { name: 'Knowledge', href: '/settings/knowledge', icon: BookOpen },
      { name: 'Skills', href: '/settings/skills', icon: Zap },
      { name: 'Templates', icon: FileText, badge: 'Upcoming' },
      { name: 'Design systems', icon: Layers, badge: 'Upcoming' },
      { name: 'Connectors', href: '/settings/connectors', icon: Plug },
    ],
  },
  {
    section: 'Build & deploy',
    items: [
      { name: 'Git', href: '/settings/git', icon: GitBranch },
      { name: 'MCP server', icon: Server, badge: 'Upcoming' },
      { name: 'Workspace domains', icon: Globe, badge: 'Upcoming' },
    ],
  },
  {
    section: 'Security',
    items: [
      { name: 'Privacy & security', href: '/settings/privacy', icon: Lock },
      { name: 'Security center', icon: ShieldCheck, badge: 'Upcoming' },
      { name: 'Audit logs', icon: ScrollText, badge: 'Upcoming' },
    ],
  },
]

const noop = () => {}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { session } = useAuth(noop, noop)
  const [searchQuery, setSearchQuery] = useState('')

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || 'U'
  const userName = session?.user?.email?.split('@')[0] || 'User'

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-[#080809]">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r border-white/10 bg-[#0b0d0b]">
        {/* Back button */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Go back
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
            />
          </div>
        </div>

        {/* Workspace selector */}
        <div className="mx-3 mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
            {userInitial}
          </div>
          <span className="flex-1 truncate text-sm text-white">{userName}&apos;s Workspace</span>
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {settingsNavigation.map((group) => (
            <div key={group.section}>
              <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-white/35">
                {group.section}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href && pathname === item.href
                  const isUpcoming = !item.href

                  if (isUpcoming) {
                    return (
                      <div
                        key={item.name}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-white/30"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href!}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-white/[0.1] text-white'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
