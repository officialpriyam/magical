'use client'

import { useMemo, useEffect } from 'react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  makeAssistantToolUI,
  type AssistantToolUI,
} from '@assistant-ui/react'
import { ChevronRight } from 'lucide-react'
import type { ToolAction, TodoItem } from '@/lib/hooks/use-agentic-stream'
import { createAgenticAdapter, type AgenticStateCallback } from '@/lib/assistant-bridge'
import {
  FileReadToolUI,
  FileCreateToolUI,
  FileEditToolUI,
  CommandToolUI,
} from '@/components/assistant-tool-uis'
import { ActivityFeed } from '@/components/activity-feed'

// ─── Register custom tool UIs with assistant-ui ─────────────
// makeAssistantToolUI creates a tool UI configuration from a component
const toolUIs: AssistantToolUI[] = [
  makeAssistantToolUI({ toolName: 'read_file', render: FileReadToolUI as any }),
  makeAssistantToolUI({ toolName: 'create_file', render: FileCreateToolUI as any }),
  makeAssistantToolUI({ toolName: 'edit_file', render: FileEditToolUI as any }),
  makeAssistantToolUI({ toolName: 'run_command', render: CommandToolUI as any }),
]

// ─── Inner thread that renders messages with activity feed ──
function AgenticThread({
  agenticActions,
  agenticTodos,
  agenticStreaming,
  agenticElapsed,
  onFileClick,
  onStop,
}: {
  agenticActions: ToolAction[]
  agenticTodos: TodoItem[]
  agenticStreaming: boolean
  agenticElapsed: number
  onFileClick?: (path: string) => void
  onStop?: () => void
}) {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
        <ThreadPrimitive.Messages components={{
          UserMessage: UserMessageBubble,
          AssistantMessage: AssistantMessageBubble,
        }} />

        {/* Activity feed — shows during and after streaming */}
        {agenticActions.length > 0 && (
          <div className="max-w-[42rem] mx-auto px-4 pb-4">
            <ActivityFeed
              actions={agenticActions}
              todos={agenticTodos}
              isStreaming={agenticStreaming}
              elapsed={agenticElapsed}
              onStop={onStop}
              onFileClick={onFileClick}
            />
          </div>
        )}
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

// ─── User message bubble ────────────────────────────────────
function UserMessageBubble() {
  return (
    <MessagePrimitive.Root className="max-w-[42rem] mx-auto mb-4">
      <div className="flex justify-end">
        <div className="rounded-2xl bg-blue-600/20 border border-blue-500/20 px-4 py-2.5 text-[14px] text-white/90 max-w-[85%]">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

// ─── Assistant message bubble ───────────────────────────────
function AssistantMessageBubble() {
  return (
    <MessagePrimitive.Root className="max-w-[42rem] mx-auto mb-4">
      <div className="flex gap-3">
        {/* Agent avatar */}
        <div className="shrink-0 mt-1">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 flex items-center justify-center">
            <span className="text-[11px] font-bold text-blue-400">✦</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Message parts: reasoning, text, tool calls */}
          <MessagePrimitive.Parts
            components={{
              Reasoning: ReasoningBlock,
              Text: TextPart,
            }}
          />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

// ─── Reasoning block (collapsible thinking) ─────────────────
function ReasoningBlock() {
  return (
    <details className="group mb-2">
      <summary className="flex items-center gap-2 py-1 px-1 -mx-1 rounded-md cursor-pointer hover:bg-white/[0.04] transition-colors text-[13px] text-white/60 list-none">
        <ChevronRight className="h-3.5 w-3.5 text-white/40 group-open:rotate-90 transition-transform" />
        <span className="text-purple-400/70">✦</span>
        <span className="font-medium">Thinking</span>
        <span className="text-[10px] text-white/30">— click to expand</span>
      </summary>
      <div className="ml-6 mb-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[13px] leading-[1.7] text-white/60 whitespace-pre-wrap">
        <MessagePrimitive.Content />
      </div>
    </details>
  )
}

// ─── Text part (commentary) ─────────────────────────────────
function TextPart() {
  return (
    <div className="text-[14px] leading-[1.7] text-white/80 mb-2 whitespace-pre-wrap">
      <MessagePrimitive.Content />
    </div>
  )
}

// ─── Main exported component ────────────────────────────────
export function AssistantChat({
  projectId,
  modelId,
  mode,
  useAgentic,
  agenticActions,
  agenticTodos,
  agenticStreaming,
  agenticElapsed,
  onStateChange,
  onFileClick,
  onStop,
}: {
  projectId: string
  modelId: string
  mode: string
  useAgentic: boolean
  agenticActions: ToolAction[]
  agenticTodos: TodoItem[]
  agenticStreaming: boolean
  agenticElapsed: number
  onStateChange: AgenticStateCallback
  onFileClick?: (path: string) => void
  onStop?: () => void
}) {
  const adapter = useMemo(() => createAgenticAdapter({
    projectId,
    modelId,
    mode,
    useAgentic,
    onStateChange,
  }), [projectId, modelId, mode, useAgentic, onStateChange])

  const runtime = useLocalRuntime(adapter)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgenticThread
        agenticActions={agenticActions}
        agenticTodos={agenticTodos}
        agenticStreaming={agenticStreaming}
        agenticElapsed={agenticElapsed}
        onFileClick={onFileClick}
        onStop={onStop}
      />
    </AssistantRuntimeProvider>
  )
}
