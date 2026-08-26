'use client'

import { useMemo } from 'react'
import { diffLines, Change } from 'diff'

export function InlineDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = useMemo(() => diffLines(oldText, newText), [oldText, newText])

  if (changes.length === 0) return null

  const totalAdded = changes.filter(c => c.added).length
  const totalRemoved = changes.filter(c => c.removed).length

  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.03]">
        <span className="text-[11px] font-mono text-emerald-400/80">+{totalAdded} added</span>
        <span className="text-[11px] font-mono text-red-400/80">-{totalRemoved} removed</span>
      </div>

      {/* Diff lines */}
      <div className="max-h-[300px] overflow-y-auto text-[12px] leading-[1.6] font-mono">
        {changes.map((change, i) => {
          const lines = (change.value || '').split('\n').filter((_, idx, arr) => {
            // Remove trailing empty line from split
            return !(idx === arr.length - 1 && arr[idx] === '')
          })

          return lines.map((line, j) => {
            const prefix = change.added ? '+' : change.removed ? '-' : ' '
            const bgColor = change.added
              ? 'bg-emerald-500/[0.08]'
              : change.removed
              ? 'bg-red-500/[0.08]'
              : 'bg-transparent'
            const textColor = change.added
              ? 'text-emerald-300/80'
              : change.removed
              ? 'text-red-300/80'
              : 'text-white/50'

            return (
              <div
                key={`${i}-${j}`}
                className={`flex items-stretch ${bgColor} hover:bg-white/[0.04] transition-colors`}
              >
                {/* Line number gutter */}
                <span className="w-8 shrink-0 text-right pr-2 select-none text-white/20 border-r border-white/[0.06]">
                  {prefix === '+' ? '+' : prefix === '-' ? '-' : ''}
                </span>
                {/* Content */}
                <span className={`flex-1 px-3 py-px ${textColor}`}>
                  <span className="text-white/20 select-none">{prefix} </span>
                  {line}
                </span>
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}
