import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  isMissingWorkspaceTableError,
  normalizeWorkspacePath,
  toFileUploadRow,
  toWorkspaceFileRow,
  toWorkspaceFile,
} from '@/lib/workspace-files'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large imports

interface BatchFileInput {
  path: string
  content: string
  isDirectory?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { files } = body as { files: BatchFileInput[] }

    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Files array is required' }, { status: 400 })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Files array cannot be empty' }, { status: 400 })
    }

    // Limit batch size to prevent abuse
    if (files.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 files per batch' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const insertData = files
      .map((file) => ({
        ...file,
        path: normalizeWorkspacePath(file.path),
      }))
      .filter((file) => file.path)
      .map((file) =>
        toWorkspaceFileRow({
          userId: user.id,
          path: file.path,
          content: file.content || '',
          isDirectory: file.isDirectory || false,
        }),
      )

    const paths = insertData.map((file) => file.path)

    if (paths.length === 0) {
      return NextResponse.json({ error: 'No valid files to import' }, { status: 400 })
    }

    await supabase
      .from('workspace_files')
      .delete()
      .eq('user_id', user.id)
      .in('path', paths)

    // Insert all files in a single batch operation
    const { data: insertedFiles, error: insertError } = await supabase
      .from('workspace_files')
      .insert(insertData as never)
      .select()

    if (insertError) {
      if (isMissingWorkspaceTableError(insertError)) {
        const fallbackRows = files
          .map((file) => ({
            ...file,
            path: normalizeWorkspacePath(file.path),
          }))
          .filter((file) => file.path)
          .map((file) =>
            toFileUploadRow({
              userId: user.id,
              path: file.path,
              content: file.content || '',
              isDirectory: file.isDirectory || false,
            }),
          )

        await supabase
          .from('file_uploads')
          .delete()
          .eq('user_id', user.id)
          .eq('bucket_name', 'workspace-files')
          .in('file_path', paths)

        const { data: fallbackFiles, error: fallbackError } = await supabase
          .from('file_uploads')
          .insert(fallbackRows as never)
          .select()

        if (fallbackError) {
          console.error('Error batch inserting fallback workspace files:', fallbackError)
          return NextResponse.json({
            error: 'Failed to import files',
            details: fallbackError.message,
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          imported: fallbackFiles?.length || 0,
          files: (fallbackFiles || []).map(toWorkspaceFile),
        })
      }

      console.error('Error batch inserting files:', insertError)

      // Check if it's a duplicate key error
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'Some files already exist. Delete them first or use update endpoint.',
          details: insertError.message
        }, { status: 409 })
      }

      return NextResponse.json({
        error: 'Failed to import files',
        details: insertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: insertedFiles?.length || 0,
      files: (insertedFiles || []).map(toWorkspaceFile)
    })
  } catch (error) {
    console.error('Error in POST /api/files/batch:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
