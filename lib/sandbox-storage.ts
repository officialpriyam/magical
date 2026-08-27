import 'server-only'

import crypto from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createServerClient } from '@/lib/supabase-server'
import type { GeneratedFile } from '@/lib/fragment-files'
import type { FileSystemNode } from '@/components/file-tree'
import { kvCacheDelete, kvCacheGet, kvCacheSet } from '@/lib/kv-cache'

export type SandboxStorageFile = {
  path: string
  content: string
}

export type SandboxStorageMetadata = {
  provider: 'rustfs'
  bucket: string
  keyPrefix: string
  storageId: string
  manifestKey: string
  manifest?: ProjectManifest
  savedAt: string
  fileCount: number
}

type OwnedProject = {
  id: string
  metadata?: Record<string, any> | null
}

type Result =
  | { saved: true; storageId: string; fileCount?: number }
  | { saved: false; reason: string }

export type ProjectManifest = {
  version: 1
  provider: 'rustfs'
  storageId: string
  ownerUserId: string
  projectId: string
  fileCount: number
  createdAt: string
  updatedAt: string
  files: Array<{ path: string; sizeBytes: number }>
}

const MAX_FILES = 1000
const MAX_FILE_BYTES = 1024 * 1024
const CACHE_TTL = 300
const MAX_CACHE_BYTES = 3 * 1024 * 1024
const PROJECT_MANIFEST = '.project.json'
const FILES_PREFIX = 'files/'

let s3: S3Client | null = null

export function getRustFSConfigurationError() {
  const missing = [
    'RUSTFS_ENDPOINT',
    'RUSTFS_ACCESS_KEY',
    'RUSTFS_SECRET_KEY',
    'RUSTFS_BUCKET',
  ].filter((key) => !process.env[key]?.trim())

  return missing.length
    ? `RustFS storage is not configured. Missing: ${missing.join(', ')}.`
    : null
}

export function hasSandboxStorageConfig() {
  return !getRustFSConfigurationError()
}

export function getSandboxStorageMetadata(metadata: any): SandboxStorageMetadata | null {
  const value = metadata?.sandboxStorage

  if (
    !value ||
    typeof value !== 'object' ||
    value.provider !== 'rustfs' ||
    typeof value.bucket !== 'string' ||
    typeof value.keyPrefix !== 'string'
  ) {
    return null
  }

  const cleanPrefix = normalizePrefix(value.keyPrefix)
  const storageId = typeof value.storageId === 'string' && value.storageId.trim()
    ? value.storageId.trim()
    : storageIdFromPrefix(cleanPrefix)

  if (!cleanPrefix || !storageId) {
    return null
  }

  return {
    provider: 'rustfs',
    bucket: value.bucket,
    keyPrefix: cleanPrefix,
    storageId,
    manifestKey: typeof value.manifestKey === 'string'
      ? value.manifestKey
      : `${cleanPrefix}${PROJECT_MANIFEST}`,
    manifest: isProjectManifestShape(value.manifest) ? value.manifest : undefined,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
    fileCount: typeof value.fileCount === 'number' ? value.fileCount : 0,
  }
}

export async function ensureProjectSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  if (!hasSandboxStorageConfig()) return null

  const project = await ownedProject(userId, projectId)
  if (!project) return null

  const workspace = workspaceFor(userId, projectId, 0)
  const manifest = await readProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    allowMissing: true,
  })

  if (!manifest) {
    const emptyManifest = await writeProjectManifest(workspace.bucket, workspace.keyPrefix, {
      userId,
      projectId,
      storageId: workspace.storageId,
      files: [],
    })
    await saveMetadata(userId, projectId, project.metadata, workspace, emptyManifest)
    return workspace.storageId
  }

  await saveMetadata(userId, projectId, project.metadata, workspace, manifest)
  return workspace.storageId
}

export async function saveProjectFilesToSandboxStorage({
  userId,
  projectId,
  files,
}: {
  userId: string
  projectId: string
  files: Array<GeneratedFile | SandboxStorageFile>
}): Promise<Result> {
  if (!hasSandboxStorageConfig()) return { saved: false, reason: 'not_configured' }

  const project = await ownedProject(userId, projectId)
  if (!project) return { saved: false, reason: 'not_found' }

  const nextFiles = normalizeFiles(files)
  if (nextFiles.length === 0) return { saved: false, reason: 'empty' }

  const workspace = workspaceFor(userId, projectId, nextFiles.length)
  const dbManifest = getSandboxStorageMetadata(project.metadata)?.manifest
  if (dbManifest && !isValidManifest(dbManifest, userId, projectId, workspace.storageId)) {
    throw new Error('RustFS DB manifest ownership mismatch')
  }

  const priorManifest = await readProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    allowMissing: true,
  })
  if (!priorManifest && dbManifest) {
    throw new Error('RustFS .project.json is missing while DB manifest exists')
  }

  await Promise.all(nextFiles.map(async (file) => {
    await putFile(workspace.bucket, workspace.keyPrefix, file)
    await verify(workspace.bucket, fileKey(workspace.keyPrefix, file.path))
  }))

  const nextManifest = await writeProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    storageId: workspace.storageId,
    files: nextFiles,
    createdAt: priorManifest?.createdAt,
  })

  await saveMetadata(userId, projectId, project.metadata, workspaceFor(userId, projectId, nextFiles.length), nextManifest)
  await invalidate(userId, projectId)

  const nextPaths = new Set(nextFiles.map((file) => file.path))
  await Promise.all((priorManifest?.files || [])
    .filter(({ path }) => !nextPaths.has(path))
    .map(({ path }) =>
      s3Client().send(new DeleteObjectCommand({
        Bucket: workspace.bucket,
        Key: fileKey(workspace.keyPrefix, path),
      })),
    ))

  console.info('[RustFS] project files uploaded', {
    projectId,
    storageId: workspace.storageId,
    fileCount: nextFiles.length,
  })

  return { saved: true, storageId: workspace.storageId, fileCount: nextFiles.length }
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
}): Promise<Result> {
  const file = normalizeFile({ path, content })
  if (!file) return { saved: false, reason: 'invalid_file' }
  if (!hasSandboxStorageConfig()) return { saved: false, reason: 'not_configured' }

  const project = await ownedProject(userId, projectId)
  if (!project) return { saved: false, reason: 'not_found' }

  const workspace = workspaceFor(userId, projectId, 0)
  const dbManifest = getSandboxStorageMetadata(project.metadata)?.manifest
  if (dbManifest && !isValidManifest(dbManifest, userId, projectId, workspace.storageId)) {
    throw new Error('RustFS DB manifest ownership mismatch')
  }

  const manifest = await readProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    allowMissing: true,
  })
  if (!manifest && dbManifest) {
    throw new Error('RustFS .project.json is missing while DB manifest exists')
  }

  await putFile(workspace.bucket, workspace.keyPrefix, file)
  await verify(workspace.bucket, fileKey(workspace.keyPrefix, file.path))

  const paths = new Set((manifest?.files || []).map(({ path }) => path))
  paths.add(file.path)
  const allFiles = await readFiles(workspace.bucket, workspace.keyPrefix, [...paths])

  const nextManifest = await writeProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    storageId: workspace.storageId,
    files: allFiles,
    createdAt: manifest?.createdAt,
  })

  await saveMetadata(userId, projectId, project.metadata, workspaceFor(userId, projectId, allFiles.length), nextManifest)
  await invalidate(userId, projectId)

  console.info('[RustFS] file uploaded', {
    projectId,
    storageId: workspace.storageId,
    path: file.path,
  })

  return { saved: true, storageId: workspace.storageId, fileCount: 1 }
}

export async function deleteProjectFileFromSandboxStorage({
  userId,
  projectId,
  path,
}: {
  userId: string
  projectId: string
  path: string
}): Promise<Result> {
  const cleanPath = normalizePath(path)
  if (!cleanPath) return { saved: false, reason: 'invalid_file' }
  if (!hasSandboxStorageConfig()) return { saved: false, reason: 'not_configured' }

  const project = await ownedProject(userId, projectId)
  if (!project) return { saved: false, reason: 'not_found' }

  const workspace = workspaceFor(userId, projectId, 0)
  const dbManifest = getSandboxStorageMetadata(project.metadata)?.manifest
  if (dbManifest && !isValidManifest(dbManifest, userId, projectId, workspace.storageId)) {
    throw new Error('RustFS DB manifest ownership mismatch')
  }

  const manifest = await readProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    allowMissing: true,
  })
  if (!manifest && dbManifest) {
    throw new Error('RustFS .project.json is missing while DB manifest exists')
  }

  const existing = manifest?.files || []
  const removed = existing.filter(({ path }) => path === cleanPath || path.startsWith(`${cleanPath}/`))
  const kept = existing.filter(({ path }) => !removed.some((file) => file.path === path))
  const keptFiles = await readFiles(workspace.bucket, workspace.keyPrefix, kept.map(({ path }) => path))

  const nextManifest = await writeProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    storageId: workspace.storageId,
    files: keptFiles,
    createdAt: manifest?.createdAt,
  })

  await Promise.all(removed.map(({ path }) =>
    s3Client().send(new DeleteObjectCommand({
      Bucket: workspace.bucket,
      Key: fileKey(workspace.keyPrefix, path),
    })),
  ))

  await saveMetadata(userId, projectId, project.metadata, workspaceFor(userId, projectId, keptFiles.length), nextManifest)
  await invalidate(userId, projectId)

  console.info('[RustFS] file deleted', {
    projectId,
    storageId: workspace.storageId,
    path: cleanPath,
  })

  return { saved: true, storageId: workspace.storageId, fileCount: removed.length }
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
}): Promise<Result> {
  const oldClean = normalizePath(oldPath)
  const newClean = normalizePath(newPath)

  if (!oldClean || !newClean) return { saved: false, reason: 'invalid_file' }

  const files = await getProjectFilesFromSandboxStorage({ userId, projectId })
  const matching = files.filter(({ path }) => path === oldClean || path.startsWith(`${oldClean}/`))

  if (matching.length === 0) return { saved: false, reason: 'not_found' }

  const renamed = files.map((file) =>
    matching.some((match) => match.path === file.path)
      ? { ...file, path: `${newClean}${file.path.slice(oldClean.length)}` }
      : file,
  )

  return saveProjectFilesToSandboxStorage({ userId, projectId, files: renamed })
}

export async function getProjectFilesFromSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
  project?: { id: string; metadata: any } | null
}) {
  if (!hasSandboxStorageConfig()) return []

  const project = await ownedProject(userId, projectId)
  if (!project) return []

  const workspace = workspaceFor(userId, projectId, 0)
  const dbManifest = getSandboxStorageMetadata(project.metadata)?.manifest
  if (dbManifest && !isValidManifest(dbManifest, userId, projectId, workspace.storageId)) {
    throw new Error('RustFS DB manifest ownership mismatch')
  }

  const manifest = await readProjectManifest(workspace.bucket, workspace.keyPrefix, {
    userId,
    projectId,
    allowMissing: true,
  })

  if (!manifest) return []

  if (dbManifest && dbManifest.updatedAt !== manifest.updatedAt) {
    throw new Error('RustFS DB manifest is out of sync with .project.json')
  }

  if (!dbManifest) {
    await saveMetadata(userId, projectId, project.metadata, workspaceFor(userId, projectId, manifest.fileCount), manifest)
  }

  const cacheKey = filesKey(userId, projectId)
  const cached = await kvCacheGet<SandboxStorageFile[]>(cacheKey)
  if (cached && Array.isArray(cached)) return cached

  const files = await readFiles(
    workspace.bucket,
    workspace.keyPrefix,
    manifest.files.map(({ path }) => path),
  )

  if (bytes(files) <= MAX_CACHE_BYTES) {
    await kvCacheSet(cacheKey, files, CACHE_TTL)
  }

  console.info('[RustFS] project files downloaded', {
    projectId,
    storageId: workspace.storageId,
    fileCount: files.length,
  })

  return files
}

export async function getProjectFileFromSandboxStorage(args: {
  userId: string
  projectId: string
  path: string
}) {
  const path = normalizePath(args.path)
  if (!path) return null

  return (await getProjectFilesFromSandboxStorage(args)).find((file) => file.path === path) || null
}

export async function getProjectFileTreeFromSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  const cacheKey = treeKey(userId, projectId)
  const files = await getProjectFilesFromSandboxStorage({ userId, projectId })
  const cached = await kvCacheGet<FileSystemNode[]>(cacheKey)
  if (cached && Array.isArray(cached) && cached.length > 0) return cached

  const tree = buildFileTree(files)
  await kvCacheSet(cacheKey, tree, CACHE_TTL)
  return tree
}

export async function deleteProjectSandboxStorage({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  if (!hasSandboxStorageConfig()) return { deleted: false, reason: 'not_configured' }

  const project = await ownedProject(userId, projectId)
  if (!project) return { deleted: false, reason: 'not_found' }

  const workspace = workspaceFor(userId, projectId, 0)
  const keys = await listKeys(workspace.bucket, workspace.keyPrefix)

  await Promise.all(keys.map((Key) =>
    s3Client().send(new DeleteObjectCommand({ Bucket: workspace.bucket, Key })),
  ))
  await invalidate(userId, projectId)

  console.info('[RustFS] project deleted', {
    projectId,
    storageId: workspace.storageId,
    objectCount: keys.length,
  })

  return { deleted: true }
}

export function buildFileTree(files: SandboxStorageFile[]): FileSystemNode[] {
  const roots: FileSystemNode[] = []
  const nodes = new Map<string, FileSystemNode>()

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    let children = roots
    let fullPath = ''

    file.path.split('/').forEach((name, index, parts) => {
      fullPath = fullPath ? `${fullPath}/${name}` : name
      let node = nodes.get(fullPath)

      if (!node) {
        node = {
          name,
          isDirectory: index < parts.length - 1,
          path: `/${fullPath}`,
          ...(index < parts.length - 1 ? { children: [] } : {}),
        }
        nodes.set(fullPath, node)
        children.push(node)
      }

      children = node.children || []
    })
  }

  const sort = (items: FileSystemNode[]): FileSystemNode[] =>
    items
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
      .map((item) => ({ ...item, ...(item.children ? { children: sort(item.children) } : {}) }))

  return sort(roots)
}

function s3Client() {
  const error = getRustFSConfigurationError()
  if (error) throw new Error(error)

  if (!s3) {
    s3 = new S3Client({
      region: process.env.RUSTFS_REGION?.trim() || 'us-east-1',
      endpoint: endpoint(process.env.RUSTFS_ENDPOINT!),
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.RUSTFS_ACCESS_KEY!,
        secretAccessKey: process.env.RUSTFS_SECRET_KEY!,
      },
    })
  }

  return s3
}

function workspaceFor(userId: string, projectId: string, fileCount: number): SandboxStorageMetadata {
  const storageId = makeStorageId(userId, projectId)
  const keyPrefix = `workspaces/${storageId}/`

  return {
    provider: 'rustfs',
    bucket: bucket(),
    keyPrefix,
    storageId,
    manifestKey: `${keyPrefix}${PROJECT_MANIFEST}`,
    savedAt: new Date().toISOString(),
    fileCount,
  }
}

function bucket() {
  const value = process.env.RUSTFS_BUCKET?.trim()
  if (!value) throw new Error(getRustFSConfigurationError() || 'RUSTFS_BUCKET is not configured.')
  return value
}

function endpoint(value: string) {
  return (/^https?:\/\//i.test(value) ? value : `http://${value}`).replace(/\/+$/, '')
}

async function ownedProject(userId: string, projectId: string) {
  const db = await createServerClient(true)
  const { data, error } = await db
    .from('projects')
    .select('id, metadata')
    .eq('id', projectId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data as OwnedProject | null
}

async function saveMetadata(
  userId: string,
  projectId: string,
  oldMetadata: Record<string, any> | null | undefined,
  sandboxStorage: SandboxStorageMetadata,
  manifest: ProjectManifest,
) {
  const db = await createServerClient(true)
  const { error } = await db
    .from('projects')
    .update({
      metadata: {
        ...(oldMetadata || {}),
        sandboxStorage: {
          ...sandboxStorage,
          manifest,
          fileCount: manifest.fileCount,
          savedAt: manifest.updatedAt,
        },
      },
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
}

async function putFile(Bucket: string, prefix: string, file: SandboxStorageFile) {
  await s3Client().send(new PutObjectCommand({
    Bucket,
    Key: fileKey(prefix, file.path),
    Body: file.content,
    ContentType: contentType(file.path),
  }))
}

async function verify(Bucket: string, Key: string) {
  await s3Client().send(new HeadObjectCommand({ Bucket, Key }))
}

async function readProjectManifest(
  Bucket: string,
  prefix: string,
  options: { userId: string; projectId: string; allowMissing?: boolean },
): Promise<ProjectManifest | null> {
  try {
    const response = await s3Client().send(new GetObjectCommand({
      Bucket,
      Key: manifestKey(prefix),
    }))
    const raw = await response.Body?.transformToString()
    const manifest = JSON.parse(raw || '{}') as Partial<ProjectManifest>

    if (!isValidManifest(manifest, options.userId, options.projectId, storageIdFromPrefix(prefix))) {
      throw new Error('manifest ownership mismatch')
    }

    return manifest
  } catch (error: any) {
    if (
      options.allowMissing &&
      (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey')
    ) {
      return null
    }

    throw storageError('read .project.json', error)
  }
}

async function writeProjectManifest(
  Bucket: string,
  prefix: string,
  options: {
    userId: string
    projectId: string
    storageId: string
    files: SandboxStorageFile[]
    createdAt?: string
  },
) {
  const now = new Date().toISOString()
  const manifest: ProjectManifest = {
    version: 1,
    provider: 'rustfs',
    storageId: options.storageId,
    ownerUserId: options.userId,
    projectId: options.projectId,
    fileCount: options.files.length,
    createdAt: options.createdAt || now,
    updatedAt: now,
    files: options.files.map(({ path, content }) => ({
      path,
      sizeBytes: Buffer.byteLength(content),
    })),
  }

  await s3Client().send(new PutObjectCommand({
    Bucket,
    Key: manifestKey(prefix),
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json',
  }))
  await verify(Bucket, manifestKey(prefix))
  return manifest
}

async function readFiles(Bucket: string, prefix: string, paths: string[]) {
  const files: SandboxStorageFile[] = []

  for (const path of paths.slice(0, MAX_FILES)) {
    const cleanPath = normalizePath(path)
    if (!cleanPath) continue

    try {
      const response = await s3Client().send(new GetObjectCommand({
        Bucket,
        Key: fileKey(prefix, cleanPath),
      }))

      if ((response.ContentLength || 0) <= MAX_FILE_BYTES) {
        files.push({
          path: cleanPath,
          content: await response.Body?.transformToString() || '',
        })
      }
    } catch (error) {
      throw storageError(`download ${cleanPath}`, error)
    }
  }

  return files
}

async function listKeys(Bucket: string, Prefix: string) {
  const keys: string[] = []
  let token: string | undefined

  do {
    const result = await s3Client().send(new ListObjectsV2Command({
      Bucket,
      Prefix,
      ContinuationToken: token,
    }))
    keys.push(...(result.Contents || []).flatMap(({ Key }) => Key ? [Key] : []))
    token = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (token)

  return keys
}

function normalizeFiles(files: Array<GeneratedFile | SandboxStorageFile>) {
  const map = new Map<string, SandboxStorageFile>()

  for (const raw of files) {
    const file = normalizeFile(raw)
    if (file) map.set(file.path, file)
    if (map.size >= MAX_FILES) break
  }

  return [...map.values()]
}

function normalizeFile(file: GeneratedFile | SandboxStorageFile) {
  const path = normalizePath(file.path)
  const content = typeof file.content === 'string' ? file.content : ''

  return path && Buffer.byteLength(content) <= MAX_FILE_BYTES
    ? { path, content }
    : null
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string') return ''

  const parts = value
    .replace(/\\/g, '/')
    .replace(/^\/?home\/user\/?/, '')
    .replace(/^\/?vercel\/sandbox\/?/, '')
    .replace(/^\/+/, '')
    .trim()
    .split('/')
    .filter(Boolean)

  if (
    parts.length === 0 ||
    parts.some((part) => part === '.' || part === '..' || part.includes('\0'))
  ) {
    return ''
  }

  const path = parts.join('/')
  if (
    path === PROJECT_MANIFEST ||
    /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/.test(path)
  ) {
    return ''
  }

  return path
}

function normalizePrefix(value: string) {
  const trimmed = value.replace(/^\/+/, '').trim()
  return trimmed ? `${trimmed.replace(/\/+$/, '')}/` : ''
}

function manifestKey(prefix: string) {
  return `${normalizePrefix(prefix)}${PROJECT_MANIFEST}`
}

function fileKey(prefix: string, path: string) {
  const cleanPath = normalizePath(path)
  if (!cleanPath) throw new Error('Invalid file path')
  return `${normalizePrefix(prefix)}${FILES_PREFIX}${cleanPath}`
}

function isValidManifest(
  value: Partial<ProjectManifest>,
  userId: string,
  projectId: string,
  storageId: string,
): value is ProjectManifest {
  return (
    value.version === 1 &&
    value.provider === 'rustfs' &&
    value.storageId === storageId &&
    value.ownerUserId === userId &&
    value.projectId === projectId &&
    Array.isArray(value.files) &&
    value.files.length <= MAX_FILES &&
    value.files.every((file) => Boolean(normalizePath(file.path)))
  )
}

function isProjectManifestShape(value: unknown): value is ProjectManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<ProjectManifest>
  return (
    manifest.version === 1 &&
    manifest.provider === 'rustfs' &&
    typeof manifest.storageId === 'string' &&
    typeof manifest.ownerUserId === 'string' &&
    typeof manifest.projectId === 'string' &&
    typeof manifest.fileCount === 'number' &&
    typeof manifest.createdAt === 'string' &&
    typeof manifest.updatedAt === 'string' &&
    Array.isArray(manifest.files)
  )
}

function storageIdFromPrefix(prefix: string) {
  const parts = normalizePrefix(prefix).split('/').filter(Boolean)
  return parts[0] === 'workspaces' && parts[1] ? parts[1] : ''
}

function makeStorageId(userId: string, projectId: string) {
  return crypto.createHash('sha256').update(`${userId}:${projectId}`).digest('base64url').slice(0, 32)
}

function filesKey(userId: string, projectId: string) {
  return `rustfs:files:${userId.slice(0, 12)}:${projectId}`
}

function treeKey(userId: string, projectId: string) {
  return `rustfs:tree:${userId.slice(0, 12)}:${projectId}`
}

async function invalidate(userId: string, projectId: string) {
  await Promise.all([
    kvCacheDelete(filesKey(userId, projectId)),
    kvCacheDelete(treeKey(userId, projectId)),
  ])
}

function bytes(files: SandboxStorageFile[]) {
  return files.reduce((sum, file) =>
    sum + Buffer.byteLength(file.path) + Buffer.byteLength(file.content), 0)
}

function contentType(path: string) {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.html')) return 'text/html; charset=utf-8'
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  return 'text/plain; charset=utf-8'
}

function storageError(operation: string, error: any) {
  console.error('[RustFS] storage operation failed', {
    operation,
    name: error?.name,
    status: error?.$metadata?.httpStatusCode,
  })
  return new Error(`RustFS ${operation} failed: ${error?.name || error?.message || 'unknown error'}`)
}
