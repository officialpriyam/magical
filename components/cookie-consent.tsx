'use client'

import { useState, useEffect } from 'react'
import { X, Cookie } from 'lucide-react'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('magical-cookie-consent')
    if (!consent) {
      setShow(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('magical-cookie-consent', 'accepted')
    setShow(false)
  }

  const decline = () => {
    localStorage.setItem('magical-cookie-consent', 'declined')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#111113] p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f97316]/15">
            <Cookie className="h-5 w-5 text-[#f97316]" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-semibold text-white">We use cookies</h3>
            <p className="text-xs leading-relaxed text-white/50">
              We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts.
              By clicking &quot;Accept&quot;, you consent to our use of cookies.{' '}
              <a href="#" className="text-[#f97316] hover:underline">Learn more</a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('magical-cookie-consent', 'dismissed')
              setShow(false)
            }}
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.08]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 py-2 text-xs font-semibold text-white transition hover:from-[#ea580c] hover:to-[#dc2626]"
          >
            Accept all cookies
          </button>
        </div>
      </div>
    </div>
  )
}
