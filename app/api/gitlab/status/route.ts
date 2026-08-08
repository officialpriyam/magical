import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      return NextResponse.json({ connected: false })
    }

    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'gitlab')
      .single()

    if (!data || !data.is_connected) {
      return NextResponse.json({ connected: false })
    }

    const connectionData = data.connection_data as Record<string, unknown> | null

    return NextResponse.json({
      connected: true,
      username: connectionData?.username || null,
      name: connectionData?.name || null,
      avatar_url: connectionData?.avatar_url || null,
      connected_at: connectionData?.connected_at || data.created_at,
      gitlab_host: connectionData?.gitlab_host || 'https://gitlab.com',
    })
  } catch (err) {
    console.error('Failed to read GitLab connection status:', err)
    return NextResponse.json({ connected: false })
  }
}
