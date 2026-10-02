export type SandboxProvider = 'e2b' | 'vercel' | 'modal' | 'daytona'
export type SandboxProviderMode = 'auto' | SandboxProvider

// 45 minutes keeps every provider inside its plan limits (Vercel Hobby caps at
// 45 minutes; Pro plans can raise this via VERCEL_SANDBOX_TIMEOUT_MS).
export const SANDBOX_TIMEOUT_MS = 45 * 60 * 1000

const PROVIDER_PREFERENCE: SandboxProvider[] = ['vercel', 'modal', 'daytona', 'e2b']

export const SANDBOX_PROVIDER_OPTIONS: {
  value: SandboxProviderMode
  label: string
  description: string
}[] = [
  {
    value: 'auto',
    label: 'Let AI choose',
    description: 'Uses Vercel Sandbox when available, otherwise the next configured provider.',
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
  {
    value: 'daytona',
    label: 'Daytona',
    description: 'Run the project in Daytona Sandbox.',
  },
]

export function normalizeSandboxProviderMode(value: unknown): SandboxProviderMode {
  return value === 'e2b' || value === 'vercel' || value === 'modal' || value === 'daytona' || value === 'auto'
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

  if (provider !== 'e2b' && provider !== 'vercel' && provider !== 'modal' && provider !== 'daytona') {
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
  if (available.length === 0) {
    return null
  }

  if (mode !== 'auto' && available.includes(mode)) {
    return mode
  }

  // Vercel is the default; fall back through the remaining configured
  // providers so an unconfigured choice (or "auto") never blocks the sandbox.
  return (
    PROVIDER_PREFERENCE.find((provider) => available.includes(provider)) ??
    available[0]
  )
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
  if (
    template === 'react-developer' ||
    template === 'vite-developer' ||
    template === 'vue-developer' ||
    template === 'svelte-developer' ||
    template === 'pwa-mobile'
  ) return 5173

  return 3000
}
