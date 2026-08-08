import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  getProjectFileFromSandboxStorage,
  getProjectFileTreeFromSandboxStorage,
  getSandboxStorageMetadata,
  hasSandboxStorageConfig,
  saveProjectFileToSandboxStorage,
} from '@/lib/sandbox-storage'
import type { FileSystemNode } from '@/components/file-tree'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 8

const SLOW_STORAGE_THRESHOLD_MS = 1500

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  if (!projectId) {
    return NextResponse.json({ error: 'Missing project ID' }, { status: 400 })
  }

  const startedAt = performance.now()
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
    return NextResponse.json({
      files: [],
      degraded: true,
      error: 'This project has not been saved to external sandbox storage yet. Files are only listed once they are saved.',
    })
  }

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      {
        error: 'External sandbox storage is not configured for this deployment.',
        files: [],
        degraded: true,
      },
      { status: 503 },
    )
  }

  const path = req.nextUrl.searchParams.get('path')

  try {
    if (path) {
      return await handleFileContent(user.id, projectId, path, startedAt)
    }

    return await handleFileTree(user.id, projectId, startedAt)
  } catch (error: any) {
    const isTimeout = /timeout/i.test(String(error?.message || ''))
    console.error(
      isTimeout ? 'Sandbox-storage request timed out:' : 'Failed to list sandbox-storage files:',
      error,
    )

    const status = isTimeout ? 504 : 500
    const message = isTimeout
      ? 'Sandbox storage is taking too long to respond. The storage server may be overloaded or unreachable.'
      : `Failed to fetch sandbox-storage files (${error?.message || error || 'unknown error'})`

    return NextResponse.json(
      {
        error: message,
        files: [],
        degraded: true,
      },
      { status },
    )
  }
}

async function handleFileContent(userId: string, projectId: string, path: string, startedAt: number) {
  const file = await raceWithTimeout(
    getProjectFileFromSandboxStorage({ userId, projectId, path }),
    7000,
    'sandbox_storage_read_timeout',
  )

  if (!file) {
    return NextResponse.json({ error: 'File not found', content: '' }, { status: 404 })
  }

  return NextResponse.json(
    { content: file.content, path: file.path, latencyMs: Math.round(performance.now() - startedAt) },
    { status: 200 },
  )
}

async function handleFileTree(userId: string, projectId: string, startedAt: number) {
  const files = await raceWithTimeout<FileSystemNode[]>(
    getProjectFileTreeFromSandboxStorage({ userId, projectId }),
    7000,
    'sandbox_storage_list_timeout',
  )

  const latencyMs = Math.round(performance.now() - startedAt)

  return NextResponse.json({
    files,
    latencyMs,
    slow: latencyMs > SLOW_STORAGE_THRESHOLD_MS,
    source: 'sandbox-storage',
  }, { status: 200 })
}

function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(reason)), timeoutMs),
    ),
  ])
}

/**
 * POST /api/projects/[projectId]/sandbox-storage-files
 * Save a file directly to sandbox-storage (no live sandbox required)
 */
export async function POST(
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

  try {
    const { path: filePath, content } = await req.json()

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing file path or content' }, { status: 400 })
    }

    const result = await raceWithTimeout(
      saveProjectFileToSandboxStorage({
        userId: user.id,
        projectId,
        path: filePath,
        content,
      }),
      7000,
      'sandbox_storage_write_timeout',
    )

    return NextResponse.json({ saved: result.saved, path: filePath })
  } catch (error: any) {
    const isTimeout = /timeout/i.test(String(error?.message || ''))
    console.error('Failed to save file to sandbox-storage:', error)

    return NextResponse.json(
      {
        error: isTimeout
          ? 'Sandbox storage write timed out.'
          : `Failed to save file (${error?.message || 'unknown error'})`,
        saved: false,
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}