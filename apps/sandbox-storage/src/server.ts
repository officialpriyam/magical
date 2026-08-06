import crypto from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(process.env.SANDBOX_STORAGE_ROOT || path.join(__dirname, '..', 'data'))
const port = Number(process.env.PORT || 8787)
const maxFiles = Number(process.env.SANDBOX_STORAGE_MAX_FILES || 1000)
const maxFileBytes = Number(process.env.SANDBOX_STORAGE_MAX_FILE_BYTES || 1024 * 1024)
const maxBodyBytes = Number(process.env.SANDBOX_STORAGE_MAX_BODY_BYTES || 10 * 1024 * 1024)
const manifestName = '.sandbox-storage-manifest.json'
const skipPathRe = /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/
const accessKey = (process.env.SANDBOX_STORAGE_ACCESS_KEY || '').trim()
const accessSalt = (process.env.SANDBOX_STORAGE_ACCESS_SALT || '').trim()

interface WorkspaceManifest {
  version?: number
  provider?: string
  storageId?: string
  ownerUserId?: string
  projectId?: string
  fileCount?: number
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

interface WorkspaceFile {
  path: string
  content: string
}

interface StoredBody {
  raw: Buffer
  text: string
  json: unknown
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const body = await readRequestBody(req)
    if (!isAuthorized(req, body, url)) {
      return sendJson(res, 401, { error: 'Unauthorized' }, true)
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, secure: true })
    }

    if (req.method === 'POST' && url.pathname === '/v1/workspaces') {
      const payload = readJsonPayload(body)
      const storageId = normalizeStorageId(payload.storageId) || crypto.randomUUID()
      const workspace = workspacePaths(storageId)
      await mkdir(workspace.filesDir, { recursive: true })
      await writeManifest(storageId, {
        ownerUserId: stringOrEmpty(payload.userId),
        projectId: stringOrEmpty(payload.projectId),
        fileCount: await countFiles(workspace.filesDir),
      })

      return sendJson(res, 200, { storageId, secure: true })
    }

    const match = url.pathname.match(/^\/v1\/workspaces\/([^/]+)\/files(?:\/batch)?$/)
    if (!match) {
      return sendJson(res, 404, { error: 'Not found' })
    }

    const storageId = normalizeStorageId(match[1])
    if (!storageId) {
      return sendJson(res, 400, { error: 'Invalid storage ID' })
    }

    const workspace = workspacePaths(storageId)
    await mkdir(workspace.filesDir, { recursive: true })

    if (req.method === 'GET') {
      const files = await listWorkspaceFiles(workspace.filesDir)
      const manifest = await readManifest(storageId)
      return sendJson(res, 200, { storageId, files, manifest, secure: true })
    }

    if (req.method === 'PUT' && url.pathname.endsWith('/batch')) {
      const payload = readJsonPayload(body)
      const files = normalizeFiles(payload.files)
      await rm(workspace.filesDir, { recursive: true, force: true })
      await mkdir(workspace.filesDir, { recursive: true })
      await Promise.all(files.map((file) => writeWorkspaceFile(workspace.filesDir, file.path, file.content)))
      await writeManifest(storageId, { fileCount: files.length })
      return sendJson(res, 200, { storageId, saved: true, fileCount: files.length, secure: true })
    }

    if (req.method === 'PUT') {
      const payload = readJsonPayload(body)
      const file = normalizeFile(payload)
      await writeWorkspaceFile(workspace.filesDir, file.path, file.content)
      await writeManifest(storageId, { fileCount: await countFiles(workspace.filesDir) })
      return sendJson(res, 200, { storageId, saved: true, path: file.path, secure: true })
    }

    if (req.method === 'DELETE') {
      const payload = readJsonPayload(body)
      const filePath = normalizeWorkspacePath(payload.path)
      if (!filePath) return sendJson(res, 400, { error: 'Path is required' })
      await rm(path.join(workspace.filesDir, filePath), { recursive: true, force: true })
      await writeManifest(storageId, { fileCount: await countFiles(workspace.filesDir) })
      return sendJson(res, 200, { storageId, saved: true, secure: true })
    }

    if (req.method === 'PATCH') {
      const payload = readJsonPayload(body)
      const oldPath = normalizeWorkspacePath(payload.oldPath)
      const newPath = normalizeWorkspacePath(payload.newPath)
      if (!oldPath || !newPath) return sendJson(res, 400, { error: 'Old path and new path are required' })
      if (newPath.startsWith(`${oldPath}/`)) return sendJson(res, 400, { error: 'A folder cannot be renamed inside itself.' })
      const source = path.join(workspace.filesDir, oldPath)
      const target = path.join(workspace.filesDir, newPath)
      await mkdir(path.dirname(target), { recursive: true })
      await rename(source, target)
      await writeManifest(storageId, { fileCount: await countFiles(workspace.filesDir) })
      return sendJson(res, 200, { storageId, saved: true, path: newPath, secure: true })
    }

    return sendJson(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Storage operation failed'
    return sendJson(res, 500, { error: 'Storage operation failed', details: message })
  }
})

function startServer(): void {
  server.listen(port, () => {
    console.log(`sandbox-storage listening on :${port}`)
    console.log(`data root: ${rootDir}`)
    console.log(`protection: ${accessKey && accessSalt ? 'signature-based auth enabled' : 'auth disabled'}`)
  })

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0))
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer()
}

function isAuthorized(req: IncomingMessage, body: StoredBody, url: URL): boolean {
  if (!accessKey || !accessSalt) {
    return true
  }

  const key = req.headers['x-sandbox-storage-key']
  const signature = req.headers['x-sandbox-storage-signature']
  const timestamp = req.headers['x-sandbox-storage-timestamp']
  const requestId = req.headers['x-request-id']

  if (typeof key !== 'string' || typeof signature !== 'string' || typeof timestamp !== 'string') {
    return false
  }

  if (!safeCompare(key, accessKey)) {
    return false
  }

  const ts = Number(timestamp)
  const now = Date.now()
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
    return false
  }

  const payload = `${timestamp}:${req.method || 'GET'}:${url.pathname}:${crypto.createHash('sha256').update(body.raw).digest('hex')}`
  const expectedSignature = createSignature(accessSalt, payload)
  return safeCompare(signature, expectedSignature) && (requestId ? requestId.length <= 128 : true)
}

function createSignature(secret: string, payload: string): string {
  return crypto.createHmac('sha256', `${accessKey}:${secret}`).update(payload).digest('hex')
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

function workspacePaths(storageId: string) {
  const dir = path.join(rootDir, storageId)
  return {
    dir,
    filesDir: path.join(dir, 'files'),
    manifestPath: path.join(dir, manifestName),
  }
}

async function readRequestBody(req: IncomingMessage): Promise<StoredBody> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBodyBytes) {
      throw new Error('Request body too large')
    }
    chunks.push(buffer)
  }

  const raw = Buffer.concat(chunks)
  return {
    raw,
    text: raw.toString('utf8'),
    json: raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {},
  }
}

function readJsonPayload(body: StoredBody): Record<string, unknown> {
  if (body.text.length === 0) {
    return {}
  }
  try {
    const parsed = JSON.parse(body.text)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>, noCache = false): void {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  }
  if (noCache) {
    headers['cache-control'] = 'no-store, max-age=0'
  }
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

export function normalizeStorageId(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : ''
}

function normalizeFiles(files: unknown): WorkspaceFile[] {
  if (!Array.isArray(files)) throw new Error('Files array is required')
  const byPath = new Map<string, WorkspaceFile>()
  for (const file of files) {
    const normalized = normalizeFile(file as Record<string, unknown>)
    byPath.set(normalized.path, normalized)
    if (byPath.size > maxFiles) break
  }
  return Array.from(byPath.values())
}

function normalizeFile(file: Record<string, unknown>): WorkspaceFile {
  const filePath = normalizeWorkspacePath(file?.path)
  const content = typeof file?.content === 'string' ? file.content : ''
  if (!filePath) throw new Error('Invalid file path')
  if (Buffer.byteLength(content, 'utf8') > maxFileBytes) throw new Error(`File too large: ${filePath}`)
  return { path: filePath, content }
}

export function normalizeWorkspacePath(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  let cleaned = trimmed
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]:)?\/+/, '')
    .replace(/^~\//, '')
    .replace(/^home\/user\//, '')
    .replace(/^vercel\/sandbox\//, '')
    .replace(/\/+/g, '/')

  if (!cleaned || cleaned === '.' || cleaned === '..') return ''
  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\0') || part.startsWith('.'))) return ''
  const normalized = parts.join('/')
  if (normalized === manifestName || skipPathRe.test(normalized)) return ''
  return normalized
}

async function writeWorkspaceFile(filesDir: string, filePath: string, content: string): Promise<void> {
  const target = path.resolve(path.join(filesDir, filePath))
  const root = path.resolve(filesDir)
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Access denied')
  }

  await mkdir(path.dirname(target), { recursive: true })
  const tempPath = path.join(path.dirname(target), `.${path.basename(target)}.${crypto.randomUUID()}.tmp`)
  await writeFile(tempPath, content, 'utf8')
  await rename(tempPath, target)
}

async function listWorkspaceFiles(filesDir: string, relativeDir = ''): Promise<WorkspaceFile[]> {
  const dir = path.join(filesDir, relativeDir)
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: WorkspaceFile[] = []
  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    if (skipPathRe.test(relativePath) || entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      files.push(...await listWorkspaceFiles(filesDir, relativePath))
      continue
    }
    const fullPath = path.join(filesDir, relativePath)
    const info = await stat(fullPath)
    if (info.size > maxFileBytes) continue
    files.push({
      path: relativePath,
      content: await readFile(fullPath, 'utf8'),
    })
    if (files.length >= maxFiles) break
  }
  return files
}

async function countFiles(filesDir: string): Promise<number> {
  return (await listWorkspaceFiles(filesDir)).length
}

async function readManifest(storageId: string): Promise<WorkspaceManifest | null> {
  const { manifestPath } = workspacePaths(storageId)
  const raw = await readFile(manifestPath, 'utf8').catch(() => '')
  return raw ? JSON.parse(raw) as WorkspaceManifest : null
}

async function writeManifest(storageId: string, updates: Partial<WorkspaceManifest>): Promise<void> {
  const workspace = workspacePaths(storageId)
  const existing = await readManifest(storageId).catch(() => null)
  const now = new Date().toISOString()
  await mkdir(workspace.dir, { recursive: true })
  await writeFile(workspace.manifestPath, JSON.stringify({
    version: 1,
    provider: 'sandbox-storage',
    storageId,
    ...existing,
    ...updates,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }, null, 2))
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
