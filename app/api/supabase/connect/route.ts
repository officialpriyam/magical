import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getAppBaseUrl } from '@/lib/github-server'
import {
  getSupabaseOAuthScopes,
  hasSupabaseOAuthConfig,
  storeSupabaseConnection,
} from '@/lib/supabase-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request)
  const redirectToSettings = (status: string) =>
    NextResponse.redirect(`${baseUrl}/settings/integrations?supabase=${status}`)

  if (!hasSupabaseOAuthConfig()) {
    return redirectToSettings('not_configured')
  }

  const { user, error } = await authenticateUser()

  if (error || !user) {
    return redirectToSettings('login_required')
  }

  const state = crypto.randomUUID()
  const codeVerifier = crypto.randomBytes(48).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  const redirectUri = `${baseUrl}/api/supabase/callback`
  const params = new URLSearchParams({
    client_id: process.env.SUPABASE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: getSupabaseOAuthScopes().join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const response = NextResponse.redirect(
    `https://api.supabase.com/v1/oauth/authorize?${params.toString()}`,
  )

  const secureCookie =
    request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production'

  response.cookies.set('supabase_oauth_state', state, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })
  response.cookies.set('supabase_oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })

  return response
}

export async function POST(req: Request) {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  const body = await req.json().catch(() => ({}))
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  const projectRef = typeof body.projectRef === 'string' ? body.projectRef.trim() : ''

  if (!accessToken || !projectRef) {
    return NextResponse.json(
      { error: 'Supabase access token and project ref are required.' },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(
      await storeSupabaseConnection({
        userId: user.id,
        accessToken,
        projectRef,
      }),
    )
  } catch (error) {
    console.error('Failed to connect Supabase:', error)
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Failed to connect Supabase.',
      },
      { status: 500 },
    )
  }
}
