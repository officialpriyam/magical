'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, Settings, Shield, ArrowLeft } from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="w-64 shrink-0 border-r border-white/10 bg-[#0b0b0c] flex flex-col">
      <div className="p-4 border-b border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-400" />
          <span className="text-lg font-semibold text-white">Admin Panel</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
