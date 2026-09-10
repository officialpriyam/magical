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
import {
  createModalSandbox,
  hasModalSandboxConfig,
  listModalSandboxFiles,
  writeModalProjectFiles,
} from '@/lib/modal-sandbox'
import {
  createDaytonaSandbox,
  hasDaytonaSandboxConfig,
  listDaytonaSandboxFiles,
  writeDaytonaProjectFiles,
} from '@/lib/daytona-sandbox'
import type { Sandbox as ModalSandbox } from 'modal'
import type { Sandbox as DaytonaSandbox } from '@daytona/sdk'
import { getProjectFilesFromSandboxStorage } from '@/lib/sandbox-storage'
import templates, { type TemplateId } from '@/lib/templates'
import type { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import type { FileSystemNode } from '@/components/file-tree'
import type { GeneratedFile } from '@/lib/fragment-files'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sandboxTimeout = 10 * 60 * 1000
const DEFAULT_WARM_TEMPLATE: TemplateId = 'nextjs-developer'

type VercelSandboxInstance = Awaited<ReturnType<typeof createVercelSandbox>>
type AnySandbox = SandboxInstance | VercelSandboxInstance | ModalSandbox | DaytonaSandbox

type WarmStartContext = {
  template: TemplateId
  port: number
  userId: string
  projectId: string
  teamId: string
  accessToken: string
  storedFiles: GeneratedFile[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let providerMode: SandboxProviderMode = 'auto'
  let attemptedProviders: SandboxProvider[] = []
  let lastError: unknown = null

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
    providerMode = normalizeSandboxProviderMode(body.sandboxProvider)
    const availableProviders = getAvailableSandboxProviders(template)
    const selectedProvider = chooseSandboxProvider({ mode: providerMode, available: availableProviders })

    if (!selectedProvider) {
      return NextResponse.json(
        { error: getNoSandboxProviderMessage(providerMode, template) },
        { status: 503 },
      )
    }

    const storedFiles = await getProjectFilesFromSandboxStorage({
      userId: user.id,
      projectId,
    }).catch((error) => {
      console.warn('RustFS warm start hydrate failed:', error)
      return [] as GeneratedFile[]
    })

    const templateConfig = templates[template]
    const port = typeof templateConfig?.port === 'number' ? templateConfig.port : 3000

    const context: WarmStartContext = {
      template,
      port,
      userId: user.id,
      projectId,
      teamId: typeof body.teamID === 'string' ? body.teamID : '',
      accessToken: typeof body.accessToken === 'string' ? body.accessToken : '',
      storedFiles,
    }

    // In "auto" mode, try the chosen provider first and fall back to any other
    // configured provider so a single misconfigured provider does not block the user.
    const providerQueue: SandboxProvider[] =
      providerMode === 'auto'
        ? [selectedProvider, ...availableProviders.filter((p) => p !== selectedProvider)]
        : [selectedProvider]

    for (const provider of providerQueue) {
      attemptedProviders.push(provider)

      try {
        const result = await startSandboxWithProvider(provider, context)
        return NextResponse.json(result)
      } catch (error) {
        lastError = error
        console.error(`Warm start with ${provider} sandbox failed:`, error)
      }
    }

    throw lastError ?? new Error('All configured sandbox providers failed.')
  } catch (error) {
    console.error('Failed to warm start project sandbox:', error)

    const details = getErrorMessage(error)
    const providerLabel = attemptedProviders.length
      ? ` (tried: ${attemptedProviders.join(', ')})`
      : ''

    return NextResponse.json(
      {
        error: `Failed to start a project sandbox${providerLabel}. ${details}`.trim(),
        details,
        providers: attemptedProviders,
        sandboxProvider: providerMode,
      },
      { status: 500 },
    )
  }
}

async function startSandboxWithProvider(
  provider: SandboxProvider,
  ctx: WarmStartContext,
): Promise<ExecutionResultWeb | ExecutionResultInterpreter> {
  let sbx: AnySandbox | null = null

  try {
    if (provider === 'vercel') {
      const vercelSandbox = await createVercelSandbox({
        template: ctx.template,
        userId: ctx.userId,
        teamId: ctx.teamId,
        projectId: ctx.projectId,
        port: ctx.port,
        timeoutMs: sandboxTimeout,
      })
      sbx = vercelSandbox

      await writeVercelProjectFiles(vercelSandbox, ctx.storedFiles, ctx.template)
      const files = await listVercelSandboxFiles(vercelSandbox)

      return {
        sbxId: encodeSandboxId('vercel', vercelSandbox.name),
        sandboxProvider: provider,
        template: ctx.template,
        url: '',
        files,
      } as ExecutionResultWeb
    }

    if (provider === 'modal') {
      const modalSandbox = await createModalSandbox({
        template: ctx.template,
        userId: ctx.userId,
        teamId: ctx.teamId,
        projectId: ctx.projectId,
        port: ctx.port,
        timeoutMs: sandboxTimeout,
      })
      sbx = modalSandbox

      await writeModalProjectFiles(modalSandbox, ctx.storedFiles, ctx.template)
      const files = await listModalSandboxFiles(modalSandbox)

      return {
        sbxId: encodeSandboxId('modal', modalSandbox.sandboxId),
        sandboxProvider: provider,
        template: ctx.template,
        url: '',
        files,
      } as ExecutionResultWeb
    }

    if (provider === 'daytona') {
      const daytonaSandbox = await createDaytonaSandbox({
        template: ctx.template,
        userId: ctx.userId,
        teamId: ctx.teamId,
        projectId: ctx.projectId,
        port: ctx.port,
        timeoutMs: sandboxTimeout,
      })
      sbx = daytonaSandbox

      await writeDaytonaProjectFiles(daytonaSandbox, ctx.storedFiles, ctx.template)
      const files = await listDaytonaSandboxFiles(daytonaSandbox)

      return {
        sbxId: encodeSandboxId('daytona', daytonaSandbox.id),
        sandboxProvider: provider,
        template: ctx.template,
        url: '',
        files,
      } as ExecutionResultWeb
    }

    const e2bSandbox = await createE2BSandbox(ctx.template, {
      metadata: {
        template: ctx.template,
        userID: ctx.userId,
        teamID: ctx.teamId,
        warm: 'true',
      },
      timeoutMs: sandboxTimeout,
      ...(ctx.teamId && ctx.accessToken
        ? {
            headers: {
              'X-Supabase-Team': ctx.teamId,
              'X-Supabase-Token': ctx.accessToken,
            },
          }
        : {}),
    })
    sbx = e2bSandbox

    await Promise.all(
      ctx.storedFiles.map((file) => e2bSandbox.files.write(file.path, file.content)),
    )

    const files = await fetchSandboxFiles(e2bSandbox)

    if (ctx.template === 'code-interpreter-v1') {
      return {
        sbxId: encodeSandboxId('e2b', e2bSandbox.sandboxId),
        sandboxProvider: provider,
        template: ctx.template,
        stdout: [],
        stderr: [],
        cellResults: [],
        files,
      } as ExecutionResultInterpreter
    }

    return {
      sbxId: encodeSandboxId('e2b', e2bSandbox.sandboxId),
      sandboxProvider: provider,
      template: ctx.template,
      url: '',
      files,
    } as ExecutionResultWeb
  } catch (error) {
    await cleanupSandbox(provider, sbx)
    throw error
  }
}

async function cleanupSandbox(provider: SandboxProvider, sbx: AnySandbox | null) {
  if (!sbx) return

  try {
    if (provider === 'vercel') {
      await (sbx as VercelSandboxInstance).stop()
    } else if (provider === 'modal') {
      await (sbx as ModalSandbox).terminate()
    } else if (provider === 'daytona') {
      await (sbx as DaytonaSandbox).delete()
    } else {
      await (sbx as SandboxInstance).kill()
    }
  } catch (cleanupError) {
    console.warn(`Failed to clean up ${provider} sandbox after error:`, cleanupError)
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || error.name || 'Unknown error'
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return 'Unknown error'
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

function getAvailableSandboxProviders(template: TemplateId): SandboxProvider[] {
  const available: SandboxProvider[] = []

  if (process.env.E2B_API_KEY?.trim()) {
    available.push('e2b')
  }

  if (hasModalSandboxConfig()) {
    available.push('modal')
  }

  if (template !== 'code-interpreter-v1' && hasVercelSandboxConfig()) {
    available.push('vercel')
  }

  if (hasDaytonaSandboxConfig()) {
    available.push('daytona')
  }

  return available
}

function getNoSandboxProviderMessage(mode: SandboxProviderMode, template: TemplateId) {
  if (mode === 'vercel' && template === 'code-interpreter-v1') {
    return 'Vercel Sandbox is only available for app previews. Python code interpreter requires E2B_API_KEY, Modal, or Daytona.'
  }

  if (mode === 'modal') {
    return 'Modal Sandbox is not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET.'
  }

  if (mode === 'vercel') {
    return 'Vercel Sandbox is not configured. Set VERCEL_OIDC_TOKEN or VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN.'
  }

  if (mode === 'e2b') {
    return 'E2B is not configured. Set E2B_API_KEY or choose Modal, Vercel, or Daytona.'
  }

  if (mode === 'daytona') {
    return 'Daytona is not configured. Set DAYTONA_API_KEY.'
  }

  return 'No sandbox provider is configured. Set E2B_API_KEY, MODAL_TOKEN_ID/SECRET, DAYTONA_API_KEY, or configure Vercel Sandbox.'
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
