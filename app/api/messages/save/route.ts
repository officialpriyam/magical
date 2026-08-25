import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side message save route.
 * The client-side save fails because:
 * 1. save_message_and_update_project RPC doesn't exist in Supabase
 * 2. Direct upsert fails with RLS (403) — client can't write to messages table
 *
 * This route uses the server-side Supabase client (service_role) to bypass RLS.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, role, content, objectData, resultData, sequenceNumber } = await request.json()

    if (!projectId || !role || sequenceNumber === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServerClient(true) // service_role bypasses RLS
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Upsert the message (server-side bypasses RLS)
    const { error: upsertError } = await supabase
      .from('messages')
      .upsert(
        {
          project_id: projectId,
          role,
          content,
          object_data: objectData ?? null,
          result_data: resultData ?? null,
          sequence_number: sequenceNumber,
        },
        { onConflict: 'project_id,sequence_number' },
      )

    if (upsertError) {
      console.error('[Messages Save] Upsert failed:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Touch the project's updated_at
    await supabase
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('user_id', user.id)

    return NextResponse.json({ saved: true })
  } catch (error) {
    console.error('[Messages Save] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
