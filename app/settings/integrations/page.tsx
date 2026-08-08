'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function IntegrationsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/settings/git')
  }, [router])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-white/50">Redirecting to Git settings...</p>
    </div>
  )
}
