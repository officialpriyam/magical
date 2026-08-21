'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Palette, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StylePreset {
  id: string
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
  }
  prompt: string
  preview: {
    heading: string
    subheading: string
    buttonText: string
    cardBg: string
    cardBorder: string
  }
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Crisp product polish',
    colors: {
      primary: '#3b82f6',
      secondary: '#1e40af',
      accent: '#60a5fa',
      background: '#ffffff',
      surface: '#f8fafc',
    },
    prompt: 'Modern design with clean lines, subtle shadows, blue accent colors, and professional typography. Use Inter or system fonts with generous white space.',
    preview: {
      heading: 'Modern',
      subheading: 'Crisp product polish',
      buttonText: 'Primary',
      cardBg: 'bg-white',
      cardBorder: 'border-blue-200',
    },
  },
  {
    id: 'minimalism',
    name: 'Minimalism',
    description: 'Clean essentials',
    colors: {
      primary: '#171717',
      secondary: '#525252',
      accent: '#a3a3a3',
      background: '#ffffff',
      surface: '#fafafa',
    },
    prompt: 'Minimalist design with maximum white space, black and gray palette, thin borders, no shadows, elegant typography. Ultra-clean with purposeful negative space.',
    preview: {
      heading: 'Minimalism',
      subheading: 'Clean essentials',
      buttonText: 'Primary',
      cardBg: 'bg-white',
      cardBorder: 'border-neutral-200',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Sleek dark mode',
    colors: {
      primary: '#8b5cf6',
      secondary: '#6d28d9',
      accent: '#a78bfa',
      background: '#0a0a0a',
      surface: '#171717',
    },
    prompt: 'Dark theme with deep black backgrounds (#0a0a0a), subtle gray surfaces (#171717), purple/violet accents, soft glowing effects, and glass-morphism elements. Use subtle gradients and hover glow effects.',
    preview: {
      heading: 'Dark',
      subheading: 'Sleek dark mode',
      buttonText: 'Primary',
      cardBg: 'bg-neutral-900',
      cardBorder: 'border-neutral-800',
    },
  },
  {
    id: 'neobrutalism',
    name: 'Neobrutalism',
    description: 'Hard edges, bold',
    colors: {
      primary: '#000000',
      secondary: '#ff0000',
      accent: '#ffff00',
      background: '#ffffff',
      surface: '#f0f0f0',
    },
    prompt: 'Neobrutalist design with thick black borders (3-4px), bold solid colors (red, yellow, blue), hard drop shadows (offset 4-6px), raw/uncut aesthetic, Monospace or system fonts, playful and bold.',
    preview: {
      heading: 'Neobrutalism',
      subheading: 'Hard edges, bold',
      buttonText: 'Primary',
      cardBg: 'bg-white',
      cardBorder: 'border-black border-2',
    },
  },
  {
    id: 'glassmorphism',
    name: 'Glass',
    description: 'Frosted glass effect',
    colors: {
      primary: '#6366f1',
      secondary: '#4f46e5',
      accent: '#818cf8',
      background: '#0f172a',
      surface: 'rgba(255,255,255,0.1)',
    },
    prompt: 'Glassmorphism design with frosted glass cards (backdrop-blur, semi-transparent backgrounds), gradient backgrounds (purple to blue), subtle borders with low opacity, floating elements with blur effects.',
    preview: {
      heading: 'Glass',
      subheading: 'Frosted glass effect',
      buttonText: 'Primary',
      cardBg: 'bg-white/10 backdrop-blur',
      cardBorder: 'border-white/20',
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Friendly and inviting',
    colors: {
      primary: '#ea580c',
      secondary: '#c2410c',
      accent: '#fb923c',
      background: '#fffbeb',
      surface: '#fef3c7',
    },
    prompt: 'Warm, friendly design with amber/orange color palette, rounded corners (16-24px), soft shadows, cream/warm white backgrounds, approachable typography with rounded fonts like Nunito or Poppins.',
    preview: {
      heading: 'Warm',
      subheading: 'Friendly and inviting',
      buttonText: 'Primary',
      cardBg: 'bg-amber-50',
      cardBorder: 'border-amber-200',
    },
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Organic and fresh',
    colors: {
      primary: '#16a34a',
      secondary: '#15803d',
      accent: '#4ade80',
      background: '#f0fdf4',
      surface: '#dcfce7',
    },
    prompt: 'Nature-inspired design with green color palette, organic shapes, leaf/plant motifs, soft rounded elements, light green backgrounds, and earthy tones. Fresh and eco-friendly feel.',
    preview: {
      heading: 'Nature',
      subheading: 'Organic and fresh',
      buttonText: 'Primary',
      cardBg: 'bg-green-50',
      cardBorder: 'border-green-200',
    },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional and trust',
    colors: {
      primary: '#0369a1',
      secondary: '#075985',
      accent: '#38bdf8',
      background: '#f0f9ff',
      surface: '#e0f2fe',
    },
    prompt: 'Corporate/professional design with navy/sky blue palette, clean grid layouts, structured sections, subtle gradients, professional imagery placeholders, Trustpilot-style credibility indicators.',
    preview: {
      heading: 'Corporate',
      subheading: 'Professional and trust',
      buttonText: 'Primary',
      cardBg: 'bg-sky-50',
      cardBorder: 'border-sky-200',
    },
  },
]

interface StyleSelectorProps {
  selectedStyle: string | null
  onSelectStyle: (styleId: string | null) => void
  onClose: () => void
}

export function StyleSelector({ selectedStyle, onSelectStyle, onClose }: StyleSelectorProps) {
  const [customPrompt, setCustomPrompt] = useState('')

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      onSelectStyle('custom')
      onClose()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#111315] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Choose a style</h2>
            <p className="mt-0.5 text-sm text-white/50">Compare typography, controls, and surfaces. You can change this anytime.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/5 p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-72px)] p-6">
          {/* Custom describe */}
          <div className="mb-6">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Describe your own
            </label>
            <div className="flex gap-2">
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="e.g. warm editorial with hand-drawn accents"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customPrompt.trim()}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-40"
              >
                Use this
              </button>
            </div>
          </div>

          {/* Recommended */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Recommended</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">3</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STYLE_PRESETS.slice(0, 3).map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  isSelected={selectedStyle === style.id}
                  onSelect={() => {
                    onSelectStyle(style.id)
                    onClose()
                  }}
                />
              ))}
            </div>
          </div>

          {/* More styles */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">More styles</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{STYLE_PRESETS.length - 3}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STYLE_PRESETS.slice(3).map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  isSelected={selectedStyle === style.id}
                  onSelect={() => {
                    onSelectStyle(style.id)
                    onClose()
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        {selectedStyle && (
          <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              Using <span className="font-medium text-white">{STYLE_PRESETS.find(s => s.id === selectedStyle)?.name || 'Custom'}</span>
            </div>
            <button
              onClick={() => {
                onSelectStyle(null)
                onClose()
              }}
              className="text-sm text-white/40 transition hover:text-white/70"
            >
              Clear
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function StyleCard({
  style,
  isSelected,
  onSelect,
}: {
  style: StylePreset
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'group relative overflow-hidden rounded-xl border text-left transition-all',
        isSelected
          ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
      )}
    >
      {/* Preview mockup */}
      <div className="relative h-28 overflow-hidden border-b border-white/5 p-3">
        <div className={cn('h-full w-full rounded-lg border p-2', style.preview.cardBg, style.preview.cardBorder)}>
          <div className="mb-1 h-2 w-16 rounded bg-white/20" />
          <div className="mb-2 h-1.5 w-24 rounded bg-white/10" />
          <div className="flex gap-1">
            <div className="h-4 w-12 rounded" style={{ backgroundColor: style.colors.primary }} />
            <div className="h-4 w-10 rounded border border-white/10 bg-white/5" />
          </div>
          <div className="mt-2 flex gap-1">
            <div className="h-3 w-8 rounded bg-white/10" />
            <div className="h-3 w-12 rounded bg-white/10" />
            <div className="h-3 w-6 rounded bg-white/10" />
          </div>
        </div>
        {isSelected && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-white">{style.name}</div>
        <div className="text-xs text-white/40">{style.description}</div>
      </div>
    </motion.button>
  )
}
