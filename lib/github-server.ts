import 'server-only'

import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { supabaseServiceRoleKey } from '@/lib/supabase-credentials'

export type GitHubConnectionData = {
  access_token?: string
  token_type?: string
  scope?: string
  github_user_id?: number
  username?: string
  name?: string | null
  avatar_url?: string
  connected_at?: string
}

export type GitHubConnectionStatus = {
  connected: boolean
  username?: string
  name?: string | null
  avatar_url?: string
  scope?: string
  connected_at?: string
}

const GITHUB_TOKEN_PREFIX = 'enc:v1:'

export function getGitHubScopes() {
  return ['repo', 'read:org', 'user:email']
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

export function getConfiguredAppBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL

  return configuredUrl ? normalizeBaseUrl(configuredUrl) : ''
}

export function getAppBaseUrl(request: NextRequest) {
  const configuredUrl = getConfiguredAppBaseUrl()

  if (configuredUrl) {
    return configuredUrl
  }

  const requestOrigin = normalizeBaseUrl(request.nextUrl.origin)

  if (requestOrigin) {
    return requestOrigin
  }

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  return vercelUrl ? normalizeBaseUrl(vercelUrl) : request.nextUrl.origin
}

export function githubHeaders(accessToken?: string | null) {
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function getOptionalAuthenticatedUser(): Promise<User | null> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return user
  } catch {
    return null
  }
}

export async function getGitHubConnectionStatus(userId: string): Promise<GitHubConnectionStatus> {
  const integration = await getGitHubIntegration(userId)

  if (!integration?.is_connected || !integration.connection_data) {
    return { connected: false }
  }

  const data = integration.connection_data as GitHubConnectionData

  return {
    connected: true,
    username: data.username,
    name: data.name,
    avatar_url: data.avatar_url,
    scope: data.scope,
    connected_at: data.connected_at,
  }
}

export async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const integration = await getGitHubIntegration(userId)

  if (!integration?.is_connected || !integration.connection_data) {
    return null
  }

  const token = (integration.connection_data as GitHubConnectionData).access_token

  return token ? decryptGitHubToken(token) : null
}

export async function storeGitHubAccessToken({
  userId,
  accessToken,
  tokenType,
  scope,
  githubUser,
}: {
  userId: string
  accessToken: string
  tokenType?: string
  scope?: string
  githubUser: {
    id: number
    login: string
    name?: string | null
    avatar_url?: string
  }
}) {
  const supabase = await createServerClient(true)
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: userId,
      service_name: 'github',
      is_connected: true,
      connection_data: {
        access_token: encryptGitHubToken(accessToken),
        token_type: tokenType || 'bearer',
        scope: scope || getGitHubScopes().join(','),
        github_user_id: githubUser.id,
        username: githubUser.login,
        name: githubUser.name || null,
        avatar_url: githubUser.avatar_url,
        connected_at: now,
      },
      updated_at: now,
    } as never)

  if (error) {
    throw error
  }
}

export async function disconnectGitHub(userId: string) {
  const supabase = await createServerClient(true)

  const { error } = await supabase
    .from('user_integrations')
    .update({
      is_connected: false,
      connection_data: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId)
    .eq('service_name', 'github')

  if (error) {
    throw error
  }
}

async function getGitHubIntegration(userId: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('user_integrations')
    .select('is_connected, connection_data')
    .eq('user_id', userId)
    .eq('service_name', 'github')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as { is_connected: boolean; connection_data: GitHubConnectionData | null } | null
}

function getEncryptionKey() {
  const material = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || supabaseServiceRoleKey
  return crypto.createHash('sha256').update(material).digest()
}

function encryptGitHubToken(token: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${GITHUB_TOKEN_PREFIX}${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`
}

function decryptGitHubToken(value: string) {
  if (!value.startsWith(GITHUB_TOKEN_PREFIX)) {
    return value
  }

  const payload = value.slice(GITHUB_TOKEN_PREFIX.length)
  const [ivValue, authTagValue, encryptedValue] = payload.split(':')

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Invalid encrypted GitHub token')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
