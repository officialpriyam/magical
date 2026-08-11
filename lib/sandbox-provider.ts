export type SandboxProvider = 'e2b' | 'vercel' | 'modal'
export type SandboxProviderMode = 'auto' | SandboxProvider

export const SANDBOX_PROVIDER_OPTIONS: {
  value: SandboxProviderMode
  label: string
  description: string
}[] = [
  {
    value: 'auto',
    label: 'Let AI choose',
    description: 'Randomly uses one configured sandbox provider.',
  },
  {
    value: 'modal',
    label: 'Modal',
    description: 'Run the project in Modal Sandbox.',
  },
  {
    value: 'vercel',
    label: 'Vercel',
    description: 'Run the project in Vercel Sandbox.',
  },
  {
    value: 'e2b',
    label: 'E2B',
    description: 'Run the project in E2B.',
  },
]

export function normalizeSandboxProviderMode(value: unknown): SandboxProviderMode {
  return value === 'e2b' || value === 'vercel' || value === 'modal' || value === 'auto'
    ? value
    : 'auto'
}

export function encodeSandboxId(provider: SandboxProvider, id: string) {
  return id.includes(':') ? `${provider}:${encodeURIComponent(id)}` : `${provider}:${id}`
}

export function decodeSandboxId(value: string): {
  provider: SandboxProvider
  id: string
} {
  const separatorIndex = value.indexOf(':')

  if (separatorIndex <= 0) {
    return { provider: 'e2b', id: value }
  }

  const provider = value.slice(0, separatorIndex)
  const rawId = value.slice(separatorIndex + 1)

  if (provider !== 'e2b' && provider !== 'vercel' && provider !== 'modal') {
    return { provider: 'e2b', id: value }
  }

  return {
    provider,
    id: decodeURIComponent(rawId),
  }
}

export function chooseSandboxProvider({
  mode,
  available,
}: {
  mode: SandboxProviderMode
  available: SandboxProvider[]
}): SandboxProvider | null {
  if (mode !== 'auto') {
    return available.includes(mode) ? mode : null
  }

  if (available.length === 0) {
    return null
  }

  return available[Math.floor(Math.random() * available.length)]
}

export function getResolvedSandboxPort(
  template: string | undefined,
  port?: number | null,
): number {
  if (typeof port === 'number' && port > 0) {
    return port
  }

  if (template === 'streamlit-developer') return 8501
  if (template === 'gradio-developer') return 7860

  return 3000
}
