import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react'
import type { ToolAction, TodoItem } from '@/lib/hooks/use-agentic-stream'

/**
 * Bridge between our existing agentic SSE stream and assistant-ui's ChatModelAdapter.
 *
 * When the user sends a message, this adapter:
 * 1. POSTs to /api/chat/agentic (our existing endpoint)
 * 2. Streams SSE events (action, fragment, todos, etc.)
 * 3. Converts them to assistant-ui's ChatModelRunUpdate format
 *    — reasoning parts for thinking actions
 *    — text parts for commentary
 *    — tool-call parts for file_read, file_write, run_command
 */

// Callback type for forwarding agentic state to our existing hooks
export type AgenticStateCallback = (update: {
  actions?: ToolAction[]
  todos?: TodoItem[]
  fragment?: Record<string, any>
  isStreaming?: boolean
  error?: string | null
}) => void

/**
 * Creates a ChatModelAdapter that bridges our SSE stream to assistant-ui.
 * The adapter reads our /api/chat/agentic SSE stream and emits updates
 * that assistant-ui renders via its Thread/Message components.
 */
export function createAgenticAdapter(opts: {
  projectId: string
  modelId: string
  mode: string
  useAgentic: boolean
  onStateChange: AgenticStateCallback
}): ChatModelAdapter {
  return {
    async run(options: ChatModelRunOptions): Promise<ChatModelRunResult> {
      const { messages, abortSignal } = options
      const lastMsg = messages[messages.length - 1]
      const userText = lastMsg?.content
        ? (Array.isArray(lastMsg.content)
            ? lastMsg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
            : typeof lastMsg.content === 'string'
            ? lastMsg.content
            : '')
        : ''

      if (!userText) {
        return { content: [{ type: 'text', text: '' }] }
      }

      // Forward loading state to our existing hooks
      opts.onStateChange({ isStreaming: true, actions: [], todos: [], error: null })

      try {
        const response = await fetch('/api/chat/agentic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userText,
            projectId: opts.projectId,
            model: opts.modelId,
            mode: opts.mode,
            useAgentic: opts.useAgentic,
          }),
          signal: abortSignal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || `HTTP ${response.status}`)
        }

        // Read SSE stream
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const actions: ToolAction[] = []
        const todos: TodoItem[] = []
        let accumulatedFragment: Record<string, any> = {}
        let commentary = ''
        let reasoningParts: string[] = []
        const toolParts: Array<{ toolName: string; args: any; result?: any }> = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''

          for (const part of parts) {
            const trimmed = part.trim()
            if (!trimmed || trimmed.startsWith(':')) continue

            const dataLines = trimmed.split('\n')
              .filter(l => l.startsWith('data: '))
              .map(l => l.slice(6))
            const jsonStr = dataLines.join('')
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr)

              if (event.type === 'action') {
                const action: ToolAction = {
                  type: event.action_type,
                  content: event.content || '',
                  detail: event.detail || '',
                  timestamp: Date.now(),
                }
                actions.push(action)

                // Forward to our existing hooks
                opts.onStateChange({ actions: [...actions] })

                // Build assistant-ui parts
                if (action.type === 'thinking') {
                  reasoningParts.push(action.content)
                } else if (action.type === 'commentary' || action.type === 'commentary_chunk') {
                  commentary = action.content
                } else if (action.type === 'file_read') {
                  toolParts.push({ toolName: 'read_file', args: { path: action.content } })
                } else if (action.type === 'file_write' || action.type === 'file_edit') {
                  toolParts.push({ toolName: 'create_file', args: { path: action.content } })
                } else if (action.type === 'run_command') {
                  toolParts.push({ toolName: 'run_command', args: { command: action.content } })
                }
              } else if (event.type === 'todos') {
                todos.splice(0, todos.length, ...(event.todos || []))
                opts.onStateChange({ todos: [...todos] })
              } else if (event.type === 'fragment') {
                accumulatedFragment = { ...accumulatedFragment, ...event.data }
                opts.onStateChange({ fragment: accumulatedFragment })
              } else if (event.type === 'error') {
                opts.onStateChange({ error: event.message })
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        opts.onStateChange({ isStreaming: false })

        // Build the final assistant-ui content parts
        const contentParts: Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; args?: any }> = []

        // Add reasoning parts
        for (const r of reasoningParts) {
          contentParts.push({ type: 'reasoning', text: r })
        }

        // Add commentary text
        if (commentary) {
          contentParts.push({ type: 'text', text: commentary })
        }

        // Add tool call parts
        for (const tp of toolParts) {
          contentParts.push({
            type: 'tool-call',
            toolCallId: `tc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            toolName: tp.toolName,
            args: tp.args,
          })
        }

        // If no content was generated, add a fallback
        if (contentParts.length === 0) {
          const fragFiles = accumulatedFragment.files
          if (fragFiles && fragFiles.length > 0) {
            contentParts.push({
              type: 'text',
              text: `Generated ${fragFiles.length} file${fragFiles.length === 1 ? '' : 's'}. Check the preview to see the result.`,
            })
          } else {
            contentParts.push({ type: 'text', text: 'Processing complete.' })
          }
        }

        return { content: contentParts as any }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          opts.onStateChange({ isStreaming: false })
          return { content: [{ type: 'text', text: '' }] }
        }
        opts.onStateChange({ isStreaming: false, error: err.message })
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    },
  }
}
