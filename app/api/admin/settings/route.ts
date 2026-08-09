import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { checkAdmin } from '@/lib/admin'

export async function GET() {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || { discord_link: '', support_email: '' })
}

export async function PUT(req: Request) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const supabase = await createServerClient(true)

  const { error } = await supabase
    .from('site_settings')
    .upsert({
      id: 1,
      discord_link: body.discord_link || '',
      support_email: body.support_email || '',
    }, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
