import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GITLAB_SCOPES = ['api']

export async function GET(request: NextRequest) {
  const baseUrl = getConnectBaseUrl(request)
  const redirectToSettings = (status: string) =>
    NextResponse.redirect(`${baseUrl}/settings/git?gitlab=${status}`)

  if (!process.env.GITLAB_CLIENT_ID || !process.env.GITLAB_CLIENT_SECRET) {
    return redirectToSettings('not_configured')
  }

  const state = randomUUID()
  const redirectUri = `${baseUrl}/api/gitlab/callback`
  const params = new URLSearchParams({
    client_id: process.env.GITLAB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: GITLAB_SCOPES.join(' '),
    state,
    response_type: 'code',
  })

  const gitlabHost = process.env.GITLAB_HOST || 'https://gitlab.com'
  const response = NextResponse.redirect(
    `${gitlabHost}/oauth/authorize?${params.toString()}`,
  )

  response.cookies.set('gitlab_oauth_state', state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })

  return response
}

function getConnectBaseUrl(request: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl)
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`)
  }

  return normalizeBaseUrl(request.nextUrl.origin)
}

function normalizeBaseUrl(url: string) {
  const trimmedUrl = url.trim().replace(/\/+$/, '')
  if (!trimmedUrl) return ''
  return trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`
}
