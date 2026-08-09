import 'server-only'

import crypto from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import type { GeneratedFile } from '@/lib/fragment-files'
import type { FileSystemNode } from '@/components/file-tree'
import {
  kvCacheGet,
  kvCacheSet,
  kvCacheDelete,
} from '@/lib/kv-cache'

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
const FILES_TTL_SECONDS = 300
const MAX_CACHE_BYTES = 3 * 1024 * 1024
const STORAGE_REQUEST_TIMEOUT_MS = 3000

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

  await invalidateFilesCache(userId, projectId)
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
  await invalidateFilesCache(userId, projectId)
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
  await invalidateFilesCache(userId, projectId)
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
  await invalidateFilesCache(userId, projectId)
  await touchProjectSandboxStorage(userId, projectId, storageId)

  return { saved: true, storageId }
}

/**
 * Fetch the flat list of files (path + content) from sandbox-storage.
 * Uses a short-lived KV cache to avoid hammering the storage server on
 * every file-tree render.
 */
export async function getProjectFilesFromSandboxStorage({
  userId,
  projectId,
  project,
}: {
  userId: string
  projectId: string
  project?: { id: string; metadata: any } | null
}) {
  if (!hasSandboxStorageConfig()) {
    return []
  }

  const cacheKey = filesCacheKey(userId, projectId)
  const cached = await kvCacheGet<SandboxStorageFile[]>(cacheKey)

  if (cached && Array.isArray(cached)) {
    return cached
  }

  const projectRow = project || await getOwnedProject(userId, projectId)

  if (!projectRow) {
    return []
  }

  const metadata = getSandboxStorageMetadata(projectRow.metadata)
  const storageId = metadata?.storageId

  if (!storageId) {
    return []
  }

  const response = await sandboxStorageFetch(`/v1/workspaces/${encodeURIComponent(storageId)}/files`)
  const files = normalizeSandboxStorageFiles(response.files || [])

  if (countBytes(files) <= MAX_CACHE_BYTES) {
    await kvCacheSet(cacheKey, files, FILES_TTL_SECONDS)
  }

  return files
}

/**
 * Fetch a single file's content from sandbox-storage without
 * pulling the whole file tree.
 */
export async function getProjectFileFromSandboxStorage({
  userId,
  projectId,
  path,
}: {
  userId: string
  projectId: string
  path: string
}): Promise<SandboxStorageFile | null> {
  const normalizedPath = normalizeSandboxStoragePath(path)

  if (!normalizedPath) {
    return null
  }

  const files = await getProjectFilesFromSandboxStorage({ userId, projectId })
  return files.find((file) => file.path === normalizedPath) || null
}

/**
 * Build a FileSystemNode tree (files only, no content) from sandbox-storage
 * so the IDE file-tree renders instantly without loading file contents.
 */
export async function getProjectFileTreeFromSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  if (!hasSandboxStorageConfig()) {
    return []
  }

  const cacheKey = treeCacheKey(userId, projectId)
  const cached = await kvCacheGet<FileSystemNode[]>(cacheKey)

  if (cached && Array.isArray(cached)) {
    return cached
  }

  const files = await getProjectFilesFromSandboxStorage({ userId, projectId })

  if (files.length > 0) {
    const tree = buildFileTree(files)
    await kvCacheSet(cacheKey, tree, FILES_TTL_SECONDS)
    return tree
  }

  return buildFileTree(files)
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
  const encodedBody = body === undefined ? '' : JSON.stringify(body)
  const headers = buildStorageHeaders(method, pathname, encodedBody)
  const attempts = 2

  let lastError: Error | null = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), STORAGE_REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers,
        body: method === 'GET' ? undefined : encodedBody || undefined,
        signal: controller.signal,
      })
    } catch (error: any) {
      clearTimeout(timeout)

      if (error?.name === 'AbortError') {
        lastError = new Error('Sandbox storage request timed out')
      } else {
        lastError = error
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
      }
      continue
    }

    clearTimeout(timeout)

    if (attempt === 0 && response.status >= 500 && attempt < attempts - 1) {
      response.body?.cancel().catch(() => {})
      await new Promise((resolve) => setTimeout(resolve, 250))
      continue
    }

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data?.error || `Sandbox storage request failed with status ${response.status}`)
    }

    return data
  }

  throw lastError || new Error('Sandbox storage request failed')
}

function buildStorageHeaders(method: string, pathname: string, encodedBody: string) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const token = process.env.SANDBOX_STORAGE_TOKEN?.trim()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const accessKey = process.env.SANDBOX_STORAGE_ACCESS_KEY?.trim()
  const accessSalt = process.env.SANDBOX_STORAGE_ACCESS_SALT?.trim()

  if (encodedBody) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessKey && accessSalt) {
    const timestamp = String(Date.now())
    const bodyHash = crypto.createHash('sha256').update(encodedBody || '').digest('hex')
    const payload = `${timestamp}:${method}:${pathname}:${bodyHash}`
    const signature = createStorageSignature(accessKey, accessSalt, payload)

    headers['x-sandbox-storage-key'] = accessKey
    headers['x-sandbox-storage-signature'] = signature
    headers['x-sandbox-storage-timestamp'] = timestamp
    headers['x-request-id'] = crypto.randomUUID()
  }

  return headers
}

function createStorageSignature(accessKey: string, accessSalt: string, payload: string) {
  return crypto.createHmac('sha256', `${accessKey}:${accessSalt}`).update(payload).digest('hex')
}

function getSandboxStorageBaseUrl() {
  const rawUrl = process.env.SANDBOX_STORAGE_URL?.trim().replace(/\/+$/, '')

  if (!rawUrl) {
    throw new Error('SANDBOX_STORAGE_URL is not configured.')
  }

  return normalizeStorageUrl(rawUrl)
}

function normalizeStorageUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value
  }

  return `http://${value}`
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

/**
 * Convert a flat array of files into a FileSystemNode tree sorted with
 * directories first, matching the existing FileTree component contract.
 */
export function buildFileTree(files: SandboxStorageFile[]): FileSystemNode[] {
  const tree: FileSystemNode[] = []
  const nodeMap = new Map<string, FileSystemNode>()

  const paths = Array.from(new Set(files.map((file) => file.path)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  for (const fullPath of paths) {
    const parts = fullPath.split('/').filter(Boolean)

    if (parts.length === 0) continue

    let currentPath = ''

    for (let index = 0; index < parts.length; index++) {
      const name = parts[index]
      currentPath = currentPath ? `${currentPath}/${name}` : name

      if (nodeMap.has(currentPath)) continue

      const isDirectory = index < parts.length - 1
      const node: FileSystemNode = {
        name,
        isDirectory,
        path: `/${currentPath}`,
        ...(isDirectory ? { children: [] } : {}),
      }
      nodeMap.set(currentPath, node)

      const parentKey = index === 0 ? '' : currentPath.slice(0, currentPath.lastIndexOf('/'))
      const parentChildren = parentKey ? nodeMap.get(parentKey)?.children : tree

      if (parentChildren) {
        parentChildren.push(node)
      }
    }
  }

  return sortFileTree(tree)
}

function sortFileTree(nodes: FileSystemNode[]): FileSystemNode[] {
  return nodes
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortFileTree(node.children) : node.children,
    }))
}

function filesCacheKey(userId: string, projectId: string) {
  return `sandbox:storage:files:${userId.slice(0, 12)}:${projectId}`
}

function treeCacheKey(userId: string, projectId: string) {
  return `sandbox:storage:tree:${userId.slice(0, 12)}:${projectId}`
}

async function invalidateFilesCache(userId: string, projectId: string) {
  await Promise.all([
    kvCacheDelete(filesCacheKey(userId, projectId)),
    kvCacheDelete(treeCacheKey(userId, projectId)),
  ])
}

function countBytes(files: SandboxStorageFile[]) {
  let bytes = 0

  for (const file of files) {
    bytes += Buffer.byteLength(file.path, 'utf8') + Buffer.byteLength(file.content, 'utf8')

    if (bytes > MAX_CACHE_BYTES) {
      return bytes
    }
  }

  return bytes
}

function createStorageId(userId: string, projectId: string) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${projectId}:${process.env.SANDBOX_STORAGE_ID_SALT || 'magical'}`)
    .digest('base64url')
    .slice(0, 32)
}