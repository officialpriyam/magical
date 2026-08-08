'use client'

import { useAuth } from '@/lib/auth'
import { useState } from 'react'
import { Mail, MoreHorizontal, UserPlus, X } from 'lucide-react'

interface Member {
  id: string
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Member' | 'Guest'
  status: 'active' | 'invited'
  lastActive?: string
  avatar?: string
}

const defaultMembers: Member[] = [
  {
    id: '1',
    name: 'You',
    email: '',
    role: 'Owner',
    status: 'active',
    lastActive: 'Just now',
  },
]

const roleColors: Record<string, string> = {
  Owner: 'bg-primary/15 text-primary',
  Admin: 'bg-emerald-400/15 text-emerald-400',
  Member: 'bg-white/10 text-white/60',
  Guest: 'bg-amber-400/15 text-amber-400',
}

const noop = () => {}

export default function PeoplePage() {
  const { session } = useAuth(noop, noop)
  const [members] = useState<Member[]>(() => {
    const email = session?.user?.email || ''
    const name = email.split('@')[0] || 'User'
    return [{ ...defaultMembers[0], email, name }]
  })
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Member' | 'Guest'>('Member')
  const [filter, setFilter] = useState('')

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(filter.toLowerCase()) ||
      m.email.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">People</h1>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black transition hover:bg-primary/80"
        >
          <UserPlus className="h-4 w-4" />
          Add member
        </button>
      </div>
      <p className="mb-6 text-sm text-white/50">Manage who has access to your workspace.</p>

      {/* Search / Filter */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Filter by name or email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/40 outline-none transition focus:border-white/20"
        />
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {/* Header */}
        <div className="grid grid-cols-[1fr_140px_100px_100px_40px] gap-4 border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-wider text-white/40">
          <span>Member</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last active</span>
          <span />
        </div>

        {/* Rows */}
        {filtered.map((member) => (
          <div
            key={member.id}
            className="grid grid-cols-[1fr_140px_100px_100px_40px] items-center gap-4 border-b border-white/5 px-5 py-3 transition hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                {member.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {member.name}
                  {member.role === 'Owner' && (
                    <span className="ml-2 text-xs text-white/40">(you)</span>
                  )}
                </div>
                <div className="text-xs text-white/40">{member.email}</div>
              </div>
            </div>

            <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${roleColors[member.role]}`}>
              {member.role}
            </span>

            <span className="text-xs text-white/50">{member.status === 'active' ? 'Active' : 'Invited'}</span>

            <span className="text-xs text-white/40">{member.lastActive || '—'}</span>

            <button
              type="button"
              className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0d0b] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Invite member</h2>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm text-white/60">Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/25"
              />
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-sm text-white/60">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition focus:border-white/25"
              >
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
                <option value="Guest">Guest</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm text-white transition hover:bg-white/[0.1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (inviteEmail) {
                    alert(`Invite sent to ${inviteEmail} as ${inviteRole}`)
                    setShowInvite(false)
                    setInviteEmail('')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black transition hover:bg-primary/80"
              >
                <Mail className="h-4 w-4" />
                Send invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
