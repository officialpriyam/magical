import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { supabaseServiceRoleKey } from '@/lib/supabase-credentials'
import { ensureProjectSandboxStorage } from '@/lib/sandbox-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function describeProjectCreateError(error: any) {
  const code = error?.code
  const message = error?.message || ''

  if (code === 'PGRST205' || code === '42P01' || /schema cache|relation .* does not exist|could not find the table/i.test(message)) {
    return 'Supabase table public.projects is missing. Run supabase/migrations/20250103000000_ensure_chat_core_tables.sql in Supabase.'
  }

  if (code === '42501' || /permission denied|row-level security|violates row-level security/i.test(message)) {
    return 'Supabase denied creating the chat project. Run the project RLS/grants migration and make sure the user is signed in.'
  }

  if (code === '23503') {
    return 'Supabase rejected the chat project because the authenticated user or team reference is invalid.'
  }

  return message || 'Failed to create chat project.'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in before creating a chat.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const title =
      typeof body.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : 'New Chat'
    const templateId =
      typeof body.templateId === 'string' && body.templateId.trim().length > 0
        ? body.templateId.trim()
        : null

    const writeSupabase = supabaseServiceRoleKey
      ? await createServerClient(true)
      : supabase

    const { data: project, error } = await writeSupabase
      .from('projects')
      .insert({
        user_id: user.id,
        title,
        template_id: templateId,
        status: 'active',
        is_public: false,
        metadata: {},
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed to create chat project:', error)
      return NextResponse.json(
        {
          error: describeProjectCreateError(error),
          code: error.code,
          details: error.message,
        },
        { status: 500 },
      )
    }

    try {
      await ensureProjectSandboxStorage({
        userId: user.id,
        projectId: project.id,
      })
    } catch (storageError) {
      console.warn('Failed to create external sandbox storage workspace:', storageError)
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Unexpected project creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create chat project.' },
      { status: 500 },
    )
  }
}
