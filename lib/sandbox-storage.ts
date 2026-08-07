import 'server-only'

import crypto from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import type { GeneratedFile } from '@/lib/fragment-files'

export type SandboxStorageFile = {
  path: string
  content: string
}

export type SandboxStorageMetadata = {
  provider: 'sandbox-storage'
  storageId: string
  url: string
  savedAt: string
  fileCount: number
}

type OwnedProject = {
  id: string
  metadata?: Record<string, any> | null
}

type SandboxStorageResult =
  | { saved: true; storageId: string; fileCount?: number }
  | { saved: false; reason: string }

const MAX_SANDBOX_STORAGE_FILES = 1000
const MAX_SANDBOX_STORAGE_FILE_BYTES = 1024 * 1024

export function hasSandboxStorageConfig() {
  return Boolean(process.env.SANDBOX_STORAGE_URL?.trim())
}

export function getSandboxStorageMetadata(metadata: any): SandboxStorageMetadata | null {
  const workspace = metadata?.sandboxStorage

  if (
    !workspace ||
    typeof workspace !== 'object' ||
    workspace.provider !== 'sandbox-storage' ||
    typeof workspace.storageId !== 'string'
  ) {
    return null
  }

  return {
    provider: 'sandbox-storage',
    storageId: workspace.storageId,
    url: typeof workspace.url === 'string' ? workspace.url : getSandboxStorageBaseUrl(),
    savedAt: typeof workspace.savedAt === 'string' ? workspace.savedAt : new Date().toISOString(),
    fileCount: typeof workspace.fileCount === 'number' ? workspace.fileCount : 0,
  }
}

export async function ensureProjectSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  if (!hasSandboxStorageConfig()) {
    return null
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return null
  }

  const existing = getSandboxStorageMetadata(project.metadata)
  const storageId = existing?.storageId || createStorageId(userId, projectId)
  const response = await sandboxStorageFetch('/v1/workspaces', {
    method: 'POST',
    body: {
      storageId,
      userId,
      projectId,
    },
  })

  await saveSandboxStorageMetadata(userId, projectId, project.metadata, {
    provider: 'sandbox-storage',
    storageId: response.storageId || storageId,
    url: getSandboxStorageBaseUrl(),
    savedAt: new Date().toISOString(),
    fileCount: existing?.fileCount || 0,
  })

  return response.storageId || storageId
}

export async function saveProjectFilesToSandboxStorage({
  userId,
  projectId,
  files,
}: {
  userId: string
  projectId: string
  files: Array<GeneratedFile | SandboxStorageFile>
}): Promise<SandboxStorageResult> {
  if (!hasSandboxStorageConfig()) {
    return { saved: false, reason: 'not_configured' }
  }

  const storageId = await ensureProjectSandboxStorage({ userId, projectId })

  if (!storageId) {
    return { saved: false, reason: 'not_found' }
  }

  const normalizedFiles = normalizeSandboxStorageFiles(files)

  if (normalizedFiles.length === 0) {
    return { saved: false, reason: 'empty' }
  }

  const response = await sandboxStorageFetch(`/v1/workspaces/${encodeURIComponent(storageId)}/files/batch`, {
    method: 'PUT',
    body: { files: normalizedFiles },
  })

  await touchProjectSandboxStorage(userId, projectId, storageId, response.fileCount || normalizedFiles.length)

  return {
    saved: true,
    storageId,
    fileCount: response.fileCount || normalizedFiles.length,
  }
}

export async function saveProjectFileToSandboxStorage({
  userId,
  projectId,
  path,
  content,
}: {
  userId: string
  projectId: string
  path: string
  content: string
}): Promise<SandboxStorageResult> {
  if (!hasSandboxStorageConfig()) {
    return { saved: false, reason: 'not_configured' }
  }

  const storageId = await ensureProjectSandboxStorage({ userId, projectId })

  if (!storageId) {
    return { saved: false, reason: 'not_found' }
  }

  const file = normalizeSandboxStorageFile({ path, content })

  if (!file) {
    return { saved: false, reason: 'invalid_file' }
  }

  await sandboxStorageFetch(`/v1/workspaces/${encodeURIComponent(storageId)}/files`, {
    method: 'PUT',
    body: file,
  })
  await touchProjectSandboxStorage(userId, projectId, storageId)

  return { saved: true, storageId, fileCount: 1 }
}

export async function deleteProjectFileFromSandboxStorage({
  userId,
  projectId,
  path,
}: {
  userId: string
  projectId: string
  path: string
}): Promise<SandboxStorageResult> {
  if (!hasSandboxStorageConfig()) {
    return { saved: false, reason: 'not_configured' }
  }

  const storageId = await ensureProjectSandboxStorage({ userId, projectId })

  if (!storageId) {
    return { saved: false, reason: 'not_found' }
  }

  await sandboxStorageFetch(`/v1/workspaces/${encodeURIComponent(storageId)}/files`, {
    method: 'DELETE',
    body: { path },
  })
  await touchProjectSandboxStorage(userId, projectId, storageId)

  return { saved: true, storageId }
}

export async function renameProjectFileInSandboxStorage({
  userId,
  projectId,
  oldPath,
  newPath,
}: {
  userId: string
  projectId: string
  oldPath: string
  newPath: string
}): Promise<SandboxStorageResult> {
  if (!hasSandboxStorageConfig()) {
    return { saved: false, reason: 'not_configured' }
  }

  const storageId = await ensureProjectSandboxStorage({ userId, projectId })

  if (!storageId) {
    return { saved: false, reason: 'not_found' }
  }

  await sandboxStorageFetch(`/v1/workspaces/${encodeURIComponent(storageId)}/files`, {
    method: 'PATCH',
    body: { oldPath, newPath },
  })
  await touchProjectSandboxStorage(userId, projectId, storageId)

  return { saved: true, storageId }
}

export async function getProjectFilesFromSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  if (!hasSandboxStorageConfig()) {
    return []
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return []
  }

  const metadata = getSandboxStorageMetadata(project.metadata)
  const storageId = metadata?.storageId

  if (!storageId) {
    return []
  }

  const response = await sandboxStorageFetch(`/v1/workspaces/${encodeURIComponent(storageId)}/files`)
  return normalizeSandboxStorageFiles(response.files || [])
}

async function getOwnedProject(userId: string, projectId: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('projects')
    .select('id, metadata')
    .eq('id', projectId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as OwnedProject | null
}

async function saveSandboxStorageMetadata(
  userId: string,
  projectId: string,
  currentMetadata: Record<string, any> | null | undefined,
  sandboxStorage: SandboxStorageMetadata,
) {
  const metadata = currentMetadata && typeof currentMetadata === 'object'
    ? currentMetadata
    : {}
  const supabase = await createServerClient(true)
  const { error } = await supabase
    .from('projects')
    .update({
      metadata: {
        ...metadata,
        sandboxStorage,
      },
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

async function touchProjectSandboxStorage(
  userId: string,
  projectId: string,
  storageId: string,
  fileCount = 0,
) {
  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return
  }

  const existing = getSandboxStorageMetadata(project.metadata)
  await saveSandboxStorageMetadata(userId, projectId, project.metadata, {
    provider: 'sandbox-storage',
    storageId,
    url: getSandboxStorageBaseUrl(),
    savedAt: new Date().toISOString(),
    fileCount: fileCount || existing?.fileCount || 0,
  })
}

async function sandboxStorageFetch(
  pathname: string,
  {
    method = 'GET',
    body,
  }: {
    method?: string
    body?: unknown
  } = {},
) {
  const baseUrl = getSandboxStorageBaseUrl()
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const token = process.env.SANDBOX_STORAGE_TOKEN?.trim()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  let response: Response
  try {
    response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Sandbox storage request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error || `Sandbox storage request failed with status ${response.status}`)
  }

  return data
}

function getSandboxStorageBaseUrl() {
  const url = process.env.SANDBOX_STORAGE_URL?.trim().replace(/\/+$/, '')

  if (!url) {
    throw new Error('SANDBOX_STORAGE_URL is not configured.')
  }

  return url
}

function normalizeSandboxStorageFiles(files: Array<GeneratedFile | SandboxStorageFile>) {
  const byPath = new Map<string, SandboxStorageFile>()

  for (const file of files) {
    const normalized = normalizeSandboxStorageFile(file)

    if (!normalized) continue

    byPath.set(normalized.path, normalized)

    if (byPath.size >= MAX_SANDBOX_STORAGE_FILES) break
  }

  return Array.from(byPath.values())
}

function normalizeSandboxStorageFile(file: GeneratedFile | SandboxStorageFile) {
  const path = normalizeSandboxStoragePath(file.path)
  const content = typeof file.content === 'string' ? file.content : ''

  if (!path) {
    return null
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_SANDBOX_STORAGE_FILE_BYTES) {
    return null
  }

  return { path, content }
}

function normalizeSandboxStoragePath(value: unknown) {
  if (typeof value !== 'string') return ''

  const path = value
    .replace(/\\/g, '/')
    .replace(/^\/?home\/user\/?/, '')
    .replace(/^\/?vercel\/sandbox\/?/, '')
    .replace(/^\/+/, '')
    .trim()
  const parts = path.split('/').filter(Boolean)

  if (
    parts.length === 0 ||
    parts.some((part) => part === '.' || part === '..' || part.includes('\0'))
  ) {
    return ''
  }

  const normalizedPath = parts.join('/')

  if (/(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/.test(normalizedPath)) {
    return ''
  }

  return normalizedPath
}

function createStorageId(userId: string, projectId: string) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${projectId}:${process.env.SANDBOX_STORAGE_ID_SALT || 'magical'}`)
    .digest('base64url')
    .slice(0, 32)
}
