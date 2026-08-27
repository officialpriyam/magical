import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { deleteProjectSandboxStorage } from '@/lib/sandbox-storage'

export const runtime = 'nodejs'

/** Purges durable objects only after authenticating ownership on the backend. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Sign in before deleting project storage.' }, { status: 401 })

    const result = await deleteProjectSandboxStorage({ userId: user.id, projectId })
    if (!result.deleted && result.reason !== 'not_configured') {
      return NextResponse.json({ error: 'Project storage could not be deleted.', details: result.reason }, { status: 404 })
    }
    return NextResponse.json({ deleted: result.deleted })
  } catch (error: any) {
    console.error('[RustFS] project storage deletion failed:', error?.message || error)
    return NextResponse.json({ error: 'Project storage deletion failed.', details: error?.message }, { status: 503 })
  }
}
