import 'server-only'

import { Sandbox } from '@e2b/code-interpreter'
import { decodeSandboxId } from '@/lib/sandbox-provider'
import { getVercelSandbox, runVercelShellCommand, VERCEL_WORKDIR } from '@/lib/vercel-sandbox'
import { getModalSandbox, runModalShellCommand, MODAL_WORKDIR } from '@/lib/modal-sandbox'

export type SandboxCommandResult = {
  stdout: string
  stderr: string
  exitCode: number
  workingDirectory: string
}

export async function runSandboxCommand({
  command,
  sbxId,
  workingDirectory = '/home/user',
  teamID,
  accessToken,
  timeoutMs = 30_000,
}: {
  command: string
  sbxId: string
  workingDirectory?: string
  teamID?: string
  accessToken?: string
  timeoutMs?: number
}): Promise<SandboxCommandResult> {
  const sandboxRef = decodeSandboxId(sbxId)
  const sanitizedCommand = command.replace(/\bpnpm\b/g, 'npm')

  if (sandboxRef.provider === 'vercel') {
    const sandbox = await getVercelSandbox(sandboxRef.id)
    const result = await runVercelShellCommand(sandbox, sanitizedCommand, {
      cwd: toVercelWorkingDirectory(workingDirectory),
      timeoutMs,
    }) as {
      exitCode: number
      stdout(): Promise<string>
      stderr(): Promise<string>
    }

    const [stdout, stderr] = await Promise.all([
      result.stdout().catch(() => ''),
      result.stderr().catch(() => ''),
    ])

    return {
      stdout,
      stderr: commandNotFoundMessage(sanitizedCommand, result.exitCode, stderr),
      exitCode: result.exitCode,
      workingDirectory,
    }
  }

  if (sandboxRef.provider === 'modal') {
    const sandbox = await getModalSandbox(sandboxRef.id)
    const proc = await runModalShellCommand(sandbox, sanitizedCommand, {
      cwd: toModalWorkingDirectory(workingDirectory),
      timeoutMs,
    })
    const exitCode = await proc.wait()
    const [stdout, stderr] = await Promise.all([
      proc.stdout.readText().catch(() => ''),
      proc.stderr.readText().catch(() => ''),
    ])

    return {
      stdout,
      stderr: commandNotFoundMessage(sanitizedCommand, exitCode, stderr),
      exitCode,
      workingDirectory,
    }
  }

  if (sandboxRef.provider === 'daytona') {
    return {
      stdout: '',
      stderr: 'Command execution is not implemented for Daytona sandboxes yet.',
      exitCode: 1,
      workingDirectory,
    }
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

  const result = await sandbox.commands.run(`cd ${shellQuote(workingDirectory)} && ${sanitizedCommand}`, {
    timeoutMs,
  })

  return {
    stdout: result.stdout,
    stderr: commandNotFoundMessage(sanitizedCommand, result.exitCode, result.stderr),
    exitCode: result.exitCode,
    workingDirectory,
  }
}

function commandNotFoundMessage(command: string, exitCode: number, stderr: string) {
  if (exitCode !== 127) return stderr

  const commandName = command.split(' ')[0]
  return stderr || `Command '${commandName}' not found. Available commands: ls, cd, pwd, cat, echo, node, npm, python3, git`
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

function toModalWorkingDirectory(value: string) {
  if (!value || value === '/home/user') {
    return MODAL_WORKDIR
  }

  if (value.startsWith(MODAL_WORKDIR)) {
    return value
  }

  if (value.startsWith('/home/user/')) {
    return `${MODAL_WORKDIR}/${value.slice('/home/user/'.length)}`
  }

  if (value.startsWith('/')) {
    return `${MODAL_WORKDIR}${value}`
  }

  return `${MODAL_WORKDIR}/${value}`
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
