import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAppBaseUrl, getGitHubScopes } from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request)
  const redirectToSettings = (status: string) =>
    NextResponse.redirect(`${baseUrl}/settings/integrations?github=${status}`)

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return redirectToSettings('not_configured')
  }

  const state = randomUUID()
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
