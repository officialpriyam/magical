import 'server-only'

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createServerClient } from '@/lib/supabase-server'
import type { GeneratedFile } from '@/lib/fragment-files'

export type R2WorkspaceMetadata = {
  provider: 'cloudflare-r2'
  bucket: string
  keyPrefix: string
  savedAt: string
  fileCount: number
}

export type R2WorkspaceFile = {
  path: string
  content: string
}

type OwnedProject = {
  id: string
  metadata?: Record<string, any> | null
}

const MAX_R2_WORKSPACE_FILES = 200
const MAX_R2_WORKSPACE_FILE_BYTES = 1024 * 1024
const R2_MANIFEST_FILE = '.magical-r2-manifest.json'

let r2Client: S3Client | null = null

export function hasR2WorkspaceConfig() {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET,
  )
}

export function getR2WorkspaceMetadata(metadata: any): R2WorkspaceMetadata | null {
  const workspace = metadata?.r2Workspace

  if (
    !workspace ||
    typeof workspace !== 'object' ||
    workspace.provider !== 'cloudflare-r2' ||
    typeof workspace.bucket !== 'string' ||
    typeof workspace.keyPrefix !== 'string'
  ) {
    return null
  }

  return {
    provider: 'cloudflare-r2',
    bucket: workspace.bucket,
    keyPrefix: workspace.keyPrefix,
    savedAt: typeof workspace.savedAt === 'string'
      ? workspace.savedAt
      : new Date().toISOString(),
    fileCount: typeof workspace.fileCount === 'number'
      ? workspace.fileCount
      : 0,
  }
}

export async function saveProjectFilesToR2({
  userId,
  projectId,
  files,
}: {
  userId: string
  projectId: string
  files: Array<GeneratedFile | R2WorkspaceFile>
}) {
  if (!hasR2WorkspaceConfig()) {
    return { saved: false, reason: 'not_configured' as const }
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return { saved: false, reason: 'not_found' as const }
  }

  if (hasGitHubWorkspace(project.metadata)) {
    return { saved: false, reason: 'github_workspace' as const }
  }

  const normalizedFiles = normalizeR2WorkspaceFiles(files)

  if (normalizedFiles.length === 0) {
    return { saved: false, reason: 'empty' as const }
  }

  const bucket = getR2Bucket()
  const keyPrefix = getProjectKeyPrefix(userId, projectId)

  await deleteProjectWorkspaceObjects(bucket, keyPrefix)
  await putWorkspaceFiles(bucket, keyPrefix, normalizedFiles)
  await writeManifest(bucket, keyPrefix, userId, projectId, normalizedFiles)
  await saveR2WorkspaceMetadata(userId, projectId, project.metadata, {
    provider: 'cloudflare-r2',
    bucket,
    keyPrefix,
    savedAt: new Date().toISOString(),
    fileCount: normalizedFiles.length,
  })

  return { saved: true, fileCount: normalizedFiles.length }
}

export async function saveProjectFileToR2({
  userId,
  projectId,
  path,
  content,
}: {
  userId: string
  projectId: string
  path: string
  content: string
}) {
  if (!hasR2WorkspaceConfig()) {
    return { saved: false, reason: 'not_configured' as const }
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return { saved: false, reason: 'not_found' as const }
  }

  if (hasGitHubWorkspace(project.metadata)) {
    return { saved: false, reason: 'github_workspace' as const }
  }

  const normalizedPath = normalizeR2WorkspacePath(path)

  if (!normalizedPath) {
    return { saved: false, reason: 'invalid_path' as const }
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_R2_WORKSPACE_FILE_BYTES) {
    return { saved: false, reason: 'too_large' as const }
  }

  const bucket = getR2Bucket()
  const keyPrefix = getProjectKeyPrefix(userId, projectId)
  await putWorkspaceFiles(bucket, keyPrefix, [{ path: normalizedPath, content }])
  await touchR2WorkspaceMetadata(userId, projectId, project.metadata, bucket, keyPrefix)

  return { saved: true, fileCount: 1 }
}

export async function deleteProjectFileFromR2({
  userId,
  projectId,
  path,
}: {
  userId: string
  projectId: string
  path: string
}) {
  if (!hasR2WorkspaceConfig()) {
    return { saved: false, reason: 'not_configured' as const }
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return { saved: false, reason: 'not_found' as const }
  }

  if (hasGitHubWorkspace(project.metadata)) {
    return { saved: false, reason: 'github_workspace' as const }
  }

  const normalizedPath = normalizeR2WorkspacePath(path)

  if (!normalizedPath) {
    return { saved: false, reason: 'invalid_path' as const }
  }

  const bucket = getR2Bucket()
  const keyPrefix = getProjectKeyPrefix(userId, projectId)
  const keys = await listProjectWorkspaceKeys(bucket, keyPrefix)
  const matchingKeys = keys.filter((key) => {
    const relativePath = key.slice(keyPrefix.length)
    return relativePath === normalizedPath || relativePath.startsWith(`${normalizedPath}/`)
  })

  await Promise.all(
    matchingKeys.map((key) =>
      getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    ),
  )
  await touchR2WorkspaceMetadata(userId, projectId, project.metadata, bucket, keyPrefix)

  return { saved: true, fileCount: matchingKeys.length }
}

export async function renameProjectFileInR2({
  userId,
  projectId,
  oldPath,
  newPath,
}: {
  userId: string
  projectId: string
  oldPath: string
  newPath: string
}) {
  if (!hasR2WorkspaceConfig()) {
    return { saved: false, reason: 'not_configured' as const }
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return { saved: false, reason: 'not_found' as const }
  }

  if (hasGitHubWorkspace(project.metadata)) {
    return { saved: false, reason: 'github_workspace' as const }
  }

  const normalizedOldPath = normalizeR2WorkspacePath(oldPath)
  const normalizedNewPath = normalizeR2WorkspacePath(newPath)

  if (!normalizedOldPath || !normalizedNewPath) {
    return { saved: false, reason: 'invalid_path' as const }
  }

  const bucket = getR2Bucket()
  const keyPrefix = getProjectKeyPrefix(userId, projectId)
  const keys = await listProjectWorkspaceKeys(bucket, keyPrefix)
  const matchingKeys = keys.filter((key) => {
    const relativePath = key.slice(keyPrefix.length)
    return relativePath === normalizedOldPath ||
      relativePath.startsWith(`${normalizedOldPath}/`)
  })

  for (const key of matchingKeys) {
    const relativePath = key.slice(keyPrefix.length)
    const renamedRelativePath = relativePath === normalizedOldPath
      ? normalizedNewPath
      : `${normalizedNewPath}/${relativePath.slice(normalizedOldPath.length + 1)}`
    const nextKey = `${keyPrefix}${renamedRelativePath}`

    await getR2Client().send(new CopyObjectCommand({
      Bucket: bucket,
      Key: nextKey,
      CopySource: `${bucket}/${encodeR2CopySourceKey(key)}`,
    }))
    await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }

  await touchR2WorkspaceMetadata(userId, projectId, project.metadata, bucket, keyPrefix)

  return { saved: true, fileCount: matchingKeys.length }
}

export async function getProjectFilesFromR2({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  if (!hasR2WorkspaceConfig()) {
    return []
  }

  const project = await getOwnedProject(userId, projectId)

  if (!project) {
    return []
  }

  const metadata = getR2WorkspaceMetadata(project.metadata)
  const bucket = metadata?.bucket || getR2Bucket()
  const keyPrefix = metadata?.keyPrefix || getProjectKeyPrefix(userId, projectId)
  const keys = await listProjectWorkspaceKeys(bucket, keyPrefix)
  const files: R2WorkspaceFile[] = []

  for (const key of keys) {
    if (files.length >= MAX_R2_WORKSPACE_FILES) break

    const relativePath = normalizeR2WorkspacePath(key.slice(keyPrefix.length))

    if (!relativePath) continue

    const response = await getR2Client().send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }))
    const size = typeof response.ContentLength === 'number' ? response.ContentLength : 0

    if (size > MAX_R2_WORKSPACE_FILE_BYTES) {
      continue
    }

    const content = await response.Body?.transformToString()

    files.push({
      path: relativePath,
      content: content || '',
    })
  }

  return files
}

function getR2Client() {
  if (!hasR2WorkspaceConfig()) {
    throw new Error('Cloudflare R2 workspace storage is not configured.')
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    })
  }

  return r2Client
}

function getR2Bucket() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim()

  if (!bucket) {
    throw new Error('CLOUDFLARE_R2_BUCKET is not configured.')
  }

  return bucket
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

async function saveR2WorkspaceMetadata(
  userId: string,
  projectId: string,
  currentMetadata: Record<string, any> | null | undefined,
  r2Workspace: R2WorkspaceMetadata,
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
        r2Workspace,
      },
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

async function touchR2WorkspaceMetadata(
  userId: string,
  projectId: string,
  currentMetadata: Record<string, any> | null | undefined,
  bucket: string,
  keyPrefix: string,
) {
  const existing = getR2WorkspaceMetadata(currentMetadata)
  await saveR2WorkspaceMetadata(userId, projectId, currentMetadata, {
    provider: 'cloudflare-r2',
    bucket,
    keyPrefix,
    savedAt: new Date().toISOString(),
    fileCount: existing?.fileCount || 0,
  })
}

async function deleteProjectWorkspaceObjects(bucket: string, keyPrefix: string) {
  const keys = await listProjectWorkspaceKeys(bucket, keyPrefix, true)

  await Promise.all(
    keys.map((key) =>
      getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    ),
  )
}

async function putWorkspaceFiles(
  bucket: string,
  keyPrefix: string,
  files: R2WorkspaceFile[],
) {
  await Promise.all(
    files.map((file) =>
      getR2Client().send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${keyPrefix}${file.path}`,
        Body: file.content,
        ContentType: guessContentType(file.path),
      })),
    ),
  )
}

async function writeManifest(
  bucket: string,
  keyPrefix: string,
  userId: string,
  projectId: string,
  files: R2WorkspaceFile[],
) {
  const savedAt = new Date().toISOString()
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${keyPrefix}${R2_MANIFEST_FILE}`,
    Body: JSON.stringify({
      version: 1,
      provider: 'cloudflare-r2',
      ownerUserId: userId,
      projectId,
      savedAt,
      files: files.map((file) => ({
        path: file.path,
        sizeBytes: Buffer.byteLength(file.content, 'utf8'),
        savedAt,
      })),
    }),
    ContentType: 'application/json',
  }))
}

async function listProjectWorkspaceKeys(
  bucket: string,
  keyPrefix: string,
  includeManifest = false,
) {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const response = await getR2Client().send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: keyPrefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }))

    for (const object of response.Contents || []) {
      if (!object.Key) continue
      if (!includeManifest && object.Key === `${keyPrefix}${R2_MANIFEST_FILE}`) continue
      if (!includeManifest && object.Size && object.Size > MAX_R2_WORKSPACE_FILE_BYTES) continue
      keys.push(object.Key)
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined
  } while (continuationToken && keys.length < MAX_R2_WORKSPACE_FILES + 1)

  return keys.slice(0, MAX_R2_WORKSPACE_FILES)
}

function normalizeR2WorkspaceFiles(files: Array<GeneratedFile | R2WorkspaceFile>) {
  const byPath = new Map<string, R2WorkspaceFile>()

  for (const file of files) {
    const normalizedPath = normalizeR2WorkspacePath(file.path)
    const content = typeof file.content === 'string' ? file.content : ''

    if (!normalizedPath || !content) continue
    if (Buffer.byteLength(content, 'utf8') > MAX_R2_WORKSPACE_FILE_BYTES) continue

    byPath.set(normalizedPath, {
      path: normalizedPath,
      content,
    })
  }

  return Array.from(byPath.values()).slice(0, MAX_R2_WORKSPACE_FILES)
}

function normalizeR2WorkspacePath(value: unknown) {
  if (typeof value !== 'string') return ''

  const path = value
    .replace(/\\/g, '/')
    .replace(/^\/?home\/user\/?/, '')
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

  if (
    normalizedPath === R2_MANIFEST_FILE ||
    /(^|\/)(\.git|node_modules|\.next|dist|build|coverage)(\/|$)/.test(normalizedPath)
  ) {
    return ''
  }

  return normalizedPath
}

function getProjectKeyPrefix(userId: string, projectId: string) {
  return `users/${safeKeySegment(userId)}/projects/${safeKeySegment(projectId)}/workspace/`
}

function safeKeySegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '_')
}

function hasGitHubWorkspace(metadata: any) {
  const workspace = metadata?.githubWorkspace
  return Boolean(workspace && typeof workspace === 'object')
}

function encodeR2CopySourceKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}

function guessContentType(path: string) {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.html')) return 'text/html; charset=utf-8'
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) {
    return 'text/javascript; charset=utf-8'
  }
  if (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.jsx')) {
    return 'text/plain; charset=utf-8'
  }
  if (path.endsWith('.svg')) return 'image/svg+xml'

  return 'text/plain; charset=utf-8'
}
