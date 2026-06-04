import { NextRequest, NextResponse } from 'next/server'
import { type Sandbox as SandboxInstance } from '@e2b/code-interpreter'
import { createE2BSandbox } from '@/lib/e2b-sandbox'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import { createServerClient } from '@/lib/supabase-server'
import { getGitHubAccessToken, githubHeaders } from '@/lib/github-server'
import { validateGitHubIdentifier } from '@/lib/security'
import type { FileSystemNode } from '@/components/file-tree'

export const maxDuration = 120
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sandboxTimeout = 10 * 60 * 1000
const MAX_RESTORE_FILES = 100
const MAX_RESTORE_FILE_BYTES = 1024 * 1024

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
  let sbx: SandboxInstance | null = null

  try {
    const { projectId } = await params
    const body = await request.json().catch(() => ({}))
    const fragment = body.fragment as FragmentSchema | undefined

    if (!fragment?.template) {
      return NextResponse.json({ error: 'Missing saved project fragment.' }, { status: 400 })
    }

    if (!process.env.E2B_API_KEY) {
      return NextResponse.json({ error: 'E2B_API_KEY not configured.' }, { status: 503 })
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

    const workspace = getGitHubWorkspace(project?.metadata)

    if (!project || !workspace) {
      return NextResponse.json({ error: 'This project is not connected to a GitHub workspace.' }, { status: 400 })
    }

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

    const files = await fetchGitHubFiles({
      owner,
      repo,
      branch,
      pathPrefix,
      accessToken: githubToken,
    })

    if (files.length === 0) {
      return NextResponse.json({ error: 'No text files found in the connected GitHub workspace.' }, { status: 400 })
    }

    sbx = await createE2BSandbox(fragment.template, {
      metadata: {
        template: fragment.template,
        userID: user.id,
        teamID: typeof body.teamID === 'string' ? body.teamID : '',
        restoredFrom: `${owner}/${repo}`,
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

    for (const file of files) {
      await sbx.files.write(file.path, file.content)
    }

    const installCommand = cleanCommand(fragment.install_dependencies_command)

    if (fragment.template === 'code-interpreter-v1') {
      const tree = await fetchSandboxFiles(sbx)

      return NextResponse.json({
        sbxId: sbx.sandboxId,
        template: fragment.template,
        stdout: [],
        stderr: [],
        cellResults: [],
        files: tree,
      } as ExecutionResultInterpreter)
    }

    if (installCommand) {
      await sbx.commands.run(installCommand, {
        envs: {
          PORT: (fragment.port || 80).toString(),
        },
      })
    }

    const tree = await fetchSandboxFiles(sbx)

    return NextResponse.json({
      sbxId: sbx.sandboxId,
      template: fragment.template,
      url: `https://${sbx.getHost(fragment.port || 80)}`,
      files: tree,
    } as ExecutionResultWeb)
  } catch (error: any) {
    console.error('Failed to restore project sandbox from GitHub:', error)

    try {
      await sbx?.kill()
    } catch {}

    return NextResponse.json(
      {
        error: 'Failed to restore project sandbox from GitHub.',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    )
  }
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
