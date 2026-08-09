import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

async function checkAdmin() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!data || data.role !== 'admin') return null
  return user
}

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = params
  const supabase = await createServerClient(true)

  const [userResult, projectsResult, teamsResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('projects').select('id, title, created_at, updated_at', { count: 'exact' }).eq('user_id', userId).is('deleted_at', null),
    supabase.from('team_members').select('team_id, teams(name)', { count: 'exact' }).eq('user_id', userId),
  ])

  if (userResult.error || !userResult.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    user: userResult.data,
    projects: projectsResult.data || [],
    projectCount: projectsResult.count || 0,
    teams: teamsResult.data || [],
    teamCount: teamsResult.count || 0,
  })
}
