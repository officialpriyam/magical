import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest } from 'next/server'
import path from 'path'

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

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E2B_API_KEY not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to existing sandbox
    const sbx = await Sandbox.connect(sbxId)

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
    const { path: filePath, content } = await req.json()

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

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'E2B_API_KEY not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to existing sandbox
    const sbx = await Sandbox.connect(sbxId)

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
