'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'
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
}

export const STYLE_PRESETS: StylePreset[] = [
  // ─── Recommended (3) ────────────────────────────────────────
  {
    id: 'minimalism',
    name: 'Minimalism',
    description: 'Clean essentials',
    colors: { primary: '#000000', secondary: '#404040', accent: '#808080', background: '#ffffff', surface: '#fafafa' },
    prompt: 'Ultra-minimalist design with maximum white space. Black and white palette only. Thin 1px borders, no shadows, no gradients. Elegant serif or thin sans-serif typography (like Playfair Display or light-weight Inter). Purposeful negative space. Clean geometric shapes. Simple iconography. Let the content breathe.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Crisp product polish',
    colors: { primary: '#2563eb', secondary: '#1d4ed8', accent: '#60a5fa', background: '#ffffff', surface: '#f8fafc' },
    prompt: 'Modern SaaS design with clean sans-serif typography (Inter, system-ui). Subtle rounded corners (8-12px). Light shadows (0 1px 3px rgba(0,0,0,0.1)). Blue accent colors (#2563eb). Clean card layouts with proper padding. Professional and polished look like Vercel or Linear.',
  },
  {
    id: 'neobrutalism',
    name: 'Neobrutalism Minimalism',
    description: 'Hard edges, controlled palette',
    colors: { primary: '#000000', secondary: '#ff3333', accent: '#ffcc00', background: '#ffffff', surface: '#f5f5f5' },
    prompt: 'Neobrutalist design with thick black borders (2-3px solid black). Bold solid colors: red (#ff3333), yellow (#ffcc00), blue (#3366ff). Hard drop shadows (4px 4px 0px black). Raw, unpolished aesthetic. Monospace or system fonts. Playful, bold, and intentionally crude. No rounded corners.',
  },
  // ─── More Styles (8) ────────────────────────────────────────
  {
    id: 'papery',
    name: 'Papery',
    description: 'Newsroom minimalism',
    colors: { primary: '#1a1a1a', secondary: '#333333', accent: '#999999', background: '#fefefe', surface: '#f9f6f1' },
    prompt: 'Newspaper/editorial design with serif typography (Georgia, Times, Merriweather). Off-white/cream backgrounds (#f9f6f1). Thin hairline dividers. Multi-column layouts. Large editorial headlines. Caption text. Black and white photography style. Classic newsroom feel.',
  },
  {
    id: 'notebook',
    name: 'Notebook',
    description: 'Lined and hand-kept',
    colors: { primary: '#2d3436', secondary: '#636e72', accent: '#0984e3', background: '#ffeaa7', surface: '#fdcb6e' },
    prompt: 'Notebook/journal style with lined paper backgrounds, handwriting-style fonts (Caveat, Patrick Hand, Kalam). Yellow/cream paper tones. Ruled lines as decorative elements. Sketchy/hand-drawn borders and buttons. Polaroid-style images. Tape and paper clip decorations.',
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Soft modern editorial',
    colors: { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560', background: '#ffffff', surface: '#f8f9fa' },
    prompt: 'Editorial/magazine design with sophisticated typography pairing (serif headlines + sans-serif body). Generous whitespace. Large hero sections. Accent color pops (coral, teal). Elegant image placements. Grid-based layouts. Think Awwwards-winning editorial sites.',
  },
  {
    id: 'claymorphism',
    name: 'Claymorphism',
    description: 'Soft surfaces',
    colors: { primary: '#6c5ce7', secondary: '#a29bfe', accent: '#fd79a8', background: '#f8f0fc', surface: '#ffffff' },
    prompt: 'Claymorphism design with 3D clay-like elements. Soft pastel colors (lavender, pink, mint). Rounded, puffy shapes with inner shadows creating depth. Float-like cards with subtle 3D effect. Playful, friendly, and modern. Think Dribbble trending.',
  },
  {
    id: 'glassmorphism',
    name: 'Glass',
    description: 'Frosted glass effect',
    colors: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#a78bfa', background: '#0f172a', surface: 'rgba(255,255,255,0.08)' },
    prompt: 'Glassmorphism with frosted glass cards (backdrop-blur-xl, bg-white/10, border-white/20). Gradient mesh backgrounds (purple to blue to teal). Semi-transparent surfaces. Subtle glow effects on hover. Floating card hierarchy. Dark backgrounds with light glass panels.',
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Friendly and inviting',
    colors: { primary: '#e17055', secondary: '#d63031', accent: '#fdcb6e', background: '#ffeaa7', surface: '#ffffff' },
    prompt: 'Warm, friendly design with orange/amber palette. Generous rounded corners (16-24px). Soft shadows. Cream and warm white backgrounds. Playful illustrations. Rounded fonts (Nunito, Poppins, Quicksand). Gradient accents from orange to pink. Friendly micro-interactions.',
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Organic and fresh',
    colors: { primary: '#00b894', secondary: '#00cec9', accent: '#55efc4', background: '#f0fff4', surface: '#ffffff' },
    prompt: 'Nature-inspired design with green/teal palette. Organic shapes and curves. Leaf/plant motifs. Soft, rounded elements. Light green backgrounds (#f0fff4). Earthy, natural feel. Think eco-friendly brands. Subtle texture overlays.',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional and trust',
    colors: { primary: '#0052cc', secondary: '#0747a6', accent: '#4c9aff', background: '#f7f8fc', surface: '#ffffff' },
    prompt: 'Corporate/professional design with navy blue palette. Clean grid layouts. Structured sections. Subtle gradients. Trust indicators (badges, logos, stats). Professional typography (Inter, IBM Plex Sans). Data-driven layouts. Think Atlassian, Salesforce, HubSpot.',
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Vintage charm',
    colors: { primary: '#d63384', secondary: '#6f42c1', accent: '#ffc107', background: '#fff3cd', surface: '#ffffff' },
    prompt: 'Retro/vintage design with warm nostalgic palette (mustard yellow, burnt orange, teal, cream). Serif and slab-serif typography. Distressed textures. Rounded, bubbly shapes. Think 70s/80s aesthetic. Halftone patterns. Vintage badges and labels.',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon futuristic',
    colors: { primary: '#00ffff', secondary: '#ff00ff', accent: '#ffff00', background: '#0a0a0f', surface: '#1a1a2e' },
    prompt: 'Cyberpunk/futuristic design with neon colors on dark backgrounds. Cyan (#00ffff), magenta (#ff00ff), electric yellow (#ffff00) accents. Glitch effects. Scanline overlays. Monospace fonts (Fira Code, JetBrains Mono). Grid patterns. HUD-style UI elements.',
  },
]

interface StyleSelectorProps {
  selectedStyle: string | null
  onSelectStyle: (styleId: string | null) => void
  customStylePrompt?: string
  onCustomStylePromptChange?: (prompt: string) => void
  onClose: () => void
}

export function StyleSelector({ selectedStyle, onSelectStyle, customStylePrompt = '', onCustomStylePromptChange, onClose }: StyleSelectorProps) {
  const [customPrompt, setCustomPrompt] = useState(customStylePrompt)

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      onCustomStylePromptChange?.(customPrompt)
      onSelectStyle('custom')
      onClose()
    }
  }

  const getSelectedName = () => {
    if (selectedStyle === 'custom') return 'Custom'
    return STYLE_PRESETS.find(s => s.id === selectedStyle)?.name || ''
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
        className="w-full max-w-[820px] max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#111315] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Choose a style</h2>
            <p className="mt-1 text-sm text-white/45">Compare typography, controls, and surfaces. You can change this anytime.</p>
          </div>
          <button
            onClick={onClose}
            className="mt-1 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-64px)] px-8 pb-6">
          {/* Describe your own */}
          <div className="mb-6">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/35">
              Describe your own
            </label>
            <div className="flex gap-2">
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="e.g. warm editorial with hand-drawn accents"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customPrompt.trim()}
                className="shrink-0 rounded-xl bg-white/[0.08] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.12] disabled:opacity-30"
              >
                Use this
              </button>
            </div>
          </div>

          {/* Recommended */}
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/35">Recommended</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/40">3</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
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
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/35">More styles</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/40">{STYLE_PRESETS.length - 3}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
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
          <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.015] px-8 py-3">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              Using <span className="font-semibold text-white">{getSelectedName()}</span>
            </div>
            <button
              onClick={() => {
                onSelectStyle(null)
                onClose()
              }}
              className="text-sm text-white/35 transition hover:text-white/60"
            >
              Clear
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Style Card with exact Freebuff preview ────────────────────
function StyleCard({
  style,
  isSelected,
  onSelect,
}: {
  style: StylePreset
  isSelected: boolean
  onSelect: () => void
}) {
  const isDark = style.id === 'glassmorphism' || style.id === 'cyberpunk'

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'group relative overflow-hidden rounded-xl border text-left transition-all',
        isSelected
          ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
      )}
    >
      {/* Preview area */}
      <div className="relative h-[140px] overflow-hidden p-3">
        {/* Design system mockup card */}
        <div
          className="h-full w-full rounded-lg border p-3 overflow-hidden"
          style={{
            backgroundColor: isDark ? style.colors.surface : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e5e5',
          }}
        >
          {/* Aa Design system header */}
          <div className="mb-2 flex items-center gap-1.5">
            <span className={cn('text-[11px] font-bold', isDark ? 'text-white/60' : 'text-black/50')}>Aa</span>
            <span className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-black/25')}>Design system</span>
            <div className="ml-auto flex gap-[3px]">
              <div className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: style.colors.primary }} />
              <div className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: style.colors.secondary }} />
              <div className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: style.colors.accent }} />
            </div>
          </div>

          {/* Heading */}
          <div className={cn('mb-1 h-[10px] w-[70px] rounded-sm', isDark ? 'bg-white/20' : 'bg-black/15')} />

          {/* Description */}
          <div className={cn('mb-2.5 h-[6px] w-[110px] rounded-sm', isDark ? 'bg-white/10' : 'bg-black/[0.06]')} />

          {/* Buttons */}
          <div className="flex gap-1.5">
            <div
              className="flex h-[20px] items-center rounded-[4px] px-2.5"
              style={{ backgroundColor: style.colors.primary }}
            >
              <span className="text-[8px] font-medium text-white">Primary</span>
            </div>
            <div
              className="flex h-[20px] items-center rounded-[4px] border px-2.5"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9f9f9',
              }}
            >
              <span className={cn('text-[8px] font-medium', isDark ? 'text-white/50' : 'text-black/40')}>Button</span>
            </div>
          </div>

          {/* Price card */}
          <div
            className="mt-2.5 rounded-md border p-2"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className={cn('mb-0.5 h-[4px] w-[24px] rounded-sm', isDark ? 'bg-white/15' : 'bg-black/10')} />
                <div className={cn('h-[7px] w-[32px] rounded-sm', isDark ? 'bg-white/20' : 'bg-black/15')} />
              </div>
              <span className={cn('text-[11px] font-bold', isDark ? 'text-white/50' : 'text-black/40')}>$24.8k</span>
            </div>
          </div>
        </div>

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 shadow-lg">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="border-t border-white/[0.04] px-3 py-2.5">
        <div className="text-[13px] font-semibold text-white/80">{style.name}</div>
        <div className="text-[11px] text-white/35">{style.description}</div>
      </div>
    </motion.button>
  )
}
