'use client'

import { useState } from 'react'
import { GitBranch, Check, RefreshCw } from 'lucide-react'

export default function GitPage() {
  const [repoConnected, setRepoConnected] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [commitPrefix, setCommitPrefix] = useState('feat: ')

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Git</h1>
        <p className="mt-1 text-sm text-white/50">
          Connect your Git provider for version control and deployments.
        </p>
      </div>

      {/* GitHub connection */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-white">GitHub</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
                G
              </div>
              <div>
                <div className="text-sm font-medium text-white">GitHub</div>
                <div className="text-xs text-white/40">
                  {repoConnected ? 'Connected · Auto-sync enabled' : 'Not connected'}
                </div>
              </div>
            </div>
            {repoConnected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  <Check className="h-3 w-3" />
                  Connected
                </span>
                <button
                  type="button"
                  onClick={() => setRepoConnected(false)}
                  className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.1]"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRepoConnected(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1EAEDB] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#1EAEDB]/90"
              >
                <GitBranch className="h-4 w-4" />
                Connect GitHub
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Repository settings */}
      {repoConnected && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-medium text-white">Repository settings</h2>
          <div className="space-y-0 rounded-xl border border-white/10 bg-white/[0.03]">
            {/* Branch */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-sm font-medium text-white">Branch</div>
                <div className="text-xs text-white/40">Target branch for auto-commits</div>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-white/60">
                  main
                </code>
                <button
                  type="button"
                  className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Auto commit */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-sm font-medium text-white">Auto commit</div>
                <div className="text-xs text-white/40">Automatically commit changes to GitHub</div>
              </div>
              <button
                type="button"
                onClick={() => setAutoSync(!autoSync)}
                className={`relative h-5 w-9 rounded-full transition ${
                  autoSync ? 'bg-[#1EAEDB]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    autoSync ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Commit prefix */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium text-white">Commit prefix</div>
                <div className="text-xs text-white/40">Prefix added to auto-generated commit messages</div>
              </div>
              <input
                type="text"
                value={commitPrefix}
                onChange={(e) => setCommitPrefix(e.target.value)}
                className="w-40 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white font-mono outline-none transition focus:border-white/25"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
