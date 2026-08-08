'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { ArrowLeft, ExternalLink, Plus, Trash2, Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useSearchParams } from 'next/navigation'

interface GitProvider {
  id: 'github' | 'gitlab'
  name: string
  icon: React.ReactNode
  description: string
  connected: boolean
  username?: string
  email?: string
  avatar_url?: string
  connected_at?: string
  loading: boolean
}

const statusMessages: Record<string, { title: string; description: string; type: 'success' | 'error' }> = {
  connected: { title: 'Connected successfully', description: 'Your account is now linked.', type: 'success' },
  disconnected: { title: 'Disconnected', description: 'Account has been unlinked.', type: 'success' },
  invalid_state: { title: 'Connection expired', description: 'Please try connecting again.', type: 'error' },
  login_required: { title: 'Sign in required', description: 'Please sign in first.', type: 'error' },
  not_configured: { title: 'Not configured', description: 'OAuth credentials are not set up on the server.', type: 'error' },
  access_denied: { title: 'Access denied', description: 'You denied the permission request.', type: 'error' },
  authorization_failed: { title: 'Authorization failed', description: 'Something went wrong during authorization.', type: 'error' },
  token_exchange_failed: { title: 'Token exchange failed', description: 'Failed to exchange authorization code.', type: 'error' },
  user_lookup_failed: { title: 'Lookup failed', description: 'Could not fetch your account details.', type: 'error' },
  storage_failed: { title: 'Save failed', description: 'Could not save the connection.', type: 'error' },
  error: { title: 'Connection failed', description: 'An unexpected error occurred.', type: 'error' },
}

export default function GitPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>}>
      <GitPageContent />
    </Suspense>
  )
}

function GitPageContent() {
  const { session } = useAuth(() => {}, () => {})
  const searchParams = useSearchParams()
  const [providers, setProviders] = useState<GitProvider[]>([
    { id: 'github', name: 'GitHub', icon: <GitHubIcon />, description: 'Two-way sync with your GitHub account or organization', connected: false, loading: true },
    { id: 'gitlab', name: 'GitLab', icon: <GitLabIcon />, description: 'Two-way sync with GitLab.com or self-managed GitLab', connected: false, loading: true },
  ])
  const [toast, setToast] = useState<{ title: string; description: string; type: 'success' | 'error' } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    const [ghRes, glRes] = await Promise.all([
      fetch('/api/github/status').then(r => r.ok ? r.json() : { connected: false }),
      fetch('/api/gitlab/status').then(r => r.ok ? r.json() : { connected: false }),
    ])

    setProviders(prev => prev.map(p => {
      if (p.id === 'github') {
        return {
          ...p,
          connected: ghRes.connected,
          username: ghRes.username,
          email: ghRes.email,
          avatar_url: ghRes.avatar_url,
          connected_at: ghRes.connected_at,
          loading: false,
        }
      }
      return {
        ...p,
        connected: glRes.connected,
        username: glRes.username,
        email: glRes.email,
        avatar_url: glRes.avatar_url,
        connected_at: glRes.connected_at,
        loading: false,
      }
    }))
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const githubStatus = searchParams.get('github')
    const gitlabStatus = searchParams.get('gitlab')

    if (githubStatus && statusMessages[githubStatus]) {
      setToast(statusMessages[githubStatus])
      if (githubStatus === 'connected') fetchStatus()
      const url = new URL(window.location.href)
      url.searchParams.delete('github')
      window.history.replaceState(null, '', url.pathname)
    }

    if (gitlabStatus && statusMessages[gitlabStatus]) {
      setToast(statusMessages[gitlabStatus])
      if (gitlabStatus === 'connected') fetchStatus()
      const url = new URL(window.location.href)
      url.searchParams.delete('gitlab')
      window.history.replaceState(null, '', url.pathname)
    }
  }, [searchParams, fetchStatus])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleConnect = (providerId: string) => {
    window.location.assign(`/api/${providerId}/connect`)
  }

  const handleDisconnect = async (providerId: string) => {
    setDisconnecting(providerId)
    try {
      const res = await fetch(`/api/${providerId}/disconnect`, { method: 'POST' })
      if (res.ok) {
        setToast({ title: 'Disconnected', description: `${providerId === 'github' ? 'GitHub' : 'GitLab'} has been disconnected.`, type: 'success' })
        await fetchStatus()
      }
    } catch {
      setToast({ title: 'Failed', description: 'Could not disconnect. Please try again.', type: 'error' })
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      {toast && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border p-4 text-sm ${
          toast.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-300'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <div>
            <div className="font-medium">{toast.title}</div>
            <div className="opacity-80">{toast.description}</div>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Git</h1>
          <p className="mt-1 text-sm text-white/50">
            Connect GitHub or GitLab to sync project code. Connections are available to every project in this workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08] hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <p className="mb-8 text-xs text-white/35">
        Once a project is linked to a repository, edits in Magical AI are committed to the repo, and pushed commits flow back into the project.
      </p>

      <div className="space-y-3">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.08]">
                  {provider.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-white">{provider.name}</h3>
                    {provider.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                    ) : provider.connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Connected
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-white/40">{provider.description}</p>
                  {provider.connected && provider.username && (
                    <p className="mt-1 text-xs text-white/30">
                      @{provider.username}{provider.email ? ` · ${provider.email}` : ''}
                      {provider.connected_at && ` · since ${new Date(provider.connected_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {provider.connected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(provider.id)}
                      disabled={disconnecting === provider.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {disconnecting === provider.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </button>
                    <a
                      href={`https://${provider.id === 'github' ? 'github.com' : 'gitlab.com'}/${provider.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      Open on {provider.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnect(provider.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-white/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Connect {provider.name}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function GitLabIcon() {
  return (
    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
    </svg>
  )
}
