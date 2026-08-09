import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { checkAdmin } from '@/lib/admin'

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await context.params
  const supabase = await createServerClient(true)

  const [profileResult, projectsResult, teamsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('projects').select('id, title, created_at, updated_at', { count: 'exact' }).eq('user_id', userId).is('deleted_at', null),
    supabase.from('users_teams').select('team_id, teams(name)', { count: 'exact' }).eq('user_id', userId),
  ])

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    profile: profileResult.data,
    projects: projectsResult.data || [],
    projectCount: projectsResult.count || 0,
    teams: teamsResult.data || [],
    teamCount: teamsResult.count || 0,
  })
}
