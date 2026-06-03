import { NextRequest, NextResponse } from 'next/server'
import {
  getGitHubAccessToken,
  getOptionalAuthenticatedUser,
  githubHeaders,
} from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const { owner, repo } = await params
    const path = request.nextUrl.searchParams.get('path') || ''
    const requestedRef = request.nextUrl.searchParams.get('ref')
    const user = await getOptionalAuthenticatedUser()
    const userAccessToken = user ? await getGitHubAccessToken(user.id) : null
    const accessToken = userAccessToken || process.env.GITHUB_TOKEN || null
    const ref =
      requestedRef ||
      (await getDefaultBranch(owner, repo, accessToken)) ||
      'main'
    const safePath = path
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/')

    // Construct GitHub API URL for repository contents
    const apiUrl = safePath
      ? `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}?ref=${encodeURIComponent(ref)}`
      : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(ref)}`

    const response = await fetch(apiUrl, {
      headers: githubHeaders(accessToken),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'File or directory not found' }, { status: 404 })
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          {
            error:
              'GitHub access denied. Public repositories work without a token; private repositories require connecting GitHub.',
          },
          { status: response.status },
        )
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()

    // If it's a single file, return the file content
    if (data.type === 'file') {
      return NextResponse.json({
        type: 'file',
        name: data.name,
        path: data.path,
        size: data.size,
        content: {
          content: data.content,
          encoding: data.encoding,
        },
        download_url: data.download_url,
      })
    }

    // If it's a directory, return the contents list
    if (Array.isArray(data)) {
      return NextResponse.json({
        type: 'dir',
        contents: data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          download_url: item.download_url,
        })),
      })
    }

    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
  } catch (error) {
    console.error('Error fetching GitHub repository content:', error)
    return NextResponse.json({ error: 'Failed to fetch repository content' }, { status: 500 })
  }
}

async function getDefaultBranch(owner: string, repo: string, accessToken?: string | null) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: githubHeaders(accessToken) },
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return typeof data.default_branch === 'string' ? data.default_branch : null
  } catch {
    return null
  }
}
