'use client'

import { useState } from 'react'
import { Database, Shield, Users, Zap, FileText, Lock, Activity, Settings, Plus, Table, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type DatabaseTab = 'tables' | 'auth' | 'users' | 'edge-functions' | 'storage' | 'secrets' | 'logs' | 'advanced'

const DB_TABS: { id: DatabaseTab; label: string; icon: typeof Database }[] = [
  { id: 'tables', label: 'Tables', icon: Table },
  { id: 'auth', label: 'Authentication', icon: Shield },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'edge-functions', label: 'Server Functions', icon: Zap },
  { id: 'storage', label: 'File Storage', icon: FileText },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'advanced', label: 'Advanced', icon: Settings },
]

function EmptyState({ icon: Icon, title, description }: { icon: typeof Database; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
        <Icon className="h-8 w-8 text-white/25" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white/70">{title}</p>
        <p className="max-w-xs text-xs text-white/40 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

export function DatabasePanel({ projectId, isSupabaseConnected }: { projectId?: string; isSupabaseConnected?: boolean }) {
  const [activeTab, setActiveTab] = useState<DatabaseTab>('tables')

  return (
    <div className="flex flex-col h-full bg-[#111315]">
      {/* Tabs bar */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-white/[0.06] bg-white/[0.02] px-1">
        <div className="flex items-center gap-1 px-3 py-2">
          <Database className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold text-white/70">Database</span>
        </div>
        <div className="h-5 w-px bg-white/[0.08] mx-1" />
        {DB_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition",
                activeTab === tab.id
                  ? "text-white border-b-2 border-blue-500 -mb-px"
                  : "text-white/45 hover:text-white/70"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!isSupabaseConnected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
              <Database className="h-8 w-8 text-white/25" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-white/70">No Supabase connected</p>
              <p className="max-w-sm text-xs text-white/40 leading-relaxed">
                Tell the AI to integrate Supabase database into your project — it will set up tables, auth, storage, and more automatically.
              </p>
              <p className="max-w-xs text-[11px] text-white/25 mt-2 font-mono bg-white/[0.03] rounded-lg px-3 py-2">
                &quot;Connect Supabase to this project and add a users table&quot;
              </p>
            </div>
          </div>
        ) : activeTab === 'tables' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Tables</h3>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08] transition">
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition">
                  <Plus className="h-3 w-3" />
                  New Table
                </button>
              </div>
            </div>
            <p className="text-sm text-white/40">
              View and manage database tables and records. Ask the AI to create or modify tables.
            </p>
            <EmptyState
              icon={Table}
              title="No tables yet"
              description="Ask the AI to create tables, or use the New Table button to create one manually."
            />
          </div>
        ) : activeTab === 'auth' ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Authentication</h3>
            <p className="text-sm text-white/40">Configure how users sign up and sign in to your app.</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">Email / Password</p>
                    <p className="text-xs text-white/40">Sign in with email and password</p>
                  </div>
                  <div className="h-2 w-8 rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">Google OAuth</p>
                    <p className="text-xs text-white/40">Sign in with Google</p>
                  </div>
                  <div className="h-2 w-8 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">GitHub OAuth</p>
                    <p className="text-xs text-white/40">Sign in with GitHub</p>
                  </div>
                  <div className="h-2 w-8 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">User Management</h3>
            <p className="text-sm text-white/40">Track authenticated users who sign up and sign in.</p>
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Users will appear here once they sign up for your app."
            />
          </div>
        ) : activeTab === 'edge-functions' ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Server Functions</h3>
            <p className="text-sm text-white/40">Server (edge) functions run secure background tasks.</p>
            <EmptyState
              icon={Zap}
              title="No server functions yet"
              description="Ask the AI to create server functions, or create one manually."
            />
          </div>
        ) : activeTab === 'storage' ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">File Storage</h3>
            <p className="text-sm text-white/40">View files stored by your app, like user uploads.</p>
            <EmptyState
              icon={FileText}
              title="No files stored yet"
              description="Ask the AI to create buckets for file storage and use them in your app."
            />
          </div>
        ) : activeTab === 'secrets' ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Secrets</h3>
            <p className="text-sm text-white/40">Hidden values (API keys, passwords) your code can use securely.</p>
            <div className="grid grid-cols-[1fr_2fr_auto] gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs text-white/50">Name</label>
                <input placeholder="Secret name" className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Value</label>
                <input type="password" placeholder="Secret value" className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" />
              </div>
              <button className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-500 transition whitespace-nowrap">
                Create secret
              </button>
            </div>
          </div>
        ) : activeTab === 'logs' ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Logs</h3>
            <p className="text-sm text-white/40">Monitor database queries, authentication events, and backend services.</p>
            <EmptyState
              icon={Activity}
              title="No logs available yet"
              description="Check back later for activity logs."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Advanced Settings</h3>
            <p className="text-sm text-white/40">Manage database connections and project settings.</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-white/80">Supabase Project</p>
                <p className="mt-1 text-xs text-white/40">Connected to your Supabase project.</p>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08] transition">
                    View in Supabase
                  </button>
                  <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08] transition">
                    Change database
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
