import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  getProjectFileFromSandboxStorage,
  getProjectFileTreeFromSandboxStorage,
  getSandboxStorageMetadata,
  hasSandboxStorageConfig,
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
    return NextResponse.json({ files: [] })
  }

  if (!hasSandboxStorageConfig()) {
    return NextResponse.json(
      { error: 'External sandbox storage is not configured', files: [], degraded: true },
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
      : 'Failed to fetch sandbox-storage files'

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