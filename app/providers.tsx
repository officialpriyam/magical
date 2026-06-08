'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'
import posthog from 'posthog-js'
import { PostHogProvider as PostHogProviderJS } from 'posthog-js/react'
import { useEffect } from 'react'

const isPostHogEnabled =
  process.env.NEXT_PUBLIC_ENABLE_POSTHOG === 'true' &&
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
const isPostHogSessionReplayEnabled =
  process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY === 'true'

let isPostHogStarted = false

function startPostHog() {
  if (!isPostHogEnabled || isPostHogStarted) return

  isPostHogStarted = true
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '', {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: !isPostHogSessionReplayEnabled,
    session_recording: {
      recordCrossOriginIframes: false,
    },
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isPostHogEnabled) return

    const startWhenIdle = () => startPostHog()
    const idleId =
      'requestIdleCallback' in window
        ? window.requestIdleCallback(startWhenIdle, { timeout: 5000 })
        : undefined
    const fallbackTimer = window.setTimeout(startWhenIdle, 3000)

    return () => {
      window.clearTimeout(fallbackTimer)
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [])

  return isPostHogEnabled ? (
    <PostHogProviderJS client={posthog}>{children}</PostHogProviderJS>
  ) : (
    children
  )
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export { AuthProvider } from '../lib/auth-provider'
