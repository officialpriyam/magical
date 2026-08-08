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
  Menu,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || 'U'
  const userName = session?.user?.email?.split('@')[0] || 'User'

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-[#080809]">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-[#0b0d0b] px-4 md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="text-sm text-white/60 hover:text-white"
        >
          Go back
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-white/10 bg-[#0b0d0b] transition-all duration-300",
        "fixed inset-y-0 left-0 z-40 md:relative md:z-auto",
        // Mobile: open/close
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: collapse/expand
        desktopCollapsed ? "md:w-16" : "md:w-64",
        // Mobile always w-64 when open
        "w-64"
      )}>
        {/* Back button */}
        <div className={cn(
          "hidden items-center border-b border-white/10 px-4 py-3 md:flex",
          desktopCollapsed ? "justify-center" : "gap-2"
        )}>
          {desktopCollapsed ? (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              title="Go back"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Go back
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setDesktopCollapsed(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Expand button when collapsed */}
        {desktopCollapsed && (
          <div className="hidden md:flex justify-center py-2">
            <button
              type="button"
              onClick={() => setDesktopCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white"
              title="Expand sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Search - hidden when collapsed on desktop */}
        {!desktopCollapsed && (
          <div className="px-3 pb-3 pt-14 md:pt-3">
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
        )}

        {/* Workspace selector - hidden when collapsed on desktop */}
        {!desktopCollapsed && (
          <div className="mx-3 mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
              {userInitial}
            </div>
            <span className="flex-1 truncate text-sm text-white">{userName}&apos;s Workspace</span>
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          </div>
        )}

        {/* Collapsed workspace avatar */}
        {desktopCollapsed && (
          <div className="hidden md:flex justify-center mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-black">
              {userInitial}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn(
          "flex-1 space-y-5 overflow-y-auto px-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          desktopCollapsed && "hidden md:flex md:flex-col md:items-center md:space-y-3 md:px-0"
        )}>
          {desktopCollapsed ? (
            // Collapsed icons only
            settingsNavigation.map((group) =>
              group.items.map((item) => {
                if (!item.href) return null
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-white/[0.1] text-white'
                        : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
                    )}
                    title={item.name}
                  >
                    <item.icon className="h-4 w-4" />
                  </Link>
                )
              })
            )
          ) : (
            // Full sidebar
            settingsNavigation.map((group) => (
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
            ))
          )}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
