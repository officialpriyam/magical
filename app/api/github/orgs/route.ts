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
            'GitHub account is not connected. Connect GitHub to list organizations.',
        },
        { status: 401 },
      )
    }

    const response = await fetch('https://api.github.com/user/orgs', {
      headers: githubHeaders(accessToken),
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const orgs = await response.json()

    return NextResponse.json(
      orgs.map((org: any) => ({
        login: org.login,
        name: org.name || org.login,
        avatar_url: org.avatar_url,
      })),
    )
  } catch (error) {
    console.error('Error fetching GitHub organizations:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}
