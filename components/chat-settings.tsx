import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'
import type { LLMModelConfig } from '@/lib/models'
import { Settings2, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

export function ChatSettings({
  apiKeyConfigurable,
  baseURLConfigurable,
  languageModel,
  onLanguageModelChange,
  useMorphApply,
  onUseMorphApplyChange,
}: {
  apiKeyConfigurable: boolean
  baseURLConfigurable: boolean
  languageModel: LLMModelConfig
  onLanguageModelChange: (model: LLMModelConfig) => void
  useMorphApply?: boolean
  onUseMorphApplyChange?: (value: boolean) => void
}) {
  const [showMorphWarning, setShowMorphWarning] = useState(false)

  const handleMorphToggle = (checked: boolean) => {
    if (!checked && useMorphApply) {
      setShowMorphWarning(true)
    } else {
      onUseMorphApplyChange?.(checked)
    }
  }

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground h-6 w-6 rounded-sm">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>LLM settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="start">
          {apiKeyConfigurable && (
            <>
              <div className="flex flex-col gap-2 px-2 py-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  name="apiKey"
                  type="password"
                  placeholder="Auto"
                  required={true}
                  defaultValue={languageModel.apiKey}
                  onChange={(e) =>
                    onLanguageModelChange({
                      apiKey:
                        e.target.value.length > 0 ? e.target.value : undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {baseURLConfigurable && (
            <>
              <div className="flex flex-col gap-2 px-2 py-2">
                <Label htmlFor="baseURL">Base URL</Label>
                <Input
                  name="baseURL"
                  type="text"
                  placeholder="Auto"
                  required={true}
                  defaultValue={languageModel.baseURL}
                  onChange={(e) =>
                    onLanguageModelChange({
                      baseURL:
                        e.target.value.length > 0 ? e.target.value : undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <div className="flex flex-col gap-1.5 px-2 py-2">
            <span className="text-sm font-medium">Parameters</span>
            <div className="flex space-x-4 items-center">
              <span className="text-sm flex-1 text-muted-foreground">
                Output tokens
              </span>
              <Input
                type="number"
                defaultValue={languageModel.maxTokens}
                min={50}
                max={10000}
                step={1}
                className="h-6 rounded-sm w-[84px] text-xs text-center tabular-nums"
                placeholder="Auto"
                onChange={(e) =>
                  onLanguageModelChange({
                    maxTokens: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div className="flex space-x-4 items-center">
              <span className="text-sm flex-1 text-muted-foreground">
                Temperature
              </span>
              <Input
                type="number"
                defaultValue={languageModel.temperature}
                min={0}
                max={5}
                step={0.01}
                className="h-6 rounded-sm w-[84px] text-xs text-center tabular-nums"
                placeholder="Auto"
                onChange={(e) =>
                  onLanguageModelChange({
                    temperature: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div className="flex space-x-4 items-center">
              <span className="text-sm flex-1 text-muted-foreground">Top P</span>
              <Input
                type="number"
                defaultValue={languageModel.topP}
                min={0}
                max={1}
                step={0.01}
                className="h-6 rounded-sm w-[84px] text-xs text-center tabular-nums"
                placeholder="Auto"
                onChange={(e) =>
                  onLanguageModelChange({
                    topP: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div className="flex space-x-4 items-center">
              <span className="text-sm flex-1 text-muted-foreground">Top K</span>
              <Input
                type="number"
                defaultValue={languageModel.topK}
                min={0}
                max={500}
                step={1}
                className="h-6 rounded-sm w-[84px] text-xs text-center tabular-nums"
                placeholder="Auto"
                onChange={(e) =>
                  onLanguageModelChange({
                    topK: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div className="flex space-x-4 items-center">
              <span className="text-sm flex-1 text-muted-foreground">
                Frequence penalty
              </span>
              <Input
                type="number"
                defaultValue={languageModel.frequencyPenalty}
                min={0}
                max={2}
                step={0.01}
                className="h-6 rounded-sm w-[84px] text-xs text-center tabular-nums"
                placeholder="Auto"
                onChange={(e) =>
                  onLanguageModelChange({
                    frequencyPenalty: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div className="flex space-x-4 items-center">
              <span className="text-sm flex-1 text-muted-foreground">
                Presence penalty
              </span>
              <Input
                type="number"
                defaultValue={languageModel.presencePenalty}
                min={0}
                max={2}
                step={0.01}
                className="h-6 rounded-sm w-[84px] text-xs text-center tabular-nums"
                placeholder="Auto"
                onChange={(e) =>
                  onLanguageModelChange({
                    presencePenalty: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
          </div>
          {onUseMorphApplyChange && (
            <>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="morph-apply" className="text-sm font-medium">
                    Morph Apply
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Edit existing code instead of regenerating
                  </span>
                </div>
                <Switch
                  id="morph-apply"
                  checked={useMorphApply}
                  onCheckedChange={handleMorphToggle}
                />
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Morph Apply Warning Dialog */}
      {showMorphWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111315] p-6 shadow-2xl">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Disable Morph Apply?</h3>
            <p className="mb-1 text-sm text-white/60">
              Turning off Morph Apply means Magical AI will <strong className="text-white">regenerate entire files</strong> instead of making targeted edits.
            </p>
            <p className="mb-6 text-sm text-white/60">
              This may <strong className="text-amber-400">increase token usage and cost</strong>, and can sometimes change code you didn&apos;t intend to modify.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowMorphWarning(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              >
                Keep it on
              </button>
              <button
                type="button"
                onClick={() => {
                  onUseMorphApplyChange?.(false)
                  setShowMorphWarning(false)
                }}
                className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/15"
              >
                Disable anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
