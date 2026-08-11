'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Gift, Check, Lock, Calendar } from 'lucide-react'

interface ClaimStatus {
  claim_date: string
  status: 'claimed' | 'skipped' | 'missed'
}

export default function CreditsPage() {
  const router = useRouter()
  const [credits, setCredits] = useState(0)
  const [claims, setClaims] = useState<ClaimStatus[]>([])
  const [claiming, setClaiming] = useState(false)
  const [message, setMessage] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  useEffect(() => {
    fetchCredits()
  }, [])

  const fetchCredits = async () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

    const res = await fetch(
      `/api/credits/status?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`
    )
    if (res.ok) {
      const data = await res.json()
      setCredits(data.credits)
      setClaims(data.claims)
    }
  }

  const handleClaim = async () => {
    setClaiming(true)
    setMessage('')
    const res = await fetch('/api/credits/claim', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setMessage(data.message)
      if (data.success) {
        setCredits(data.credits)
        fetchCredits()
      }
    }
    setClaiming(false)
  }

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    return { daysInMonth, firstDay }
  }

  const getClaimForDate = (day: number): ClaimStatus | undefined => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return claims.find(c => c.claim_date === dateStr)
  }

  const isToday = (day: number) => {
    return (
      currentMonth.getFullYear() === today.getFullYear() &&
      currentMonth.getMonth() === today.getMonth() &&
      day === today.getDate()
    )
  }

  const isFuture = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return date > today
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const { daysInMonth, firstDay } = getDaysInMonth()
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">Daily Credits</h1>
        </div>

        {/* Credit Balance */}
        <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-sm">Current Balance</p>
              <p className="text-4xl font-bold mt-1">{credits}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-sm">Daily Claim</p>
              <p className="text-2xl font-semibold text-green-400">+50</p>
            </div>
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={handleClaim}
          disabled={claiming || claims.some(c => c.claim_date === todayStr && c.status === 'claimed')}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-white/10 disabled:to-white/10 disabled:text-white/40 text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 mb-6"
        >
          {claiming ? (
            <span>Claiming...</span>
          ) : claims.some(c => c.claim_date === todayStr && c.status === 'claimed') ? (
            <>
              <Check className="h-5 w-5" />
              <span>Already Claimed Today</span>
            </>
          ) : (
            <>
              <Gift className="h-5 w-5" />
              <span>Claim Daily Credits</span>
            </>
          )}
        </button>

        {message && (
          <div className="bg-white/5 rounded-lg p-3 mb-6 text-center text-sm border border-white/10">
            {message}
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg">
              ←
            </button>
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg">
              →
            </button>
          </div>

          {/* Week days header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs text-white/40 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const claim = getClaimForDate(day)
              const today = isToday(day)
              const future = isFuture(day)

              let bgColor = 'bg-transparent'
              let icon = null

              if (claim?.status === 'claimed') {
                bgColor = 'bg-green-500/20'
                icon = <Check className="h-4 w-4 text-green-400" />
              } else if (claim?.status === 'skipped') {
                bgColor = 'bg-yellow-500/20'
                icon = <span className="text-yellow-400 text-xs">Skipped</span>
              } else if (future) {
                bgColor = 'bg-white/5'
                icon = <Lock className="h-3 w-3 text-white/30" />
              } else if (today) {
                bgColor = 'bg-purple-500/20 ring-2 ring-purple-500'
              }

              return (
                <div
                  key={day}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 ${bgColor} ${today ? 'ring-2 ring-purple-500' : ''}`}
                >
                  <span className={`text-sm ${today ? 'font-bold' : ''}`}>{day}</span>
                  {icon}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-white/50">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500/20" />
              <span>Claimed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500/20" />
              <span>Skipped</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-white/5" />
              <span>Locked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
