import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getGitHubAccessToken, githubHeaders } from '@/lib/github-server'
import { validateGitHubIdentifier, validateGitHubPath } from '@/lib/security'

export const dynamic = 'force-dynamic'

type SaveFileInput = {
  path: string
  content: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  const accessToken = await getGitHubAccessToken(user.id)

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Connect GitHub before saving generated code to a repository.' },
      { status: 401 },
    )
  }

  try {
    const { owner, repo } = await params

    if (!validateGitHubIdentifier(owner, 'owner') || !validateGitHubIdentifier(repo, 'repo')) {
      return NextResponse.json({ error: 'Invalid repository owner or name' }, { status: 400 })
    }

    const body = await request.json()
    const files = normalizeFiles(body.files)
    const branch = normalizeBranch(body.branch)
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 200)
        : 'Save generated code from Magical AI'

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 100) {
      return NextResponse.json(
        { error: 'Too many files. Save at most 100 files at a time.' },
        { status: 400 },
      )
    }

    const committed = []

    for (const file of files) {
      const sha = await getExistingFileSha({
        owner,
        repo,
        path: file.path,
        branch,
        accessToken,
      })

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(file.path)}`,
        {
          method: 'PUT',
          headers: {
            ...githubHeaders(accessToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            content: Buffer.from(file.content, 'utf8').toString('base64'),
            branch,
            ...(sha ? { sha } : {}),
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        return NextResponse.json(
          {
            error:
              errorData?.message ||
              `Failed to save ${file.path} to GitHub (${response.status})`,
            path: file.path,
          },
          { status: response.status },
        )
      }

      const data = await response.json()
      committed.push({
        path: file.path,
        html_url: data.content?.html_url,
        commit_sha: data.commit?.sha,
      })
    }

    return NextResponse.json({
      committed: committed.length,
      files: committed,
    })
  } catch (error) {
    console.error('Failed to save generated code to GitHub:', error)
    return NextResponse.json({ error: 'Failed to save generated code to GitHub' }, { status: 500 })
  }
}

function normalizeFiles(value: unknown): SaveFileInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((file) => {
      if (!file || typeof file !== 'object') return null

      const input = file as Partial<SaveFileInput>
      const normalizedPath =
        typeof input.path === 'string'
          ? input.path.replace(/\\/g, '/').replace(/^\/+/, '').trim()
          : ''

      if (!normalizedPath || !validateGitHubPath(normalizedPath)) {
        return null
      }

      if (typeof input.content !== 'string') {
        return null
      }

      return {
        path: normalizedPath,
        content: input.content,
      }
    })
    .filter((file): file is SaveFileInput => Boolean(file))
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

function encodeGitHubPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function getExistingFileSha({
  owner,
  repo,
  path,
  branch,
  accessToken,
}: {
  owner: string
  repo: string
  path: string
  branch: string
  accessToken: string
}) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(accessToken) },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to inspect ${path}: ${response.status}`)
  }

  const data = await response.json()
  return typeof data.sha === 'string' ? data.sha : null
}
