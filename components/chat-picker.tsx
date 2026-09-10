import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LLMModel, LLMModelConfig } from '@/lib/models'
import type { TemplateId, Templates } from '@/lib/templates'
import 'core-js/actual/object/group-by'
import { Sparkles, Info } from 'lucide-react'
import Image from 'next/image'
import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const ETC_PROVIDER_IDS = new Set(['orcarouter', 'requesty', 'llm_gateway', 'novita', 'poolside'])

const CAPABILITY_META: Record<string, { label: string; icon: string }> = {
  text: { label: 'Text', icon: '💬' },
  image: { label: 'Image input', icon: '🖼️' },
  video: { label: 'Video input', icon: '🎬' },
  audio: { label: 'Audio input', icon: '🎙️' },
  reasoning: { label: 'Reasoning', icon: '🧠' },
}

function ModelCapabilities({ model }: { model: LLMModel }) {
  const caps = (model.capabilities || []).filter((c) => CAPABILITY_META[c])
  if (caps.length === 0) return null

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => e.preventDefault()}
            className="pointer-events-auto ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-amber-400/80 hover:text-amber-400"
          >
            !
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="p-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/50">
            Supported input
          </p>
          <div className="flex flex-col gap-0.5">
            {caps.map((cap) => (
              <span key={cap} className="flex items-center gap-1.5 text-xs text-white/90">
                <span>{CAPABILITY_META[cap].icon}</span>
                {CAPABILITY_META[cap].label}
              </span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function ChatPicker({
  templates,
  selectedTemplate,
  onSelectedTemplateChange,
  models,
  languageModel,
  onLanguageModelChange,
}: {
  templates: Templates
  selectedTemplate: 'auto' | TemplateId
  onSelectedTemplateChange: (template: 'auto' | TemplateId) => void
  models: LLMModel[]
  languageModel: LLMModelConfig
  onLanguageModelChange: (config: LLMModelConfig) => void
}) {
  const resolvedModel = useMemo(() => {
    const modelId = languageModel.model
    if (modelId === 'auto') {
      return models[0]
    }
    return models.find((m) => m.id === modelId)
  }, [languageModel.model, models])

  const displayName = useMemo(() => {
    if (languageModel.model === 'auto') return 'Auto'
    return resolvedModel?.name || 'Select model'
  }, [languageModel.model, resolvedModel])

  return (
    <div className="flex items-center space-x-2">
      <div className="flex flex-col">
        <Select
          name="template"
          value={selectedTemplate}
          onValueChange={onSelectedTemplateChange}
        >
          <SelectTrigger className="whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-6 text-xs bg-transparent">
            <SelectValue placeholder="Select a persona" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectGroup>
              <SelectLabel>Persona</SelectLabel>
              <SelectItem value="auto">
                <div className="flex items-center space-x-2">
                  <Sparkles
                    className="flex text-[#a1a1aa]"
                    width={14}
                    height={14}
                  />
                  <span>Auto</span>
                </div>
              </SelectItem>
              {Object.entries(templates).map(([templateId, template]) => (
                <SelectItem key={templateId} value={templateId}>
                  <div className="flex items-center space-x-2">
                    <img
                      className="flex shrink-0"
                      src={`/thirdparty/templates/${templateId}.svg`}
                      alt={templateId}
                      width={14}
                      height={14}
                      onError={(e) => {
                        // Fallback: show first letter of template name
                        const target = e.target as HTMLImageElement;
                        if (target.style) {
                          target.style.display = 'none';
                          const next = target.nextElementSibling;
                          if (!next || !next.classList.contains('template-fallback')) {
                            const span = document.createElement('span');
                            span.className = 'template-fallback flex items-center justify-center w-3.5 h-3.5 rounded bg-white/10 text-[10px] font-bold text-white/70';
                            span.textContent = template.name.charAt(0);
                            target.parentNode?.insertBefore(span, target.nextSibling);
                          }
                        }
                      }}
                    />
                    <span>{template.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col">
        <Select
          name="languageModel"
          value={languageModel.model}
          onValueChange={(e) => onLanguageModelChange({ model: e })}
        >
          <SelectTrigger className="whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-6 text-xs bg-transparent">
            <SelectValue>
              <div className="flex items-center space-x-1.5">
                {languageModel.model === 'auto' && <Sparkles className="h-3 w-3 text-primary" />}
                {languageModel.model !== 'auto' && resolvedModel && (
                  <Image
                    className="flex"
                    src={`/thirdparty/logos/${resolvedModel.providerId}.svg`}
                    alt={resolvedModel.provider}
                    width={14}
                    height={14}
                  />
                )}
                <span>{displayName}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Model</SelectLabel>
              <SelectItem value="auto">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Auto</span>
                  <span className="text-[10px] text-white/40">Auto-select working model</span>
                </div>
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Available models</SelectLabel>
              {Object.entries(
                Object.groupBy(
                  models,
                  (model) =>
                    model.providerId === 'openrouter'
                      ? 'openrouter'
                      : ETC_PROVIDER_IDS.has(model.providerId)
                        ? 'etc'
                        : model.provider,
                ),
              ).map(([groupKey, groupModels]) => (
                <SelectGroup key={groupKey}>
                  <SelectLabel>
                    {groupKey === 'openrouter'
                      ? 'OpenRouter'
                      : groupKey === 'etc'
                        ? 'etc'
                        : groupKey}
                  </SelectLabel>
                  {groupModels?.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex w-full items-center space-x-2">
                        <Image
                          className="flex shrink-0"
                          src={`/thirdparty/logos/${model.providerId}.svg`}
                          alt={model.provider}
                          width={14}
                          height={14}
                        />
                        <span className="truncate">{model.name}</span>
                        <ModelCapabilities model={model} />
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
