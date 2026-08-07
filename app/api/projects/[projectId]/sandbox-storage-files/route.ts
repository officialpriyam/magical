import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  getProjectFilesFromSandboxStorage,
  getSandboxStorageMetadata,
  hasSandboxStorageConfig,
} from '@/lib/sandbox-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  if (!projectId) {
    return NextResponse.json({ error: 'Missing project ID' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, metadata')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (projectError) {
    console.error('Failed to load project for sandbox-storage file listing:', projectError)
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const sandboxStorage = getSandboxStorageMetadata(project.metadata)

  if (!sandboxStorage) {
    return NextResponse.json({ files: [] })
  }

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      { error: 'External sandbox storage is not configured', files: [] },
      { status: 503 },
    )
  }

  try {
    const files = await getProjectFilesFromSandboxStorage({
      userId: user.id,
      projectId,
    })

    const path = req.nextUrl.searchParams.get('path')
    if (path) {
      const match = files.find((file: { path?: string }) => file.path === path)
      if (!match) {
        return NextResponse.json({ error: 'File not found', content: '' }, { status: 404 })
      }
      return NextResponse.json({ content: match.content, path: match.path })
    }

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Failed to list sandbox-storage files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sandbox-storage files', files: [] },
      { status: 500 },
    )
  }
}
