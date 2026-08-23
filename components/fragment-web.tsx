import { CopyButton } from './ui/copy-button'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ExecutionResultWeb } from '@/lib/types'
import { RotateCw, ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react'
import { useState, useCallback } from 'react'

type ViewportMode = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_SIZES: Record<ViewportMode, { width: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: '100%', label: 'Desktop', icon: Monitor },
  tablet: { width: '768px', label: 'Tablet', icon: Tablet },
  mobile: { width: '375px', label: 'Mobile', icon: Smartphone },
}

export function FragmentWeb({ result }: { result: ExecutionResultWeb }) {
  const [iframeKey, setIframeKey] = useState(0)
  const [viewport, setViewport] = useState<ViewportMode>('desktop')
  if (!result) return null

  function refreshIframe() {
    setIframeKey((prevKey) => prevKey + 1)
  }

  const cycleViewport = useCallback(() => {
    setViewport(prev => {
      if (prev === 'desktop') return 'tablet'
      if (prev === 'tablet') return 'mobile'
      return 'desktop'
    })
  }, [])

  const vpConfig = VIEWPORT_SIZES[viewport]
  const VpIcon = vpConfig.icon
  const isMobile = viewport !== 'desktop'

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0b]">
      {/* Preview area with centered viewport */}
      <div className="flex-1 overflow-hidden flex items-start justify-center bg-[#0a0a0b] p-0">
        <div
          className={`h-full transition-all duration-300 ${isMobile ? 'border-x border-white/[0.06] shadow-2xl' : 'w-full'}`}
          style={{ width: vpConfig.width, maxWidth: isMobile ? '100%' : '100%' }}
        >
          <iframe
            key={iframeKey}
            className="h-full w-full border-0"
            sandbox="allow-forms allow-scripts allow-same-origin"
            loading="lazy"
            src={result.url}
          />
        </div>
      </div>
      {/* Bottom bar with URL, viewport toggle, and open-in-new-tab */}
      <div className="shrink-0 border-t border-white/[0.08] bg-[#151615] px-3 py-2">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button type="button" onClick={refreshIframe} className="shrink-0 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition">
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-[11px] text-white/40 flex-1 text-ellipsis overflow-hidden whitespace-nowrap font-mono">
            {result.url}
          </span>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <CopyButton
                  variant="ghost"
                  content={result.url}
                  className="shrink-0 p-1 h-auto text-white/40 hover:text-white/70"
                />
              </TooltipTrigger>
              <TooltipContent>Copy URL</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Viewport toggle — cycles desktop → tablet → mobile */}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button type="button" onClick={cycleViewport} className="shrink-0 flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/60 hover:bg-white/[0.08] hover:text-white transition">
                  <VpIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{vpConfig.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Viewport: {vpConfig.label} (click to cycle)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Open in new tab */}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
