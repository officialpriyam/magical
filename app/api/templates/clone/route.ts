import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createE2BSandbox } from '@/lib/e2b-sandbox'
import { normalizeSandboxProviderMode, chooseSandboxProvider, type SandboxProvider } from '@/lib/sandbox-provider'
import { createVercelSandbox, hasVercelSandboxConfig, runVercelShellCommand } from '@/lib/vercel-sandbox'
import { createModalSandbox, hasModalSandboxConfig, runModalShellCommand } from '@/lib/modal-sandbox'
import { saveProjectFilesToSandboxStorage } from '@/lib/sandbox-storage'
import templates, { type TemplateId } from '@/lib/templates'
import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter'
import type { Sandbox as ModalSandbox } from 'modal'

export const maxDuration = 120
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let sbx: E2BSandbox | Awaited<ReturnType<typeof createVercelSandbox>> | ModalSandbox | null = null
  let selectedProvider: SandboxProvider | null = null

  try {
    const body = await request.json()
    const { templateId, githubRepo, templateName } = body as {
      templateId?: string
      githubRepo?: string
      templateName?: string
    }

    if (!githubRepo) {
      return NextResponse.json({ error: 'Missing githubRepo' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    // Create a new project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title: templateName || 'Template Project',
        description: `Cloned from ${githubRepo}`,
        template_id: templateId || 'nextjs-developer',
        status: 'active',
        is_public: false,
        metadata: {},
      })
      .select()
      .single()

    if (projectError || !project) {
      console.error('Failed to create project:', projectError)
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    const resolvedTemplate = (templateId && templateId in templates ? templateId : 'nextjs-developer') as TemplateId
    const templateConfig = templates[resolvedTemplate]
    const port = templateConfig?.port || 3000

    // Determine sandbox provider
    const providerMode = normalizeSandboxProviderMode('auto')
    const available: SandboxProvider[] = []
    if (process.env.E2B_API_KEY) available.push('e2b')
    if (hasModalSandboxConfig()) available.push('modal')
    if (resolvedTemplate !== 'code-interpreter-v1' && hasVercelSandboxConfig()) available.push('vercel')
    selectedProvider = chooseSandboxProvider({ mode: providerMode, available })

    if (!selectedProvider) {
      return NextResponse.json({ error: 'No sandbox provider configured' }, { status: 503 })
    }

    const sandboxTimeout = 10 * 60 * 1000
    const metadata = {
      template: resolvedTemplate,
      userID: user.id,
      teamID: '',
      warm: 'true',
    }

    // Start sandbox
    if (selectedProvider === 'vercel') {
      sbx = await createVercelSandbox({
        template: resolvedTemplate,
        userId: user.id,
        teamId: '',
        projectId: project.id,
        port,
        timeoutMs: sandboxTimeout,
      })
    } else if (selectedProvider === 'modal') {
      sbx = await createModalSandbox({
        template: resolvedTemplate,
        userId: user.id,
        teamId: '',
        projectId: project.id,
        port,
        timeoutMs: sandboxTimeout,
      })
    } else {
      sbx = await createE2BSandbox(resolvedTemplate, {
        metadata,
        timeoutMs: sandboxTimeout,
      })
    }

    // Clone the repo into the sandbox
    const cloneCmd = `git clone --depth 1 ${githubRepo} /home/user/app 2>&1`

    if (selectedProvider === 'vercel') {
      const { runVercelShellCommand } = await import('@/lib/vercel-sandbox')
      const result = await runVercelShellCommand(sbx as Awaited<ReturnType<typeof createVercelSandbox>>, cloneCmd, { cwd: '/home/user', timeoutMs: 60000 })
      const stdout = await result.stdout().catch(() => '')
      const stderr = await result.stderr().catch(() => '')
      if (result.exitCode !== 0) {
        console.error('Clone failed:', stderr || stdout)
      }
    } else if (selectedProvider === 'modal') {
      const { runModalShellCommand } = await import('@/lib/modal-sandbox')
      const proc = await runModalShellCommand(sbx as ModalSandbox, cloneCmd, { cwd: '/home/user', timeoutMs: 60000 })
      await proc.wait()
    } else {
      const e2bSbx = sbx as E2BSandbox
      await e2bSbx.commands.run(cloneCmd, { timeoutMs: 60000 })
    }

    // Install dependencies
    const installCmd = 'cd /home/user/app && (npm install 2>&1 || yarn install 2>&1 || pnpm install 2>&1)'

    if (selectedProvider === 'vercel') {
      const { runVercelShellCommand } = await import('@/lib/vercel-sandbox')
      await runVercelShellCommand(sbx as Awaited<ReturnType<typeof createVercelSandbox>>, installCmd, { cwd: '/home/user', timeoutMs: 120000 })
    } else if (selectedProvider === 'modal') {
      const { runModalShellCommand } = await import('@/lib/modal-sandbox')
      const proc = await runModalShellCommand(sbx as ModalSandbox, installCmd, { cwd: '/home/user', timeoutMs: 120000 })
      await proc.wait()
    } else {
      const e2bSbx = sbx as E2BSandbox
      await e2bSbx.commands.run(installCmd, { timeoutMs: 120000 })
    }

    // Read files from the sandbox using terminal commands (works across all providers)
    let files: Array<{ path: string; content: string }> = []

    // Step 1: Get list of file paths using find command
    const findCmd = 'find /home/user/app -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/.cache/*" 2>/dev/null | head -500'
    let filePaths: string[] = []

    if (selectedProvider === 'vercel') {
      const result = await runVercelShellCommand(
        sbx as Awaited<ReturnType<typeof createVercelSandbox>>,
        findCmd,
        { cwd: '/home/user', timeoutMs: 30000 }
      )
      const stdout = await result.stdout().catch(() => '')
      filePaths = stdout.split('\n').filter(Boolean)
    } else if (selectedProvider === 'modal') {
      const proc = await runModalShellCommand(
        sbx as ModalSandbox,
        findCmd,
        { cwd: '/home/user', timeoutMs: 30000 }
      )
      await proc.wait()
      const stdout = await proc.stdout.readText().catch(() => '')
      filePaths = stdout.split('\n').filter(Boolean)
    } else {
      const e2bSbx = sbx as E2BSandbox
      const result = await e2bSbx.commands.run(findCmd, { timeoutMs: 30000 })
      filePaths = result.stdout.split('\n').filter(Boolean)
    }

    // Step 2: Read each file's content
    const fileReads = await Promise.all(
      filePaths.map(async (absolutePath) => {
        const relativePath = absolutePath.replace('/home/user/app/', '')
        if (!relativePath || relativePath === absolutePath) return null

        try {
          let content = ''
          const readCmd = `cat "${absolutePath}" 2>/dev/null`

          if (selectedProvider === 'vercel') {
            const result = await runVercelShellCommand(
              sbx as Awaited<ReturnType<typeof createVercelSandbox>>,
              readCmd,
              { cwd: '/home/user', timeoutMs: 15000 }
            )
            content = await result.stdout().catch(() => '')
          } else if (selectedProvider === 'modal') {
            const proc = await runModalShellCommand(
              sbx as ModalSandbox,
              readCmd,
              { cwd: '/home/user', timeoutMs: 15000 }
            )
            await proc.wait()
            content = await proc.stdout.readText().catch(() => '')
          } else {
            const e2bSbx = sbx as E2BSandbox
            content = await e2bSbx.files.read(absolutePath)
          }

          return { path: relativePath, content }
        } catch {
          return null
        }
      })
    )

    files = fileReads.filter(Boolean) as Array<{ path: string; content: string }>

    // Save files to RustFS storage
    if (files.length > 0) {
      await saveProjectFilesToSandboxStorage({
        userId: user.id,
        projectId: project.id,
        files,
      })
    }

    // Stop the sandbox — chat page will start a fresh one and hydrate from storage
    try {
      if (selectedProvider === 'vercel') {
        await (sbx as Awaited<ReturnType<typeof createVercelSandbox>>)?.stop()
      } else if (selectedProvider === 'modal') {
        await (sbx as ModalSandbox | null)?.terminate()
      } else {
        await (sbx as E2BSandbox | null)?.kill()
      }
    } catch {}

    return NextResponse.json({
      projectId: project.id,
      fileCount: files.length,
      templateId: resolvedTemplate,
    })

  } catch (error) {
    console.error('Template clone failed:', error)

    // Cleanup sandbox if it was started
    try {
      if (selectedProvider === 'vercel') {
        await (sbx as Awaited<ReturnType<typeof createVercelSandbox>>)?.stop()
      } else if (selectedProvider === 'modal') {
        await (sbx as ModalSandbox | null)?.terminate()
      } else if (sbx) {
        await (sbx as E2BSandbox | null)?.kill()
      }
    } catch {}

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Clone failed' },
      { status: 500 },
    )
  }
}
