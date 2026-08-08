import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    const supabase = createSupabaseBrowserClient()
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
