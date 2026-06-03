import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlashCommand } from '@/lib/slash-commands'
import { Command } from 'lucide-react'

interface SlashCommandMenuProps {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  position?: { top: number; left: number }
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  position = { top: 0, left: 0 }
}: SlashCommandMenuProps) {
  if (commands.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50 w-72 bg-background border border-border rounded-xl shadow-lg overflow-hidden"
        style={{
          bottom: position.top + 8,
          left: position.left,
        }}
      >
        <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/30">
          <Command className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Slash Commands
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {commands.map((cmd, index) => (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd)}
              className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-primary/5 dark:hover:bg-muted/50 text-foreground'
              }`}
            >
              <span className="text-lg">{cmd.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{cmd.command}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {cmd.description}
                </div>
              </div>
              {cmd.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {cmd.category}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
