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
import { Sparkles, Zap, Wand2 } from 'lucide-react'
import Image from 'next/image'
import { useMemo } from 'react'

export const MAGIC_FREE_MODELS: LLMModel[] = [
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B', provider: 'OpenAI', providerId: 'openrouter' },
  { id: 'qwen/qwen3-4b:free', name: 'Qwen3 4B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'qwen/qwen3-8b:free', name: 'Qwen3 8B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'qwen/qwen3-14b:free', name: 'Qwen3 14B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'google/gemma-3n-e2b-it:free', name: 'Gemma 3n E2B', provider: 'Google', providerId: 'openrouter' },
  { id: 'google/gemma-3n-e4b-it:free', name: 'Gemma 3n E4B', provider: 'Google', providerId: 'openrouter' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'Meta', providerId: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', providerId: 'openrouter' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', provider: 'Mistral', providerId: 'openrouter' },
]

export const MAGIC_PLUS_MODELS: LLMModel[] = [
  { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick', provider: 'Meta', providerId: 'openrouter' },
  { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout', provider: 'Meta', providerId: 'openrouter' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', providerId: 'openrouter' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', provider: 'Mistral', providerId: 'openrouter' },
  { id: 'qwen/qwen3-14b:free', name: 'Qwen3 14B', provider: 'Qwen', providerId: 'openrouter' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'Google', providerId: 'openrouter' },
  { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B', provider: 'Google', providerId: 'openrouter' },
]

function getRandomModel(models: LLMModel[]): LLMModel {
  return models[Math.floor(Math.random() * models.length)]
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
    if (modelId === 'magic') return getRandomModel(MAGIC_FREE_MODELS)
    if (modelId === 'magic+') return getRandomModel(MAGIC_PLUS_MODELS)
    return models.find((m) => m.id === modelId)
  }, [languageModel.model, models])

  const displayName = useMemo(() => {
    if (languageModel.model === 'magic') return 'Magic'
    if (languageModel.model === 'magic+') return 'Magic+'
    return resolvedModel?.name || 'Select model'
  }, [languageModel.model, resolvedModel])

  return (
    <div className="flex items-center space-x-2">
      <div className="flex flex-col">
        <Select
          name="template"
          defaultValue={selectedTemplate}
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
                    <Image
                      className="flex"
                      src={`/thirdparty/templates/${templateId}.svg`}
                      alt={templateId}
                      width={14}
                      height={14}
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
                {languageModel.model === 'magic' && <Wand2 className="h-3 w-3 text-[#f97316]" />}
                {languageModel.model === 'magic+' && <Zap className="h-3 w-3 text-[#f97316]" />}
                {languageModel.model !== 'magic' && languageModel.model !== 'magic+' && resolvedModel && (
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
              <SelectLabel>Magical AI</SelectLabel>
              <SelectItem value="magic">
                <div className="flex items-center space-x-2">
                  <Wand2 className="h-3.5 w-3.5 text-[#f97316]" />
                  <span className="font-medium">Magic</span>
                  <span className="text-[10px] text-white/40">Fast & free</span>
                </div>
              </SelectItem>
              <SelectItem value="magic+">
                <div className="flex items-center space-x-2">
                  <Zap className="h-3.5 w-3.5 text-[#f97316]" />
                  <span className="font-medium">Magic+</span>
                  <span className="text-[10px] text-white/40">Best quality</span>
                </div>
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Free models</SelectLabel>
              {MAGIC_FREE_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center space-x-2">
                    <Image
                      className="flex"
                      src={`/thirdparty/logos/${model.providerId}.svg`}
                      alt={model.provider}
                      width={14}
                      height={14}
                    />
                    <span>{model.name}</span>
                    <span className="text-[10px] text-[#22c55e]">Free</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Other models</SelectLabel>
              {Object.entries(
                Object.groupBy(
                  models.filter((m) => !MAGIC_FREE_MODELS.some((f) => f.id === m.id)),
                  (model) =>
                    model.providerId === 'openrouter'
                      ? 'openrouter'
                      : model.provider,
                ),
              ).map(([groupKey, groupModels]) => (
                <SelectGroup key={groupKey}>
                  <SelectLabel>
                    {groupKey === 'openrouter' ? 'OpenRouter' : groupKey}
                  </SelectLabel>
                  {groupModels?.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center space-x-2">
                        <Image
                          className="flex"
                          src={`/thirdparty/logos/${model.providerId}.svg`}
                          alt={model.provider}
                          width={14}
                          height={14}
                        />
                        <span>{model.name}</span>
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
