import { Message, MessagePlan } from '@/lib/messages'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { getFragmentFiles } from '@/lib/fragment-files'
import { AgentMetadataDisplay } from '@/components/agent-status'
import { AGENT_DISPLAY_NAMES } from '@/lib/agents/prompts'
import type { AgentRole } from '@/lib/agents/types'
import { DeepPartial } from 'ai'
import { Check, Database, FileCode2, LoaderIcon, Terminal, Sparkles, Square, Globe, Eye, Plus, Pencil, Cpu, Activity, Braces, Palette, Server, Shield, Zap, Wrench } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
}) {

  useEffect(() => {
    const chatContainer = document.getElementById('chat-container')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, [messages, isLoading, isPreviewLoading, currentFragment])

  return (
    <div
      id="chat-container"
      className="flex h-full max-h-full flex-col gap-2 overflow-y-auto px-0 pb-4 pt-1 sm:gap-3 sm:px-1 md:gap-3 md:px-1"
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
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
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
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6-1 1-2 2.5-2 4h-4c0-1.5-1-3-2-4-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z"/><path d="M9 21h6"/></svg>
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
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
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
              return (
                <FileOperationCard key={id} operation={content.operation} files={content.files} />
              )
            }
            if (content.type === 'web_search') {
              return (
                <WebSearchCard key={id} query={content.query} results={content.results} />
              )
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
      {(isLoading || isPreviewLoading || autoFixMessage) && (
        <>
          {useAgentic && isLoading && (
            <AgentProgressIndicator currentFragment={currentFragment} />
          )}
          <GenerationStatusCard
            messages={messages}
            currentFragment={currentFragment}
            isLoading={isLoading}
            isPreviewLoading={isPreviewLoading}
            autoFixMessage={autoFixMessage}
            onStop={onStop}
          />
        </>
      )}
    </div>
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

const AGENT_ICONS: Record<AgentRole, React.ComponentType<any>> = {
  orchestrator: Activity,
  planner: Braces,
  architect: Server,
  frontend: Palette,
  backend: Server,
  reviewer: Shield,
  optimizer: Zap,
  fixer: Wrench,
}

const AGENT_LABELS: Record<AgentRole, string> = {
  orchestrator: 'Analyzing request complexity',
  planner: 'Creating implementation plan',
  architect: 'Designing project architecture',
  frontend: 'Building UI components',
  backend: 'Building API & data layer',
  reviewer: 'Reviewing code quality',
  optimizer: 'Optimizing performance',
  fixer: 'Fixing issues',
}

function AgentProgressIndicator({ currentFragment }: { currentFragment?: DeepPartial<FragmentSchema> }) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef(Date.now())

  // Derive live state from currentFragment
  const files = getFragmentFiles(currentFragment)
  const currentFilePath = cleanText(currentFragment?.file_path)
  const hasCode = Boolean(cleanText(currentFragment?.code))
  const commentary = cleanText(currentFragment?.commentary)
  const template = cleanText(currentFragment?.template)

  // Determine which agents are active based on streaming progress
  const activeAgents: AgentRole[] = []
  if (!currentFragment) {
    activeAgents.push('orchestrator')
  } else if (!template) {
    activeAgents.push('planner')
  } else if (files.length === 0 && !currentFilePath) {
    activeAgents.push('architect')
  } else if (files.length < 3) {
    activeAgents.push('frontend')
  } else {
    activeAgents.push('frontend', 'backend')
  }

  // If we have code, reviewer/optimizer may be running
  if (hasCode && files.length > 0) {
    activeAgents.push('reviewer')
  }

  const totalAgents = activeAgents.length

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="w-full max-w-[36rem] rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
            <Cpu className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-blue-300">Agentic Pipeline</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-blue-400/70">
            <Activity className="h-3 w-3" />
            {totalAgents} agent{totalAgents !== 1 ? 's' : ''} active
          </span>
          <span className="text-white/20">|</span>
          <span className="text-white/40">{elapsedTime}s</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
          initial={{ width: '0%' }}
          animate={{ width: hasCode ? '85%' : files.length > 0 ? '60%' : '25%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Active agents */}
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {activeAgents.map((role) => {
          const Icon = AGENT_ICONS[role]
          return (
            <span
              key={role}
              className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300"
            >
              <LoaderIcon className="h-2.5 w-2.5 animate-spin" />
              <Icon className="h-2.5 w-2.5" />
              {AGENT_DISPLAY_NAMES[role]}
            </span>
          )
        })}
      </div>

      {/* Live file creation feed */}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {files.slice(0, 5).map((file, idx) => (
            <motion.div
              key={file.path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-lg bg-blue-500/5 px-2 py-1 text-[11px] text-white/50"
            >
              <FileCode2 className="h-3 w-3 shrink-0 text-blue-400/60" />
              <span className="truncate">{file.path}</span>
              <span className="ml-auto shrink-0 text-[10px] text-emerald-400/60">done</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Currently writing file */}
        {currentFilePath && !files.find(f => f.path === currentFilePath) && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] text-blue-300"
          >
            <LoaderIcon className="h-3 w-3 shrink-0 animate-spin text-blue-400" />
            <span className="truncate">{currentFilePath}</span>
            <span className="ml-auto shrink-0 text-[10px] text-blue-400/60">writing</span>
          </motion.div>
        )}

        {files.length > 5 && (
          <div className="text-[11px] text-white/30 pl-5">+{files.length - 5} more files</div>
        )}
      </div>

      {/* Live commentary */}
      {commentary && (
        <div className="mt-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-white/40">
          {commentary.length > 120 ? `${commentary.slice(0, 120)}...` : commentary}
        </div>
      )}
    </motion.div>
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
  const currentFilePath = cleanText(currentFragment?.file_path)
  const hasCode = Boolean(cleanText(currentFragment?.code))

  return (
    <div className="mt-2 w-full max-w-[36rem] rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-white">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles strokeWidth={2} className="h-4 w-4 shrink-0 animate-pulse text-foreground/70" />
          <span className="min-w-0 break-words">{status.title}</span>
        </div>
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-200 transition hover:bg-red-500/20"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
        <LoaderIcon strokeWidth={2} className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span className="min-w-0 break-words">{status.detail}</span>
      </div>

      {commentary && (
        <div className="mt-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs leading-relaxed text-white/50">
          {commentary.length > 200 ? `${commentary.slice(0, 200)}...` : commentary}
        </div>
      )}

      {currentFilePath && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs text-primary/80">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Writing {currentFilePath}</span>
          <LoaderIcon strokeWidth={2} className="h-3 w-3 shrink-0 animate-spin ml-auto" />
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {files.slice(0, 8).map((file, idx) => (
            <div
              key={file.path}
              className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/15 px-2 py-1.5 text-xs text-white/62"
            >
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-white/36" />
              <span className="truncate">{file.path}</span>
              {idx === files.length - 1 && hasCode && (
                <LoaderIcon strokeWidth={2} className="h-3 w-3 shrink-0 animate-spin ml-auto text-primary/60" />
              )}
            </div>
          ))}
          {files.length > 8 && (
            <div className="text-xs text-white/42">+{files.length - 8} more files</div>
          )}
        </div>
      )}
      {migrations.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
          <Database className="h-3.5 w-3.5" />
          Preparing {migrations.length} Supabase migration{migrations.length === 1 ? '' : 's'}
        </div>
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
