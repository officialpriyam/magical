import { createServerClient } from '@/lib/supabase-server'

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return data.role === 'admin'
}

export async function getAdminUser() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = await isAdmin(user.id)
  if (!admin) return null

  return user
}

export async function getAllUsers(page = 1, pageSize = 20, search = '') {
  const supabase = await createServerClient(true)

  let query = supabase
    .from('user_profiles')
    .select('*', { count: 'exact' })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) throw error
  return { users: data || [], total: count || 0 }
}

export async function getUserDetails(userId: string) {
  const supabase = await createServerClient(true)

  const [profileResult, projectsResult, teamsResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('projects').select('id, title, created_at, updated_at', { count: 'exact' }).eq('user_id', userId).is('deleted_at', null),
    supabase.from('users_teams').select('team_id, teams(name)', { count: 'exact' }).eq('user_id', userId),
  ])

  return {
    profile: profileResult.data,
    projects: projectsResult.data || [],
    projectCount: projectsResult.count || 0,
    teams: teamsResult.data || [],
    teamCount: teamsResult.count || 0,
  }
}

export async function banUser(userId: string) {
  const supabase = await createServerClient(true)
  const { error } = await supabase
    .from('user_profiles')
    .update({ banned: true })
    .eq('user_id', userId)

  if (error) throw error
}

export async function unbanUser(userId: string) {
  const supabase = await createServerClient(true)
  const { error } = await supabase
    .from('user_profiles')
    .update({ banned: false })
    .eq('user_id', userId)

  if (error) throw error
}

export async function addCredits(userId: string, amount: number) {
  const supabase = await createServerClient(true)
  const { error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
  })

  if (error) throw error
}

export async function deductCredits(userId: string, amount: number) {
  const supabase = await createServerClient(true)
  const { error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
  })

  if (error) throw error
}

export async function getSiteSettings() {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || { discord_link: '', support_email: '' }
}

export async function updateSiteSettings(settings: { discord_link?: string; support_email?: string }) {
  const supabase = await createServerClient(true)
  const { error } = await supabase
    .from('site_settings')
    .upsert(settings, { onConflict: 'id' })

  if (error) throw error
}

export async function getUserTokenUsage(userId: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('token_usage')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw error
  return data || []
}
