import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import {
  getAppBaseUrl,
  githubHeaders,
  storeGitHubAccessToken,
} from '@/lib/github-server'

export const dynamic = 'force-dynamic'

type GitHubTokenResponse = {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request)
  const redirectToSettings = (status: string) =>
    NextResponse.redirect(`${baseUrl}/settings/integrations?github=${status}`)

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  const savedState = request.cookies.get('github_oauth_state')?.value

  if (oauthError) {
    const response = redirectToSettings(
      oauthError === 'access_denied' ? 'access_denied' : 'authorization_failed',
    )
    response.cookies.delete('github_oauth_state')
    return response
  }

  if (!code || !state || !savedState || state !== savedState) {
    const response = redirectToSettings('invalid_state')
    response.cookies.delete('github_oauth_state')
    return response
  }

  const { user, error } = await authenticateUser()

  if (error) {
    const response = redirectToSettings('login_required')
    response.cookies.delete('github_oauth_state')
    return response
  }

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    const response = redirectToSettings('not_configured')
    response.cookies.delete('github_oauth_state')
    return response
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${baseUrl}/api/github/callback`,
        state,
      }),
    })

    const tokenData = (await tokenResponse.json()) as GitHubTokenResponse

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      console.error('GitHub token exchange failed:', tokenData.error_description || tokenData.error)
      const response = redirectToSettings('token_exchange_failed')
      response.cookies.delete('github_oauth_state')
      return response
    }

    const githubUserResponse = await fetch('https://api.github.com/user', {
      headers: githubHeaders(tokenData.access_token),
    })

    if (!githubUserResponse.ok) {
      console.error('GitHub user lookup failed:', githubUserResponse.status)
      const response = redirectToSettings('user_lookup_failed')
      response.cookies.delete('github_oauth_state')
      return response
    }

    const githubUser = await githubUserResponse.json()

    try {
      await storeGitHubAccessToken({
        userId: user.id,
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        githubUser,
      })
    } catch (storageError) {
      console.error('GitHub token storage failed:', storageError)
      const response = redirectToSettings('storage_failed')
      response.cookies.delete('github_oauth_state')
      return response
    }

    const response = redirectToSettings('connected')
    response.cookies.delete('github_oauth_state')
    return response
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error)
    const response = redirectToSettings('error')
    response.cookies.delete('github_oauth_state')
    return response
  }
}
