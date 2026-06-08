'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'
import posthog from 'posthog-js'
import { PostHogProvider as PostHogProviderJS } from 'posthog-js/react'

const isPostHogEnabled =
  process.env.NEXT_PUBLIC_ENABLE_POSTHOG === 'true' &&
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)

if (typeof window !== 'undefined' && isPostHogEnabled) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '', {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    session_recording: {
      recordCrossOriginIframes: false,
    }
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
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
