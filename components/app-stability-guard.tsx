'use client'

import ErrorBoundary from '@/components/error-boundary'
import { useEffect, useRef, useState } from 'react'

const PERFORMANCE_MODE_KEY = 'magical-performance-mode'
const STALL_INTERVAL_MS = 1000
const STALL_THRESHOLD_MS = 650
const STALL_WINDOW_MS = 18000
const STALLS_BEFORE_RECOVERY = 3

export function AppStabilityGuard({ children }: { children: React.ReactNode }) {
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(false)
  const stallTimesRef = useRef<number[]>([])
  const recoveryEnabledRef = useRef(false)

  useEffect(() => {
    const savedPerformanceMode = sessionStorage.getItem(PERFORMANCE_MODE_KEY) === '1'
    const isLowPowerDevice =
      typeof navigator !== 'undefined' &&
      ((typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2) ||
        (typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number' &&
          ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2))

    if (savedPerformanceMode || isLowPowerDevice) {
      enablePerformanceMode({
        persist: savedPerformanceMode,
        notify: savedPerformanceMode,
      })
    }

    function enablePerformanceMode({
      persist = true,
      notify = true,
    }: {
      persist?: boolean
      notify?: boolean
    } = {}) {
      if (recoveryEnabledRef.current) return

      recoveryEnabledRef.current = true
      document.documentElement.dataset.performanceMode = 'low'

      if (persist) {
        sessionStorage.setItem(PERFORMANCE_MODE_KEY, '1')
      }

      if (notify) {
        setShowRecoveryNotice(true)
      }
    }

    function recordStall() {
      const now = performance.now()
      stallTimesRef.current = [...stallTimesRef.current, now].filter(
        (time) => now - time <= STALL_WINDOW_MS,
      )

      if (stallTimesRef.current.length >= STALLS_BEFORE_RECOVERY) {
        enablePerformanceMode()
      }
    }

    let expectedTick = performance.now() + STALL_INTERVAL_MS
    const lagTimer = window.setInterval(() => {
      const now = performance.now()
      const drift = now - expectedTick
      expectedTick = now + STALL_INTERVAL_MS

      if (drift > STALL_THRESHOLD_MS) {
        recordStall()
      }
    }, STALL_INTERVAL_MS)

    let longTaskObserver: PerformanceObserver | null = null

    if (
      'PerformanceObserver' in window &&
      PerformanceObserver.supportedEntryTypes?.includes('longtask')
    ) {
      longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.duration > STALL_THRESHOLD_MS) {
            recordStall()
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
    }

    function handleChunkFailure(event: ErrorEvent | PromiseRejectionEvent) {
      const reason = 'reason' in event ? event.reason : event.error || event.message
      const message = String(reason?.message || reason || '')

      if (/chunk|loading css chunk|module script|failed to fetch dynamically imported module/i.test(message)) {
        setShowRecoveryNotice(true)
      }
    }

    window.addEventListener('error', handleChunkFailure)
    window.addEventListener('unhandledrejection', handleChunkFailure)

    return () => {
      window.clearInterval(lagTimer)
      longTaskObserver?.disconnect()
      window.removeEventListener('error', handleChunkFailure)
      window.removeEventListener('unhandledrejection', handleChunkFailure)
    }
  }, [])

  function disablePerformanceMode() {
    recoveryEnabledRef.current = false
    stallTimesRef.current = []
    delete document.documentElement.dataset.performanceMode
    sessionStorage.removeItem(PERFORMANCE_MODE_KEY)
    setShowRecoveryNotice(false)
  }

  return (
    <ErrorBoundary fallback={<AppCrashRecovery />}>
      {children}
      {showRecoveryNotice && (
        <div className="fixed bottom-4 right-4 z-[100] w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-amber-400/20 bg-[#111211]/95 p-4 text-sm text-white shadow-2xl backdrop-blur">
          <div className="font-medium">Performance mode enabled</div>
          <p className="mt-1 text-xs leading-5 text-white/60">
            Magical detected repeated browser stalls and reduced animations to keep the app responsive.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={disablePerformanceMode}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              Turn off
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}

function AppCrashRecovery() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080809] p-6 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111211] p-6 shadow-2xl">
        <div className="text-lg font-semibold">Magical needs a refresh</div>
        <p className="mt-2 text-sm leading-6 text-white/60">
          The app hit a render error. Reloading clears the current UI state and keeps your saved projects intact.
        </p>
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
