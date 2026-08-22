'use client'

import { FragmentSchema } from '@/lib/schema'
import { DeepPartial } from 'ai'
import { useCallback, useRef, useState } from 'react'

export type ToolAction = {
  type: 'thinking' | 'file_write' | 'file_edit' | 'file_read' | 'web_search' | 'web_fetch' | 'todo' | 'commentary' | 'commentary_chunk' | 'status'
  content: string
  detail?: string
  timestamp: number
}

export type TodoItem = {
  id: string
  text: string
  completed: boolean
}

export type AgenticStreamState = {
  fragment: DeepPartial<FragmentSchema>
  actions: ToolAction[]
  todos: TodoItem[]
  isStreaming: boolean
  error: string | null
  completedSteps: number
  totalSteps: number
}

const INITIAL_STATE: AgenticStreamState = {
  fragment: {},
  actions: [],
  todos: [],
  isStreaming: false,
  error: null,
  completedSteps: 0,
  totalSteps: 0,
}

function mergeFragment(
  accumulated: DeepPartial<FragmentSchema>,
  chunk: Record<string, any>,
): DeepPartial<FragmentSchema> {
  const result = { ...accumulated } as Record<string, any>

  for (const [key, value] of Object.entries(chunk)) {
    if (value === undefined || value === null) continue

    if (key === 'files' && Array.isArray(value)) {
      const existing = (result.files || []) as any[]
      const merged = [...existing]
      for (const file of value) {
        const idx = merged.findIndex((f: any) => f?.path === file.path)
        if (idx >= 0) {
          merged[idx] = file
        } else {
          merged.push(file)
        }
      }
      result.files = merged
    } else if (key === 'supabase_migrations' && Array.isArray(value)) {
      result.supabase_migrations = [
        ...(result.supabase_migrations || []),
        ...value,
      ]
    } else if (key === 'additional_dependencies' && Array.isArray(value)) {
      const set = new Set([...(result.additional_dependencies || []), ...value])
      result.additional_dependencies = Array.from(set)
    } else {
      result[key] = value
    }
  }

  return result as DeepPartial<FragmentSchema>
}

export function useAgenticStream() {
  const [state, setState] = useState<AgenticStreamState>(INITIAL_STATE)
  const abortControllerRef = useRef<AbortController | null>(null)
  const accumulatedRef = useRef<DeepPartial<FragmentSchema>>({})

  const reset = useCallback(() => {
    accumulatedRef.current = {}
    setState(INITIAL_STATE)
  }, [])

  const submit = useCallback(async (body: Record<string, any>) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    accumulatedRef.current = {}
    setState({
      fragment: {},
      actions: [],
      todos: [],
      isStreaming: true,
      error: null,
      completedSteps: 0,
      totalSteps: 0,
    })

    try {
      const response = await fetch('/api/chat/agentic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event = JSON.parse(trimmed)

            if (event.type === 'action') {
              const actionType = event.action_type as ToolAction['type']

              if (actionType === 'commentary_chunk') {
                // Append to the last commentary action for streaming text effect
                setState(prev => {
                  const actions = [...prev.actions]
                  const lastCommentaryIdx = actions.findLastIndex(
                    a => a.type === 'commentary' || a.type === 'commentary_chunk'
                  )
                  if (lastCommentaryIdx >= 0) {
                    actions[lastCommentaryIdx] = {
                      ...actions[lastCommentaryIdx],
                      content: event.content || '',
                      timestamp: Date.now(),
                    }
                  } else {
                    actions.push({
                      type: 'commentary_chunk',
                      content: event.content || '',
                      detail: event.detail || '',
                      timestamp: Date.now(),
                    })
                  }
                  return { ...prev, actions }
                })
              } else {
                // Regular action: thinking, file_write, web_search, etc.
                setState(prev => ({
                  ...prev,
                  actions: [
                    ...prev.actions,
                    {
                      type: actionType,
                      content: event.content || '',
                      detail: event.detail || '',
                      timestamp: Date.now(),
                    },
                  ],
                }))
              }
            } else if (event.type === 'todos') {
              // Todo list update
              setState(prev => ({
                ...prev,
                todos: event.todos || prev.todos,
              }))
            } else if (event.type === 'progress') {
              // Progress update
              setState(prev => ({
                ...prev,
                completedSteps: event.completed ?? prev.completedSteps,
                totalSteps: event.total ?? prev.totalSteps,
              }))
            } else if (event.type === 'fragment') {
              // Fragment chunk — partial JSON
              accumulatedRef.current = mergeFragment(
                accumulatedRef.current,
                event.data,
              )
              setState(prev => ({
                ...prev,
                fragment: { ...accumulatedRef.current },
              }))
            } else if (event.type === 'error') {
              setState(prev => ({
                ...prev,
                error: event.message || 'Streaming error',
              }))
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          error: err.message || 'Stream failed',
        }))
      }
    } finally {
      setState(prev => ({ ...prev, isStreaming: false }))
    }
  }, [])

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    setState(prev => ({ ...prev, isStreaming: false }))
  }, [])

  return {
    ...state,
    submit,
    stop,
    reset,
  }
}
