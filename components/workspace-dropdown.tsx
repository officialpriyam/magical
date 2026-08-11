'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Plus, Settings, HelpCircle, CreditCard, LogOut, User } from 'lucide-react'
import Link from 'next/link'
import { HelpModal } from '@/components/help-center'

interface WorkspaceDropdownProps {
  onSignOut?: () => void
  onOpenPricing?: () => void
}

interface Workspace {
  id: string
  name: string
  plan: 'Free' | 'Pro' | 'Enterprise'
  isCurrent: boolean
  memberCount?: number
}

const demoWorkspaces: Workspace[] = [
  { id: '1', name: "Priyam's Workspace", plan: 'Free', isCurrent: true, memberCount: 1 },
]

export function WorkspaceDropdown({ onSignOut, onOpenPricing }: WorkspaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspaces] = useState<Workspace[]>(demoWorkspaces)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentWorkspace = workspaces.find((w) => w.isCurrent)
  const creditsUsed = 47
  const creditsTotal = 50
  const creditsPercent = (creditsUsed / creditsTotal) * 100

  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close()
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, close])

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.08]"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-black">
            {currentWorkspace?.name[0] || 'W'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium text-white">{currentWorkspace?.name || 'Workspace'}</div>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-white/10 bg-[#111315] p-2 shadow-2xl">
            {/* Current workspace info */}
            <div className="mb-2 rounded-lg bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-black">
                  {currentWorkspace?.name[0] || 'W'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{currentWorkspace?.name}</div>
                  <div className="text-xs text-white/40">{currentWorkspace?.plan} Plan · {currentWorkspace?.memberCount} member</div>
                </div>
              </div>
              <button
                type="button"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                Invite members
              </button>
            </div>

            {/* Credits */}
            <div className="mb-2 px-1">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-white/60">Credits</span>
                <span className="text-xs text-white/40">{creditsTotal - creditsUsed} left ›</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-out"
                  style={{ width: `${creditsPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/35">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Daily credits reset at midnight UTC
              </div>
            </div>

            {/* Workspaces list */}
            <div className="mb-2">
              <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-white/30">Workspaces</div>
              <div className="space-y-0.5">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={close}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/80 text-[9px] font-bold text-black">
                      {ws.name[0]}
                    </div>
                    <span className="flex-1 truncate text-xs text-white/70">{ws.name}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40">{ws.plan}</span>
                    {ws.isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setShowCreateModal(true); close() }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-white/20">
                  <Plus className="h-3 w-3 text-white/40" />
                </div>
                <span className="text-xs text-white/50">New workspace</span>
              </button>
            </div>

            {/* Bottom actions */}
            <div className="border-t border-white/10 pt-1 space-y-0.5">
              <Link
                href="/settings"
                onClick={close}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
              >
                <Settings className="h-3.5 w-3.5 text-white/40" />
                <span className="text-xs text-white/60">Settings</span>
              </Link>
              <HelpModal trigger={
                <button
                  type="button"
                  onClick={close}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                  <span className="text-xs text-white/60">Help Center</span>
                </button>
              } />
              <button
                type="button"
                onClick={() => { onOpenPricing?.(); close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
              >
                <CreditCard className="h-3.5 w-3.5 text-white/40" />
                <span className="text-xs text-white/60">My Subscription</span>
              </button>
              <button
                type="button"
                onClick={() => { onSignOut?.(); close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
              >
                <LogOut className="h-3.5 w-3.5 text-white/40" />
                <span className="text-xs text-white/60">Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateWorkspaceModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  )
}

function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111315] p-8 shadow-2xl">
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80">
            <span className="text-xl font-bold text-white">M</span>
          </div>
        </div>

        <h2 className="mb-2 text-center text-xl font-semibold text-white">Create a Workspace</h2>
        <p className="mb-6 text-center text-sm text-white/50">
          Create a new place to make projects or collaborate with others.
        </p>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-white">Workspace name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter workspace name"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-primary/50"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            Go back
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/80 py-2.5 text-sm font-semibold text-white transition hover:from-primary/80 hover:to-[#dc2626] disabled:opacity-40"
          >
            Continue to plan
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
