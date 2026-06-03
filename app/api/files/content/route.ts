import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  isMissingWorkspaceTableError,
  normalizeWorkspacePath,
  toWorkspaceFileRow,
  toWorkspaceFile,
} from '@/lib/workspace-files'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const path = normalizeWorkspacePath(request.nextUrl.searchParams.get('path') || '')

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

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
      .eq('path', path)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error || !rows?.length) {
      if (error && isMissingWorkspaceTableError(error)) {
        return NextResponse.json(
          { error: 'Workspace file table is not created. Run the Supabase workspace_files migration.' },
          { status: 404 },
        )
      }

      console.error('Error fetching file content:', error)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = toWorkspaceFile(rows[0])

    if (file.is_directory) {
      return NextResponse.json({ error: 'Cannot read content of a directory' }, { status: 400 })
    }

    return NextResponse.json({
      content: file.content,
      path: file.path,
      name: file.name
    })
  } catch (error) {
    console.error('Error in GET /api/files/content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, content } = body
    const normalizedPath = typeof path === 'string' ? normalizeWorkspacePath(path) : ''

    if (!normalizedPath || content === undefined) {
      return NextResponse.json({ error: 'Path and content are required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('workspace_files')
      .select('id')
      .eq('user_id', user.id)
      .eq('path', normalizedPath)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (existingError) {
      if (isMissingWorkspaceTableError(existingError)) {
        return NextResponse.json(
          { error: 'Workspace file table is not created. Run the Supabase workspace_files migration.' },
          { status: 503 },
        )
      }

      console.error('Error finding file to update:', existingError)
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
    }

    const row = toWorkspaceFileRow({
      userId: user.id,
      path: normalizedPath,
      content,
      isDirectory: false,
    })

    const existingId = existingRows?.[0]?.id
    const query = existingId
      ? supabase
          .from('workspace_files')
          .update({
            name: row.name,
            content: row.content,
            is_directory: row.is_directory,
            parent_path: row.parent_path,
            size_bytes: row.size_bytes,
            mime_type: row.mime_type,
            metadata: row.metadata,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', existingId)
          .select()
          .single()
      : supabase
          .from('workspace_files')
          .insert(row as never)
          .select()
          .single()

    const { data: file, error } = await query

    if (error) {
      if (isMissingWorkspaceTableError(error)) {
        return NextResponse.json(
          { error: 'Workspace file table is not created. Run the Supabase workspace_files migration.' },
          { status: 503 },
        )
      }

      console.error('Error updating file content:', error)
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
    }

    return NextResponse.json({ success: true, file: toWorkspaceFile(file) })
  } catch (error) {
    console.error('Error in POST /api/files/content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
