'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Shield, Ban, CheckCircle, CreditCard, Zap, Folder, Users, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

interface UserDetails {
  user: any
  projects: any[]
  projectCount: number
  teams: any[]
  teamCount: number
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string
  const [details, setDetails] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [creditAmount, setCreditAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.status === 403) {
        router.push('/')
        return
      }
      const data = await res.json()
      setDetails(data)
    } catch (err) {
      console.error('Failed to fetch user details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [userId])

  const handleCredits = async (action: 'add' | 'deduct') => {
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return

    setActionLoading(true)
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'credits', creditAction: action, amount }),
      })
      setCreditAmount('')
      fetchDetails()
    } finally {
      setActionLoading(false)
    }
  }

  const handleBan = async () => {
    setActionLoading(true)
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: details?.user?.banned ? 'unban' : 'ban' }),
      })
      fetchDetails()
    } finally {
      setActionLoading(false)
    }
  }

  const handleRole = async () => {
    setActionLoading(true)
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'role', role: details?.user?.role === 'admin' ? 'user' : 'admin' }),
      })
      fetchDetails()
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="text-white/40 text-center py-12">Loading...</div>
  }

  if (!details?.user) {
    return <div className="text-white/40 text-center py-12">User not found</div>
  }

  const { user, projects, projectCount, teams, teamCount } = details

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      {/* User Header */}
      <div className="flex items-start justify-between gap-4 p-6 rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-white/60">
              {(user.full_name || user.email)?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{user.full_name || 'Unnamed User'}</h1>
            <p className="text-sm text-white/50">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/60'
              }`}>
                {user.role === 'admin' && <Shield className="h-3 w-3" />}
                {user.role}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                user.banned ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
              }`}>
                {user.banned ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                {user.banned ? 'Banned' : 'Active'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRole} disabled={actionLoading} className="border-white/10 text-white/70 hover:bg-white/10">
            {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBan} disabled={actionLoading} className={user.banned ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}>
            {user.banned ? 'Unban' : 'Ban'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
            <CreditCard className="h-4 w-4" />
            Credits
          </div>
          <div className="text-2xl font-bold text-white">{user.credits ?? 0}</div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
            <Zap className="h-4 w-4" />
            Tokens Used
          </div>
          <div className="text-2xl font-bold text-white">{user.tokens_used ?? 0}</div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
            <Folder className="h-4 w-4" />
            Projects
          </div>
          <div className="text-2xl font-bold text-white">{projectCount}</div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
            <Users className="h-4 w-4" />
            Teams
          </div>
          <div className="text-2xl font-bold text-white">{teamCount}</div>
        </div>
      </div>

      {/* Credits Management */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
        <h3 className="text-sm font-medium text-white/70 mb-3">Manage Credits</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Amount"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            className="w-32 bg-white/5 border-white/10 text-white"
            min="1"
          />
          <Button size="sm" onClick={() => handleCredits('add')} disabled={actionLoading || !creditAmount} className="bg-green-600 hover:bg-green-500 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
          <Button size="sm" onClick={() => handleCredits('deduct')} disabled={actionLoading || !creditAmount} className="bg-red-600 hover:bg-red-500 text-white">
            <Minus className="h-4 w-4 mr-1" />
            Deduct
          </Button>
        </div>
      </div>

      {/* Projects */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
        <h3 className="text-sm font-medium text-white/70 mb-3">Projects ({projectCount})</h3>
        {projects.length === 0 ? (
          <p className="text-sm text-white/40">No projects</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-white/80">{project.title}</span>
                <span className="text-xs text-white/40">{new Date(project.updated_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
        <h3 className="text-sm font-medium text-white/70 mb-3">Teams ({teamCount})</h3>
        {teams.length === 0 ? (
          <p className="text-sm text-white/40">No teams</p>
        ) : (
          <div className="space-y-2">
            {teams.map((team: any, i: number) => (
              <div key={i} className="py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-white/80">{team.teams?.name || team.team_id}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
