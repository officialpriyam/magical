import { NextRequest, NextResponse } from 'next/server'
import { runSandboxCommand } from '@/lib/sandbox-command'
import { createServerClient } from '@/lib/supabase-server'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let workingDirectory = '/home/user'

  try {
    const {
      command,
      sbxId,
      projectID,
      workingDirectory: wd = '/home/user',
      teamID,
      accessToken
    } = await req.json()

    workingDirectory = wd

    if (!command || !sbxId || !projectID) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectID)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await runSandboxCommand({
      command,
      sbxId,
      workingDirectory,
      teamID,
      accessToken,
      timeoutMs: 30_000,
    })

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      workingDirectory,
    })

  } catch (error: any) {
    console.error('Terminal command error:', error)

    // Extract useful error information
    let errorMessage = error.message || 'Failed to execute command'
    let stderr = errorMessage

    // If it's a CommandExitError, extract the actual error
    if (error.result) {
      stderr = error.result.stderr || error.result.error || errorMessage
      errorMessage = `Command failed with exit code ${error.result.exitCode}`
    }

    return NextResponse.json(
      {
        error: errorMessage,
        stderr: stderr,
        stdout: error.result?.stdout || '',
        exitCode: error.result?.exitCode || 1,
        workingDirectory,
      },
      { status: 200 } // Return 200 so the UI can display the error properly
    )
  }
}
