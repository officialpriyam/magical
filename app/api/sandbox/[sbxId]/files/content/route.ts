import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest } from 'next/server'
import path from 'path'
import { createServerClient } from '@/lib/supabase-server'
import {
  deleteProjectFileFromR2,
  renameProjectFileInR2,
  saveProjectFileToR2,
} from '@/lib/r2-workspace'
import {
  deleteProjectFileFromSandboxStorage,
  renameProjectFileInSandboxStorage,
  saveProjectFileToSandboxStorage,
} from '@/lib/sandbox-storage'
import { decodeSandboxId } from '@/lib/sandbox-provider'
import {
  deleteVercelSandboxFile,
  getVercelSandbox,
  readVercelSandboxFile,
  renameVercelSandboxFile,
  writeVercelSandboxFile,
} from '@/lib/vercel-sandbox'
import {
  deleteModalSandboxFile,
  getModalSandbox,
  readModalSandboxFile,
  renameModalSandboxFile,
  writeModalSandboxFile,
} from '@/lib/modal-sandbox'

export const maxDuration = 15
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * GET /api/sandbox/[sbxId]/files/content?path=/path/to/file
 * Fetches the content of a specific file from a sandbox
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
      try {
        const sbx = await Promise.race([
          getVercelSandbox(sandboxRef.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 5000)),
        ])
        const content = await Promise.race([
          readVercelSandboxFile(sbx, filePath),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_read_timeout')), 5000)),
        ])

        return new Response(
          JSON.stringify({
            content,
            path: filePath
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      } catch {
        return new Response(
          JSON.stringify({ error: 'Sandbox file read timed out' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    if (sandboxRef.provider === 'modal') {
      try {
        const sbx = await Promise.race([
          getModalSandbox(sandboxRef.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 5000)),
        ])
        const content = await Promise.race([
          readModalSandboxFile(sbx, filePath),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_read_timeout')), 5000)),
        ])

        return new Response(
          JSON.stringify({
            content,
            path: filePath
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      } catch {
        return new Response(
          JSON.stringify({ error: 'Modal sandbox file read timed out' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E2B_API_KEY not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to existing sandbox
    const sbx = await Promise.race([
      Sandbox.connect(sandboxRef.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 5000)),
    ])

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
    const content = await Promise.race([
      sbx.files.read(relativePath),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_read_timeout')), 8000)),
    ])

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
      await Promise.all([
        persistProjectRename(projectID, oldPath, newPath),
        renameVercelSandboxFile(sbx, oldPath, newPath),
      ])

      return jsonResponse({ success: true, path: newPath })
    }

    if (sandboxRef.provider === 'modal') {
      const sbx = await getModalSandbox(sandboxRef.id)
      await Promise.all([
        persistProjectRename(projectID, oldPath, newPath),
        renameModalSandboxFile(sbx, oldPath, newPath),
      ])

      return jsonResponse({ success: true, path: newPath })
    }

    if (!process.env.E2B_API_KEY) {
      return jsonResponse({ error: 'E2B_API_KEY not configured' }, 503)
    }

    const sbx = await Promise.race([
      Sandbox.connect(sandboxRef.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
    ])
    await Promise.all([
      persistProjectRename(projectID, oldPath, newPath),
      sbx.files.rename(toSandboxRelativePath(oldPath), toSandboxRelativePath(newPath)),
    ])

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
      try {
        const sbx = await Promise.race([
          getVercelSandbox(sandboxRef.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
        ])
        await Promise.all([
          persistProjectDelete(projectID, filePath),
          Promise.race([
            deleteVercelSandboxFile(sbx, filePath),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_delete_timeout')), 8000)),
          ]),
        ])

        return jsonResponse({ success: true })
      } catch {
        return jsonResponse({ error: 'Sandbox delete timed out' }, 504)
      }
    }

    if (sandboxRef.provider === 'modal') {
      try {
        const sbx = await Promise.race([
          getModalSandbox(sandboxRef.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
        ])
        await Promise.all([
          persistProjectDelete(projectID, filePath),
          Promise.race([
            deleteModalSandboxFile(sbx, filePath),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_delete_timeout')), 8000)),
          ]),
        ])

        return jsonResponse({ success: true })
      } catch {
        return jsonResponse({ error: 'Modal sandbox delete timed out' }, 504)
      }
    }

    if (!process.env.E2B_API_KEY) {
      return jsonResponse({ error: 'E2B_API_KEY not configured' }, 503)
    }

    const sbx = await Promise.race([
      Sandbox.connect(sandboxRef.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
    ])
    await Promise.all([
      persistProjectDelete(projectID, filePath),
      Promise.race([
        sbx.files.remove(toSandboxRelativePath(filePath)),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_delete_timeout')), 8000)),
      ]),
    ])

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
 * Writes content to a specific file in a sandbox
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
      try {
        const sbx = await Promise.race([
          getVercelSandbox(sandboxRef.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
        ])
        await Promise.all([
          persistProjectFile(projectID, filePath, content),
          Promise.race([
            writeVercelSandboxFile(sbx, filePath, content),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_write_timeout')), 8000)),
          ]),
        ])

        return new Response(
          JSON.stringify({
            success: true,
            path: filePath
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      } catch {
        return new Response(
          JSON.stringify({ error: 'Sandbox write timed out' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    if (sandboxRef.provider === 'modal') {
      try {
        const sbx = await Promise.race([
          getModalSandbox(sandboxRef.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
        ])
        await Promise.all([
          persistProjectFile(projectID, filePath, content),
          Promise.race([
            writeModalSandboxFile(sbx, filePath, content),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_write_timeout')), 8000)),
          ]),
        ])

        return new Response(
          JSON.stringify({
            success: true,
            path: filePath
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      } catch {
        return new Response(
          JSON.stringify({ error: 'Modal sandbox write timed out' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E2B_API_KEY not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to existing sandbox
    const sbx = await Promise.race([
      Sandbox.connect(sandboxRef.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_connect_timeout')), 8000)),
    ])

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
    await Promise.all([
      persistProjectFile(projectID, filePath, content),
      Promise.race([
        sbx.files.write(relativePath, content),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_write_timeout')), 8000)),
      ]),
    ])

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

async function persistProjectFile(projectID: unknown, filePath: unknown, content: unknown) {
  if (typeof projectID !== 'string' || typeof filePath !== 'string' || typeof content !== 'string') {
    return
  }

  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return
  }

  try {
    const result = await saveProjectFileToSandboxStorage({
      userId,
      projectId: projectID,
      path: filePath,
      content,
    })

    if (!result.saved && result.reason === 'not_configured') {
      await saveProjectFileToR2({
        userId,
        projectId: projectID,
        path: filePath,
        content,
      })
    }
  } catch (error) {
    console.warn('External sandbox storage file backup failed:', error)
    await saveProjectFileToR2({
      userId,
      projectId: projectID,
      path: filePath,
      content,
    })
  }
}

async function persistProjectDelete(projectID: unknown, filePath: unknown) {
  if (typeof projectID !== 'string' || typeof filePath !== 'string') {
    return
  }

  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return
  }

  try {
    const result = await deleteProjectFileFromSandboxStorage({
      userId,
      projectId: projectID,
      path: filePath,
    })

    if (!result.saved && result.reason === 'not_configured') {
      await deleteProjectFileFromR2({
        userId,
        projectId: projectID,
        path: filePath,
      })
    }
  } catch (error) {
    console.warn('External sandbox storage delete backup failed:', error)
    await deleteProjectFileFromR2({
      userId,
      projectId: projectID,
      path: filePath,
    })
  }
}

async function persistProjectRename(projectID: unknown, oldPath: unknown, newPath: unknown) {
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
    const result = await renameProjectFileInSandboxStorage({
      userId,
      projectId: projectID,
      oldPath,
      newPath,
    })

    if (!result.saved && result.reason === 'not_configured') {
      await renameProjectFileInR2({
        userId,
        projectId: projectID,
        oldPath,
        newPath,
      })
    }
  } catch (error) {
    console.warn('External sandbox storage rename backup failed:', error)
    await renameProjectFileInR2({
      userId,
      projectId: projectID,
      oldPath,
      newPath,
    })
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
