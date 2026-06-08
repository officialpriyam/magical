import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest } from 'next/server'
import path from 'path'
import { createServerClient } from '@/lib/supabase-server'
import {
  deleteProjectFileFromR2,
  renameProjectFileInR2,
  saveProjectFileToR2,
} from '@/lib/r2-workspace'
import { decodeSandboxId } from '@/lib/sandbox-provider'
import {
  deleteVercelSandboxFile,
  getVercelSandbox,
  readVercelSandboxFile,
  renameVercelSandboxFile,
  writeVercelSandboxFile,
} from '@/lib/vercel-sandbox'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * GET /api/sandbox/[sbxId]/files/content?path=/path/to/file
 * Fetches the content of a specific file from an E2B sandbox
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sbxId: string }> }
) {
  try {
    const { sbxId } = await params
    const searchParams = req.nextUrl.searchParams
    const filePath = searchParams.get('path')

    if (!sbxId) {
      return new Response(
        JSON.stringify({ error: 'Missing sandbox ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'Missing file path' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const sandboxRef = decodeSandboxId(sbxId)

    if (sandboxRef.provider === 'vercel') {
      const sbx = await getVercelSandbox(sandboxRef.id)
      const content = await readVercelSandboxFile(sbx, filePath)

      return new Response(
        JSON.stringify({
          content,
          path: filePath
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E2B_API_KEY not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to existing sandbox
    const sbx = await Sandbox.connect(sandboxRef.id)

    // Sanitize path to prevent path traversal attacks
    const userDir = '/home/user'

    // If path already starts with /home/user, use it as-is; otherwise join with userDir
    const normalizedPath = filePath.startsWith(userDir)
      ? path.normalize(filePath)
      : path.normalize(path.join(userDir, filePath))

    // Verify the normalized path is still within the allowed directory
    if (!normalizedPath.startsWith(userDir + '/') && normalizedPath !== userDir) {
      return new Response(
        JSON.stringify({ error: 'Access denied: Invalid path' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Use E2B SDK's files.read() method for robust file reading
    const relativePath = normalizedPath === userDir ? '' : normalizedPath.substring(userDir.length + 1)
    const content = await sbx.files.read(relativePath)

    return new Response(
      JSON.stringify({
        content,
        path: filePath
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error fetching file content:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch file content',
        details: error?.message || 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sbxId: string }> }
) {
  try {
    const { sbxId } = await params
    const { oldPath, newPath, projectID } = await req.json()

    if (!sbxId) {
      return jsonResponse({ error: 'Missing sandbox ID' }, 400)
    }

    if (!oldPath || !newPath) {
      return jsonResponse({ error: 'Missing old path or new path' }, 400)
    }

    const sandboxRef = decodeSandboxId(sbxId)

    if (sandboxRef.provider === 'vercel') {
      const sbx = await getVercelSandbox(sandboxRef.id)
      await renameVercelSandboxFile(sbx, oldPath, newPath)
      await persistR2Rename(projectID, oldPath, newPath)

      return jsonResponse({ success: true, path: newPath })
    }

    if (!process.env.E2B_API_KEY) {
      return jsonResponse({ error: 'E2B_API_KEY not configured' }, 503)
    }

    const sbx = await Sandbox.connect(sandboxRef.id)
    await sbx.files.rename(toSandboxRelativePath(oldPath), toSandboxRelativePath(newPath))
    await persistR2Rename(projectID, oldPath, newPath)

    return jsonResponse({ success: true, path: newPath })
  } catch (error: any) {
    console.error('Error renaming sandbox file:', error)
    return jsonResponse({
      error: 'Failed to rename file',
      details: error?.message || 'Unknown error',
    }, 500)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sbxId: string }> }
) {
  try {
    const { sbxId } = await params
    const { path: filePath, projectID } = await req.json()

    if (!sbxId) {
      return jsonResponse({ error: 'Missing sandbox ID' }, 400)
    }

    if (!filePath) {
      return jsonResponse({ error: 'Missing file path' }, 400)
    }

    const sandboxRef = decodeSandboxId(sbxId)

    if (sandboxRef.provider === 'vercel') {
      const sbx = await getVercelSandbox(sandboxRef.id)
      await deleteVercelSandboxFile(sbx, filePath)
      await persistR2Delete(projectID, filePath)

      return jsonResponse({ success: true })
    }

    if (!process.env.E2B_API_KEY) {
      return jsonResponse({ error: 'E2B_API_KEY not configured' }, 503)
    }

    const sbx = await Sandbox.connect(sandboxRef.id)
    await sbx.files.remove(toSandboxRelativePath(filePath))
    await persistR2Delete(projectID, filePath)

    return jsonResponse({ success: true })
  } catch (error: any) {
    console.error('Error deleting sandbox file:', error)
    return jsonResponse({
      error: 'Failed to delete file',
      details: error?.message || 'Unknown error',
    }, 500)
  }
}

/**
 * POST /api/sandbox/[sbxId]/files/content
 * Writes content to a specific file in an E2B sandbox
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sbxId: string }> }
) {
  try {
    const { sbxId } = await params
    const { path: filePath, content, projectID } = await req.json()

    if (!sbxId) {
      return new Response(
        JSON.stringify({ error: 'Missing sandbox ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!filePath || content === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing file path or content' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const sandboxRef = decodeSandboxId(sbxId)

    if (sandboxRef.provider === 'vercel') {
      const sbx = await getVercelSandbox(sandboxRef.id)
      await writeVercelSandboxFile(sbx, filePath, content)
      await persistR2File(projectID, filePath, content)

      return new Response(
        JSON.stringify({
          success: true,
          path: filePath
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E2B_API_KEY not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to existing sandbox
    const sbx = await Sandbox.connect(sandboxRef.id)

    // Sanitize path to prevent path traversal attacks
    const userDir = '/home/user'

    const normalizedPath = filePath.startsWith(userDir)
      ? path.normalize(filePath)
      : path.normalize(path.join(userDir, filePath))

    // Verify the normalized path is still within the allowed directory
    if (!normalizedPath.startsWith(userDir + '/') && normalizedPath !== userDir) {
      return new Response(
        JSON.stringify({ error: 'Access denied: Invalid path' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // E2B files.write expects path relative to /home/user
    const relativePath = normalizedPath === userDir ? '' : normalizedPath.substring(userDir.length + 1)
    await sbx.files.write(relativePath, content)
    await persistR2File(projectID, filePath, content)

    return new Response(
      JSON.stringify({
        success: true,
        path: filePath
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error writing file content:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to write file content',
        details: error?.message || 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function toSandboxRelativePath(filePath: string) {
  const userDir = '/home/user'
  const normalizedPath = filePath.startsWith(userDir)
    ? path.normalize(filePath)
    : path.normalize(path.join(userDir, filePath))

  if (!normalizedPath.startsWith(userDir + '/') && normalizedPath !== userDir) {
    throw new Error('Access denied: Invalid path')
  }

  return normalizedPath === userDir ? '' : normalizedPath.substring(userDir.length + 1)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function persistR2File(projectID: unknown, filePath: unknown, content: unknown) {
  if (typeof projectID !== 'string' || typeof filePath !== 'string' || typeof content !== 'string') {
    return
  }

  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return
  }

  try {
    await saveProjectFileToR2({
      userId,
      projectId: projectID,
      path: filePath,
      content,
    })
  } catch (error) {
    console.warn('Cloudflare R2 sandbox file backup failed:', error)
  }
}

async function persistR2Delete(projectID: unknown, filePath: unknown) {
  if (typeof projectID !== 'string' || typeof filePath !== 'string') {
    return
  }

  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return
  }

  try {
    await deleteProjectFileFromR2({
      userId,
      projectId: projectID,
      path: filePath,
    })
  } catch (error) {
    console.warn('Cloudflare R2 sandbox delete backup failed:', error)
  }
}

async function persistR2Rename(projectID: unknown, oldPath: unknown, newPath: unknown) {
  if (
    typeof projectID !== 'string' ||
    typeof oldPath !== 'string' ||
    typeof newPath !== 'string'
  ) {
    return
  }

  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return
  }

  try {
    await renameProjectFileInR2({
      userId,
      projectId: projectID,
      oldPath,
      newPath,
    })
  } catch (error) {
    console.warn('Cloudflare R2 sandbox rename backup failed:', error)
  }
}

async function getAuthenticatedUserId() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return user?.id || ''
  } catch {
    return ''
  }
}
