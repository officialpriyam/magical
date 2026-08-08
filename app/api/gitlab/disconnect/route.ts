import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    await supabase
      .from('user_integrations')
      .update({ is_connected: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('service_name', 'gitlab')

    return NextResponse.json({ connected: false })
  } catch (err) {
    console.error('Failed to disconnect GitLab:', err)
    return NextResponse.json({ error: 'Failed to disconnect GitLab' }, { status: 500 })
  }
}
