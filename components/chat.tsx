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
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

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
              : 'w-full gap-2 text-white/90'
          }`}
          key={index}
        >
          {message.content.map((content, id) => {
            if (content.type === 'text') {
              const text = content.text || ''
              const searchMatch = text.match(/^\[Search:\s*(.*?)\]\s*$/)
              const thinkMatch = text.match(/^\[Think:\s*(.*?)\]\s*$/)
              const canvasMatch = text.match(/^\[Canvas:\s*(.*?)\]\s*$/)

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
              return <span key={id}>{content.text}</span>
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
          {message.object && (
            <GeneratedArtifactCard
              message={message}
              setCurrentPreview={setCurrentPreview}
            />
          )}
        </motion.div>
      ))}
      {(isLoading || isPreviewLoading || autoFixMessage || (useAgentic && agenticActions.length > 0)) && (
        <>
          {/* Live agentic streaming actions — show during AND after streaming */}
          {useAgentic && agenticActions.length > 0 && (
            <AgenticLiveActions
              actions={agenticActions}
              todos={agenticTodos}
              isStreaming={agenticStreaming}
              setCurrentPreview={setCurrentPreview}
              currentFragment={currentFragment}
              onStop={onStop}
            />
          )}
          {/* Fallback indicator for non-agentic or before actions stream in */}
          {useAgentic && isLoading && agenticActions.length === 0 && (
            <div className="w-full max-w-[36rem] rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <LoaderIcon className="h-4 w-4 animate-spin text-blue-400" />
                <span className="text-xs font-medium text-blue-300">Starting agentic pipeline...</span>
              </div>
            </div>
          )}
          {/* Hide GenerationStatusCard when agentic actions are showing (they provide better info) */}
          {!(useAgentic && agenticActions.length > 0) && (
            <GenerationStatusCard
              messages={messages}
              currentFragment={currentFragment}
              isLoading={isLoading}
              isPreviewLoading={isPreviewLoading}
              autoFixMessage={autoFixMessage}
              onStop={onStop}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── Live Agentic Actions Display ──────────────────────────
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
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

  return (
    <div
      onClick={() =>
        setCurrentPreview({
          fragment: message.object,
          result: message.result,
        })
      }
      className="w-full max-w-[24rem] rounded-xl border border-blue-500/70 bg-white/[0.035] p-3 shadow-[0_0_0_1px_rgba(37,99,235,0.18)] transition hover:bg-white/[0.055] hover:cursor-pointer"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {message.object?.title || 'Generated project'}
          </div>
          <div className="mt-1 truncate text-xs text-white/45">
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? '' : 's'} generated`
              : message.object?.template || 'Artifact ready'}
          </div>
        </div>
        <Terminal strokeWidth={2} className="h-4 w-4 shrink-0 text-foreground/50" />
      </div>

      {files.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {files.slice(0, 5).map((file) => (
            <div key={file.path} className="flex min-w-0 items-center gap-2 text-xs text-white/68">
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-white/42" />
              <span className="truncate">{file.path}</span>
            </div>
          ))}
          {files.length > 5 && (
            <div className="text-xs text-white/42">+{files.length - 5} more files</div>
          )}
        </div>
      )}      {migrations.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
          <Database className="h-3.5 w-3.5" />
          {migrations.length} Supabase migration{migrations.length === 1 ? '' : 's'} ready
        </div>
      )}

      {/* Agent Metadata Display */}
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
  const commentary = cleanText(currentFragment?.commentary) || ''
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

  if (!isLoading) return null

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
