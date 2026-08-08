'use client'

import { useAuth } from '@/lib/auth'
import { useState } from 'react'

const noop = () => {}

export default function WorkspaceSettingsPage() {
  const { session } = useAuth(noop, noop)
  const [workspaceName, setWorkspaceName] = useState(
    session?.user?.email?.split('@')[0] + "'s Workspace" || 'My Workspace'
  )
  const [creditLimit, setCreditLimit] = useState('')

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || 'U'
  const workspaceId = session?.user?.id?.slice(0, 20) || 'workspace-id'

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Workspace settings</h1>
        <p className="mt-1 text-sm text-white/50">
          Workspaces allow you to collaborate on projects in real time.
        </p>
      </div>

      {/* Workspace profile */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-white">Workspace profile</h2>
        <p className="mb-4 text-sm text-white/50">Control how this workspace appears on Magical.</p>

        <div className="space-y-0 rounded-xl border border-white/10 bg-white/[0.03]">
          {/* Avatar */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-white">Avatar</div>
              <div className="text-xs text-white/40">Set an avatar for your workspace.</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1EAEDB] text-sm font-bold text-black">
              {userInitial}
            </div>
          </div>

          {/* Name */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-white">Name</div>
              <div className="text-xs text-white/40">Your full workspace name, as visible to others.</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                maxLength={50}
                className="w-64 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none transition focus:border-white/25"
              />
              <span className="text-xs text-white/35">{workspaceName.length} / 50</span>
            </div>
          </div>

          {/* Workspace ID */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-white">Workspace ID</div>
              <div className="text-xs text-white/40">Unique workspace identifier</div>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-white/60">
                {workspaceId}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(workspaceId)}
                className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Workspace handle */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-white">Workspace handle</div>
              <div className="text-xs text-white/40">Set a handle for the workspace profile page.</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.1]"
            >
              Set handle
            </button>
          </div>
        </div>
      </section>

      {/* Member defaults */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-white">Member defaults</h2>
        <p className="mb-4 text-sm text-white/50">Set default limits for workspace members.</p>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Default monthly member credit limit</div>
              <div className="text-xs text-white/40">
                The default monthly credit limit for members of this workspace. Leave empty to use no limit.
              </div>
            </div>
            <input
              type="text"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="Enter default monthly member credit limi"
              className="w-64 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/25"
            />
          </div>
        </div>
      </section>

      {/* Workspace access */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-white">Workspace access</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Leave workspace</div>
              <div className="text-xs text-white/40">
                You cannot leave as you are the only owner. Please transfer ownership first.
              </div>
            </div>
            <button
              type="button"
              disabled
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/30"
            >
              Leave workspace
            </button>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-white">Danger zone</h2>
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Delete workspace</div>
              <div className="text-xs text-white/40">
                Permanently delete this workspace and all projects in it. Members lose access immediately.
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
            >
              Delete workspace
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
