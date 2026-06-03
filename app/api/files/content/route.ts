import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the file content
    const { data: file, error } = await supabase
      .from('workspace_files')
      .select('content, path, name, is_directory')
      .eq('user_id', user.id)
      .eq('path', path)
      .single()

    if (error) {
      console.error('Error fetching file content:', error)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

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

    if (!path || content === undefined) {
      return NextResponse.json({ error: 'Path and content are required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate content size
    const sizeBytes = Buffer.byteLength(content, 'utf8')

    // Update the file content (updated_at handled by database trigger)
    const { data: file, error } = await supabase
      .from('workspace_files')
      .update({
        content,
        size_bytes: sizeBytes
      })
      .eq('user_id', user.id)
      .eq('path', path)
      .select()
      .single()

    if (error) {
      console.error('Error updating file content:', error)
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
    }

    return NextResponse.json({ success: true, file })
  } catch (error) {
    console.error('Error in POST /api/files/content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
