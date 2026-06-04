import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  getWorkspaceFileParts,
  isMissingWorkspaceTableError,
  normalizeWorkspacePath,
  toFileUploadRow,
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
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from('file_uploads')
          .select('id, file_name, file_path, file_size, mime_type, metadata, updated_at')
          .eq('user_id', user.id)
          .eq('bucket_name', 'workspace-files')
          .order('file_path', { ascending: true })

        if (fallbackError) {
          console.warn('workspace_files table is missing and file_uploads fallback failed:', fallbackError)
          return NextResponse.json([])
        }

        const files = dedupeWorkspaceFiles((fallbackRows || []).map(toWorkspaceFile))
        return NextResponse.json(buildFileTree(files))
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
        const fallback = await upsertFileUploadFallback(
          supabase,
          user.id,
          normalizedPath,
          content,
          Boolean(isDirectory),
        )

        if (fallback.error) {
          return NextResponse.json({ error: fallback.error }, { status: fallback.status })
        }

        return NextResponse.json({ success: true, file: fallback.file })
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
        return deleteFileUploadFallback(supabase, user.id, normalizedPath)
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const oldPath = typeof body.oldPath === 'string' ? normalizeWorkspacePath(body.oldPath) : ''
    const newPath = typeof body.newPath === 'string' ? normalizeWorkspacePath(body.newPath) : ''

    if (!oldPath || !newPath) {
      return NextResponse.json({ error: 'Old path and new path are required' }, { status: 400 })
    }

    if (oldPath === newPath) {
      return NextResponse.json({ success: true, path: newPath })
    }

    if (newPath.startsWith(`${oldPath}/`)) {
      return NextResponse.json(
        { error: 'A folder cannot be renamed inside itself.' },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()

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
        return renameFileUploadFallback(supabase, user.id, oldPath, newPath)
      }

      console.error('Error finding workspace files to rename:', fetchError)
      return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 })
    }

    const affectedRows = (rows || []).filter(
      (row: any) => row.path === oldPath || row.path.startsWith(`${oldPath}/`),
    )

    if (affectedRows.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const affectedIds = new Set(affectedRows.map((row: any) => row.id))
    const targetConflict = (rows || []).some(
      (row: any) =>
        !affectedIds.has(row.id) &&
        (row.path === newPath || row.path.startsWith(`${newPath}/`)),
    )

    if (targetConflict) {
      return NextResponse.json(
        { error: 'A file or folder already exists at the target path.' },
        { status: 409 },
      )
    }

    for (const row of affectedRows) {
      const renamedPath = row.path === oldPath
        ? newPath
        : `${newPath}/${row.path.slice(oldPath.length + 1)}`
      const parts = getWorkspaceFileParts(renamedPath)

      const { error } = await supabase
        .from('workspace_files')
        .update({
          path: parts.path,
          name: parts.name,
          parent_path: parts.parentPath,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id)

      if (error) {
        console.error('Error renaming workspace file:', error)
        return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, path: newPath })
  } catch (error) {
    console.error('Error in PATCH /api/files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function upsertFileUploadFallback(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  path: string,
  content: string,
  isDirectory: boolean,
) {
  const { error: deleteError } = await supabase
    .from('file_uploads')
    .delete()
    .eq('user_id', userId)
    .eq('bucket_name', 'workspace-files')
    .eq('file_path', path)

  if (deleteError && isMissingWorkspaceTableError(deleteError)) {
    return {
      error: 'Supabase file storage tables are missing. Run the Magical AI database schema in Supabase.',
      status: 503,
    }
  }

  if (deleteError) {
    console.error('Error replacing fallback workspace file:', deleteError)
    return { error: 'Failed to create file', status: 500 }
  }

  const { data: file, error } = await supabase
    .from('file_uploads')
    .insert(toFileUploadRow({
      userId,
      path,
      content,
      isDirectory,
    }) as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating fallback workspace file:', error)
    return { error: 'Failed to create file', status: 500 }
  }

  return { file: toWorkspaceFile(file), status: 200 }
}

async function deleteFileUploadFallback(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  path: string,
) {
  const { data: rows, error: fetchError } = await supabase
    .from('file_uploads')
    .select('id, file_path')
    .eq('user_id', userId)
    .eq('bucket_name', 'workspace-files')

  if (fetchError) {
    if (isMissingWorkspaceTableError(fetchError)) {
      return NextResponse.json({ success: true })
    }

    console.error('Error finding fallback workspace files to delete:', fetchError)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }

  const ids = (rows || [])
    .filter((row: any) => row.file_path === path || row.file_path.startsWith(`${path}/`))
    .map((row: any) => row.id)

  if (ids.length === 0) {
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase
    .from('file_uploads')
    .delete()
    .in('id', ids)

  if (error) {
    console.error('Error deleting fallback workspace file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function renameFileUploadFallback(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  oldPath: string,
  newPath: string,
) {
  const { data: rows, error: fetchError } = await supabase
    .from('file_uploads')
    .select('id, file_path, metadata')
    .eq('user_id', userId)
    .eq('bucket_name', 'workspace-files')

  if (fetchError) {
    console.error('Error finding fallback workspace files to rename:', fetchError)
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 })
  }

  const affectedRows = (rows || []).filter(
    (row: any) => row.file_path === oldPath || row.file_path.startsWith(`${oldPath}/`),
  )

  if (affectedRows.length === 0) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const affectedIds = new Set(affectedRows.map((row: any) => row.id))
  const targetConflict = (rows || []).some(
    (row: any) =>
      !affectedIds.has(row.id) &&
      (row.file_path === newPath || row.file_path.startsWith(`${newPath}/`)),
  )

  if (targetConflict) {
    return NextResponse.json(
      { error: 'A file or folder already exists at the target path.' },
      { status: 409 },
    )
  }

  for (const row of affectedRows) {
    const renamedPath = row.file_path === oldPath
      ? newPath
      : `${newPath}/${row.file_path.slice(oldPath.length + 1)}`
    const parts = getWorkspaceFileParts(renamedPath)
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}

    const { error } = await supabase
      .from('file_uploads')
      .update({
        file_path: parts.path,
        file_name: parts.name,
        metadata: {
          ...metadata,
          parent_path: parts.parentPath,
        },
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', row.id)

    if (error) {
      console.error('Error renaming fallback workspace file:', error)
      return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, path: newPath })
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
