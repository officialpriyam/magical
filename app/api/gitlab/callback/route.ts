import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type GitLabTokenResponse = {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

export async function GET(request: NextRequest) {
  const baseUrl = getConnectBaseUrl(request)
  const redirectToSettings = (status: string) =>
    NextResponse.redirect(`${baseUrl}/settings/git?gitlab=${status}`)

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  const savedState = request.cookies.get('gitlab_oauth_state')?.value

  if (oauthError) {
    const response = redirectToSettings(
      oauthError === 'access_denied' ? 'access_denied' : 'authorization_failed',
    )
    response.cookies.delete('gitlab_oauth_state')
    return response
  }

  if (!code || !state || !savedState || state !== savedState) {
    const response = redirectToSettings('invalid_state')
    response.cookies.delete('gitlab_oauth_state')
    return response
  }

  const { user, error } = await authenticateUser()

  if (error) {
    const response = redirectToSettings('login_required')
    response.cookies.delete('gitlab_oauth_state')
    return response
  }

  if (!process.env.GITLAB_CLIENT_ID || !process.env.GITLAB_CLIENT_SECRET) {
    const response = redirectToSettings('not_configured')
    response.cookies.delete('gitlab_oauth_state')
    return response
  }

  const gitlabHost = process.env.GITLAB_HOST || 'https://gitlab.com'

  try {
    const tokenResponse = await fetch(`${gitlabHost}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code,
        redirect_uri: `${baseUrl}/api/gitlab/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = (await tokenResponse.json()) as GitLabTokenResponse

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      console.error('GitLab token exchange failed:', tokenData.error_description || tokenData.error)
      const response = redirectToSettings('token_exchange_failed')
      response.cookies.delete('gitlab_oauth_state')
      return response
    }

    const gitlabUserResponse = await fetch(`${gitlabHost}/api/v4/user`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!gitlabUserResponse.ok) {
      console.error('GitLab user lookup failed:', gitlabUserResponse.status)
      const response = redirectToSettings('user_lookup_failed')
      response.cookies.delete('gitlab_oauth_state')
      return response
    }

    const gitlabUser = await gitlabUserResponse.json()

    const supabase = await createServerClient()
    if (!supabase) {
      const response = redirectToSettings('storage_failed')
      response.cookies.delete('gitlab_oauth_state')
      return response
    }

    const { error: upsertError } = await supabase.from('user_integrations').upsert(
      {
        user_id: user.id,
        service_name: 'gitlab',
        is_connected: true,
        connection_data: {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          username: gitlabUser.username,
          name: gitlabUser.name,
          email: gitlabUser.email,
          avatar_url: gitlabUser.avatar_url,
          connected_at: new Date().toISOString(),
          gitlab_host: gitlabHost,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,service_name' },
    )

    if (upsertError) {
      console.error('GitLab token storage failed:', JSON.stringify(upsertError))
      const response = redirectToSettings('storage_failed')
      response.cookies.delete('gitlab_oauth_state')
      return response
    }

    console.log('GitLab connected successfully for user:', user.id)
    const response = redirectToSettings('connected')
    response.cookies.delete('gitlab_oauth_state')
    return response
  } catch (err) {
    console.error('GitLab OAuth callback failed:', err)
    const response = redirectToSettings('error')
    response.cookies.delete('gitlab_oauth_state')
    return response
  }
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
