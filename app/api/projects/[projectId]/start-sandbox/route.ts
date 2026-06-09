import { NextRequest, NextResponse } from 'next/server'
import { type Sandbox as SandboxInstance } from '@e2b/code-interpreter'
import { createE2BSandbox } from '@/lib/e2b-sandbox'
import { createServerClient } from '@/lib/supabase-server'
import {
  chooseSandboxProvider,
  encodeSandboxId,
  normalizeSandboxProviderMode,
  type SandboxProvider,
  type SandboxProviderMode,
} from '@/lib/sandbox-provider'
import {
  createVercelSandbox,
  hasVercelSandboxConfig,
  listVercelSandboxFiles,
  writeVercelProjectFiles,
} from '@/lib/vercel-sandbox'
import templates, { type TemplateId } from '@/lib/templates'
import type { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import type { FileSystemNode } from '@/components/file-tree'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sandboxTimeout = 10 * 60 * 1000
const DEFAULT_WARM_TEMPLATE: TemplateId = 'nextjs-developer'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let selectedProvider: SandboxProvider | null = null
  let sbx: SandboxInstance | Awaited<ReturnType<typeof createVercelSandbox>> | null = null

  try {
    const { projectId } = await params
    const body = await request.json().catch(() => ({}))
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in before starting a sandbox.' }, { status: 401 })
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, template_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (projectError) {
      console.error('Failed to load project for sandbox warm start:', projectError)
      return NextResponse.json({ error: 'Failed to load project.' }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const template = resolveWarmTemplate(body.template, project.template_id)
    const providerMode = normalizeSandboxProviderMode(body.sandboxProvider)
    selectedProvider = resolveSandboxProvider(providerMode, template)

    if (!selectedProvider) {
      return NextResponse.json(
        { error: getNoSandboxProviderMessage(providerMode, template) },
        { status: 503 },
      )
    }

    if (selectedProvider === 'vercel') {
      sbx = await createVercelSandbox({
        template,
        userId: user.id,
        teamId: typeof body.teamID === 'string' ? body.teamID : '',
        projectId,
        port: templates[template].port,
        timeoutMs: sandboxTimeout,
      })

      await writeVercelProjectFiles(
        sbx as Awaited<ReturnType<typeof createVercelSandbox>>,
        [],
        template,
      )

      const files = await listVercelSandboxFiles(sbx as Awaited<ReturnType<typeof createVercelSandbox>>)

      return NextResponse.json({
        sbxId: encodeSandboxId('vercel', (sbx as Awaited<ReturnType<typeof createVercelSandbox>>).name),
        sandboxProvider: selectedProvider,
        template,
        url: '',
        files,
      } as ExecutionResultWeb)
    }

    sbx = await createE2BSandbox(template, {
      metadata: {
        template,
        userID: user.id,
        teamID: typeof body.teamID === 'string' ? body.teamID : '',
        warm: 'true',
      },
      timeoutMs: sandboxTimeout,
      ...(body.teamID && body.accessToken
        ? {
            headers: {
              'X-Supabase-Team': body.teamID,
              'X-Supabase-Token': body.accessToken,
            },
          }
        : {}),
    })

    const files = await fetchSandboxFiles(sbx as SandboxInstance)

    if (template === 'code-interpreter-v1') {
      return NextResponse.json({
        sbxId: encodeSandboxId('e2b', (sbx as SandboxInstance).sandboxId),
        sandboxProvider: selectedProvider,
        template,
        stdout: [],
        stderr: [],
        cellResults: [],
        files,
      } as ExecutionResultInterpreter)
    }

    return NextResponse.json({
      sbxId: encodeSandboxId('e2b', (sbx as SandboxInstance).sandboxId),
      sandboxProvider: selectedProvider,
      template,
      url: '',
      files,
    } as ExecutionResultWeb)
  } catch (error) {
    console.error('Failed to warm start project sandbox:', error)

    try {
      if (selectedProvider === 'vercel') {
        await (sbx as Awaited<ReturnType<typeof createVercelSandbox>> | null)?.stop()
      } else {
        await (sbx as SandboxInstance | null)?.kill()
      }
    } catch {}

    return NextResponse.json(
      {
        error: 'Failed to start a project sandbox.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

function resolveWarmTemplate(value: unknown, projectTemplate: unknown): TemplateId {
  if (isTemplateId(value)) {
    return value
  }

  if (isTemplateId(projectTemplate)) {
    return projectTemplate
  }

  return DEFAULT_WARM_TEMPLATE
}

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && value in templates
}

function resolveSandboxProvider(mode: SandboxProviderMode, template: TemplateId) {
  const available: SandboxProvider[] = []

  if (process.env.E2B_API_KEY) {
    available.push('e2b')
  }

  if (template !== 'code-interpreter-v1' && hasVercelSandboxConfig()) {
    available.push('vercel')
  }

  return chooseSandboxProvider({ mode, available })
}

function getNoSandboxProviderMessage(mode: SandboxProviderMode, template: TemplateId) {
  if (mode === 'vercel' && template === 'code-interpreter-v1') {
    return 'Vercel Sandbox is only available for app previews. Python code interpreter requires E2B_API_KEY.'
  }

  if (mode === 'vercel') {
    return 'Vercel Sandbox is not configured. Set VERCEL_OIDC_TOKEN or VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN.'
  }

  if (mode === 'e2b') {
    return 'E2B is not configured. Set E2B_API_KEY or choose Vercel Sandbox.'
  }

  return 'No sandbox provider is configured. Set E2B_API_KEY or configure Vercel Sandbox.'
}

async function fetchSandboxFiles(sbx: SandboxInstance): Promise<FileSystemNode[]> {
  try {
    const filesList = await sbx.files.list('/home/user')
    return convertE2BFilesToTree(filesList)
  } catch (error) {
    console.error('Error fetching warm sandbox files:', error)
    return []
  }
}

function convertE2BFilesToTree(e2bFiles: any[]): FileSystemNode[] {
  return e2bFiles
    .filter(file => !file.name.includes('node_modules'))
    .map(file => {
      const node: FileSystemNode = {
        name: file.name,
        isDirectory: file.isDir,
        path: `/${file.path}`,
      }

      if (file.isDir && file.children) {
        node.children = convertE2BFilesToTree(file.children)
      }

      return node
    })
}
