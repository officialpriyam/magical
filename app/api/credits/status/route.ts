import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getCredits, getClaimStatus } from '@/lib/credits'

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const startDate = url.searchParams.get('start') || new Date().toISOString().split('T')[0]
  const endDate = url.searchParams.get('end') || startDate

  const [credits, claims] = await Promise.all([
    getCredits(user.id),
    getClaimStatus(user.id, startDate, endDate),
  ])

  return NextResponse.json({ credits, claims })
}
