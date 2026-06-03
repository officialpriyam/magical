import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getAppBaseUrl, getGitHubScopes } from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error } = await authenticateUser()

  if (error) {
    return error
  }

  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' },
      { status: 503 },
    )
  }

  const state = randomUUID()
  const baseUrl = getAppBaseUrl(request)
  const redirectUri = `${baseUrl}/api/github/callback`
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: getGitHubScopes().join(' '),
    state,
    allow_signup: 'true',
  })

  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  )

  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })

  return response
}
