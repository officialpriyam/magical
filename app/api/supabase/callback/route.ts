import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getAppBaseUrl } from '@/lib/github-server'
import {
  exchangeSupabaseOAuthCode,
  hasSupabaseOAuthConfig,
  storeSupabaseOAuthConnection,
} from '@/lib/supabase-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request)
  const redirectToSettings = (status: string) =>
    NextResponse.redirect(`${baseUrl}/settings/integrations?supabase=${status}`)

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  const savedState = request.cookies.get('supabase_oauth_state')?.value
  const codeVerifier = request.cookies.get('supabase_oauth_code_verifier')?.value

  const clearOAuthCookies = (response: NextResponse) => {
    response.cookies.delete('supabase_oauth_state')
    response.cookies.delete('supabase_oauth_code_verifier')
    return response
  }

  if (oauthError) {
    return clearOAuthCookies(
      redirectToSettings(
        oauthError === 'access_denied' ? 'access_denied' : 'authorization_failed',
      ),
    )
  }

  if (!code || !state || !savedState || state !== savedState || !codeVerifier) {
    return clearOAuthCookies(redirectToSettings('invalid_state'))
  }

  const { user, error } = await authenticateUser()

  if (error || !user) {
    return clearOAuthCookies(redirectToSettings('login_required'))
  }

  if (!hasSupabaseOAuthConfig()) {
    return clearOAuthCookies(redirectToSettings('not_configured'))
  }

  try {
    const tokenData = await exchangeSupabaseOAuthCode({
      code,
      codeVerifier,
      redirectUri: `${baseUrl}/api/supabase/callback`,
    })

    await storeSupabaseOAuthConnection({
      userId: user.id,
      tokenData,
    })

    return clearOAuthCookies(redirectToSettings('connected'))
  } catch (error) {
    console.error('Supabase OAuth callback failed:', error)
    return clearOAuthCookies(
      redirectToSettings(
        error instanceof Error && /organization/i.test(error.message)
          ? 'organization_lookup_failed'
          : 'token_exchange_failed',
      ),
    )
  }
}
