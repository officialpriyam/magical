'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  FileCode2,
  Eye,
  Pencil,
  Play,
  Brain,
  Search,
  Globe,
  Loader2,
  Check,
  Terminal,
  FilePlus,
  StopCircle,
  Sparkles,
  MessageSquare,
  ListTodo,
} from 'lucide-react'
import type { ToolAction, TodoItem } from '@/lib/hooks/use-agentic-stream'
import { InlineDiff } from './inline-diff'

// ─── Formatting helpers ─────────────────────────────────────
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = ((ms % 60000) / 1000).toFixed(0)
  return `${mins}m ${secs}s`
}

function extractPath(content: string, type?: string): string {
  return content
    .replace(/^(Reading|Writing|Editing|Created|Read|Edit|Write)\s+/i, '')
    .replace(/\.{3}$/, '')
    .trim()
}

// ─── Thinking Block (collapsible, Replit-style) ─────────────
function ThinkingBlock({
  action,
  isExpanded,
  onToggle,
  isLatest,
  isStreaming,
  duration,
}: {
  action: ToolAction
  isExpanded: boolean
  onToggle: () => void
  isLatest: boolean
  isStreaming: boolean
  duration: number
}) {
  const thinkingText = action.content.replace(/^[\w]+:\s*/i, '').trim()
  const hasContent = thinkingText.length > 10

  return (
    <div className="group">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md hover:bg-white/[0.04] transition-colors w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
        )}
        {isLatest && isStreaming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400/70 shrink-0" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-purple-400/70 shrink-0" />
        )}
        <span className="text-[13px] font-medium text-white/70">
          {isStreaming && isLatest ? 'Thinking...' : 'Thought for'}
          {' '}
          <span className="text-white/50">{formatDuration(duration)}</span>
        </span>
        {!isStreaming && hasContent && (
          <Check className="h-3 w-3 shrink-0 text-emerald-400/70 ml-auto" />
        )}
        {!isExpanded && hasContent && (
          <span className="text-[11px] text-white/30 truncate max-w-[280px] ml-1">
            — {thinkingText.slice(0, 60)}
            {thinkingText.length > 60 ? '...' : ''}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && hasContent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-7 mb-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[13px] leading-[1.7] text-white/65 whitespace-pre-wrap">
              {thinkingText}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── File Read Row ──────────────────────────────────────────
function FileReadRow({
  action,
  onFileClick,
}: {
  action: ToolAction
  onFileClick?: (path: string) => void
}) {
  const path = extractPath(action.content)
  return (
    <div
      className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[13px] ${
        onFileClick
          ? 'cursor-pointer hover:bg-white/[0.04] transition-colors'
          : ''
      }`}
      onClick={() => onFileClick?.(path)}
    >
      <Eye className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
      <span className="text-white/50">Read</span>
      <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded hover:text-white/80 transition-colors">
        {path}
      </code>
    </div>
  )
}

// ─── File Write / Create Row ────────────────────────────────
function FileWriteRow({
  action,
  onFileClick,
}: {
  action: ToolAction
  onFileClick?: (path: string) => void
}) {
  const path = extractPath(action.content)
  const isEdit = action.type === 'file_edit'
  const Icon = isEdit ? Pencil : FilePlus

  return (
    <div
      className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[13px] ${
        onFileClick
          ? 'cursor-pointer hover:bg-white/[0.04] transition-colors'
          : ''
      }`}
      onClick={() => onFileClick?.(path)}
    >
      <Icon className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
      <span className="text-white/50">{isEdit ? 'Edited' : 'Created'}</span>
      <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded hover:text-white/80 transition-colors">
        {path}
      </code>
    </div>
  )
}

// ─── Command Row (expandable output) ────────────────────────
function CommandRow({ action }: { action: ToolAction }) {
  const [expanded, setExpanded] = useState(false)
  const command = action.content
  const output = action.detail || ''

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 py-1 px-1 -mx-1 rounded-md hover:bg-white/[0.04] transition-colors w-full text-left text-[13px]"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
        )}
        <Terminal className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
        <span className="text-white/50">Ran</span>
        <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded">
          {command.length > 60 ? command.slice(0, 60) + '...' : command}
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

// ─── File Edit with Diff ────────────────────────────────────
function FileEditRow({
  action,
  onFileClick,
}: {
  action: ToolAction
  onFileClick?: (path: string) => void
}) {
  const [showDiff, setShowDiff] = useState(false)
  const path = extractPath(action.content)

  // Try to parse old/new content from detail field
  let oldText = ''
  let newText = ''
  if (action.detail) {
    try {
      const parsed = JSON.parse(action.detail)
      oldText = parsed.old || parsed.oldContent || ''
      newText = parsed.new || parsed.newContent || parsed.content || ''
    } catch {
      // detail might be a raw diff or content
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (oldText || newText) setShowDiff(!showDiff)
          else onFileClick?.(path)
        }}
        className="flex items-center gap-2 py-1 px-1 -mx-1 rounded-md hover:bg-white/[0.04] transition-colors w-full text-left text-[13px]"
      >
        <ChevronRight className={`h-3.5 w-3.5 text-white/40 shrink-0 transition-transform ${showDiff ? 'rotate-90' : ''}`} />
        <Pencil className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
        <span className="text-white/50">Edited</span>
        <code className="text-[11px] font-mono text-white/65 bg-white/[0.06] px-1.5 py-0.5 rounded hover:text-white/80 transition-colors">
          {path}
        </code>
        {oldText && newText && (
          <span className="text-[10px] text-white/30 ml-auto">
            {showDiff ? 'hide diff' : 'show diff'}
          </span>
        )}
      </button>

      <AnimatePresence>
        {showDiff && (oldText || newText) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-7 mb-2">
              <InlineDiff oldText={oldText} newText={newText} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Commentary Bubble ──────────────────────────────────────
function CommentaryBubble({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  if (!text && isStreaming) {
    return (
      <span className="flex items-center gap-2 text-white/40 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/50" />
        <span className="text-[12px]">Thinking...</span>
      </span>
    )
  }
  if (!text) return null

  return (
    <div className="text-[14px] leading-[1.7] text-white/75 whitespace-pre-wrap py-1">
      {text}
      {isStreaming && (
        <span className="inline-block h-[13px] w-[1.5px] bg-blue-400/50 animate-pulse -ml-0.5 align-middle" />
      )}
    </div>
  )
}

// ─── Todo List ──────────────────────────────────────────────
function TodoList({
  todos,
  isStreaming,
}: {
  todos: TodoItem[]
  isStreaming: boolean
}) {
  const completed = todos.filter(t => t.completed).length

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <ListTodo className="h-4 w-4 text-white/50" />
        <span className="text-[13px] font-medium text-white/80">To-dos</span>
        <span className="text-[11px] text-white/40">
          {completed}/{todos.length}
        </span>
      </div>
      <div className="space-y-2">
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center gap-2.5 py-0.5">
            {todo.completed ? (
              <div className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-emerald-400 bg-emerald-400/20 flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-emerald-400" />
              </div>
            ) : isStreaming ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400/50" />
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-white/20" />
            )}
            <span
              className={`text-[13px] ${
                todo.completed ? 'text-white/45 line-through' : 'text-white/75'
              }`}
            >
              {todo.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Web Search Row ─────────────────────────────────────────
function WebSearchRow({ action }: { action: ToolAction }) {
  let results: { title: string; url: string; snippet?: string }[] = []
  try {
    results = action.detail ? JSON.parse(action.detail) : []
  } catch {}

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-2 text-[13px]">
        <Globe className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
        <span className="text-white/50">Searched</span>
        <span className="text-blue-300/70">{action.content}</span>
      </div>
      {results.length > 0 && (
        <div className="flex flex-wrap gap-1.5 ml-6 mt-1">
          {results.map(r => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-blue-400/15 bg-blue-400/[0.06] px-2 py-0.5 text-[11px] text-blue-300/75 transition hover:bg-blue-400/15 hover:text-blue-300"
            >
              <Globe className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate max-w-[160px]">{r.title || r.url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ActivityFeed Component ────────────────────────────
export function ActivityFeed({
  actions,
  todos,
  isStreaming,
  onStop,
  onFileClick,
  elapsed: initialElapsed,
}: {
  actions: ToolAction[]
  todos: TodoItem[]
  isStreaming: boolean
  onStop?: () => void
  onFileClick?: (path: string) => void
  elapsed?: number
}) {
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set())
  const [elapsed, setElapsed] = useState(initialElapsed || 0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Live timer during streaming
  useEffect(() => {
    if (!isStreaming || actions.length === 0 || initialElapsed) return
    const start = actions[0].timestamp
    const interval = setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(interval)
  }, [isStreaming, actions.length, initialElapsed])

  // Auto-expand all thinking blocks when streaming completes
  useEffect(() => {
    if (!isStreaming && actions.length > 0) {
      const thinkingIndices = new Set<number>()
      actions.forEach((a, i) => {
        if (a.type === 'thinking') thinkingIndices.add(i)
      })
      setExpandedThinking(thinkingIndices)
    }
  }, [isStreaming])

  // Get latest commentary for streaming bubble
  const commentary = useMemo(() => {
    const commentaryActions = actions.filter(
      a => a.type === 'commentary' || a.type === 'commentary_chunk'
    )
    return commentaryActions.length > 0
      ? commentaryActions[commentaryActions.length - 1].content
      : ''
  }, [actions])

  // Thinking indices
  const thinkingActions = useMemo(
    () => actions.filter(a => a.type === 'thinking'),
    [actions]
  )

  // Duration calculations
  function getActionDuration(action: ToolAction): number {
    const idx = actions.indexOf(action)
    if (idx === -1) return 0
    if (idx < actions.length - 1) {
      return actions[idx + 1].timestamp - action.timestamp
    }
    return isStreaming ? Date.now() - action.timestamp : 0
  }

  if (actions.length === 0 && !isStreaming) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col w-full gap-0 max-w-[42rem]"
    >
      {/* Header: agent icon + name + timer + stop */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex h-6 w-6 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/25 to-purple-600/25 animate-pulse" />
          <Sparkles className="relative h-3.5 w-3.5 text-blue-400/80" />
        </div>
        <span className="text-[14px] font-semibold text-white/85">Magical</span>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-[12px] text-white/40">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Working for {Math.floor(elapsed / 1000)}s
          </span>
        )}
        {!isStreaming && elapsed > 0 && (
          <span className="text-[12px] text-white/35">
            Done in {formatDuration(elapsed)}
          </span>
        )}
        {isStreaming && onStop && (
          <button
            type="button"
            onClick={onStop}
            className="ml-auto flex h-5 items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 text-[10px] font-medium text-red-300/80 transition hover:bg-red-500/20"
          >
            <StopCircle className="h-2.5 w-2.5" />
            Stop
          </button>
        )}
      </div>

      {/* Commentary bubble */}
      <CommentaryBubble text={commentary} isStreaming={isStreaming} />

      {/* Action rows — interleaved in stream order */}
      <div className="pl-6 space-y-0.5">
        {/* Connecting state */}
        {isStreaming && actions.length === 0 && (
          <div className="flex items-center gap-2 py-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-blue-400/50" />
            <span className="text-[12px] text-white/40">Connecting...</span>
          </div>
        )}

        {/* Render each action in stream order */}
        {actions.map((action, i) => {
          switch (action.type) {
            case 'thinking': {
              const thinkIdx = thinkingActions.indexOf(action)
              return (
                <ThinkingBlock
                  key={`think-${i}-${action.timestamp}`}
                  action={action}
                  isExpanded={expandedThinking.has(action.timestamp) || expandedThinking.has(i)}
                  onToggle={() => {
                    setExpandedThinking(prev => {
                      const next = new Set(prev)
                      if (next.has(action.timestamp) || next.has(i)) {
                        next.delete(action.timestamp)
                        next.delete(i)
                      } else {
                        next.add(action.timestamp)
                      }
                      return next
                    })
                  }}
                  isLatest={i === actions.length - 1}
                  isStreaming={isStreaming}
                  duration={getActionDuration(action)}
                />
              )
            }

            case 'file_read':
              return (
                <FileReadRow
                  key={`read-${i}-${action.timestamp}`}
                  action={action}
                  onFileClick={onFileClick}
                />
              )

            case 'file_edit':
              return (
                <FileEditRow
                  key={`edit-${i}-${action.timestamp}`}
                  action={action}
                  onFileClick={onFileClick}
                />
              )

            case 'file_write':
              return (
                <FileWriteRow
                  key={`write-${i}-${action.timestamp}`}
                  action={action}
                  onFileClick={onFileClick}
                />
              )

            case 'run_command':
              return (
                <CommandRow
                  key={`cmd-${i}-${action.timestamp}`}
                  action={action}
                />
              )

            case 'web_search':
              return (
                <WebSearchRow
                  key={`search-${i}-${action.timestamp}`}
                  action={action}
                />
              )

            case 'web_fetch':
              return (
                <div key={`fetch-${i}-${action.timestamp}`} className="flex items-center gap-2 py-1 text-[13px]">
                  <Globe className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
                  <span className="text-white/50">Fetched</span>
                  <a
                    href={action.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300/70 hover:text-blue-300 hover:underline truncate max-w-[280px]"
                  >
                    {action.detail || action.content}
                  </a>
                </div>
              )

            case 'status':
              return (
                <div key={`status-${i}-${action.timestamp}`} className="flex items-center gap-2 py-1 text-[12px]">
                  <span className="text-white/20">·</span>
                  <span className="text-white/45">{action.content}</span>
                </div>
              )

            // Skip commentary and todo — handled separately
            case 'commentary':
            case 'commentary_chunk':
            case 'todo':
              return null

            default:
              return (
                <div key={`misc-${i}-${action.timestamp}`} className="flex items-center gap-2 py-1 text-[13px]">
                  <span className="text-white/20">·</span>
                  <span className="text-white/55">{action.content}</span>
                </div>
              )
          }
        })}

        {/* Show latest action spinner during streaming */}
        {isStreaming && actions.length > 0 && (() => {
          const last = actions[actions.length - 1]
          if (last.type === 'thinking' || last.type === 'commentary' || last.type === 'commentary_chunk') {
            // Already handled by thinking/commentary rendering
            return null
          }
          return null
        })()}
      </div>

      {/* Todos */}
      {todos.length > 0 && (
        <TodoList todos={todos} isStreaming={isStreaming} />
      )}
    </motion.div>
  )
}
