import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getSupabaseConnectionStatus } from '@/lib/supabase-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    return NextResponse.json(await getSupabaseConnectionStatus(user.id))
  } catch (error) {
    console.error('Failed to read Supabase connection status:', error)
    return NextResponse.json(
      { error: 'Failed to read Supabase connection status' },
      { status: 500 },
    )
  }
}
