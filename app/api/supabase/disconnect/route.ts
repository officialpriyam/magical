import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import {
  disconnectSupabase,
  getSupabaseConnectionStatus,
} from '@/lib/supabase-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    await disconnectSupabase(user.id)
    return NextResponse.json(await getSupabaseConnectionStatus(user.id))
  } catch (error) {
    console.error('Failed to disconnect Supabase:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Supabase' },
      { status: 500 },
    )
  }
}
