import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getGitHubAccessToken, githubHeaders } from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, error } = await authenticateUser()

    if (error) {
      return error
    }

    const accessToken = await getGitHubAccessToken(user.id)

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            'GitHub account is not connected. Connect GitHub to list account repositories, or import a public repository by URL.',
        },
        { status: 401 },
      )
    }

    const response = await fetch('https://api.github.com/user', {
      headers: githubHeaders(accessToken),
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const githubUser = await response.json()

    return NextResponse.json({
      login: githubUser.login,
      name: githubUser.name,
      avatar_url: githubUser.avatar_url,
    })
  } catch (error) {
    console.error('Error fetching GitHub user:', error)
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
  }
}
