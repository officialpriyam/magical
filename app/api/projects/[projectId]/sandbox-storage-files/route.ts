import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  deleteProjectFileFromSandboxStorage,
  getProjectFileFromSandboxStorage,
  getProjectFileTreeFromSandboxStorage,
  getRustFSConfigurationError,
  hasSandboxStorageConfig,
  renameProjectFileInSandboxStorage,
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
    console.error('Failed to load project for RustFS file listing:', projectError)
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      {
        error: getRustFSConfigurationError() || 'RustFS storage is not configured for this deployment.',
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
      isTimeout ? 'RustFS request timed out:' : 'Failed to list RustFS files:',
      error,
    )

    const status = isTimeout ? 504 : 500
    const message = isTimeout
      ? 'RustFS storage is taking too long to respond. The storage server may be overloaded or unreachable.'
      : `Failed to fetch RustFS files (${error?.message || error || 'unknown error'})`

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
    source: 'rustfs',
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
 * Save a file directly to RustFS (no live sandbox required)
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

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      { error: getRustFSConfigurationError(), saved: false },
      { status: 503 },
    )
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
    console.error('Failed to save file to RustFS:', error)

    return NextResponse.json(
      {
        error: isTimeout
          ? 'RustFS storage write timed out.'
          : `Failed to save file (${error?.message || 'unknown error'})`,
        saved: false,
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}

export async function DELETE(
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

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      { error: getRustFSConfigurationError(), deleted: false },
      { status: 503 },
    )
  }

  try {
    const { path: filePath } = await req.json()

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Missing file path', deleted: false }, { status: 400 })
    }

    const result = await raceWithTimeout(
      deleteProjectFileFromSandboxStorage({
        userId: user.id,
        projectId,
        path: filePath,
      }),
      7000,
      'sandbox_storage_delete_timeout',
    )

    return NextResponse.json({ deleted: result.saved, path: filePath })
  } catch (error: any) {
    const isTimeout = /timeout/i.test(String(error?.message || ''))
    console.error('Failed to delete file from RustFS:', error)

    return NextResponse.json(
      {
        error: isTimeout
          ? 'RustFS storage delete timed out.'
          : `Failed to delete file (${error?.message || 'unknown error'})`,
        deleted: false,
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}

export async function PATCH(
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

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      { error: getRustFSConfigurationError(), renamed: false },
      { status: 503 },
    )
  }

  try {
    const { oldPath, newPath } = await req.json()

    if (!oldPath || !newPath || typeof oldPath !== 'string' || typeof newPath !== 'string') {
      return NextResponse.json({ error: 'Missing old path or new path', renamed: false }, { status: 400 })
    }

    const result = await raceWithTimeout(
      renameProjectFileInSandboxStorage({
        userId: user.id,
        projectId,
        oldPath,
        newPath,
      }),
      7000,
      'sandbox_storage_rename_timeout',
    )

    return NextResponse.json({ renamed: result.saved, oldPath, newPath })
  } catch (error: any) {
    const isTimeout = /timeout/i.test(String(error?.message || ''))
    console.error('Failed to rename file in RustFS:', error)

    return NextResponse.json(
      {
        error: isTimeout
          ? 'RustFS storage rename timed out.'
          : `Failed to rename file (${error?.message || 'unknown error'})`,
        renamed: false,
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}
