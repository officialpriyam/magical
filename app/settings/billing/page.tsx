'use client'

import { useAuth } from '@/lib/auth'
import { useState } from 'react'
import { Check } from 'lucide-react'

const noop = () => {}

export default function BillingPage() {
  const { session } = useAuth(noop, noop)
  const [creditsUsed] = useState(47)

  const userName = session?.user?.email?.split('@')[0] || 'User'

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      {/* Title */}
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-white">
          {userName}&apos;s Workspace&apos;s plan
        </h1>
      </div>

      {/* Credits used */}
      <div className="mb-8">
        <span className="text-sm text-white/50">{creditsUsed} credits used</span>
      </div>

      {/* Plan cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Free */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-1 text-sm text-white/50">Free</div>
          <div className="mb-4 text-3xl font-semibold text-white">$0</div>
          <button
            type="button"
            disabled
            className="mb-4 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white/50"
          >
            Current plan
          </button>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>50 credits per month</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>Unlimited projects</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>Community support</span>
            </li>
          </ul>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border border-[#1EAEDB]/30 bg-[#1EAEDB]/[0.06] p-5">
          <div className="mb-1 text-sm text-[#1EAEDB]">Pro</div>
          <div className="mb-4 text-3xl font-semibold text-white">$20</div>
          <button
            type="button"
            className="mb-4 w-full rounded-lg bg-[#1EAEDB] px-3 py-2 text-sm font-medium text-black transition hover:bg-[#1EAEDB]/90"
          >
            Upgrade
          </button>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1EAEDB]" />
              <span>500 credits per month</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1EAEDB]" />
              <span>Priority support</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1EAEDB]" />
              <span>Advanced models</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1EAEDB]" />
              <span>Team collaboration</span>
            </li>
          </ul>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-1 text-sm text-white/50">Enterprise</div>
          <div className="mb-4 text-3xl font-semibold text-white">Custom</div>
          <button
            type="button"
            className="mb-4 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1]"
          >
            Contact sales
          </button>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>Unlimited credits</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>Dedicated support</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>Custom integrations</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
              <span>SLA guarantee</span>
            </li>
          </ul>
        </div>
      </div>

      {/* How credits work */}
      <div className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-white">How credits work</h2>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60">
          <p>
            Magical uses a credit system. Each AI interaction consumes credits based on the model and complexity.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>Credits reset monthly on your billing date</li>
            <li>Unused credits do not roll over</li>
            <li>Free plan includes 50 credits/month</li>
            <li>Pro plan includes 500 credits/month</li>
          </ul>
        </div>
      </div>

      {/* Credit usage */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-white">Credit usage</h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-white/60">Credits used this month</span>
            <span className="text-white">47 / 50</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#1EAEDB] transition-all"
              style={{ width: '94%' }}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">3 credits remaining. Resets on Aug 1, 2026.</p>
        </div>
      </div>
    </div>
  )
}
