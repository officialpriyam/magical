import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  isMissingWorkspaceTableError,
  normalizeWorkspacePath,
  toWorkspaceFileRow,
  toWorkspaceFile,
  type WorkspaceFile,
} from '@/lib/workspace-files'

export const dynamic = 'force-dynamic'

// Helper function to build file tree from flat list
function buildFileTree(files: WorkspaceFile[]): any[] {
  const tree: any[] = []
  const pathMap = new Map<string, any>()

  // Sort files by path to ensure parents are processed before children
  const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sortedFiles) {
    const node = {
      name: file.name,
      path: file.path,
      isDirectory: file.is_directory,
      children: file.is_directory ? [] : undefined,
    }

    pathMap.set(file.path, node)

    if (file.parent_path) {
      const parent = pathMap.get(file.parent_path)
      if (parent && parent.children) {
        parent.children.push(node)
      } else {
        tree.push(node)
      }
    } else {
      tree.push(node)
    }
  }

  return tree
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from('workspace_files')
      .select('id, name, path, content, is_directory, parent_path, size_bytes, metadata, updated_at')
      .eq('user_id', user.id)
      .order('path', { ascending: true })

    if (error) {
      if (isMissingWorkspaceTableError(error)) {
        console.warn('workspace_files table is missing; returning an empty workspace file list.')
        return NextResponse.json([])
      }

      console.error('Error fetching workspace files:', error)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }

    const files = dedupeWorkspaceFiles((rows || []).map(toWorkspaceFile))

    // Build file tree structure
    const fileTree = buildFileTree(files)

    return NextResponse.json(fileTree)
  } catch (error) {
    console.error('Error in GET /api/files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, isDirectory, content = '' } = body
    const normalizedPath = typeof path === 'string' ? normalizeWorkspacePath(path) : ''

    if (!normalizedPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: file, error } = await supabase
      .from('workspace_files')
      .upsert(toWorkspaceFileRow({
        userId: user.id,
        path: normalizedPath,
        content,
        isDirectory,
      }) as never, { onConflict: 'user_id,path' })
      .select()
      .single()

    if (error) {
      if (isMissingWorkspaceTableError(error)) {
        return NextResponse.json(
          { error: 'Workspace file table is not created. Run the Supabase workspace_files migration.' },
          { status: 503 },
        )
      }

      console.error('Error creating workspace file:', error)
      return NextResponse.json({ error: 'Failed to create file' }, { status: 500 })
    }

    return NextResponse.json({ success: true, file: toWorkspaceFile(file) })
  } catch (error) {
    console.error('Error in POST /api/files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { path } = body
    const normalizedPath = typeof path === 'string' ? normalizeWorkspacePath(path) : ''

    if (!normalizedPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rows, error: fetchError } = await supabase
      .from('workspace_files')
      .select('id, path')
      .eq('user_id', user.id)

    if (fetchError) {
      if (isMissingWorkspaceTableError(fetchError)) {
        return NextResponse.json({ success: true })
      }

      console.error('Error finding workspace files to delete:', fetchError)
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    const ids = (rows || [])
      .filter((row: any) => row.path === normalizedPath || row.path.startsWith(`${normalizedPath}/`))
      .map((row: any) => row.id)

    if (ids.length === 0) {
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase
      .from('workspace_files')
      .delete()
      .in('id', ids)

    if (error) {
      if (isMissingWorkspaceTableError(error)) {
        return NextResponse.json({ success: true })
      }

      console.error('Error deleting workspace file:', error)
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function dedupeWorkspaceFiles(files: WorkspaceFile[]) {
  const byPath = new Map<string, WorkspaceFile>()

  for (const file of files) {
    const existing = byPath.get(file.path)
    if (!existing || new Date(file.updated_at || 0) > new Date(existing.updated_at || 0)) {
      byPath.set(file.path, file)
    }
  }

  return Array.from(byPath.values())
}
