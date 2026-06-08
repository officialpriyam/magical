import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest, NextResponse } from 'next/server'
import { decodeSandboxId } from '@/lib/sandbox-provider'
import { getVercelSandbox, runVercelShellCommand, VERCEL_WORKDIR } from '@/lib/vercel-sandbox'

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

    const sandboxRef = decodeSandboxId(sbxId)

    // Replace pnpm with npm in commands since pnpm isn't available in E2B sandboxes
    const sanitizedCommand = command.replace(/\bpnpm\b/g, 'npm')

    if (sandboxRef.provider === 'vercel') {
      const sandbox = await getVercelSandbox(sandboxRef.id)
      const result = await runVercelShellCommand(sandbox, sanitizedCommand, {
        cwd: toVercelWorkingDirectory(workingDirectory),
        timeoutMs: 30000,
      }) as {
        exitCode: number
        stdout(): Promise<string>
        stderr(): Promise<string>
      }
      const [stdout, stderr] = await Promise.all([
        result.stdout().catch(() => ''),
        result.stderr().catch(() => ''),
      ])

      if (result.exitCode === 127) {
        const commandName = sanitizedCommand.split(' ')[0]
        return NextResponse.json({
          stdout,
          stderr: stderr || `Command '${commandName}' not found. Available commands: ls, cd, pwd, cat, echo, node, npm, python3, git`,
          exitCode: result.exitCode,
          workingDirectory,
        })
      }

      return NextResponse.json({
        stdout,
        stderr,
        exitCode: result.exitCode,
        workingDirectory,
      })
    }

    const sandbox = await Sandbox.connect(sandboxRef.id, {
      ...(teamID && accessToken
        ? {
            headers: {
              'X-Supabase-Team': teamID,
              'X-Supabase-Token': accessToken,
            },
          }
        : {}),
    })

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

function toVercelWorkingDirectory(value: string) {
  if (!value || value === '/home/user') {
    return VERCEL_WORKDIR
  }

  if (value.startsWith(VERCEL_WORKDIR)) {
    return value
  }

  if (value.startsWith('/home/user/')) {
    return `${VERCEL_WORKDIR}/${value.slice('/home/user/'.length)}`
  }

  if (value.startsWith('/')) {
    return `${VERCEL_WORKDIR}${value}`
  }

  return `${VERCEL_WORKDIR}/${value}`
}
