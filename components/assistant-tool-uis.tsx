'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  Pencil,
  FilePlus,
  Terminal,
  ChevronRight,
  ChevronDown,
  Check,
  Loader2,
  Globe,
} from 'lucide-react'
import { InlineDiff } from './inline-diff'

/**
 * Custom tool UI components for assistant-ui.
 * These are registered via makeAssistantToolUI() and rendered
 * inline in the chat thread when the AI calls the corresponding tools.
 *
 * Each component receives the tool call state (args, result, status)
 * and renders a compact, informative row.
 */

// ─── File Read Row ──────────────────────────────────────────
export function FileReadToolUI({ args, status }: { args: any; status: string }) {
  const path = args?.path || 'unknown'
  const isRunning = status === 'running' || status === 'call'

  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md text-[13px] hover:bg-white/[0.04] transition-colors">
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/60 shrink-0" />
      ) : (
        <Eye className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
      )}
      <span className="text-white/50">Read</span>
      <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded">
        {path}
      </code>
      {!isRunning && status === 'result' && (
        <Check className="h-3 w-3 text-emerald-400/70 ml-auto shrink-0" />
      )}
    </div>
  )
}

// ─── File Create Row ────────────────────────────────────────
export function FileCreateToolUI({ args, status }: { args: any; status: string }) {
  const path = args?.path || 'unknown'
  const isRunning = status === 'running' || status === 'call'

  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md text-[13px] hover:bg-white/[0.04] transition-colors">
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/60 shrink-0" />
      ) : (
        <FilePlus className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
      )}
      <span className="text-white/50">Created</span>
      <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded">
        {path}
      </code>
      {!isRunning && status === 'result' && (
        <Check className="h-3 w-3 text-emerald-400/70 ml-auto shrink-0" />
      )}
    </div>
  )
}

// ─── File Edit Row with Diff ────────────────────────────────
export function FileEditToolUI({ args, status }: { args: any; status: string }) {
  const [showDiff, setShowDiff] = useState(false)
  const path = args?.path || 'unknown'
  const oldContent = args?.oldContent || ''
  const newContent = args?.newContent || ''
  const isRunning = status === 'running' || status === 'call'
  const hasDiff = oldContent || newContent

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDiff && setShowDiff(!showDiff)}
        className={`flex items-center gap-2 py-1 px-2 rounded-md text-[13px] w-full text-left ${
          hasDiff ? 'hover:bg-white/[0.04] transition-colors' : ''
        }`}
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/60 shrink-0" />
        ) : (
          <Pencil className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
        )}
        <span className="text-white/50">Edited</span>
        <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded">
          {path}
        </code>
        {hasDiff && (
          <>
            <ChevronRight className={`h-3 w-3 text-white/30 shrink-0 transition-transform ${showDiff ? 'rotate-90' : ''}`} />
            <span className="text-[10px] text-white/30 ml-auto">{showDiff ? 'hide' : 'diff'}</span>
          </>
        )}
        {!isRunning && status === 'result' && !hasDiff && (
          <Check className="h-3 w-3 text-emerald-400/70 ml-auto shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {showDiff && hasDiff && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-7 mb-2">
              <InlineDiff oldText={oldContent} newText={newContent} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Command Row (expandable output) ────────────────────────
export function CommandToolUI({ args, result, status }: { args: any; result?: any; status: string }) {
  const [expanded, setExpanded] = useState(false)
  const command = args?.command || 'unknown'
  const output = typeof result === 'string' ? result : result?.output || ''
  const isRunning = status === 'running' || status === 'call'

  return (
    <div>
      <button
        type="button"
        onClick={() => output && setExpanded(!expanded)}
        className="flex items-center gap-2 py-1 px-2 rounded-md text-[13px] w-full text-left hover:bg-white/[0.04] transition-colors"
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/60 shrink-0" />
        ) : expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
        ) : (
          <Terminal className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
        )}
        <span className="text-white/50">Ran</span>
        <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded">
          {command.length > 50 ? command.slice(0, 50) + '...' : command}
        </code>
        {output && (
          <span className="text-[10px] text-white/30 ml-auto">
            {output.split('\n').length} lines
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && output && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <pre className="ml-7 mb-2 p-3 rounded-lg bg-black/30 border border-white/[0.06] text-[11px] font-mono leading-[1.6] text-white/55 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
              {output}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Generic Tool Fallback ──────────────────────────────────
export function GenericToolUI({ toolName, args, status }: { toolName: string; args: any; status: string }) {
  const isRunning = status === 'running' || status === 'call'

  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md text-[13px]">
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/60 shrink-0" />
      ) : (
        <Check className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
      )}
      <span className="text-white/50 capitalize">{toolName.replace(/_/g, ' ')}</span>
      {args && (
        <code className="text-[11px] font-mono text-white/45 truncate max-w-[300px]">
          {JSON.stringify(args).slice(0, 80)}
        </code>
      )}
    </div>
  )
}
