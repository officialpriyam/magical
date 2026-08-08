'use client'

import { useState } from 'react'
import { Plus, Upload, FileText, Trash2 } from 'lucide-react'

interface KnowledgeItem {
  id: string
  name: string
  type: 'file' | 'url' | 'text'
  size?: string
  addedAt: string
}

export default function KnowledgePage() {
  const [items] = useState<KnowledgeItem[]>([
    { id: '1', name: 'Company README', type: 'file', size: '12 KB', addedAt: '2 days ago' },
    { id: '2', name: 'Design System Docs', type: 'url', addedAt: '5 days ago' },
  ])
  const [showUpload, setShowUpload] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Knowledge</h1>
        <button
          type="button"
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black transition hover:bg-primary/80"
        >
          <Plus className="h-4 w-4" />
          Add knowledge
        </button>
      </div>
      <p className="mb-6 text-sm text-white/50">
        Add context files to help AI understand your project better.
      </p>

      {showUpload && (
        <div className="mb-6 rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center">
          <Upload className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="mb-2 text-sm text-white/60">Drop files here or click to upload</p>
          <p className="text-xs text-white/35">Supports .md, .txt, .json, .yaml, .pdf</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <FileText className="h-4 w-4 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{item.name}</div>
              <div className="text-xs text-white/40">
                {item.type === 'file' ? item.size : 'URL'} · {item.addedAt}
              </div>
            </div>
            <button
              type="button"
              className="rounded p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
