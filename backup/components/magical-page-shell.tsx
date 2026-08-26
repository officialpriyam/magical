import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function MagicalPageShell({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-[#080a08] text-foreground', className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,196,87,0.24),transparent_30%),radial-gradient(circle_at_14%_72%,rgba(40,127,96,0.16),transparent_26%),linear-gradient(180deg,#12160f_0%,#080a08_54%,#0f0c08_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,9,0.12),rgba(8,8,9,0)_48%,rgba(8,8,9,0.22))]" />
      <div className={cn('relative z-10', contentClassName)}>{children}</div>
    </div>
  )
}
