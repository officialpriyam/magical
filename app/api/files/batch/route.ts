import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

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

    // Prepare batch insert data
    const insertData = files.map(file => {
      const pathParts = file.path.split('/')
      const name = pathParts[pathParts.length - 1]
      const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null
      const sizeBytes = Buffer.byteLength(file.content || '', 'utf8')

      return {
        user_id: user.id,
        path: file.path,
        name,
        content: file.content || '',
        is_directory: file.isDirectory || false,
        parent_path: parentPath,
        size_bytes: sizeBytes,
      }
    })

    // Insert all files in a single batch operation
    const { data: insertedFiles, error: insertError } = await supabase
      .from('workspace_files')
      .insert(insertData)
      .select()

    if (insertError) {
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
      files: insertedFiles
    })
  } catch (error) {
    console.error('Error in POST /api/files/batch:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
