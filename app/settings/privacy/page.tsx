'use client'

import { useState } from 'react'

interface ToggleSetting {
  id: string
  label: string
  description: string
  enabled: boolean
  badge?: string
}

interface SelectSetting {
  id: string
  label: string
  description: string
  value: string
  options: { label: string; value: string }[]
  badge?: string
}

interface NumberSetting {
  id: string
  label: string
  description: string
  value: string
  suffix?: string
  badge?: string
}

export default function PrivacySettings() {
  const [accessToggles, setAccessToggles] = useState<ToggleSetting[]>([
    { id: 'restrict-invites', label: 'Restrict workspace invitations', description: 'When enabled, only admins and owners can invite members to this workspace.', enabled: false, badge: 'Enterprise' },
    { id: 'invite-links', label: 'Invite links', description: 'Allow workspace members to create and share invite links.', enabled: true },
    { id: 'workspace-discovery', label: 'Workspace discovery', description: 'Allow members from the same email domain to discover and request access to this workspace.', enabled: false, badge: 'Business' },
    { id: 'public-profiles', label: 'Public member profiles', description: 'Enterprise workspaces hide member profiles by default. Turn this on to let members\' public profiles be discoverable outside the workspace.', enabled: false, badge: 'Enterprise' },
    { id: 'editor-transfer', label: 'Editor project transfers', description: 'When enabled, editors who own a project can transfer it, or remix a copy of it, into another workspace.', enabled: false, badge: 'Enterprise' },
    { id: 'require-editor', label: 'Require workspace editor role', description: 'When enabled, workspace viewers and external collaborators can view projects but cannot edit them, even through project ownership or collaborator access.', enabled: false, badge: 'Enterprise' },
  ])

  const [defaultAccess, setDefaultAccess] = useState('restricted')
  const [externalRole, setExternalRole] = useState('viewer')
  const [defaultWebsiteAccess, setDefaultWebsiteAccess] = useState('public')
  const [publishRole, setPublishRole] = useState('member')

  const [publishToggles, setPublishToggles] = useState<ToggleSetting[]>([
    { id: 'external-invites', label: 'External invites', description: 'Members can invite people outside the workspace to view published projects by email.', enabled: false, badge: 'Business' },
    { id: 'block-critical', label: 'Block publishing with critical issues', description: 'Prevent projects with critical security issues from being published or updated.', enabled: true },
    { id: 'require-scan', label: 'Require basic security scan before first publish', description: 'Require the basic security scan to complete before a project can be published for the first time.', enabled: false },
  ])

  const [appLoginMethods, setAppLoginMethods] = useState('email')

  const [securityToggles, setSecurityToggles] = useState<ToggleSetting[]>([
    { id: 'auto-fix', label: 'Auto-fix security issues', description: 'Enable auto-fixing basic scan issues that are low risk at the workspace level.', enabled: false },
  ])

  const [abandonedAfter, setAbandonedAfter] = useState('60')
  const [deleteAfter, setDeleteAfter] = useState('off')

  const [sharingToggles, setSharingToggles] = useState<ToggleSetting[]>([
    { id: 'preview-links', label: 'Preview link sharing', description: 'When enabled, users can create temporary public preview links to their apps.', enabled: false, badge: 'Enterprise' },
    { id: 'code-downloads', label: 'Code downloads', description: 'When disabled, only workspace admins and owners can download project source code.', enabled: false, badge: 'Enterprise' },
    { id: 'cross-project', label: 'Cross-project sharing', description: 'Allow projects in this workspace to read files from other projects.', enabled: true },
  ])

  const [mcpToggles, setMcpToggles] = useState<ToggleSetting[]>([
    { id: 'remote-mcp', label: 'Remote MCP connectors', description: 'Allow workspace members to connect MCP servers that Magical AI can call from chat.', enabled: false, badge: 'Business' },
    { id: 'local-mcp', label: 'Local desktop MCP servers', description: 'Allow workspace members to use MCP servers from connected Desktop sessions.', enabled: false, badge: 'Business' },
  ])

  const [aiTraining, setAiTraining] = useState<ToggleSetting[]>([
    { id: 'ai-training', label: 'AI model training on workspace data', description: 'Prompts, code, content, and files from every member of this workspace may be used to train AI models.', enabled: false, badge: 'Business' },
  ])

  const [dataToggles, setDataToggles] = useState<ToggleSetting[]>([
    { id: 'sensitive-scan', label: 'Sensitive data scanning', description: 'Enable PII detection for this workspace.', enabled: false, badge: 'Enterprise' },
    { id: 'block-public-storage', label: 'Block public storage buckets', description: 'Prevent users from creating publicly accessible storage buckets.', enabled: false },
  ])

  const [dataHosting, setDataHosting] = useState('auto')

  const toggleItem = (setter: React.Dispatch<React.SetStateAction<ToggleSetting[]>>, id: string) => {
    setter((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  const renderToggle = (setting: ToggleSetting, setter: React.Dispatch<React.SetStateAction<ToggleSetting[]>>) => (
    <div key={setting.id} className="flex items-center justify-between py-4">
      <div className="flex-1 mr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{setting.label}</span>
          {setting.badge && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {setting.badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-white/40">{setting.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={setting.enabled}
        onClick={() => toggleItem(setter, setting.id)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#0b0d0b] ${
          setting.enabled ? 'bg-primary' : 'bg-white/20'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${setting.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  const renderSelect = (setting: SelectSetting, setter: (val: string) => void) => (
    <div key={setting.id} className="flex items-center justify-between py-4">
      <div className="flex-1 mr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{setting.label}</span>
          {setting.badge && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {setting.badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-white/40">{setting.description}</p>
      </div>
      <select
        value={setting.value}
        onChange={(e) => setter(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50"
      >
        {setting.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-white">Privacy & security</h1>
      </div>
      <p className="mb-8 text-sm text-white/50">
        Manage privacy and security settings for your workspace.
      </p>

      {/* Access & membership */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">Access & membership</h2>
        <p className="mb-4 text-xs text-white/40">Who can join the workspace and manage projects.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-white">Default project access</span>
                <p className="mt-0.5 text-xs text-white/40">Choose whether new projects are accessible to all workspace members, or restricted to invited users only.</p>
              </div>
              <select
                value={defaultAccess}
                onChange={(e) => setDefaultAccess(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50"
              >
                <option value="all">All members</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          </div>
          {accessToggles.map((t) => (
            <div key={t.id} className="border-t border-white/10">
              {renderToggle(t, setAccessToggles)}
            </div>
          ))}
          <div className="border-t border-white/10">
            {renderSelect(
              { id: 'external-role', label: 'External project collaborators', description: 'Choose the highest project role people outside this workspace can have.', value: externalRole, options: [{ label: 'Viewer', value: 'viewer' }, { label: 'Editor', value: 'editor' }, { label: 'None', value: 'none' }], badge: 'Business' },
              setExternalRole
            )}
          </div>
        </div>
      </section>

      {/* Publishing */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">Publishing</h2>
        <p className="mb-4 text-xs text-white/40">Control how projects are published and deployed to the web.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">Default website access</span>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">Business</span>
                </div>
                <p className="mt-0.5 text-xs text-white/40">Choose who can view newly published websites.</p>
              </div>
              <select
                value={defaultWebsiteAccess}
                onChange={(e) => setDefaultWebsiteAccess(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50"
              >
                <option value="public">Public</option>
                <option value="members">Members only</option>
              </select>
            </div>
          </div>
          <div className="border-t border-white/10">
            {renderSelect(
              { id: 'publish-role', label: 'Who can publish externally', description: 'Control who can publish and deploy projects to the web.', value: publishRole, options: [{ label: 'Member', value: 'member' }, { label: 'Admin', value: 'admin' }, { label: 'Owner', value: 'owner' }], badge: 'Enterprise' },
              setPublishRole
            )}
          </div>
          {publishToggles.map((t) => (
            <div key={t.id} className="border-t border-white/10">
              {renderToggle(t, setPublishToggles)}
            </div>
          ))}
        </div>
      </section>

      {/* App login methods */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">App login methods</h2>
        <p className="mb-4 text-xs text-white/40">Control which login methods projects in this workspace may use for generated apps.</p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">App login methods</span>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">Business</span>
                </div>
                <p className="mt-0.5 text-xs text-white/40">Control which login methods projects in this workspace may use for generated apps.</p>
              </div>
              <select
                value={appLoginMethods}
                onChange={(e) => setAppLoginMethods(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50"
              >
                <option value="email">Email</option>
                <option value="all">All methods</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Security automation */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">Security automation</h2>
        <p className="mb-4 text-xs text-white/40">Control automatic security remediation for workspace projects.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          {securityToggles.map((t) => (
            <div key={t.id} className={t.id !== 'auto-fix' ? 'border-t border-white/10' : ''}>
              {renderToggle(t, setSecurityToggles)}
            </div>
          ))}
        </div>
      </section>

      {/* Abandoned projects */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">Abandoned projects</h2>
        <p className="mb-4 text-xs text-white/40">Automatically identify projects with no recent activity.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">Mark as abandoned after</span>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">Enterprise</span>
                </div>
                <p className="mt-0.5 text-xs text-white/40">Projects with no activity for this period are marked abandoned.</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={abandonedAfter}
                  onChange={(e) => setAbandonedAfter(e.target.value)}
                  className="w-16 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-center text-sm text-white outline-none focus:border-primary/50"
                />
                <span className="text-xs text-white/40">days</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 py-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-white">Delete abandoned projects after</span>
                <p className="mt-0.5 text-xs text-white/40">Abandoned projects stay recoverable during this grace period.</p>
              </div>
              <select
                value={deleteAfter}
                onChange={(e) => setDeleteAfter(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50"
              >
                <option value="off">Off</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Sharing */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">Sharing</h2>
        <p className="mb-4 text-xs text-white/40">Control how members share project files and preview links.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          {sharingToggles.map((t) => (
            <div key={t.id} className={t.id !== 'preview-links' ? 'border-t border-white/10' : ''}>
              {renderToggle(t, setSharingToggles)}
            </div>
          ))}
        </div>
      </section>

      {/* MCP connectors */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">MCP connectors</h2>
        <p className="mb-4 text-xs text-white/40">Control MCP servers Magical AI can use from chat.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          {mcpToggles.map((t) => (
            <div key={t.id} className={t.id !== 'remote-mcp' ? 'border-t border-white/10' : ''}>
              {renderToggle(t, setMcpToggles)}
            </div>
          ))}
        </div>
      </section>

      {/* AI model training */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">AI model training</h2>
        <p className="mb-4 text-xs text-white/40">Choose how we use your workspace data.</p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5">
          {aiTraining.map((t) => (
            <div key={t.id}>
              {renderToggle(t, setAiTraining)}
            </div>
          ))}
        </div>
      </section>

      {/* Data protection */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium text-white">Data protection</h2>
        <p className="mb-4 text-xs text-white/40">Control how data from this workspace is used.</p>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-5">
          {dataToggles.map((t) => (
            <div key={t.id} className={t.id !== 'sensitive-scan' ? 'border-t border-white/10' : ''}>
              {renderToggle(t, setDataToggles)}
            </div>
          ))}
          <div className="border-t border-white/10">
            {renderSelect(
              { id: 'data-hosting', label: 'Default data hosting region', description: 'Choose where data for new projects in this workspace is stored.', value: dataHosting, options: [{ label: 'Auto', value: 'auto' }, { label: 'US', value: 'us' }, { label: 'EU', value: 'eu' }], badge: 'Business' },
              setDataHosting
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
