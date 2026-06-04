import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GITHUB_SCOPES = ['repo', 'read:org', 'user:email']

export async function GET(request: NextRequest) {
  const baseUrl = getConnectBaseUrl(request)
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
    scope: GITHUB_SCOPES.join(' '),
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

  if (!trimmedUrl) {
    return ''
  }

  return trimmedUrl.startsWith('http')
    ? trimmedUrl
    : `https://${trimmedUrl}`
}
