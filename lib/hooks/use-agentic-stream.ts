'use client'

import { FragmentSchema } from '@/lib/schema'
import { DeepPartial } from 'ai'
import { useCallback, useEffect, useRef, useState } from 'react'

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

const STREAM_STORAGE_PREFIX = 'agentic-stream:'

function loadPersistedState(key?: string): AgenticStreamState | null {
  if (!key) return null
  try {
    const saved = localStorage.getItem(STREAM_STORAGE_PREFIX + key)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    // Only restore if the stream was not streaming when saved
    if (parsed.isStreaming) return null
    return { ...INITIAL_STATE, ...parsed, isStreaming: false, error: null }
  } catch { return null }
}

function persistState(key: string | undefined, state: AgenticStreamState) {
  if (!key) return
  try {
    // Only persist when stream is done and has meaningful data
    if (state.isStreaming) return
    if (state.actions.length === 0 && !state.fragment?.code && !state.fragment?.title) return
    localStorage.setItem(STREAM_STORAGE_PREFIX + key, JSON.stringify({
      actions: state.actions,
      todos: state.todos,
      fragment: state.fragment,
      completedSteps: state.completedSteps,
      totalSteps: state.totalSteps,
      isStreaming: false,
    }))
  } catch {}
}

function clearPersistedState(key?: string) {
  if (!key) return
  try { localStorage.removeItem(STREAM_STORAGE_PREFIX + key) } catch {}
}

export function useAgenticStream(storageKey?: string) {
  const [state, setState] = useState<AgenticStreamState>(() => {
    const persisted = loadPersistedState(storageKey)
    return persisted || INITIAL_STATE
  })
  const abortControllerRef = useRef<AbortController | null>(null)
  const accumulatedRef = useRef<DeepPartial<FragmentSchema>>({})
  const storageKeyRef = useRef(storageKey)
  storageKeyRef.current = storageKey

  // Persist state when stream completes
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestStateRef = useRef(state)
  latestStateRef.current = state

  // Debounced persist when streaming ends
  if (!state.isStreaming && state.actions.length > 0) {
    if (!persistTimeoutRef.current) {
      persistTimeoutRef.current = setTimeout(() => {
        persistState(storageKeyRef.current, latestStateRef.current)
        persistTimeoutRef.current = null
      }, 500)
    }
  }

  const reset = useCallback(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
    persistTimeoutRef.current = null
    clearPersistedState(storageKeyRef.current)
    accumulatedRef.current = {}
    setState(INITIAL_STATE)
  }, [])

  const submit = useCallback(async (body: Record<string, any>) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Clear old persisted state for this project
    clearPersistedState(storageKeyRef.current)

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

        // SSE format: events separated by double newlines
        // Each event starts with "data: " followed by JSON
        // Comments start with ":" (heartbeats)
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed) continue

          // Skip SSE comments (heartbeats)
          if (trimmed.startsWith(':')) continue

          // Extract JSON from "data: {...}" lines
          const dataLines = trimmed.split('\n')
            .filter(l => l.startsWith('data: '))
            .map(l => l.slice(6)) // Remove "data: " prefix
          const jsonStr = dataLines.join('')
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

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
              } else if (actionType === 'file_write' || actionType === 'file_edit' || actionType === 'file_read') {
                // Deduplicate file actions: only add if not already present
                setState(prev => {
                  const exists = prev.actions.some(
                    a => a.type === actionType && a.content === (event.content || '')
                  )
                  if (exists) return prev
                  return {
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
                  }
                })
              } else {
                // Regular action: thinking, web_search, status, etc.
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

  // Persist state when stream completes (safety net)
  const prevStateRef = useRef(state.isStreaming)
  useEffect(() => {
    if (prevStateRef.current && !state.isStreaming && state.actions.length > 0) {
      persistState(storageKeyRef.current, state)
    }
    prevStateRef.current = state.isStreaming
  }, [state.isStreaming, state.actions.length])

  // Cleanup persist timeout on unmount
  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [])

  return {
    ...state,
    submit,
    stop,
    reset,
  }
}
