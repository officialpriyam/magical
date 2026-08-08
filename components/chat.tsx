import { Message, MessagePlan } from '@/lib/messages'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { getFragmentFiles } from '@/lib/fragment-files'
import { DeepPartial } from 'ai'
import { Check, Database, FileCode2, LoaderIcon, Terminal, Sparkles, Square } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Chat({
  messages,
  isLoading,
  isPreviewLoading = false,
  currentFragment,
  autoFixMessage,
  onStop,
  onAcceptPlan,
  setCurrentPreview,
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
      className="flex h-full max-h-full flex-col gap-5 overflow-y-auto px-1 pb-6 pt-2"
    >
      {messages.length === 0 && !isLoading && !isPreviewLoading && (
        <div className="flex h-full items-center justify-center text-sm text-white/45">
          Start a new conversation
        </div>
      )}

      {messages.map((message: Message, index: number) => (
        <div
          className={`flex flex-col whitespace-pre-wrap text-sm leading-6 ${
            message.role === 'user'
              ? 'self-end rounded-2xl bg-white/[0.07] px-4 py-2 text-white shadow-sm'
              : 'w-full gap-3 text-white/90'
          }`}
          key={index}
        >
          {message.content.map((content, id) => {
            if (content.type === 'text') {
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
          })}
          {message.object && (
            <GeneratedArtifactCard
              message={message}
              setCurrentPreview={setCurrentPreview}
            />
          )}
        </div>
      ))}
      {(isLoading || isPreviewLoading || autoFixMessage) && (
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
        <Terminal strokeWidth={2} className="h-4 w-4 shrink-0 text-[#FFB84D]" />
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
      )}

      {migrations.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
          <Database className="h-3.5 w-3.5" />
          {migrations.length} Supabase migration{migrations.length === 1 ? '' : 's'} ready
        </div>
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
    <div className="w-full max-w-[36rem] whitespace-normal rounded-2xl border border-[#FFB84D]/25 bg-[#151410] p-4 shadow-[0_0_0_1px_rgba(255,184,77,0.08)]">
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#FFB84D]/30 bg-[#FFB84D]/10 text-[#FFB84D]">
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
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#FFB84D]/85">
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
                        ? 'border-[#FFB84D]/70 bg-[#FFB84D]/15 text-white'
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
              className="mt-3 h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#FFB84D]/45"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onAcceptPlan?.(plan, answer || undefined)}
          disabled={isContinueDisabled}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#FFB84D]/40 bg-[#FFB84D]/15 px-3 text-sm font-semibold text-white transition hover:bg-[#FFB84D]/25 disabled:pointer-events-none disabled:opacity-45"
        >
          <Check className="h-4 w-4" />
          {hasQuestion ? 'Continue with answer' : 'Accept and continue'}
        </button>
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

  return (
    <div className="mt-2 w-full max-w-[36rem] rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-white">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles strokeWidth={2} className="h-4 w-4 shrink-0 animate-pulse text-[#FF8800]" />
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
      {files.length > 0 && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {files.slice(0, 6).map((file) => (
            <div
              key={file.path}
              className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/15 px-2 py-1.5 text-xs text-white/62"
            >
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-white/36" />
              <span className="truncate">{file.path}</span>
            </div>
          ))}
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

  if (files.length > 0) {
    return {
      title: 'Writing project files',
      detail: `Generating ${files.length} file${files.length === 1 ? '' : 's'} for ${title || promptTarget}`,
    }
  }

  if (code || filePath || title || template) {
    return {
      title: 'Writing project files',
      detail: `Generating ${generatedTarget}`,
    }
  }

  if (/landing|page|website|design|ui|hero/i.test(promptTarget)) {
    return {
      title: 'Exploring design directions',
      detail: `Drafting ${promptTarget}`,
    }
  }

  return {
    title: 'Planning implementation',
    detail: `Generating ${promptTarget}`,
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
