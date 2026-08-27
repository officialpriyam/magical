import 'server-only'

import crypto from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createServerClient } from '@/lib/supabase-server'
import type { GeneratedFile } from '@/lib/fragment-files'
import type { FileSystemNode } from '@/components/file-tree'
import { kvCacheDelete, kvCacheGet, kvCacheSet } from '@/lib/kv-cache'

export type SandboxStorageFile = { path: string; content: string }
export type SandboxStorageMetadata = { provider: 'rustfs'; bucket: string; keyPrefix: string; savedAt: string; fileCount: number }
type OwnedProject = { id: string; metadata?: Record<string, any> | null }
type Result = { saved: true; storageId: string; fileCount?: number } | { saved: false; reason: string }
type Manifest = { version: 1; ownerUserId: string; projectId: string; files: Array<{ path: string }> }

const MAX_FILES = 1000, MAX_FILE_BYTES = 1024 * 1024, CACHE_TTL = 300, MAX_CACHE_BYTES = 3 * 1024 * 1024, MANIFEST = '.magical-rustfs-manifest.json'
let s3: S3Client | null = null

export function getRustFSConfigurationError() {
  const missing = ['RUSTFS_ENDPOINT', 'RUSTFS_ACCESS_KEY', 'RUSTFS_SECRET_KEY', 'RUSTFS_BUCKET'].filter((key) => !process.env[key]?.trim())
  return missing.length ? `RustFS storage is not configured. Missing: ${missing.join(', ')}.` : null
}
export function hasSandboxStorageConfig() { return !getRustFSConfigurationError() }
export function getSandboxStorageMetadata(metadata: any): SandboxStorageMetadata | null {
  const value = metadata?.sandboxStorage
  return value?.provider === 'rustfs' && typeof value.bucket === 'string' && typeof value.keyPrefix === 'string'
    ? { provider: 'rustfs', bucket: value.bucket, keyPrefix: value.keyPrefix, savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(), fileCount: typeof value.fileCount === 'number' ? value.fileCount : 0 } : null
}

/** Creates RustFS metadata only. Sandboxes are never used as durable storage. */
export async function ensureProjectSandboxStorage({ userId, projectId }: { userId: string; projectId: string }) {
  if (!hasSandboxStorageConfig()) return null
  const project = await ownedProject(userId, projectId); if (!project) return null
  if (!getSandboxStorageMetadata(project.metadata)) await saveMetadata(userId, projectId, project.metadata, metadata(userId, projectId, 0))
  return storageId(userId, projectId)
}

export async function saveProjectFilesToSandboxStorage({ userId, projectId, files }: { userId: string; projectId: string; files: Array<GeneratedFile | SandboxStorageFile> }): Promise<Result> {
  if (!hasSandboxStorageConfig()) return { saved: false, reason: 'not_configured' }
  const project = await ownedProject(userId, projectId); if (!project) return { saved: false, reason: 'not_found' }
  const next = normalizeFiles(files); if (!next.length) return { saved: false, reason: 'empty' }
  const { bucket, keyPrefix } = metadata(userId, projectId, next.length); const prior = await readManifest(bucket, keyPrefix)
  // Files are confirmed before the manifest commit; failed batches leave the prior manifest intact.
  await Promise.all(next.map(async (file) => { await put(bucket, keyPrefix, file); await verify(bucket, `${keyPrefix}${file.path}`) }))
  await writeManifest(bucket, keyPrefix, userId, projectId, next)
  await saveMetadata(userId, projectId, project.metadata, metadata(userId, projectId, next.length)); await invalidate(userId, projectId)
  await Promise.all((prior?.files || []).filter(({ path }) => !next.some((file) => file.path === path)).map(({ path }) => s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: `${keyPrefix}${path}` }))))
  console.info('[RustFS] project files uploaded', { projectId, fileCount: next.length })
  return { saved: true, storageId: storageId(userId, projectId), fileCount: next.length }
}

export async function saveProjectFileToSandboxStorage({ userId, projectId, path, content }: { userId: string; projectId: string; path: string; content: string }): Promise<Result> {
  const file = normalizeFile({ path, content }); if (!file) return { saved: false, reason: 'invalid_file' }
  if (!hasSandboxStorageConfig()) return { saved: false, reason: 'not_configured' }
  const project = await ownedProject(userId, projectId); if (!project) return { saved: false, reason: 'not_found' }
  const { bucket, keyPrefix } = metadata(userId, projectId, 0); const manifest = await readManifest(bucket, keyPrefix)
  await put(bucket, keyPrefix, file); await verify(bucket, `${keyPrefix}${file.path}`)
  const paths = new Set((manifest?.files || []).map(({ path }) => path)); paths.add(file.path)
  const all = await readFiles(bucket, keyPrefix, [...paths]); await writeManifest(bucket, keyPrefix, userId, projectId, all)
  await saveMetadata(userId, projectId, project.metadata, metadata(userId, projectId, all.length)); await invalidate(userId, projectId)
  console.info('[RustFS] file uploaded', { projectId, path: file.path })
  return { saved: true, storageId: storageId(userId, projectId), fileCount: 1 }
}

export async function deleteProjectFileFromSandboxStorage({ userId, projectId, path }: { userId: string; projectId: string; path: string }): Promise<Result> {
  const clean = normalizePath(path); if (!clean) return { saved: false, reason: 'invalid_file' }
  if (!hasSandboxStorageConfig()) return { saved: false, reason: 'not_configured' }
  const project = await ownedProject(userId, projectId); if (!project) return { saved: false, reason: 'not_found' }
  const { bucket, keyPrefix } = metadata(userId, projectId, 0), manifest = await readManifest(bucket, keyPrefix)
  const removed = (manifest?.files || []).filter(({ path }) => path === clean || path.startsWith(`${clean}/`)); const keep = (manifest?.files || []).filter((file) => !removed.includes(file))
  await writeManifest(bucket, keyPrefix, userId, projectId, await readFiles(bucket, keyPrefix, keep.map(({ path }) => path)))
  await Promise.all(removed.map(({ path }) => s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: `${keyPrefix}${path}` }))))
  await saveMetadata(userId, projectId, project.metadata, metadata(userId, projectId, keep.length)); await invalidate(userId, projectId)
  console.info('[RustFS] file deleted', { projectId, path: clean })
  return { saved: true, storageId: storageId(userId, projectId), fileCount: removed.length }
}

export async function renameProjectFileInSandboxStorage({ userId, projectId, oldPath, newPath }: { userId: string; projectId: string; oldPath: string; newPath: string }): Promise<Result> {
  const oldClean = normalizePath(oldPath), newClean = normalizePath(newPath); if (!oldClean || !newClean) return { saved: false, reason: 'invalid_file' }
  const files = await getProjectFilesFromSandboxStorage({ userId, projectId }); const matching = files.filter(({ path }) => path === oldClean || path.startsWith(`${oldClean}/`)); if (!matching.length) return { saved: false, reason: 'not_found' }
  const saved = await saveProjectFilesToSandboxStorage({ userId, projectId, files: files.map((file) => matching.includes(file) ? { ...file, path: `${newClean}${file.path.slice(oldClean.length)}` } : file) })
  if (saved.saved) await deleteProjectFileFromSandboxStorage({ userId, projectId, path: oldClean }); return saved
}

export async function getProjectFilesFromSandboxStorage({ userId, projectId, project }: { userId: string; projectId: string; project?: { id: string; metadata: any } | null }) {
  if (!hasSandboxStorageConfig()) return []
  const cacheKey = filesKey(userId, projectId), cached = await kvCacheGet<SandboxStorageFile[]>(cacheKey); if (cached && Array.isArray(cached)) return cached
  const owned = project || await ownedProject(userId, projectId); if (!owned) return []
  const { bucket, keyPrefix } = metadata(userId, projectId, 0), manifest = await readManifest(bucket, keyPrefix); if (!manifest) return []
  const files = await readFiles(bucket, keyPrefix, manifest.files.map(({ path }) => path)); if (bytes(files) <= MAX_CACHE_BYTES) await kvCacheSet(cacheKey, files, CACHE_TTL)
  console.info('[RustFS] project files downloaded', { projectId, fileCount: files.length }); return files
}
export async function getProjectFileFromSandboxStorage(args: { userId: string; projectId: string; path: string }) { const path = normalizePath(args.path); return path ? (await getProjectFilesFromSandboxStorage(args)).find((file) => file.path === path) || null : null }
export async function getProjectFileTreeFromSandboxStorage({ userId, projectId }: { userId: string; projectId: string }) { const key = treeKey(userId, projectId), cached = await kvCacheGet<FileSystemNode[]>(key); if (cached && Array.isArray(cached)) return cached; const tree = buildFileTree(await getProjectFilesFromSandboxStorage({ userId, projectId })); await kvCacheSet(key, tree, CACHE_TTL); return tree }
export async function deleteProjectSandboxStorage({ userId, projectId }: { userId: string; projectId: string }) { if (!hasSandboxStorageConfig()) return { deleted: false, reason: 'not_configured' }; const project = await ownedProject(userId, projectId); if (!project) return { deleted: false, reason: 'not_found' }; const { bucket, keyPrefix } = metadata(userId, projectId, 0); const keys = await listKeys(bucket, keyPrefix); await Promise.all(keys.map((Key) => s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key })))); await invalidate(userId, projectId); console.info('[RustFS] project deleted', { projectId, objectCount: keys.length }); return { deleted: true } }

export function buildFileTree(files: SandboxStorageFile[]): FileSystemNode[] {
  const roots: FileSystemNode[] = [], nodes = new Map<string, FileSystemNode>()
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) { let children = roots, full = ''; file.path.split('/').forEach((name, index, parts) => { full = full ? `${full}/${name}` : name; let node = nodes.get(full); if (!node) { node = { name, isDirectory: index < parts.length - 1, path: `/${full}`, ...(index < parts.length - 1 ? { children: [] } : {}) }; nodes.set(full, node); children.push(node) }; children = node.children || [] }) }
  const sort = (items: FileSystemNode[]): FileSystemNode[] => items.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)).map((item) => ({ ...item, ...(item.children ? { children: sort(item.children) } : {}) })); return sort(roots)
}

function s3Client() { const error = getRustFSConfigurationError(); if (error) throw new Error(error); if (!s3) s3 = new S3Client({ region: process.env.RUSTFS_REGION?.trim() || 'us-east-1', endpoint: endpoint(process.env.RUSTFS_ENDPOINT!), forcePathStyle: true, credentials: { accessKeyId: process.env.RUSTFS_ACCESS_KEY!, secretAccessKey: process.env.RUSTFS_SECRET_KEY! } }); return s3 }
function metadata(userId: string, projectId: string, fileCount: number): SandboxStorageMetadata { return { provider: 'rustfs', bucket: bucket(), keyPrefix: `projects/${segment(userId)}/${segment(projectId)}/`, savedAt: new Date().toISOString(), fileCount } }
function bucket() { const value = process.env.RUSTFS_BUCKET?.trim(); if (!value) throw new Error(getRustFSConfigurationError() || 'RUSTFS_BUCKET is not configured.'); return value }
function endpoint(value: string) { return (/^https?:\/\//i.test(value) ? value : `http://${value}`).replace(/\/+$/, '') }
async function ownedProject(userId: string, projectId: string) { const db = await createServerClient(true), { data, error } = await db.from('projects').select('id, metadata').eq('id', projectId).eq('user_id', userId).is('deleted_at', null).maybeSingle(); if (error) throw error; return data as OwnedProject | null }
async function saveMetadata(userId: string, projectId: string, old: Record<string, any> | null | undefined, sandboxStorage: SandboxStorageMetadata) { const db = await createServerClient(true), { error } = await db.from('projects').update({ metadata: { ...(old || {}), sandboxStorage }, updated_at: new Date().toISOString() } as never).eq('id', projectId).eq('user_id', userId); if (error) throw error }
async function put(Bucket: string, prefix: string, file: SandboxStorageFile) { await s3Client().send(new PutObjectCommand({ Bucket, Key: `${prefix}${file.path}`, Body: file.content, ContentType: contentType(file.path) })) }
async function verify(Bucket: string, Key: string) { await s3Client().send(new HeadObjectCommand({ Bucket, Key })) }
async function readManifest(Bucket: string, prefix: string): Promise<Manifest | null> { try { const response = await s3Client().send(new GetObjectCommand({ Bucket, Key: `${prefix}${MANIFEST}` })), result = JSON.parse(await response.Body?.transformToString() || '{}'); return result?.version === 1 && Array.isArray(result.files) ? result : null } catch (error: any) { if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey') return null; throw storageError('download manifest', error) } }
async function writeManifest(Bucket: string, prefix: string, userId: string, projectId: string, files: SandboxStorageFile[]) { await s3Client().send(new PutObjectCommand({ Bucket, Key: `${prefix}${MANIFEST}`, Body: JSON.stringify({ version: 1, ownerUserId: userId, projectId, savedAt: new Date().toISOString(), files: files.map(({ path, content }) => ({ path, sizeBytes: Buffer.byteLength(content) })) }), ContentType: 'application/json' })); await verify(Bucket, `${prefix}${MANIFEST}`) }
async function readFiles(Bucket: string, prefix: string, paths: string[]) { const files: SandboxStorageFile[] = []; for (const path of paths.slice(0, MAX_FILES)) { const clean = normalizePath(path); if (!clean) continue; try { const response = await s3Client().send(new GetObjectCommand({ Bucket, Key: `${prefix}${clean}` })); if ((response.ContentLength || 0) <= MAX_FILE_BYTES) files.push({ path: clean, content: await response.Body?.transformToString() || '' }) } catch (error) { throw storageError(`download ${clean}`, error) } }; return files }
async function listKeys(Bucket: string, Prefix: string) { const keys: string[] = []; let token: string | undefined; do { const result = await s3Client().send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken: token })); keys.push(...(result.Contents || []).flatMap(({ Key }) => Key ? [Key] : [])); token = result.IsTruncated ? result.NextContinuationToken : undefined } while (token); return keys }
function normalizeFiles(files: Array<GeneratedFile | SandboxStorageFile>) { const map = new Map<string, SandboxStorageFile>(); for (const raw of files) { const file = normalizeFile(raw); if (file) map.set(file.path, file); if (map.size >= MAX_FILES) break }; return [...map.values()] }
function normalizeFile(file: GeneratedFile | SandboxStorageFile) { const path = normalizePath(file.path), content = typeof file.content === 'string' ? file.content : ''; return path && Buffer.byteLength(content) <= MAX_FILE_BYTES ? { path, content } : null }
function normalizePath(value: unknown) { if (typeof value !== 'string') return ''; const parts = value.replace(/\\/g, '/').replace(/^\/?home\/user\/?/, '').replace(/^\/?vercel\/sandbox\/?/, '').replace(/^\/+/, '').trim().split('/').filter(Boolean); if (!parts.length || parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) return ''; const path = parts.join('/'); return path === MANIFEST || /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/.test(path) ? '' : path }
function segment(value: string) { return value.replace(/[^A-Za-z0-9_-]/g, '_') }; function storageId(userId: string, projectId: string) { return crypto.createHash('sha256').update(`${userId}:${projectId}`).digest('base64url').slice(0, 32) }; function filesKey(userId: string, projectId: string) { return `rustfs:files:${userId.slice(0, 12)}:${projectId}` }; function treeKey(userId: string, projectId: string) { return `rustfs:tree:${userId.slice(0, 12)}:${projectId}` }; async function invalidate(userId: string, projectId: string) { await Promise.all([kvCacheDelete(filesKey(userId, projectId)), kvCacheDelete(treeKey(userId, projectId))]) }; function bytes(files: SandboxStorageFile[]) { return files.reduce((sum, file) => sum + Buffer.byteLength(file.path) + Buffer.byteLength(file.content), 0) }; function contentType(path: string) { return path.endsWith('.json') ? 'application/json' : path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/plain; charset=utf-8' }; function storageError(operation: string, error: any) { console.error('[RustFS] storage operation failed', { operation, name: error?.name, status: error?.$metadata?.httpStatusCode }); return new Error(`RustFS ${operation} failed: ${error?.name || error?.message || 'unknown error'}`) }
