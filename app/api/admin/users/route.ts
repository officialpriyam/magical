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

export async function GET(req: Request) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
  const search = url.searchParams.get('search') || ''

  const supabase = await createServerClient(true)

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data || [], total: count || 0 })
}

export async function PATCH(req: Request) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, action, role, creditAction, amount } = body

  if (!userId || !action) {
    return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 })
  }

  const supabase = await createServerClient(true)

  switch (action) {
    case 'ban':
      const { error: banError } = await supabase
        .from('users')
        .update({ banned: true })
        .eq('id', userId)
      if (banError) return NextResponse.json({ error: banError.message }, { status: 500 })
      break

    case 'unban':
      const { error: unbanError } = await supabase
        .from('users')
        .update({ banned: false })
        .eq('id', userId)
      if (unbanError) return NextResponse.json({ error: unbanError.message }, { status: 500 })
      break

    case 'role':
      if (!role || !['user', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const { error: roleError } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId)
      if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })
      break

    case 'credits':
      if (!creditAction || !amount || amount <= 0) {
        return NextResponse.json({ error: 'Invalid credit action or amount' }, { status: 400 })
      }

      const { data: currentUser } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single()

      if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const newCredits = creditAction === 'add'
        ? (currentUser.credits || 0) + amount
        : Math.max(0, (currentUser.credits || 0) - amount)

      const { error: creditError } = await supabase
        .from('users')
        .update({ credits: newCredits })
        .eq('id', userId)

      if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 })
      break

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
