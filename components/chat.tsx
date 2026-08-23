import { Message, MessagePlan } from '@/lib/messages'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { getFragmentFiles } from '@/lib/fragment-files'
import { AgentMetadataDisplay } from '@/components/agent-status'
import { AGENT_DISPLAY_NAMES } from '@/lib/agents/prompts'
import type { AgentRole } from '@/lib/agents/types'
import type { ToolAction, TodoItem } from '@/lib/hooks/use-agentic-stream'
import { DeepPartial } from 'ai'
import { Check, Database, FileCode2, LoaderIcon, Terminal, Sparkles, Square, Globe, Eye, Plus, Pencil, Cpu, Activity, Braces, Palette, Server, Shield, Zap, Wrench, ChevronRight, ChevronDown, Circle, FileEdit, Search, Brain, ListTodo, MessageSquare } from 'lucide-react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

/** Simple markdown renderer for bold/italic in streaming commentary */
function renderMarkdownText(text: string): React.ReactNode[] {
  if (!text) return []
  const parts: React.ReactNode[] = []
  // Split on **bold**, *italic*, and `code` patterns
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>)
    }
    const token = match[1]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++} className="font-semibold text-white/95">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key++} className="italic text-white/70">{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key++} className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[12px] text-blue-300/80">{token.slice(1, -1)}</code>
      )
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>)
  }
  return parts
}

export function Chat({
  messages,
  isLoading,
  isPreviewLoading = false,
  currentFragment,
  autoFixMessage,
  onStop,
  onAcceptPlan,
  setCurrentPreview,
  useAgentic = false,
  agenticActions = [],
  agenticTodos = [],
  agenticStreaming = false,
}: {
  messages: Message[]
  isLoading: boolean
  isPreviewLoading?: boolean
  currentFragment?: DeepPartial<FragmentSchema>
  autoFixMessage?: string
  onStop?: () => void
  onAcceptPlan?: (plan: MessagePlan, answer?: string) => void
  setCurrentPreview: (preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) => void
  useAgentic?: boolean
  agenticActions?: ToolAction[]
  agenticTodos?: TodoItem[]
  agenticStreaming?: boolean
}) {

  useEffect(() => {
    const chatContainer = document.getElementById('chat-container')
    if (chatContainer) {
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight
      })
    }
  }, [messages, isLoading, isPreviewLoading, currentFragment, agenticActions])

  return (
    <div
      id="chat-container"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-0 pb-4 pt-1 sm:gap-3 sm:px-1 md:gap-3 md:px-1"
    >
      {messages.length === 0 && !isLoading && !isPreviewLoading && (
        <div className="flex h-full items-center justify-center text-sm text-white/45">
          Start a new conversation
        </div>
      )}

      {messages.map((message: Message, index: number) => (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
          className={`flex flex-col whitespace-pre-wrap text-sm leading-5 ${
            message.role === 'user'
              ? 'self-end max-w-[85%] rounded-2xl bg-white/[0.07] px-3 py-1.5 text-white shadow-sm sm:px-4 md:px-4'
              : 'w-full gap-2 text-white'
          }`}
          key={index}
        >
          {message.content.map((content, id) => {
            if (content.type === 'text') {
              const text = content.text || ''
              // Strip style injection metadata from display
              const cleanedText = text
                .replace(/\[Style:\s*[^\]]*\]\s*/g, '')
                .replace(/\[Custom Style\]\s*/g, '')
                .trim()
              // If nothing remains after cleaning, skip rendering
              if (!cleanedText && message.role === 'user') return null
              const displayText = cleanedText || text
              const searchMatch = displayText.match(/^\[Search:\s*(.*?)\]\s*$/)
              const thinkMatch = displayText.match(/^\[Think:\s*(.*?)\]\s*$/)
              const canvasMatch = displayText.match(/^\[Canvas:\s*(.*?)\]\s*$/)

              if (searchMatch) {
                return (
                  <span key={id} className="block">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1EAEDB]/30 bg-[#1EAEDB]/10 px-2 py-0.5 text-[11px] text-[#1EAEDB] mb-1">
                      <Search className="h-3 w-3" />
                      Web search
                    </span>
                    <span className="block text-white/90">{searchMatch[1]}</span>
                  </span>
                )
              }
              if (thinkMatch) {
                return (
                  <span key={id} className="block">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-[11px] text-purple-300 mb-1">
                      <Brain className="h-3 w-3" />
                      Thinking
                    </span>
                    <span className="block text-white/90">{thinkMatch[1]}</span>
                  </span>
                )
              }
              if (canvasMatch) {
                return (
                  <span key={id} className="block">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300 mb-1">
                      <FileCode2 className="h-3 w-3" />
                      Canvas
                    </span>
                    <span className="block text-white/90">{canvasMatch[1]}</span>
                  </span>
                )
              }
              return <span key={id} className="text-white/95 leading-relaxed">{renderMarkdownText(displayText)}</span>
            }
            if (content.type === 'image') {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={content.image}
                  alt="fragment"
                  className="mr-2 inline-block w-12 h-12 object-cover rounded-lg bg-white mb-2"
                />
              )
            }
            if (content.type === 'plan') {
              return (
                <PlanActionCard
                  key={id}
                  plan={content}
                  disabled={isLoading || isPreviewLoading}
                  onAcceptPlan={onAcceptPlan}
                />
              )
            }
            if (content.type === 'file_op') {
              return <FileOperationCard key={id} operation={content.operation} files={content.files} />
            }
            if (content.type === 'web_search') {
              return <WebSearchCard key={id} query={content.query} results={content.results} />
            }
          })}
        </motion.div>
      ))}

      {/* Artifact card — rendered below the Magical message */}
      {(() => {
        const lastAssistantWithObject = [...messages].reverse().find(m => m.role === 'assistant' && m.object)
        if (!lastAssistantWithObject) return null
        // Only show if we have agentic streaming done or no streaming at all
        if (useAgentic && agenticStreaming) return null
        return (
          <GeneratedArtifactCard
            message={lastAssistantWithObject}
            setCurrentPreview={setCurrentPreview}
          />
        )
      })()}

      {/* Live streaming message — shows during AND after generation when actions exist */}
      {(agenticStreaming || agenticActions.length > 0) && (
        <LiveStreamingMessage
          key="live-stream"
          actions={agenticActions}
          todos={agenticTodos}
          isStreaming={agenticStreaming}
          onStop={onStop}
        />
      )}
      {/* Status card — only during loading, NOT after generation (artifact card handles that) */}
      {(
        !useAgentic ||
        (!agenticStreaming && agenticActions.length === 0)
      ) && !messages.some(m => m.role === 'assistant' && m.object) && (
        <GenerationStatusCard
          messages={messages}
          currentFragment={currentFragment}
          isLoading={isLoading}
          isPreviewLoading={isPreviewLoading}
          autoFixMessage={autoFixMessage}
          onStop={onStop}
        />
      )}
    </div>
  )
}

// ─── Live Agentic Actions Display ──────────────────────────
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── Live Streaming Message (matches Claude Code / OpenThorn style) ─
function LiveStreamingMessage({
  actions,
  todos,
  isStreaming,
  onStop,
}: {
  actions: ToolAction[]
  todos: TodoItem[]
  isStreaming: boolean
  onStop?: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(new Set())
  const [expandedReads, setExpandedReads] = useState(false)
  const [expandedWrites, setExpandedWrites] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Live timer
  useEffect(() => {
    if (!isStreaming || actions.length === 0) return
    const start = actions[0].timestamp
    const interval = setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(interval)
  }, [isStreaming, actions.length])

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [actions.length, actions[actions.length - 1]?.content])

  const elapsedSec = Math.floor(elapsed / 1000)

  // Latest commentary text for streaming body
  const commentaryActions = actions.filter(a => a.type === 'commentary' || a.type === 'commentary_chunk')
  const latestCommentary = commentaryActions.length > 0
    ? commentaryActions[commentaryActions.length - 1].content
    : ''

  // Group reads and writes
  const fileReadActions = actions.filter(a => a.type === 'file_read')
  const fileWriteActions = actions.filter(a => a.type === 'file_write' || a.type === 'file_edit')
  const thinkingActions = actions.filter(a => a.type === 'thinking')

  // Calculate duration for each action
  function getActionDuration(index: number, filteredActions: ToolAction[]): number {
    const action = filteredActions[index]
    if (!action) return 0
    const globalIdx = actions.indexOf(action)
    if (globalIdx === -1) return 0
    if (globalIdx < actions.length - 1) {
      return actions[globalIdx + 1].timestamp - action.timestamp
    }
    return Date.now() - action.timestamp
  }

  // Format a human-readable label from action content
  function getActionLabel(action: ToolAction): string {
    if (action.type === 'thinking') return action.content.slice(0, 80)
    if (action.type === 'file_read') {
      const path = action.content.replace(/^Reading\s+/i, '').replace(/\.\.\.$/, '').trim()
      return `Read ${path}`
    }
    if (action.type === 'file_write' || action.type === 'file_edit') {
      const path = action.content.replace(/^(Writing|Editing)\s+/i, '').replace(/\.\.\.$/, '').trim()
      const isEdit = action.type === 'file_edit'
      return `${isEdit ? 'Edited' : 'Writing'} ${path}`
    }
    if (action.type === 'web_search') return `Explore · ${action.content}`
    if (action.type === 'web_fetch') return `Fetched ${action.content}`
    return action.content
  }

  // Get icon for action type
  function getActionIcon(type: ToolAction['type']) {
    switch (type) {
      case 'thinking': return { icon: Brain, color: 'text-purple-400/60' }
      case 'file_read': return { icon: Eye, color: 'text-emerald-400/60' }
      case 'file_write': case 'file_edit': return { icon: FileEdit, color: 'text-emerald-400/60' }
      case 'web_search': case 'web_fetch': return { icon: Search, color: 'text-blue-400/60' }
      case 'status': return { icon: Activity, color: 'text-blue-400/60' }
      case 'commentary': case 'commentary_chunk': return { icon: MessageSquare, color: 'text-white/30' }
      default: return { icon: Circle, color: 'text-white/30' }
    }
  }

  // Build chronological timeline items (skip commentary and todo)
  const timelineActions = useMemo(() => {
    return actions.filter(a =>
      a.type !== 'commentary' &&
      a.type !== 'commentary_chunk' &&
      a.type !== 'todo'
    )
  }, [actions])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col w-full gap-0 text-white/90 max-w-[42rem]"
    >
      {/* Agent header — matches screenshot: B Blink / Working for 28s */}
      <div className="flex items-center gap-2 mb-2">
        {/* Animated Magical icon */}
        <div className="relative flex h-7 w-7 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 animate-pulse" />
          <svg className="relative h-4 w-4 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold text-white/90">Magical</span>
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-xs text-white/40">
            Working for {elapsedSec}s
            <ChevronDown className="h-3 w-3" />
          </span>
        )}
        {!isStreaming && elapsedSec > 0 && (
          <span className="text-xs text-white/30">Done in {formatDuration(elapsed)}</span>
        )}
        {isStreaming && onStop && (
          <button
            type="button"
            onClick={onStop}
            className="ml-auto flex h-6 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/20"
          >
            <Square className="h-2 w-2 fill-current" />
            Stop
          </button>
        )}
      </div>

      {/* Streaming commentary text — appears as normal message body with markdown */}
      <div className="text-[15px] leading-[1.8] text-white/85 mb-3 whitespace-pre-wrap">
        {latestCommentary
          ? renderMarkdownText(latestCommentary)
          : isStreaming && actions.length > 0 ? (
            <span className="flex items-center gap-2 text-white/40">
              <span className="inline-block h-4 w-[2px] bg-blue-400/50 animate-pulse" />
              <span className="text-xs">Thinking...</span>
            </span>
          ) : null}
        {isStreaming && latestCommentary && (
          <span className="inline-block h-[14px] w-[2px] bg-blue-400/50 animate-pulse -ml-0.5 align-middle" />
        )}
      </div>

      {/* Scrollable timeline + commentary area — only show during streaming */}
      {isStreaming && (
      <div ref={scrollRef} className="pl-8 space-y-1 max-h-[400px] overflow-y-auto overscroll-contain">
        {/* Connecting state — when streaming but no actions yet */}
        {actions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 py-1"
          >
            <LoaderIcon className="h-3 w-3 animate-spin text-blue-400" />
            <span className="text-[12px] text-white/40">Connecting...</span>
          </motion.div>
        )}
        {/* Chronological timeline of actions */}
        {timelineActions.map((action, i) => {
          const { icon: ActionIcon, color } = getActionIcon(action.type)
          const duration = getActionDuration(i, timelineActions)
          const label = getActionLabel(action)
          const isThinking = action.type === 'thinking'
          const isLatest = i === timelineActions.length - 1
          const thoughtIdx = thinkingActions.indexOf(action)
          const isExpanded = expandedThoughts.has(thoughtIdx)

          // For thinking actions, show as expandable with actual thinking text
          if (isThinking) {
            // Extract meaningful content from thinking action
            const thinkingText = action.content
              .replace(/^[\w]+:\s*/i, '') // Remove agent name prefix
              .trim()
            const hasThinkingContent = thinkingText.length > 10

            return (
              <motion.div
                key={`${action.timestamp}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedThoughts(prev => {
                      const next = new Set(prev)
                      if (next.has(thoughtIdx)) next.delete(thoughtIdx)
                      else next.add(thoughtIdx)
                      return next
                    })
                  }}
                  className="flex items-center gap-1.5 py-1 text-[13px] text-white/45 hover:text-white/60 transition"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Brain className="h-3 w-3 text-purple-400/50" />
                  <span className="font-medium">Thought for {formatDuration(duration)}</span>
                  {/* Show preview of thinking text when collapsed */}
                  {!isExpanded && hasThinkingContent && (
                    <span className="text-white/25 truncate max-w-[200px]">— {thinkingText.slice(0, 60)}{thinkingText.length > 60 ? '...' : ''}</span>
                  )}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pl-6"
                    >
                      <div className="py-1 text-[13px] leading-relaxed text-white/55 whitespace-pre-wrap rounded-lg bg-white/[0.03] px-3 py-2 border border-white/[0.05]">
                        {renderMarkdownText(thinkingText)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          }

          // For web_search actions, show query + clickable result URLs
          if (action.type === 'web_search') {
            let results: { title: string; url: string; snippet?: string }[] = []
            try {
              results = action.detail ? JSON.parse(action.detail) : []
            } catch {}

            return (
              <motion.div
                key={`${action.timestamp}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="py-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/20">⋮</span>
                  <Search className="h-3 w-3 text-[#1EAEDB]/70" />
                  <span className="text-[12px] text-white/50">Searched: <span className="text-[#1EAEDB]/80">{action.content}</span></span>
                </div>
                {results.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-6 mt-1">
                    {results.map((r) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-[#1EAEDB]/15 bg-[#1EAEDB]/[0.06] px-2 py-0.5 text-[11px] text-[#1EAEDB]/80 transition hover:bg-[#1EAEDB]/15 hover:text-[#1EAEDB]"
                      >
                        <Globe className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate max-w-[180px]">{r.title || r.url}</span>
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          }

          // For web_fetch actions, show clickable URL
          if (action.type === 'web_fetch') {
            return (
              <motion.div
                key={`${action.timestamp}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2 py-0.5"
              >
                <span className="text-[10px] text-white/20">⋮</span>
                <Globe className="h-3 w-3 text-[#1EAEDB]/70" />
                <a
                  href={action.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-[#1EAEDB]/80 hover:text-[#1EAEDB] hover:underline truncate max-w-[300px]"
                >
                  {action.detail || action.content}
                </a>
              </motion.div>
            )
          }

          // For non-thinking, non-search actions, show as a simple timeline item
          return (
            <motion.div
              key={`${action.timestamp}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 py-0.5"
            >
              <span className="text-[10px] text-white/20">⋮</span>
              {isLatest && isStreaming ? (
                <LoaderIcon className="h-3 w-3 animate-spin text-blue-400/60" />
              ) : (
                <ActionIcon className={`h-3 w-3 ${color}`} />
              )}
              <span className="text-[13px] text-white/55 truncate">{label}</span>
            </motion.div>
          )
        })}

        {/* Collapsible: File reads */}
        {fileReadActions.length > 0 && (
          <Collapsible open={expandedReads} onOpenChange={setExpandedReads}>
            <CollapsibleTrigger className="flex items-center gap-1.5 py-0.5 text-xs text-white/40 hover:text-white/55 transition">
              {expandedReads ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-white/30">⋮</span>
              <Eye className="h-3 w-3 text-blue-400/50" />
              <span className="font-medium">Explore · {fileReadActions.length} File{fileReadActions.length === 1 ? '' : 's'}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 pl-5">
                {fileReadActions.map((action, i) => {
                  const path = action.content.replace(/^Reading\s+/i, '').replace(/\.\.\.$/, '').trim()
                  return (
                    <motion.div
                      key={`${action.timestamp}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                      <span className="text-[12px] text-white/40">Read</span>
                      <code className="text-[11px] text-white/60 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">{path}</code>
                    </motion.div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Collapsible: File writes/edits */}
        {fileWriteActions.length > 0 && (
          <Collapsible open={expandedWrites} onOpenChange={setExpandedWrites}>
            <CollapsibleTrigger className="flex items-center gap-1.5 py-0.5 text-xs text-white/40 hover:text-white/55 transition">
              {expandedWrites ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-white/30">⋮</span>
              <FileEdit className="h-3 w-3 text-emerald-400/50" />
              <span className="font-medium">Writing {fileWriteActions.length} file{fileWriteActions.length === 1 ? '' : 's'}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 pl-5">
                {fileWriteActions.map((action, i) => {
                  const isEdit = action.type === 'file_edit'
                  const path = action.content.replace(/^(Writing|Editing)\s+/i, '').replace(/\.\.\.$/, '').trim()
                  return (
                    <motion.div
                      key={`${action.timestamp}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                      <span className="text-[12px] text-white/40">{isEdit ? 'Edited' : 'Writing'}</span>
                      <code className="text-[11px] text-white/60 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">{path}</code>
                    </motion.div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Web search items are intentionally hidden — user requested removal of blue search boxes */}

      </div>
      )}

      {/* In-message to-dos */}
      {todos.length > 0 && (
        <div className="pl-8 mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1.5">
            <ListTodo className="h-3.5 w-3.5 text-white/40" />
            <span className="font-medium">To-dos</span>
            <span className="text-white/30">{todos.filter(t => t.completed).length}/{todos.length}</span>
            {todos.every(t => t.completed) && <Check className="h-3 w-3 text-emerald-400" />}
          </div>
          <div className="space-y-1">
            {todos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-2 py-0.5">
                {todo.completed ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                ) : isStreaming ? (
                  <LoaderIcon className="h-3 w-3 shrink-0 animate-spin text-blue-400/50" />
                ) : (
                  <div className="h-3 w-3 shrink-0 rounded-full border border-white/20" />
                )}
                <span className={`text-[11px] ${todo.completed ? 'text-white/35 line-through' : 'text-white/55'}`}>
                  {todo.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function AgenticLiveActions({
  actions,
  todos,
  isStreaming,
  setCurrentPreview,
  currentFragment,
  onStop,
}: {
  actions: ToolAction[]
  todos: TodoItem[]
  isStreaming: boolean
  setCurrentPreview: (preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) => void
  currentFragment?: DeepPartial<FragmentSchema>
  onStop?: () => void
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['actions']))
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  // Auto-scroll to latest action
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [actions.length])

  // Tick every second to update live duration of current action
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  // Calculate duration for each action (time until next action, or time until now)
  const now = Date.now()
  function getActionDuration(index: number, filteredActions: ToolAction[]): number {
    const action = filteredActions[index]
    if (!action) return 0
    // Find this action's index in the full actions array
    const globalIdx = actions.indexOf(action)
    if (globalIdx === -1) return 0
    // Duration is time until next action in the full array, or time until now
    if (globalIdx < actions.length - 1) {
      return actions[globalIdx + 1].timestamp - action.timestamp
    }
    // Last action — still running, show live elapsed time
    return now - action.timestamp
  }

  // Group actions by type
  const thinkingActions = actions.filter(a => a.type === 'thinking')
  const fileActions = actions.filter(a => a.type === 'file_write' || a.type === 'file_edit' || a.type === 'file_read')
  const searchActions = actions.filter(a => a.type === 'web_search' || a.type === 'web_fetch')
  const commentaryActions = actions.filter(a => a.type === 'commentary')
  const statusActions = actions.filter(a => a.type === 'status')

  // Latest status line
  const latestStatus = statusActions.length > 0 ? statusActions[statusActions.length - 1] : null

  // Count completed vs total todos
  const completedTodos = todos.filter(t => t.completed).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]"
    >
      {/* Status header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-2.5">
        {isStreaming ? (
          <LoaderIcon className="h-3.5 w-3.5 animate-spin text-blue-400" />
        ) : (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        )}
        <span className="text-xs font-medium text-white/70">
          {isStreaming
            ? (latestStatus?.content || 'Working...')
            : `Completed — ${actions.length} actions`
          }
        </span>
        <span className="ml-auto text-[11px] text-white/30 tabular-nums">
          {Math.floor((Date.now() - actions[0]?.timestamp) / 1000)}s
        </span>
        {onStop && isStreaming && (
          <button
            type="button"
            onClick={onStop}
            className="flex h-5 items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 text-[10px] font-medium text-red-300 transition hover:bg-red-500/20"
          >
            <Square className="h-2 w-2 fill-current" />
            Stop
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto">
        {/* Status updates — shown as individual items */}
        {statusActions.length > 0 && (
          <div className="space-y-0.5 border-b border-white/[0.04] px-4 py-2">
            {statusActions.map((action, i) => (
              <motion.div
                key={`${action.timestamp}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 py-0.5"
              >
                {isStreaming && i === statusActions.length - 1 ? (
                  <LoaderIcon className="h-3 w-3 shrink-0 animate-spin text-blue-400" />
                ) : (
                  <Check className="h-3 w-3 shrink-0 text-emerald-400/60" />
                )}
                <span className="text-[11px] text-white/50">{action.content}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-white/20">{formatDuration(getActionDuration(i, statusActions))}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Thinking / Reasoning */}
        {thinkingActions.length > 0 && (
          <Collapsible open={expandedSections.has('thinking')} onOpenChange={() => toggleSection('thinking')}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.02]">
              {expandedSections.has('thinking') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Brain className="h-3.5 w-3.5 text-purple-400/70" />
              <span>Reasoning</span>
              <span className="ml-auto text-[10px] text-white/25">{thinkingActions.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 px-4 pb-2">
                {thinkingActions.map((action, i) => {
                  const duration = getActionDuration(i, thinkingActions)
                  return (
                    <motion.div
                      key={`${action.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 text-[11px] leading-relaxed text-white/40"
                    >
                      <span className="flex-1">{action.content}</span>
                      <span className="shrink-0 tabular-nums text-[10px] text-white/20">{formatDuration(duration)}</span>
                    </motion.div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Commentary */}
        {commentaryActions.length > 0 && (
          <div className="border-t border-white/[0.04] px-4 py-2.5">
            {commentaryActions.map((action, i) => {
              const duration = getActionDuration(i, commentaryActions)
              return (
                <motion.div
                  key={`${action.timestamp}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start justify-between gap-2 text-xs leading-relaxed text-white/55"
                >
                  <span className="flex-1">{action.content}</span>
                  <span className="shrink-0 tabular-nums text-[10px] text-white/20">{formatDuration(duration)}</span>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* File operations */}
        {fileActions.length > 0 && (
          <Collapsible open={expandedSections.has('files')} onOpenChange={() => toggleSection('files')}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 border-t border-white/[0.04] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.02]">
              {expandedSections.has('files') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <FileCode2 className="h-3.5 w-3.5 text-emerald-400/70" />
              <span>Files</span>
              <span className="ml-auto text-[10px] text-white/25">{fileActions.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 px-4 pb-2">
                {fileActions.map((action, i) => {
                  const isWrite = action.type === 'file_write'
                  const isRead = action.type === 'file_read'
                  const Icon = isRead ? Eye : isWrite ? FileEdit : Pencil
                  const iconColor = isRead ? 'text-blue-400/60' : isWrite ? 'text-emerald-400/60' : 'text-amber-400/60'
                  const duration = getActionDuration(i, fileActions)
                  // Extract just the file path from content like "Writing src/App.tsx..."
                  const filePath = action.content.replace(/^(Writing|Reading|Editing)\s+/i, '').replace(/\.\.\.$/, '').trim()

                  return (
                    <motion.div
                      key={`${action.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group flex items-center gap-1.5 py-0.5"
                    >
                      <Icon className={`h-3 w-3 shrink-0 ${iconColor}`} />
                      <button
                        type="button"
                        onClick={() => {
                          // Open file in preview/IDE by setting the fragment
                          if (currentFragment) {
                            setCurrentPreview({ fragment: currentFragment, result: undefined })
                          }
                        }}
                        className="truncate text-[11px] text-white/45 transition hover:text-white/70 hover:underline"
                      >
                        {filePath}
                      </button>
                      <span className="shrink-0 tabular-nums text-[10px] text-white/20">{formatDuration(duration)}</span>
                    </motion.div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Web searches */}
        {searchActions.length > 0 && (
          <Collapsible open={expandedSections.has('searches')} onOpenChange={() => toggleSection('searches')}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 border-t border-white/[0.04] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.02]">
              {expandedSections.has('searches') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Search className="h-3.5 w-3.5 text-[#1EAEDB]/70" />
              <span>Web Search</span>
              <span className="ml-auto text-[10px] text-white/25">{searchActions.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 px-4 pb-2">
                {searchActions.map((action, i) => {
                  const duration = getActionDuration(i, searchActions)
                  return (
                    <motion.div
                      key={`${action.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1.5 py-0.5"
                    >
                      <Globe className="h-3 w-3 shrink-0 text-[#1EAEDB]/50" />
                      <span className="truncate text-[11px] text-white/45">{action.content}</span>
                      <span className="shrink-0 tabular-nums text-[10px] text-white/20">{formatDuration(duration)}</span>
                    </motion.div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* To-dos — real tasks from planner output */}
      {todos.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <ListTodo className="h-3.5 w-3.5 text-white/40" />
            <span className="text-[11px] font-medium text-white/50">
              To-dos {completedTodos}/{todos.length}
            </span>
            {completedTodos === todos.length && (
              <Check className="h-3 w-3 text-emerald-400" />
            )}
          </div>
          <div className="space-y-1">
            {todos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-2 py-0.5">
                {todo.completed ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                ) : isStreaming ? (
                  <LoaderIcon className="h-3 w-3 shrink-0 animate-spin text-blue-400/50" />
                ) : (
                  <Circle className="h-3 w-3 shrink-0 text-white/20" />
                )}
                <span className={`text-[11px] ${todo.completed ? 'text-white/40 line-through' : 'text-white/55'}`}>
                  {todo.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}


function GeneratedArtifactCard({
  message,
  setCurrentPreview,
}: {
  message: Message
  setCurrentPreview: (preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) => void
}) {
  const files = getFragmentFiles(message.object)
  const migrations = Array.isArray(message.object?.supabase_migrations)
    ? message.object.supabase_migrations
    : []
  const agentMeta = (message.object as any)?.agent_metadata
  const description = typeof message.object?.description === 'string' ? message.object.description : ''

  return (
    <div className="w-full max-w-[28rem]">
      {/* Description text above the card */}
      {description && (
        <p className="mb-2 text-[13px] leading-relaxed text-white/85 pl-1">{description}</p>
      )}

      {/* Card with project info */}
      <div
        onClick={() =>
          setCurrentPreview({
            fragment: message.object,
            result: message.result,
          })
        }
        className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.06] hover:border-white/15 cursor-pointer"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              {message.object?.title || 'Generated project'}
            </div>
            <div className="mt-1 text-xs text-white/50">
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? '' : 's'} generated`
                : message.object?.template || 'Artifact ready'}
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-3 space-y-1">
            {files.slice(0, 5).map((file) => (
              <div key={file.path} className="flex min-w-0 items-center gap-2 text-xs text-white/60">
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <span className="truncate font-mono">{file.path}</span>
              </div>
            ))}
            {files.length > 5 && (
              <div className="text-xs text-white/40">+{files.length - 5} more files</div>
            )}
          </div>
        )}

        {/* Migrations */}
        {migrations.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
            <Database className="h-3.5 w-3.5" />
            {migrations.length} Supabase migration{migrations.length === 1 ? '' : 's'} ready
          </div>
        )}

        {/* Agent metadata */}
        {agentMeta && (
          <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 mb-1">
              <Cpu className="h-3 w-3" />
              Agentic Generation Info
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-white/35">Complexity:</span>
                <span className="ml-1 text-white/60">{agentMeta.complexity || 'moderate'}</span>
              </div>
              <div>
                <span className="text-white/35">Agents:</span>
                <span className="ml-1 text-white/60">{(agentMeta.agents_used || []).length}</span>
              </div>
              <div>
                <span className="text-white/35">Time:</span>
                <span className="ml-1 text-white/60">{agentMeta.total_duration ? `${(agentMeta.total_duration / 1000).toFixed(1)}s` : '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-white/15 bg-white/[0.04] text-xs font-medium text-white/80 transition hover:bg-white/[0.08]"
          >
            Details
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-white/10 bg-white/[0.08] text-xs font-medium text-white/90 transition hover:bg-white/[0.12]"
          >
            Preview
          </button>
        </div>
      </div>
    </div>
  )
}

// Keep old component for backward compat
function GeneratedArtifactCardOld({
  message,
  setCurrentPreview,
}: {
  message: Message
  setCurrentPreview: (preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) => void
}) {
  const files = getFragmentFiles(message.object)
  const agentMeta = (message.object as any)?.agent_metadata

  return (
    <div
      onClick={() =>
        setCurrentPreview({
          fragment: message.object,
          result: message.result,
        })
      }
      className="w-full max-w-[24rem] rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.06] cursor-pointer"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {message.object?.title || 'Generated project'}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? '' : 's'} generated`
              : message.object?.template || 'Artifact ready'}
          </div>
        </div>
        <Terminal strokeWidth={2} className="h-4 w-4 shrink-0 text-white/40" />
      </div>

      {(message.object as any)?.agent_metadata && (
        <AgentMetadataDisplay metadata={(message.object as any).agent_metadata} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h-8 rounded-md border border-white/15 bg-white/[0.04] text-xs font-medium text-white transition hover:bg-white/[0.08]"
        >
          Details
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-white/10 bg-white/[0.08] text-xs font-medium text-white/70 transition hover:bg-white/[0.12] hover:text-white"
        >
          Preview
        </button>
      </div>
    </div>
  )
}

function PlanActionCard({
  plan,
  disabled,
  onAcceptPlan,
}: {
  plan: MessagePlan
  disabled?: boolean
  onAcceptPlan?: (plan: MessagePlan, answer?: string) => void
}) {
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [customAnswer, setCustomAnswer] = useState('')

  const hasQuestion = Boolean(plan.question)
  const options = plan.options || []
  const allowCustomInput = plan.allowCustomInput !== false
  const answer = (customAnswer || selectedAnswer).trim()
  const isContinueDisabled = disabled || !onAcceptPlan || (hasQuestion && !answer)

  return (
    <div className="w-full max-w-[36rem] whitespace-normal rounded-2xl border border-foreground/50/25 bg-[#151410] p-4 shadow-[0_0_0_1px_rgba(255,184,77,0.08)]">
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-foreground/50/30 bg-foreground/50/10 text-foreground/50">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Plan ready</div>
          <div className="mt-0.5 text-xs text-white/50">Review it, answer if needed, then continue.</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/82">
        {plan.plan}
      </div>

      {plan.question && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/50/85">
            Question
          </div>
          <div className="text-sm leading-6 text-white/85">{plan.question}</div>

          {options.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((option) => {
                const selected = selectedAnswer === option && !customAnswer
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelectedAnswer(option)
                      setCustomAnswer('')
                    }}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
                      selected
                        ? 'border-foreground/50/70 bg-foreground/50/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {option}
                  </button>
                )
              })}
            </div>
          )}

          {allowCustomInput && (
            <input
              value={customAnswer}
              onChange={(event) => {
                setCustomAnswer(event.target.value)
                if (event.target.value) {
                  setSelectedAnswer('')
                }
              }}
              placeholder="Type your answer..."
              className="mt-3 h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-foreground/50/45"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onAcceptPlan?.(plan, answer || undefined)}
          disabled={isContinueDisabled}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-foreground/50/40 bg-foreground/50/15 px-3 text-sm font-semibold text-white transition hover:bg-foreground/50/25 disabled:pointer-events-none disabled:opacity-45"
        >
          <Check className="h-4 w-4" />
          {hasQuestion ? 'Continue with answer' : 'Accept and continue'}
        </button>
      </div>
    </div>
  )
}

function FileOperationCard({
  operation,
  files,
}: {
  operation: 'reading' | 'created' | 'editing'
  files: string[]
}) {
  const config = {
    reading: {
      label: 'Reading',
      icon: Eye,
      borderColor: 'border-blue-500/20',
      bgColor: 'bg-blue-500/5',
      iconColor: 'text-blue-400',
      labelColor: 'text-blue-300',
    },
    created: {
      label: 'Created',
      icon: Plus,
      borderColor: 'border-emerald-500/20',
      bgColor: 'bg-emerald-500/5',
      iconColor: 'text-emerald-400',
      labelColor: 'text-emerald-300',
    },
    editing: {
      label: 'Editing',
      icon: Pencil,
      borderColor: 'border-amber-500/20',
      bgColor: 'bg-amber-500/5',
      iconColor: 'text-amber-400',
      labelColor: 'text-amber-300',
    },
  }

  const { label, icon: Icon, borderColor, bgColor, iconColor, labelColor } = config[operation]

  return (
    <div className={`w-full max-w-[36rem] rounded-xl border ${borderColor} ${bgColor} p-3`}>
      <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${labelColor}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {files.map((file) => {
          const fileName = file.split('/').pop() || file
          const icon = fileName.endsWith('.yml') || fileName.endsWith('.yaml')
            ? '⚙'
            : fileName.endsWith('.java')
              ? '☕'
              : fileName.endsWith('.gradle')
                ? '🐘'
                : fileName.endsWith('.kt') || fileName.endsWith('.kod')
                  ? '🟣'
                  : '📄'
          return (
            <span
              key={file}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/70"
            >
              <span>{icon}</span>
              <span className="truncate max-w-[140px]">{fileName}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function WebSearchCard({
  query,
  results,
}: {
  query: string
  results: { title: string; url: string; favicon?: string }[]
}) {
  return (
    <div className="w-full max-w-[36rem] rounded-xl border border-[#1EAEDB]/20 bg-[#1EAEDB]/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1EAEDB]">
          <Globe className="h-3.5 w-3.5" />
          {query}
        </div>
        <span className="text-[11px] text-white/40">{results.length} results</span>
      </div>
      <div className="space-y-1">
        {results.map((result) => {
          let domain = ''
          try {
            domain = new URL(result.url).hostname.replace('www.', '')
          } catch {
            domain = result.url
          }
          return (
            <a
              key={result.url}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/10 px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              {result.favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.favicon} alt="" className="h-4 w-4 rounded-sm object-contain" />
              ) : (
                <Globe className="h-3.5 w-3.5 shrink-0 text-white/30" />
              )}
              <span className="truncate flex-1">{result.title}</span>
              <span className="shrink-0 text-[10px] text-white/35">{domain}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}


function GenerationStatusCard({
  messages,
  currentFragment,
  isLoading,
  isPreviewLoading,
  autoFixMessage,
  onStop,
}: {
  messages: Message[]
  currentFragment?: DeepPartial<FragmentSchema>
  isLoading: boolean
  isPreviewLoading: boolean
  autoFixMessage?: string
  onStop?: () => void
}) {
  const status = getGenerationStatus({
    messages,
    currentFragment,
    isLoading,
    isPreviewLoading,
    autoFixMessage,
  })

  if (!status) return null

  const files = getFragmentFiles(currentFragment)
  const migrations = Array.isArray(currentFragment?.supabase_migrations)
    ? currentFragment.supabase_migrations
    : []
  // Prefer description (user-friendly) over commentary (internal planning text)
  const commentary = cleanText(currentFragment?.description) || cleanText(currentFragment?.commentary) || ''
  const title = cleanText(currentFragment?.title)
  const description = cleanText(currentFragment?.description)

  return (
    <div className="mt-2 w-full max-w-[36rem] space-y-2">
      {/* Streaming output indicator */}
      {isLoading && !isPreviewLoading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <LoaderIcon strokeWidth={2} className="h-4 w-4 animate-spin text-blue-400" />
            <span className="text-sm font-medium text-white/80">Generating</span>
          </div>
          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="ml-auto flex h-6 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/20"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
              Stop
            </button>
          )}
        </motion.div>
      )}

      {/* Commentary / reasoning (shown after response arrives) */}
      {commentary && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            <Sparkles className="h-3 w-3" />
            Steps
          </div>
          <div className="space-y-3">
            {commentary.split('\n\n').filter(Boolean).map((paragraph, i) => {
              // Parse agent step lines (e.g. "Frontend: Building...")
              const agentMatch = paragraph.match(/^(\w+):\s*([\s\S]+)/)
              if (agentMatch) {
                const agentName = agentMatch[1]
                const agentText = agentMatch[2]
                const IconMap: Record<string, React.ComponentType<any>> = { orchestrator: Activity, planner: Braces, architect: Server, frontend: Palette, backend: Server, reviewer: Shield, optimizer: Zap, fixer: Wrench }
              const Icon = IconMap[agentName.toLowerCase()] || Sparkles
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-blue-400/60" />
                      <span className="text-[11px] font-semibold text-blue-300/70">{agentName}</span>
                    </div>
                    <p className="pl-4 text-xs leading-relaxed text-white/45">
                      {agentText.length > 400 ? `${agentText.slice(0, 400)}...` : agentText}
                    </p>
                  </motion.div>
                )
              }
              return (
                <div key={i} className="text-xs leading-relaxed text-white/45">
                  {paragraph}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Files (shown after response arrives) */}
      {files.length > 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            <FileCode2 className="h-3 w-3" />
            Files ({files.length})
          </div>
          <div className="space-y-1">
            {files.map((file, idx) => (
              <motion.div
                key={file.path}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: idx * 0.03 }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-white/30" />
                <span className="flex-1 truncate text-white/60">{file.path}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">edited</span>
                <Check className="h-3 w-3 shrink-0 text-emerald-400/70" />
              </motion.div>
            ))}


          </div>
        </motion.div>
      )}

      {/* Title + description (when available) */}
      {(title || description) && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
        >
          {title && (
            <div className="text-sm font-medium text-white/80">{title}</div>
          )}
          {description && (
            <div className="mt-1 text-xs text-white/40">{description}</div>
          )}
        </motion.div>
      )}

      {/* Supabase migrations */}
      {migrations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-300/80"
        >
          <Database className="h-3.5 w-3.5" />
          Preparing {migrations.length} Supabase migration{migrations.length === 1 ? '' : 's'}
        </motion.div>
      )}
    </div>
  )
}

function getGenerationStatus({
  messages,
  currentFragment,
  isLoading,
  isPreviewLoading,
  autoFixMessage,
}: {
  messages: Message[]
  currentFragment?: DeepPartial<FragmentSchema>
  isLoading: boolean
  isPreviewLoading: boolean
  autoFixMessage?: string
}) {
  const promptTarget = getPromptTarget(messages)
  const latestObject =
    currentFragment ||
    [...messages].reverse().find((message) => message.object)?.object
  const title = cleanText(latestObject?.title)
  const filePath = cleanText(latestObject?.file_path)
  const template = cleanText(latestObject?.template)
  const code = cleanText(latestObject?.code)
  const generatedTarget = filePath || title || template || promptTarget

  if (autoFixMessage) {
    return {
      title: 'Fixing generated code',
      detail: autoFixMessage,
    }
  }

  if (isPreviewLoading) {
    return {
      title: 'Preparing live preview',
      detail: `Launching the sandbox for ${title || promptTarget}`,
    }
  }

  if (!isLoading && !isPreviewLoading && !autoFixMessage) {
    // After generation: don't show status card — artifact card handles it
    return null
  }

  const files = getFragmentFiles(latestObject)

  if (files.length > 3) {
    return {
      title: 'Building your project',
      detail: `Generated ${files.length} files — installing dependencies and setting up the project`,
    }
  }

  if (files.length > 0) {
    return {
      title: 'Creating project files',
      detail: `Writing ${files.length} file${files.length === 1 ? '' : 's'} for ${title || promptTarget}`,
    }
  }

  if (code || filePath) {
    return {
      title: 'Writing code',
      detail: `Generating ${generatedTarget}`,
    }
  }

  if (title || template) {
    return {
      title: 'Planning implementation',
      detail: `Setting up ${title || template || promptTarget}`,
    }
  }

  if (/landing|page|website|design|ui|hero/i.test(promptTarget)) {
    return {
      title: 'Exploring design directions',
      detail: `Drafting ${promptTarget}`,
    }
  }

  return {
    title: 'Thinking',
    detail: `Planning how to build ${promptTarget}`,
  }
}

function getPromptTarget(messages: Message[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const text = latestUserMessage?.content
    .filter((content) => content.type === 'text')
    .map((content) => content.text)
    .join(' ')

  const normalized = cleanText(text)
    .replace(/^(make|build|create|generate|design|code|write)\s+/i, '')

  if (!normalized) {
    return 'your project'
  }

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}
