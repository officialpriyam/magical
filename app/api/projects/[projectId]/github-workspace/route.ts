import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GitHubWorkspaceInput = {
  fullName?: string
  owner?: string
  repo?: string
  branch?: string
  pathPrefix?: string
  autoSync?: boolean
  lastCommitSha?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in before connecting a GitHub workspace.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as GitHubWorkspaceInput
    const fullName = normalizeFullName(body.fullName)
    const [owner, repo] = fullName ? fullName.split('/') : [body.owner, body.repo]
    const normalizedOwner = normalizeIdentifier(owner)
    const normalizedRepo = normalizeIdentifier(repo)

    if (!projectId || !normalizedOwner || !normalizedRepo) {
      return NextResponse.json({ error: 'Missing GitHub repository information.' }, { status: 400 })
    }

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, metadata')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed to load project for GitHub workspace:', fetchError)
      return NextResponse.json({ error: 'Failed to load project.' }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const metadata = project.metadata && typeof project.metadata === 'object'
      ? project.metadata
      : {}
    const githubWorkspace = {
      owner: normalizedOwner,
      repo: normalizedRepo,
      fullName: `${normalizedOwner}/${normalizedRepo}`,
      branch: normalizeBranch(body.branch),
      pathPrefix: normalizePathPrefix(body.pathPrefix),
      autoSync: body.autoSync !== false,
      lastCommitSha: typeof body.lastCommitSha === 'string' ? body.lastCommitSha : null,
      connectedAt: new Date().toISOString(),
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        metadata: {
          ...metadata,
          githubWorkspace,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Failed to save GitHub workspace metadata:', updateError)
      return NextResponse.json({ error: 'Failed to save GitHub workspace.' }, { status: 500 })
    }

    return NextResponse.json({ project: updatedProject, githubWorkspace })
  } catch (error) {
    console.error('Unexpected GitHub workspace save error:', error)
    return NextResponse.json({ error: 'Failed to save GitHub workspace.' }, { status: 500 })
  }
}

function normalizeFullName(value: unknown) {
  if (typeof value !== 'string') return ''
  const clean = value.trim().replace(/^\/+|\/+$/g, '')
  return clean.includes('/') ? clean : ''
}

function normalizeIdentifier(value: unknown) {
  if (typeof value !== 'string') return ''
  const clean = value.trim()
  return /^[A-Za-z0-9_.-]{1,100}$/.test(clean) ? clean : ''
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
