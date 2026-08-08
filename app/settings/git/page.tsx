'use client'

import { useState } from 'react'
import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react'

interface GitConnection {
  id: string
  provider: 'github' | 'gitlab'
  name: string
  email: string
  projects: number
  updatedAt: string
}

export default function GitPage() {
  const [connections] = useState<GitConnection[]>([
    { id: '1', provider: 'github', name: 'officialpriyam', email: 'justpriyamextra@gmail.com', projects: 6, updatedAt: '7 months ago' },
  ])
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab' | null>(null)
  const [selectedConnection, setSelectedConnection] = useState<GitConnection | null>(null)

  if (selectedConnection) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setSelectedConnection(null)}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            GitHub
          </button>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedConnection.name}</h2>
              <p className="text-xs text-white/40">
                Created by {selectedConnection.email}, last updated {selectedConnection.updatedAt}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.08]"
            >
              Configure on GitHub
              <ExternalLink className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.08]"
            >
              Open docs
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Linked projects */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Linked projects</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.08]"
            >
              <Plus className="h-3.5 w-3.5" />
              Import repo
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              <svg className="h-5 w-5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <p className="text-sm text-white/40">This connection is not linked to any projects.</p>
          </div>
        </div>

        {/* Delete */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-medium text-white">Delete this connection</h3>
          <p className="mt-1 text-xs text-white/40">
            This action cannot be undone. This will permanently delete the connection and disconnect all linked projects.{' '}
            Currently used in <strong className="text-white">{selectedConnection.projects} projects</strong>.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    )
  }

  if (selectedProvider) {
    const providerConnections = connections.filter((c) => c.provider === selectedProvider)
    const providerName = selectedProvider === 'github' ? 'GitHub' : 'GitLab'

    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setSelectedProvider(null)}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Git
          </button>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{providerName}</h2>
            <p className="mt-1 text-sm text-white/50">
              Connect {providerName} accounts and organizations, then link projects to repositories.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.1]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add connection
          </button>
        </div>

        {providerConnections.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="grid grid-cols-[1fr_80px_1fr_100px] gap-4 border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-wider text-white/40">
              <span>Name</span>
              <span>Projects</span>
              <span>Owner</span>
              <span>Updated</span>
            </div>
            {providerConnections.map((conn) => (
              <button
                key={conn.id}
                type="button"
                onClick={() => setSelectedConnection(conn)}
                className="grid w-full grid-cols-[1fr_80px_1fr_100px] items-center gap-4 border-b border-white/5 px-5 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                    {conn.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-white">{conn.name}</span>
                </div>
                <span className="text-sm text-white/60">{conn.projects}</span>
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f97316] text-[9px] font-bold text-white">
                    {conn.email[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-white/50">{conn.email}</span>
                </div>
                <span className="text-xs text-white/40">{conn.updatedAt}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              <svg className="h-5 w-5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <p className="text-sm text-white/40">
              No connections yet. Add one to start syncing your projects with {providerName}.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-white">Git</h1>
      </div>
      <p className="mb-2 text-sm text-white/50">
        Connect the GitHub or GitLab accounts your team uses to sync project code.
      </p>
      <div className="mb-8 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white"
        >
          Open docs
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <p className="mb-6 text-xs text-white/40">
        Connections added here are available to every project in this workspace. Once a project is linked to a
        repository, it syncs both ways: edits in Magical AI are committed to the repo, and pushed commits flow
        back into the project.
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setSelectedProvider('github')}
          className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left transition hover:bg-white/[0.06]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">GitHub</div>
            <div className="text-xs text-white/40">Two-way sync with your GitHub account or organization</div>
          </div>
          <svg className="h-4 w-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <button
          type="button"
          onClick={() => setSelectedProvider('gitlab')}
          className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left transition hover:bg-white/[0.06]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">GitLab</div>
            <div className="text-xs text-white/40">Two-way sync with GitLab.com or self-managed GitLab</div>
          </div>
          <svg className="h-4 w-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  )
}
