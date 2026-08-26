'use client'

import ErrorBoundary, { getErrorLog } from '@/components/error-boundary'
import { useState, useCallback } from 'react'

export function AppStabilityGuard({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary name="App" fallback={<AppCrashRecovery />}>
      {children}
    </ErrorBoundary>
  )
}

function AppCrashRecovery() {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const errors = getErrorLog()

  async function copyAllErrors() {
    const text = errors.map((e) =>
      `[${e.timestamp}] ${e.name}: ${e.message}\n${e.stack || ''}\n${e.componentStack || ''}`
    ).join('\n---\n')

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080809] p-6 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111211] p-6 shadow-2xl">
        <div className="text-lg font-semibold">Magical needs a refresh</div>
        <p className="mt-2 text-sm leading-6 text-white/60">
          The app hit a render error. Reloading clears the current UI state and keeps your saved projects intact.
        </p>

        {errors.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-white/40 hover:text-white/60"
            >
              {showDetails ? 'Hide' : 'Show'} error details ({errors.length})
            </button>
            {showDetails && (
              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/5 bg-black/30 p-2">
                {errors.map((e) => (
                  <div key={e.id} className="mb-2 border-b border-white/5 pb-2 text-[10px] last:mb-0 last:border-0 last:pb-0">
                    <div className="text-white/30">{e.timestamp} — {e.name}</div>
                    <div className="text-red-300/80">{e.message}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={copyAllErrors}
              className="mt-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60"
            >
              {copied ? 'Copied!' : 'Copy all errors'}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Reload app
        </button>
      </div>
    </main>
  )
}
