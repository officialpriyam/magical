'use client'

import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { ReactNode } from 'react'

interface PageHeaderProps {
  showMobileMenu?: boolean
  onToggleMobileMenu?: () => void
  isMobileSidebarOpen?: boolean
  actions?: ReactNode
}

export function PageHeader({
  showMobileMenu = false,
  onToggleMobileMenu,
  isMobileSidebarOpen,
  actions
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-2">
          {showMobileMenu && (
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              onClick={onToggleMobileMenu}
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}

          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-semibold">Magical AI</h1>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
          {actions}
        </div>
      </div>
    </header>
  )
}
