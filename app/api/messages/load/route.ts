import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/supabase-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side message load route.
 * Uses admin Supabase client (service_role) to bypass RLS,
 * ensuring messages are reliably loaded when a project is reopened.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is required.' },
        { status: 503 },
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await adminClient
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: true })

    if (error) {
      console.error('[Messages Load] Query failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    console.error('[Messages Load] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
