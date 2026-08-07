import { Sandbox } from '@e2b/code-interpreter'
import { FileSystemNode } from '@/components/file-tree'
import { decodeSandboxId } from '@/lib/sandbox-provider'
import { getVercelSandbox, listVercelSandboxFiles } from '@/lib/vercel-sandbox'

export const maxDuration = 15
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * GET /api/sandbox/[sbxId]/files
 * Fetches the file tree from an E2B sandbox
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sbxId: string }> }
) {
  try {
    const { sbxId } = await params

    if (!sbxId) {
      return new Response(
        JSON.stringify({ error: 'Missing sandbox ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const sandboxRef = decodeSandboxId(sbxId)

    if (sandboxRef.provider === 'vercel') {
      try {
        const sbx = await getVercelSandbox(sandboxRef.id)
        const files = await Promise.race([
          listVercelSandboxFiles(sbx),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_list_timeout')), 5000)),
        ])

        return new Response(
          JSON.stringify({ files }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        return new Response(
          JSON.stringify({ files: [], error: 'Sandbox file listing timed out' }),
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

    // Use E2B SDK's files.list() method for robust file listing
    const filesList = await Promise.race([
      sbx.files.list('/home/user'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sandbox_list_timeout')), 5000)),
    ])

    // Convert E2B file structure to our FileSystemNode format
    const files = convertE2BFilesToTree(filesList)

    return new Response(
      JSON.stringify({ files }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error fetching sandbox files:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch sandbox files',
        details: error?.message || 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Convert E2B file list to our FileSystemNode structure
 */
function convertE2BFilesToTree(e2bFiles: any[]): FileSystemNode[] {
  return e2bFiles.map(file => {
    const node: FileSystemNode = {
      name: file.name,
      isDirectory: file.isDir,
      path: `/${file.path}`,
    }

    // Recursively convert children if it's a directory
    if (file.isDir && file.children) {
      node.children = convertE2BFilesToTree(file.children)
    }

    return node
  })
}
