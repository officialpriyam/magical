import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/supabase-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side message save route.
 * Uses admin Supabase client (service_role) to bypass RLS.
 * The @supabase/ssr client with service_role doesn't bypass RLS
 * because auth.uid() returns NULL for service_role JWTs.
 * Using @supabase/supabase-js directly bypasses RLS entirely.
 */
export async function POST(request: NextRequest) {
  try {
    // Guard: service_role key must be configured, otherwise RLS blocks the upsert
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[Messages Save] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set — cannot bypass RLS.')
      return NextResponse.json(
        { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is required for message saving.' },
        { status: 503 },
      )
    }

    const { projectId, role, content, objectData, resultData, sequenceNumber } = await request.json()

    if (!projectId || !role || sequenceNumber === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create admin client with service_role to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { error: upsertError } = await adminClient
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

    return NextResponse.json({ saved: true })
  } catch (error) {
    console.error('[Messages Save] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
