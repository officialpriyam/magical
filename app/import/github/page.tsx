'use client'

import { useRouter } from 'next/navigation'
import { GitHubImport } from '@/components/github-import'

export default function GitHubImportPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0a0b] p-6">
      <GitHubImport 
        onClose={() => router.back()}
        onImport={() => {
          router.push('/')
        }}
      />
    </div>
  )
}
