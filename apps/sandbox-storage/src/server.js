import crypto from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(process.env.SANDBOX_STORAGE_ROOT || path.join(__dirname, '..', 'data'))
const port = Number(process.env.PORT || 8787)
const authToken = process.env.SANDBOX_STORAGE_TOKEN || ''
const maxFiles = Number(process.env.SANDBOX_STORAGE_MAX_FILES || 1000)
const maxFileBytes = Number(process.env.SANDBOX_STORAGE_MAX_FILE_BYTES || 1024 * 1024)
const manifestName = '.sandbox-storage-manifest.json'
const skipPathRe = /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/

const server = createServer(async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Unauthorized' })
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/v1/workspaces') {
      const body = await readJson(req)
      const storageId = normalizeStorageId(body.storageId) || crypto.randomUUID()
      const workspace = workspacePaths(storageId)
      await mkdir(workspace.filesDir, { recursive: true })
      await writeManifest(storageId, {
        ownerUserId: stringOrEmpty(body.userId),
        projectId: stringOrEmpty(body.projectId),
        fileCount: await countFiles(workspace.filesDir),
      })

      return sendJson(res, 200, { storageId })
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
      return sendJson(res, 200, { storageId, files, manifest })
    }

    if (req.method === 'PUT' && url.pathname.endsWith('/batch')) {
      const body = await readJson(req)
      const files = normalizeFiles(body.files)
      await rm(workspace.filesDir, { recursive: true, force: true })
      await mkdir(workspace.filesDir, { recursive: true })
      await Promise.all(files.map((file) => writeWorkspaceFile(workspace.filesDir, file.path, file.content)))
      await writeManifest(storageId, { fileCount: files.length })
      return sendJson(res, 200, { storageId, saved: true, fileCount: files.length })
    }

    if (req.method === 'PUT') {
      const body = await readJson(req)
      const file = normalizeFile(body)
      await writeWorkspaceFile(workspace.filesDir, file.path, file.content)
      await writeManifest(storageId, { fileCount: await countFiles(workspace.filesDir) })
      return sendJson(res, 200, { storageId, saved: true, path: file.path })
    }

    if (req.method === 'DELETE') {
      const body = await readJson(req)
      const filePath = normalizeWorkspacePath(body.path)
      if (!filePath) return sendJson(res, 400, { error: 'Path is required' })
      await rm(path.join(workspace.filesDir, filePath), { recursive: true, force: true })
      await writeManifest(storageId, { fileCount: await countFiles(workspace.filesDir) })
      return sendJson(res, 200, { storageId, saved: true })
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req)
      const oldPath = normalizeWorkspacePath(body.oldPath)
      const newPath = normalizeWorkspacePath(body.newPath)
      if (!oldPath || !newPath) return sendJson(res, 400, { error: 'Old path and new path are required' })
      if (newPath.startsWith(`${oldPath}/`)) return sendJson(res, 400, { error: 'A folder cannot be renamed inside itself.' })
      const source = path.join(workspace.filesDir, oldPath)
      const target = path.join(workspace.filesDir, newPath)
      await mkdir(path.dirname(target), { recursive: true })
      await rename(source, target)
      await writeManifest(storageId, { fileCount: await countFiles(workspace.filesDir) })
      return sendJson(res, 200, { storageId, saved: true, path: newPath })
    }

    return sendJson(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    console.error(error)
    return sendJson(res, 500, { error: 'Storage operation failed', details: error.message })
  }
})

server.listen(port, () => {
  console.log(`sandbox-storage listening on :${port}`)
  console.log(`data root: ${rootDir}`)
})

function isAuthorized(req) {
  if (!authToken) return true
  return req.headers.authorization === `Bearer ${authToken}`
}

function workspacePaths(storageId) {
  const dir = path.join(rootDir, storageId)
  return {
    dir,
    filesDir: path.join(dir, 'files'),
    manifestPath: path.join(dir, manifestName),
  }
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function normalizeStorageId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : ''
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) throw new Error('Files array is required')
  const byPath = new Map()
  for (const file of files) {
    const normalized = normalizeFile(file)
    byPath.set(normalized.path, normalized)
    if (byPath.size > maxFiles) break
  }
  return Array.from(byPath.values())
}

function normalizeFile(file) {
  const filePath = normalizeWorkspacePath(file?.path)
  const content = typeof file?.content === 'string' ? file.content : ''
  if (!filePath) throw new Error('Invalid file path')
  if (Buffer.byteLength(content, 'utf8') > maxFileBytes) throw new Error(`File too large: ${filePath}`)
  return { path: filePath, content }
}

function normalizeWorkspacePath(value) {
  if (typeof value !== 'string') return ''
  const cleaned = value
    .replace(/\\/g, '/')
    .replace(/^\/?home\/user\/?/, '')
    .replace(/^\/?vercel\/sandbox\/?/, '')
    .replace(/^\/+/, '')
    .trim()
  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) return ''
  const normalized = parts.join('/')
  if (normalized === manifestName || skipPathRe.test(normalized)) return ''
  return normalized
}

async function writeWorkspaceFile(filesDir, filePath, content) {
  const target = path.join(filesDir, filePath)
  if (!target.startsWith(filesDir + path.sep)) throw new Error('Access denied')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, 'utf8')
}

async function listWorkspaceFiles(filesDir, relativeDir = '') {
  const dir = path.join(filesDir, relativeDir)
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = []
  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    if (skipPathRe.test(relativePath)) continue
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

async function countFiles(filesDir) {
  return (await listWorkspaceFiles(filesDir)).length
}

async function readManifest(storageId) {
  const { manifestPath } = workspacePaths(storageId)
  const raw = await readFile(manifestPath, 'utf8').catch(() => '')
  return raw ? JSON.parse(raw) : null
}

async function writeManifest(storageId, updates) {
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

function stringOrEmpty(value) {
  return typeof value === 'string' ? value : ''
}
