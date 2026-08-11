'use client'

import { Sidebar } from '@/components/sidebar'
import { useAuth } from '@/lib/auth'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth(
    useCallback(() => {}, []),
    useCallback(() => {}, [])
  )
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  const handleSignOut = useCallback(async () => {
    const { createSupabaseBrowserClient } = await import('@/lib/supabase-browser')
    const supabase = createSupabaseBrowserClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    window.location.assign('/')
  }, [])

  const handleChatSelected = useCallback((chatId: string) => {
    router.push(`/chat/${chatId}`)
  }, [router])

  const handleProjectDeleted = useCallback((chatId: string) => {
    setSidebarRefreshKey(prev => prev + 1)
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-[#0a0a0b]">
      <Sidebar
        onChatSelected={handleChatSelected}
        onSignOut={handleSignOut}
        onProjectDeleted={handleProjectDeleted}
        refreshKey={sidebarRefreshKey}
      />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
