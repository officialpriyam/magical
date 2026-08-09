import type { LLMModel } from '@/lib/models'

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
  { id: 'anthropic/claude-haiku-4-5-free', name: 'Claude Haiku 4.5 Free', provider: 'Anthropic', providerId: 'llm_gateway' },
  { id: 'orcarouter/free', name: 'OrcaRouter Free', provider: 'OrcaRouter', providerId: 'orcarouter' },
  { id: 'deepseek/deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', provider: 'DeepSeek', providerId: 'orcarouter' },
  { id: 'mistral/leanstral-1-5', name: 'Leanstral 1.5', provider: 'Mistral', providerId: 'requesty' },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', provider: 'Google', providerId: 'requesty' },
  { id: 'novita/inclusionai/ling-3.0-tiny', name: 'Ling 3.0 Tiny', provider: 'Novita', providerId: 'requesty' },
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
  { id: 'anthropic/claude-haiku-4-5-free', name: 'Claude Haiku 4.5 Free', provider: 'Anthropic', providerId: 'llm_gateway' },
  { id: 'orcarouter/free', name: 'OrcaRouter Free', provider: 'OrcaRouter', providerId: 'orcarouter' },
  { id: 'deepseek/deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', provider: 'DeepSeek', providerId: 'orcarouter' },
  { id: 'deepseek/deepseek-v4-pro-free', name: 'DeepSeek V4 Pro Free', provider: 'DeepSeek', providerId: 'orcarouter' },
  { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', provider: 'NVIDIA', providerId: 'requesty' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', provider: 'NVIDIA', providerId: 'requesty' },
  { id: 'poolside/laguna-m.1', name: 'Poolside Laguna M', provider: 'Poolside', providerId: 'requesty' },
  { id: 'poolside/laguna-xs.2', name: 'Poolside Laguna XS', provider: 'Poolside', providerId: 'requesty' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b', name: 'Nemotron 3 Nano 30B', provider: 'NVIDIA', providerId: 'requesty' },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', provider: 'Google', providerId: 'requesty' },
]

export function getRandomModel(models: LLMModel[]): LLMModel {
  return models[Math.floor(Math.random() * models.length)]
}
