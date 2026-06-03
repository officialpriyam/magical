import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let workingDirectory = '/home/user'

  try {
    const {
      command,
      sbxId,
      workingDirectory: wd = '/home/user',
      teamID,
      accessToken
    } = await req.json()

    workingDirectory = wd

    if (!command || !sbxId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const sandbox = await Sandbox.connect(sbxId, {
      ...(teamID && accessToken
        ? {
            headers: {
              'X-Supabase-Team': teamID,
              'X-Supabase-Token': accessToken,
            },
          }
        : {}),
    })

    // Replace pnpm with npm in commands since pnpm isn't available in E2B sandboxes
    const sanitizedCommand = command.replace(/\bpnpm\b/g, 'npm')
    const fullCommand = `cd "${workingDirectory}" && ${sanitizedCommand}`

    const result = await sandbox.commands.run(fullCommand, {
      timeoutMs: 30000,
    })

    // If command failed with 127 (command not found), provide helpful message
    if (result.exitCode === 127) {
      const commandName = sanitizedCommand.split(' ')[0]
      return NextResponse.json({
        stdout: result.stdout,
        stderr: result.stderr || `Command '${commandName}' not found. Available commands: ls, cd, pwd, cat, echo, node, npm, python3, git`,
        exitCode: result.exitCode,
        workingDirectory,
      })
    }

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