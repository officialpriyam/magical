import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlashCommand } from '@/lib/slash-commands'
import { Command, Sparkles, Bot, Code, FileText, HelpCircle } from 'lucide-react'

interface SlashCommandMenuProps {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  position?: { top: number; left: number }
}

const categoryIcons: Record<string, React.ReactNode> = {
  Agent: <Bot className="w-3.5 h-3.5" />,
  Code: <Code className="w-3.5 h-3.5" />,
  Testing: <Code className="w-3.5 h-3.5" />,
  Docs: <FileText className="w-3.5 h-3.5" />,
  System: <HelpCircle className="w-3.5 h-3.5" />,
}

const categoryColors: Record<string, string> = {
  Agent: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  Code: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  Testing: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  Docs: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  System: 'bg-white/10 text-white/50 border-white/10',
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  position = { top: 0, left: 0 }
}: SlashCommandMenuProps) {
  if (commands.length === 0) return null

  // Group commands by category
  const grouped = commands.reduce((acc, cmd) => {
    const cat = cmd.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(cmd)
    return acc
  }, {} as Record<string, SlashCommand[]>)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50 w-80 max-h-80 overflow-hidden rounded-xl border border-white/10 bg-[#111315] shadow-2xl"
        style={{
          bottom: position.top + 8,
          left: position.left,
        }}
      >
        <div className="p-2.5 border-b border-white/[0.06] flex items-center gap-2 bg-white/[0.02]">
          <Command className="w-4 h-4 text-white/40" />
          <span className="text-xs font-medium text-white/50">
            Commands & Agents
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain">
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-3 py-1.5 flex items-center gap-1.5 bg-white/[0.02]">
                {categoryIcons[category] || <Sparkles className="w-3 h-3" />}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {category}
                </span>
              </div>
              {cmds.map((cmd) => {
                const globalIndex = commands.indexOf(cmd)
                return (
                  <button
                    key={cmd.command}
                    onClick={() => onSelect(cmd)}
                    className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${
                      globalIndex === selectedIndex
                        ? 'bg-white/[0.08] text-white'
                        : 'hover:bg-white/[0.04] text-white/70'
                    }`}
                  >
                    <span className="text-base w-6 text-center shrink-0">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[13px]">{cmd.command}</span>
                        {cmd.agent && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${categoryColors[category] || 'bg-white/10 text-white/50 border-white/10'}`}>
                            Agent
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/40 truncate">
                        {cmd.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="text-[10px] text-white/30 flex items-center justify-between">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
