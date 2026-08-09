import { NextRequest, NextResponse } from 'next/server'
import { type Sandbox as SandboxInstance } from '@e2b/code-interpreter'
import { createE2BSandbox } from '@/lib/e2b-sandbox'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import { createServerClient } from '@/lib/supabase-server'
import { getSupabaseProjectRuntimeEnv } from '@/lib/supabase-integration'
import { getGitHubAccessToken, githubHeaders } from '@/lib/github-server'
import {
  getProjectFilesFromR2,
  getR2WorkspaceMetadata,
  hasR2WorkspaceConfig,
} from '@/lib/r2-workspace'
import {
  getProjectFilesFromSandboxStorage,
  getSandboxStorageMetadata,
  hasSandboxStorageConfig,
} from '@/lib/sandbox-storage'
import {
  chooseSandboxProvider,
  encodeSandboxId,
  normalizeSandboxProviderMode,
  type SandboxProvider,
  type SandboxProviderMode,
} from '@/lib/sandbox-provider'
import {
  createVercelSandbox,
  getVercelSandboxUrl,
  hasVercelSandboxConfig,
  installAndStartVercelProject,
  listVercelSandboxFiles,
  writeVercelProjectFiles,
} from '@/lib/vercel-sandbox'
import {
  createModalSandbox,
  getModalSandboxUrl,
  hasModalSandboxConfig,
  installAndStartModalProject,
  listModalSandboxFiles,
  writeModalProjectFiles,
} from '@/lib/modal-sandbox'
import type { Sandbox as ModalSandbox } from 'modal'
import { validateGitHubIdentifier } from '@/lib/security'
import type { FileSystemNode } from '@/components/file-tree'
import type { TemplateId } from '@/lib/templates'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sandboxTimeout = 25 * 1000
const MAX_RESTORE_FILES = 50
const MAX_RESTORE_FILE_BYTES = 512 * 1024

type GitHubWorkspace = {
  owner?: string
  repo?: string
  fullName?: string
  branch?: string
  pathPrefix?: string
}

type GitHubFile = {
  path: string
  content: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let sbx: SandboxInstance | Awaited<ReturnType<typeof createVercelSandbox>> | ModalSandbox | null = null
  let selectedProvider: SandboxProvider | null = null

  try {
    const { projectId } = await params
    const body = await request.json().catch(() => ({}))
    const fragment = body.fragment as FragmentSchema | undefined

    if (!fragment?.template) {
      return NextResponse.json({ error: 'Missing saved project fragment.' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in before restoring a project sandbox.' }, { status: 401 })
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, metadata')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (projectError) {
      console.error('Failed to load project for sandbox restore:', projectError)
      return NextResponse.json({ error: 'Failed to load project.' }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const providerMode = normalizeSandboxProviderMode(body.sandboxProvider)
    selectedProvider = resolveSandboxProviderForFragment(providerMode, fragment)

    if (!selectedProvider) {
      return NextResponse.json(
        { error: getNoSandboxProviderMessage(providerMode, fragment) },
        { status: 503 },
      )
    }

    const sandboxStorage = getSandboxStorageMetadata(project.metadata)
    const workspace = getGitHubWorkspace(project.metadata)
    let files: GitHubFile[] = []
    let restoredFrom = 'saved workspace'

    if (sandboxStorage) {
      if (!hasSandboxStorageConfig()) {
        console.warn('Sandbox storage is not configured for this deployment')
        // Fall through to try GitHub or R2 instead of failing
      } else {
        try {
          files = await getProjectFilesFromSandboxStorage({
            userId: user.id,
            projectId,
            project,
          })
          restoredFrom = 'sandbox-storage'

          if (files.length === 0) {
            console.warn('No files found in sandbox-storage, will try other sources')
            files = []
          } else {
            // Successfully got files from sandbox storage, proceed
            files = files
          }
        } catch (error) {
          console.warn('Failed to fetch from sandbox-storage:', error)
          // Fall through to try GitHub or R2
        }
      }
    }

    // If sandbox-storage didn't work or isn't configured, try GitHub or R2
    if (files.length === 0 && workspace) {
      const owner = workspace.owner
      const repo = workspace.repo
      const branch = normalizeBranch(workspace.branch)
      const pathPrefix = normalizePathPrefix(workspace.pathPrefix)

      if (!validateGitHubIdentifier(owner, 'owner') || !validateGitHubIdentifier(repo, 'repo')) {
        return NextResponse.json({ error: 'Invalid GitHub workspace metadata.' }, { status: 400 })
      }

      const githubToken = await getGitHubAccessToken(user.id)

      if (!githubToken) {
        return NextResponse.json({ error: 'Connect GitHub again before restoring this project.' }, { status: 401 })
      }

      try {
        files = await fetchGitHubFiles({
          owner,
          repo,
          branch,
          pathPrefix,
          accessToken: githubToken,
        })
        restoredFrom = `${owner}/${repo}`

        if (files.length === 0) {
          console.warn('No files found in GitHub workspace')
          files = []
        }
      } catch (error) {
        console.warn('Failed to fetch from GitHub:', error)
        files = []
      }
    }

    // If still no files, try R2
    if (files.length === 0) {
      const r2Workspace = getR2WorkspaceMetadata(project.metadata)

      if (!r2Workspace && !hasR2WorkspaceConfig()) {
        return NextResponse.json(
          { error: 'This project has no saved files and no GitHub/R2 workspace is configured.' },
          { status: 400 },
        )
      }

      if (r2Workspace && !hasR2WorkspaceConfig()) {
        return NextResponse.json(
          { error: 'Cloudflare R2 workspace storage is not configured for this deployment.' },
          { status: 503 },
        )
      }

      try {
        files = await getProjectFilesFromR2({
          userId: user.id,
          projectId,
        })
        restoredFrom = 'cloudflare-r2'

        if (files.length === 0) {
          console.warn('No files found in R2')
        }
      } catch (error) {
        console.warn('Failed to fetch from R2:', error)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No saved files were found for this project in any storage source.' },
        { status: 400 },
      )
    }

    const supabaseRuntimeEnv = await getSupabaseProjectRuntimeEnv(user.id, projectId)

    if (selectedProvider === 'vercel') {
      sbx = await createVercelSandbox({
        template: fragment.template as TemplateId,
        userId: user.id,
        teamId: typeof body.teamID === 'string' ? body.teamID : '',
        projectId,
        port: fragment.port,
        env: supabaseRuntimeEnv,
        timeoutMs: sandboxTimeout,
      })
      await writeVercelProjectFiles(
        sbx as Awaited<ReturnType<typeof createVercelSandbox>>,
        files,
        fragment.template as TemplateId,
      )
    } else if (selectedProvider === 'modal') {
      sbx = await createModalSandbox({
        template: fragment.template as TemplateId,
        userId: user.id,
        teamId: typeof body.teamID === 'string' ? body.teamID : '',
        projectId,
        port: fragment.port,
        env: supabaseRuntimeEnv,
        timeoutMs: sandboxTimeout,
      })
      await writeModalProjectFiles(
        sbx as ModalSandbox,
        files,
        fragment.template as TemplateId,
      )
    } else {
      sbx = await createE2BSandbox(fragment.template, {
        metadata: {
          template: fragment.template,
          userID: user.id,
          teamID: typeof body.teamID === 'string' ? body.teamID : '',
          restoredFrom,
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

      await Promise.all(
        files.map((file) => (sbx as SandboxInstance).files.write(file.path, file.content))
      )
    }

    const installCommand = cleanCommand(fragment.install_dependencies_command)

    if (fragment.template === 'code-interpreter-v1') {
      const tree = await fetchSandboxFiles(sbx as SandboxInstance)

      return NextResponse.json({
        sbxId: encodeSandboxId('e2b', (sbx as SandboxInstance).sandboxId),
        sandboxProvider: selectedProvider,
        template: fragment.template,
        stdout: [],
        stderr: [],
        cellResults: [],
        files: tree,
      } as ExecutionResultInterpreter)
    }

    if (selectedProvider === 'vercel') {
      const vercelSandbox = sbx as Awaited<ReturnType<typeof createVercelSandbox>>

      await installAndStartVercelProject({
        sandbox: vercelSandbox,
        fragment,
        env: supabaseRuntimeEnv,
      })

      const tree = await listVercelSandboxFiles(vercelSandbox)

      return NextResponse.json({
        sbxId: encodeSandboxId('vercel', vercelSandbox.name),
        sandboxProvider: selectedProvider,
        template: fragment.template,
        url: getVercelSandboxUrl(vercelSandbox, fragment.port || 3000),
        files: tree,
      } as ExecutionResultWeb)
    }

    if (selectedProvider === 'modal') {
      const modalSandbox = sbx as ModalSandbox

      await installAndStartModalProject({
        sandbox: modalSandbox,
        fragment,
        env: supabaseRuntimeEnv,
      })

      // Wait for server to start before getting tunnel URL
      await new Promise(resolve => setTimeout(resolve, 3000))

      const tree = await listModalSandboxFiles(modalSandbox)
      const url = await getModalSandboxUrl(modalSandbox, fragment.port || 3000)

      return NextResponse.json({
        sbxId: encodeSandboxId('modal', modalSandbox.sandboxId),
        sandboxProvider: selectedProvider,
        template: fragment.template,
        url,
        files: tree,
      } as ExecutionResultWeb)
    }

    if (installCommand) {
      await (sbx as SandboxInstance).commands.run(installCommand, {
        envs: {
          PORT: (fragment.port || 80).toString(),
          ...supabaseRuntimeEnv,
        },
      })
    }

    const tree = await fetchSandboxFiles(sbx as SandboxInstance)

    return NextResponse.json({
      sbxId: encodeSandboxId('e2b', (sbx as SandboxInstance).sandboxId),
      sandboxProvider: selectedProvider,
      template: fragment.template,
      url: `https://${(sbx as SandboxInstance).getHost(fragment.port || 80)}`,
      files: tree,
    } as ExecutionResultWeb)
  } catch (error: any) {
    console.error('Failed to restore project sandbox from saved workspace:', error)

    try {
      if (selectedProvider === 'vercel') {
        await (sbx as Awaited<ReturnType<typeof createVercelSandbox>> | null)?.stop()
      } else if (selectedProvider === 'modal') {
        await (sbx as ModalSandbox | null)?.terminate()
      } else {
        await (sbx as SandboxInstance | null)?.kill()
      }
    } catch {}

    return NextResponse.json(
      {
        error: 'Failed to restore project sandbox from saved workspace.',
        details: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 },
    )
  }
}

function resolveSandboxProviderForFragment(
  mode: SandboxProviderMode,
  fragment: FragmentSchema,
): SandboxProvider | null {
  const available: SandboxProvider[] = []

  if (process.env.E2B_API_KEY) {
    available.push('e2b')
  }

  if (hasModalSandboxConfig()) {
    available.push('modal')
  }

  if (fragment.template !== 'code-interpreter-v1' && hasVercelSandboxConfig()) {
    available.push('vercel')
  }

  return chooseSandboxProvider({ mode, available })
}

function getNoSandboxProviderMessage(
  mode: SandboxProviderMode,
  fragment: FragmentSchema,
) {
  if (mode === 'vercel' && fragment.template === 'code-interpreter-v1') {
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

async function fetchGitHubFiles({
  owner,
  repo,
  branch,
  pathPrefix,
  accessToken,
}: {
  owner: string
  repo: string
  branch: string
  pathPrefix: string
  accessToken: string
}) {
  const files: GitHubFile[] = []

  async function walk(path: string) {
    if (files.length >= MAX_RESTORE_FILES) return

    const safePath = path
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/')
    const url = safePath
      ? `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}?ref=${encodeURIComponent(branch)}`
      : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(branch)}`
    const response = await fetch(url, {
      headers: githubHeaders(accessToken),
    })

    if (!response.ok) {
      throw new Error(`GitHub content fetch failed (${response.status})`)
    }

    const data = await response.json()
    const items = Array.isArray(data) ? data : [data]

    for (const item of items) {
      if (files.length >= MAX_RESTORE_FILES) return
      if (shouldSkipGitHubPath(item.path || item.name || '')) continue

      if (item.type === 'dir') {
        await walk(item.path)
        continue
      }

      if (item.type !== 'file' || item.size > MAX_RESTORE_FILE_BYTES) {
        continue
      }

      const fileResponse = item.content
        ? null
        : await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(item.path)}?ref=${encodeURIComponent(branch)}`,
            { headers: githubHeaders(accessToken) },
          )
      const fileData = item.content
        ? item
        : fileResponse?.ok
          ? await fileResponse.json()
          : null

      if (!fileData?.content || fileData.encoding !== 'base64') {
        continue
      }

      const relativePath = stripPrefix(item.path, pathPrefix)
      if (!relativePath) continue

      files.push({
        path: relativePath,
        content: Buffer.from(fileData.content.replace(/\s/g, ''), 'base64').toString('utf8'),
      })
    }
  }

  await walk(pathPrefix)
  return files
}

async function fetchSandboxFiles(sbx: SandboxInstance): Promise<FileSystemNode[]> {
  const filesList = await sbx.files.list('/home/user')
  return convertE2BFilesToTree(filesList)
}

function convertE2BFilesToTree(e2bFiles: any[]): FileSystemNode[] {
  return e2bFiles
    .filter((file) => !shouldSkipGitHubPath(file.path || file.name || ''))
    .map((file) => {
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

function getGitHubWorkspace(metadata: any): Required<GitHubWorkspace> | null {
  const workspace = metadata?.githubWorkspace
  if (!workspace || typeof workspace !== 'object') return null

  const fullName =
    typeof workspace.fullName === 'string'
      ? workspace.fullName
      : `${workspace.owner || ''}/${workspace.repo || ''}`
  const [owner, repo] = fullName.split('/')

  if (!owner || !repo) return null

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    branch: normalizeBranch(workspace.branch),
    pathPrefix: normalizePathPrefix(workspace.pathPrefix),
  }
}

function stripPrefix(path: string, prefix: string) {
  const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '')
  const cleanPrefix = normalizePathPrefix(prefix)

  if (!cleanPrefix) return cleanPath
  if (cleanPath === cleanPrefix) return ''
  if (!cleanPath.startsWith(`${cleanPrefix}/`)) return ''

  return cleanPath.slice(cleanPrefix.length + 1)
}

function normalizeBranch(value: unknown) {
  const branch = typeof value === 'string' && value.trim() ? value.trim() : 'main'

  if (
    branch.length > 250 ||
    branch.includes('..') ||
    branch.endsWith('.lock') ||
    /[\x00-\x1f\x7f ~^:?*[\]\\]/.test(branch)
  ) {
    return 'main'
  }

  return branch
}

function normalizePathPrefix(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
    : ''
}

function encodeGitHubPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function cleanCommand(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function shouldSkipGitHubPath(value: string) {
  return /(^|\/)(\.git|node_modules|\.next|dist|build|coverage)(\/|$)/.test(value)
}
