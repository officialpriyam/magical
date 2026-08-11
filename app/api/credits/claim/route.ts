import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { claimDailyCredit } from '@/lib/credits'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await claimDailyCredit(user.id)
  return NextResponse.json(result)
}
