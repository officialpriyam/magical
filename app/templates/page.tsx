'use client'

import { MotionSitesGallery } from '@/components/motionsites-gallery'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-lg font-semibold">Website Templates</h1>
        </div>
      </div>
      <div className="p-6">
        <MotionSitesGallery />
      </div>
    </div>
  )
}
