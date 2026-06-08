import 'server-only'

import crypto from 'node:crypto'
import { kv } from '@vercel/kv'
import { createServerClient } from '@/lib/supabase-server'
import { supabaseServiceRoleKey } from '@/lib/supabase-credentials'

export type SupabaseOrganization = {
  id?: string
  slug: string
  name: string
}

export type SupabaseProjectBinding = {
  ref: string
  name: string
  organizationSlug?: string
  region?: string
  status?: string
  url: string
  source: SupabaseConnectionSource
  createdAt: string
}

export type SupabaseConnectionData = {
  access_token?: string
  project_ref?: string
  project_name?: string | null
  oauth_access_token?: string
  oauth_refresh_token?: string
  token_type?: string
  scope?: string
  expires_at?: string
  organization_slug?: string
  organization_name?: string | null
  organizations?: SupabaseOrganization[]
  connected_at?: string
  source?: SupabaseConnectionSource
}

export type SupabaseConnectionSource = 'user' | 'environment' | 'oauth'

export type SupabaseConnectionStatus = {
  connected: boolean
  projectRef?: string
  projectName?: string | null
  connected_at?: string
  source?: SupabaseConnectionSource
  organizationSlug?: string
  organizationName?: string | null
  projectsMode?: 'single' | 'per_project'
}

export type SupabaseMigrationInput = {
  name: string
  query: string
}

export type SupabaseOAuthTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

type SupabaseCredentials = {
  accessToken: string
  projectRef?: string
  projectName?: string | null
  connectedAt?: string
  source: SupabaseConnectionSource
  organizationSlug?: string
  organizationName?: string | null
}

const SUPABASE_TOKEN_PREFIX = 'enc:supabase:v1:'
const SUPABASE_API_BASE_URL = 'https://api.supabase.com'
const SUPABASE_KV_PREFIX = 'supabase:integration:'
const SUPABASE_OAUTH_SCOPES = [
  'organizations:read',
  'projects:read',
  'projects:write',
  'database:write',
  'secrets:read',
]

export function getSupabaseOAuthScopes() {
  return SUPABASE_OAUTH_SCOPES
}

export function hasSupabaseOAuthConfig() {
  return Boolean(
    process.env.SUPABASE_OAUTH_CLIENT_ID &&
      process.env.SUPABASE_OAUTH_CLIENT_SECRET,
  )
}

export async function getSupabaseConnectionStatus(
  userId?: string,
  projectId?: string,
): Promise<SupabaseConnectionStatus> {
  const credentials = await getSupabaseCredentials(userId)

  if (!credentials) {
    return { connected: false }
  }

  const project = userId && projectId
    ? await getProjectSupabaseBinding(userId, projectId)
    : null

  return {
    connected: true,
    projectRef: project?.ref || credentials.projectRef,
    projectName: project?.name || credentials.projectName,
    connected_at: credentials.connectedAt,
    source: credentials.source,
    organizationSlug: credentials.organizationSlug || project?.organizationSlug,
    organizationName: credentials.organizationName,
    projectsMode: credentials.source === 'oauth' && !credentials.projectRef
      ? 'per_project'
      : 'single',
  }
}

export async function exchangeSupabaseOAuthCode({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string
  codeVerifier: string
  redirectUri: string
}) {
  return requestSupabaseOAuthToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: getSupabaseOAuthScopes().join(' '),
  })
}

export async function storeSupabaseOAuthConnection({
  userId,
  tokenData,
}: {
  userId: string
  tokenData: SupabaseOAuthTokenResponse
}) {
  if (!tokenData.access_token || !tokenData.refresh_token) {
    throw new Error('Supabase did not return an OAuth access token and refresh token.')
  }

  const organizations = await fetchSupabaseOrganizations(tokenData.access_token)
  const organization = chooseSupabaseOrganization(organizations)

  if (!organization) {
    throw new Error(
      'Supabase OAuth succeeded, but no organization was available for project creation.',
    )
  }

  const now = new Date().toISOString()
  const connectionData: SupabaseConnectionData = {
    oauth_access_token: encryptSupabaseToken(tokenData.access_token),
    oauth_refresh_token: encryptSupabaseToken(tokenData.refresh_token),
    token_type: tokenData.token_type || 'Bearer',
    scope: getSupabaseOAuthScopes().join(' '),
    expires_at: getSupabaseOAuthExpiry(tokenData.expires_in),
    organization_slug: organization.slug,
    organization_name: organization.name,
    organizations,
    connected_at: now,
    source: 'oauth',
  }

  await storeSupabaseIntegration(userId, connectionData)

  return getSupabaseConnectionStatus(userId)
}

export async function storeSupabaseConnection({
  userId,
  accessToken,
  projectRef,
}: {
  userId: string
  accessToken: string
  projectRef: string
}) {
  const project = await fetchSupabaseProject(accessToken, projectRef)
  const now = new Date().toISOString()
  const connectionData: SupabaseConnectionData = {
    access_token: encryptSupabaseToken(accessToken),
    project_ref: projectRef,
    project_name: getProjectName(project),
    connected_at: now,
    source: 'user',
  }

  await storeSupabaseIntegration(userId, connectionData)

  return getSupabaseConnectionStatus(userId)
}

export async function disconnectSupabase(userId: string) {
  const integration = await getSupabaseIntegration(userId)

  if (integration?.connection_data?.oauth_refresh_token) {
    await revokeSupabaseOAuthToken(integration.connection_data.oauth_refresh_token).catch(
      (error) => {
        console.warn('Supabase OAuth revoke failed:', error)
      },
    )
  }

  const supabase = await createServerClient(true)
  const { error } = await supabase
    .from('user_integrations')
    .update({
      is_connected: false,
      connection_data: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId)
    .eq('service_name', 'supabase')

  if (error) {
    if (isMissingUserIntegrationsTable(error)) {
      await storeSupabaseIntegrationInKV(userId, {
        is_connected: false,
        connection_data: null,
      })
      return
    }

    throw error
  }

  await deleteSupabaseIntegrationFromKV(userId)
}

export async function applySupabaseMigration(
  userId: string | undefined,
  migration: SupabaseMigrationInput,
  options: {
    projectId?: string
    projectTitle?: string
  } = {},
) {
  const target = await resolveSupabaseMigrationTarget({
    userId,
    projectId: options.projectId,
    projectTitle: options.projectTitle,
  })

  await waitForSupabaseProjectReady(target.credentials.accessToken, target.projectRef)

  const response = await fetch(
    `${SUPABASE_API_BASE_URL}/v1/projects/${encodeURIComponent(target.projectRef)}/database/migrations`,
    {
      method: 'POST',
      headers: supabaseManagementHeaders(target.credentials.accessToken),
      body: JSON.stringify({
        name: migration.name,
        query: migration.query,
      }),
    },
  )

  const body = await readSupabaseApiResponse(response)

  if (!response.ok) {
    throw new Error(getSupabaseApiError(body, 'Supabase migration failed.'))
  }

  return {
    result: body,
    supabaseProject: target.project,
  }
}

export async function getSupabaseProjectRuntimeEnv(
  userId: string | undefined,
  projectId: string | undefined,
) {
  if (!userId) {
    return {}
  }

  const credentials = await getSupabaseCredentials(userId)

  if (!credentials) {
    return {}
  }

  const projectRef = credentials.projectRef ||
    (projectId ? (await getProjectSupabaseBinding(userId, projectId))?.ref : '')

  if (!projectRef) {
    return {}
  }

  const apiKeys = await fetchSupabaseApiKeys(
    credentials.accessToken,
    projectRef,
  ).catch((error) => {
    console.warn('Could not fetch Supabase API keys for sandbox env:', error)
    return []
  })
  const publicKey = getSupabasePublicApiKey(apiKeys)
  const url = `https://${projectRef}.supabase.co`

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_URL: url,
    ...(publicKey
      ? {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
          SUPABASE_ANON_KEY: publicKey,
        }
      : {}),
  }
}

async function resolveSupabaseMigrationTarget({
  userId,
  projectId,
  projectTitle,
}: {
  userId?: string
  projectId?: string
  projectTitle?: string
}) {
  const credentials = await getSupabaseCredentials(userId)

  if (!credentials) {
    throw new Error(
      'Supabase is not connected. Connect Supabase from Settings with OAuth before applying database migrations.',
    )
  }

  if (credentials.projectRef) {
    return {
      credentials,
      projectRef: credentials.projectRef,
      project: {
        ref: credentials.projectRef,
        name: credentials.projectName || 'Supabase project',
        organizationSlug: credentials.organizationSlug,
        url: `https://${credentials.projectRef}.supabase.co`,
        source: credentials.source,
        createdAt: credentials.connectedAt || new Date().toISOString(),
      } satisfies SupabaseProjectBinding,
    }
  }

  if (!userId || !projectId) {
    throw new Error(
      'This Supabase OAuth connection creates one Supabase project per Magical project. Create or open a Magical project first.',
    )
  }

  const project = await ensureSupabaseProjectForMagicalProject({
    userId,
    projectId,
    projectTitle,
    credentials,
  })

  return {
    credentials,
    projectRef: project.ref,
    project,
  }
}

async function ensureSupabaseProjectForMagicalProject({
  userId,
  projectId,
  projectTitle,
  credentials,
}: {
  userId: string
  projectId: string
  projectTitle?: string
  credentials: SupabaseCredentials
}) {
  const ownedProject = await getOwnedMagicalProject(userId, projectId)
  const existing = getSupabaseProjectBindingFromMetadata(ownedProject.metadata)

  if (existing?.ref) {
    return existing
  }

  if (!credentials.organizationSlug) {
    throw new Error(
      'Supabase is connected, but no organization is available for automatic project creation. Reconnect Supabase from Settings.',
    )
  }

  const createdProject = await createSupabaseProject(
    credentials.accessToken,
    credentials.organizationSlug,
    buildSupabaseProjectName(projectTitle || ownedProject.title || projectId),
  )

  const binding: SupabaseProjectBinding = {
    ref: String(createdProject.ref || createdProject.id || ''),
    name: String(createdProject.name || projectTitle || ownedProject.title || 'Magical project'),
    organizationSlug: String(
      createdProject.organization_slug || credentials.organizationSlug,
    ),
    region: typeof createdProject.region === 'string'
      ? createdProject.region
      : undefined,
    status: typeof createdProject.status === 'string'
      ? createdProject.status
      : undefined,
    url: `https://${createdProject.ref}.supabase.co`,
    source: credentials.source,
    createdAt: new Date().toISOString(),
  }

  if (!binding.ref) {
    throw new Error('Supabase created a project but did not return a project ref.')
  }

  await saveSupabaseProjectBinding(userId, projectId, ownedProject.metadata, binding)

  return binding
}

async function getSupabaseCredentials(userId?: string): Promise<SupabaseCredentials | null> {
  const integration = await getSupabaseIntegration(userId)

  if (integration?.is_connected && integration.connection_data) {
    const data = integration.connection_data

    if (data.oauth_access_token && data.oauth_refresh_token) {
      const accessToken = await getValidSupabaseOAuthAccessToken(userId, data)

      if (accessToken) {
        return {
          accessToken,
          connectedAt: data.connected_at,
          source: 'oauth',
          organizationSlug: data.organization_slug,
          organizationName: data.organization_name,
        }
      }
    }

    const token = data.access_token
      ? decryptSupabaseToken(data.access_token)
      : ''
    const projectRef = data.project_ref

    if (token && projectRef) {
      return {
        accessToken: token,
        projectRef,
        projectName: data.project_name,
        connectedAt: data.connected_at,
        source: 'user',
        organizationSlug: data.organization_slug,
        organizationName: data.organization_name,
      }
    }
  }

  return getEnvSupabaseCredentials()
}

async function getValidSupabaseOAuthAccessToken(
  userId: string | undefined,
  data: SupabaseConnectionData,
) {
  if (!userId || !data.oauth_access_token || !data.oauth_refresh_token) {
    return ''
  }

  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : 0

  if (expiresAt > Date.now() + 60_000) {
    return decryptSupabaseToken(data.oauth_access_token)
  }

  const refreshToken = decryptSupabaseToken(data.oauth_refresh_token)
  const tokenData = await requestSupabaseOAuthToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  if (!tokenData.access_token) {
    return ''
  }

  const nextConnectionData: SupabaseConnectionData = {
    ...data,
    oauth_access_token: encryptSupabaseToken(tokenData.access_token),
    oauth_refresh_token: tokenData.refresh_token
      ? encryptSupabaseToken(tokenData.refresh_token)
      : data.oauth_refresh_token,
    token_type: tokenData.token_type || data.token_type || 'Bearer',
    expires_at: getSupabaseOAuthExpiry(tokenData.expires_in),
  }

  await storeSupabaseIntegration(userId, nextConnectionData)

  return tokenData.access_token
}

async function requestSupabaseOAuthToken(body: Record<string, string>) {
  if (!process.env.SUPABASE_OAUTH_CLIENT_ID || !process.env.SUPABASE_OAUTH_CLIENT_SECRET) {
    throw new Error('Supabase OAuth is not configured.')
  }

  const response = await fetch(`${SUPABASE_API_BASE_URL}/v1/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SUPABASE_OAUTH_CLIENT_ID}:${process.env.SUPABASE_OAUTH_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      client_id: process.env.SUPABASE_OAUTH_CLIENT_ID,
      client_secret: process.env.SUPABASE_OAUTH_CLIENT_SECRET,
      ...body,
    }),
  })
  const data = (await readSupabaseApiResponse(response)) as SupabaseOAuthTokenResponse

  if (!response.ok || data.error) {
    throw new Error(getSupabaseApiError(data, 'Supabase OAuth token exchange failed.'))
  }

  return data
}

async function revokeSupabaseOAuthToken(encryptedRefreshToken: string) {
  if (!hasSupabaseOAuthConfig()) {
    return
  }

  const refreshToken = decryptSupabaseToken(encryptedRefreshToken)

  await fetch(`${SUPABASE_API_BASE_URL}/v1/oauth/revoke`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.SUPABASE_OAUTH_CLIENT_ID}:${process.env.SUPABASE_OAUTH_CLIENT_SECRET}`,
      ).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: refreshToken }),
  })
}

function getEnvSupabaseCredentials(): SupabaseCredentials | null {
  const accessToken = readFirstEnvValue([
    'SUPABASE_MANAGEMENT_ACCESS_TOKEN',
    'SUPABASE_ACCESS_TOKEN',
  ])
  const projectRef =
    readFirstEnvValue([
      'SUPABASE_PROJECT_REF',
      'SUPABASE_MANAGEMENT_PROJECT_REF',
    ]) || getProjectRefFromUrl(readFirstEnvValue([
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_URL',
    ]))

  if (!accessToken || !projectRef) {
    return null
  }

  return {
    accessToken,
    projectRef,
    projectName: readFirstEnvValue([
      'SUPABASE_PROJECT_NAME',
      'SUPABASE_MANAGEMENT_PROJECT_NAME',
    ]) || null,
    connectedAt: undefined,
    source: 'environment',
    organizationSlug: readFirstEnvValue([
      'SUPABASE_ORGANIZATION_SLUG',
      'SUPABASE_MANAGEMENT_ORGANIZATION_SLUG',
    ]) || undefined,
  }
}

async function storeSupabaseIntegration(
  userId: string,
  connectionData: SupabaseConnectionData,
) {
  const supabase = await createServerClient(true)
  const { error } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: userId,
      service_name: 'supabase',
      is_connected: true,
      connection_data: connectionData,
      updated_at: new Date().toISOString(),
    } as never)

  if (error) {
    if (isMissingUserIntegrationsTable(error)) {
      await storeSupabaseIntegrationInKV(userId, {
        is_connected: true,
        connection_data: connectionData,
      })
      return
    }

    throw error
  }

  await deleteSupabaseIntegrationFromKV(userId)
}

async function getSupabaseIntegration(userId?: string) {
  if (!userId) {
    return null
  }

  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('user_integrations')
    .select('is_connected, connection_data')
    .eq('user_id', userId)
    .eq('service_name', 'supabase')
    .maybeSingle()

  if (error) {
    if (isMissingUserIntegrationsTable(error)) {
      return getSupabaseIntegrationFromKV(userId)
    }

    return null
  }

  return data as {
    is_connected: boolean
    connection_data: SupabaseConnectionData | null
  } | null
}

function isMissingUserIntegrationsTable(error: { code?: string; message?: string }) {
  const message = error.message || ''

  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    message.includes("Could not find the table 'public.user_integrations'") ||
    message.includes('relation "public.user_integrations" does not exist') ||
    /schema cache/i.test(message)
  )
}

function hasKVConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function getSupabaseKVKey(userId: string) {
  return `${SUPABASE_KV_PREFIX}${userId}`
}

async function storeSupabaseIntegrationInKV(
  userId: string,
  integration: {
    is_connected: boolean
    connection_data: SupabaseConnectionData | null
  },
) {
  if (!hasKVConfig()) {
    throw new Error(
      'user_integrations table is missing and Vercel KV is not configured. Run supabase/migrations/20260603000600_ensure_user_integrations_table.sql or set KV_REST_API_URL and KV_REST_API_TOKEN.',
    )
  }

  await kv.set(getSupabaseKVKey(userId), integration)
}

async function getSupabaseIntegrationFromKV(userId: string) {
  if (!hasKVConfig()) {
    return null
  }

  return kv.get<{
    is_connected: boolean
    connection_data: SupabaseConnectionData | null
  }>(getSupabaseKVKey(userId))
}

async function deleteSupabaseIntegrationFromKV(userId: string) {
  if (!hasKVConfig()) {
    return
  }

  await kv.del(getSupabaseKVKey(userId))
}

async function getOwnedMagicalProject(userId: string, projectId: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, metadata')
    .eq('id', projectId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Magical project not found for this user.')
  }

  return data as {
    id: string
    title?: string | null
    metadata?: Record<string, any> | null
  }
}

async function getProjectSupabaseBinding(userId: string, projectId: string) {
  const project = await getOwnedMagicalProject(userId, projectId).catch(() => null)

  return getSupabaseProjectBindingFromMetadata(project?.metadata)
}

function getSupabaseProjectBindingFromMetadata(metadata: any): SupabaseProjectBinding | null {
  const project = metadata?.supabaseProject

  if (!project || typeof project !== 'object' || typeof project.ref !== 'string') {
    return null
  }

  return {
    ref: project.ref,
    name: typeof project.name === 'string' ? project.name : 'Supabase project',
    organizationSlug: typeof project.organizationSlug === 'string'
      ? project.organizationSlug
      : undefined,
    region: typeof project.region === 'string' ? project.region : undefined,
    status: typeof project.status === 'string' ? project.status : undefined,
    url: typeof project.url === 'string'
      ? project.url
      : `https://${project.ref}.supabase.co`,
    source: project.source === 'environment' || project.source === 'user'
      ? project.source
      : 'oauth',
    createdAt: typeof project.createdAt === 'string'
      ? project.createdAt
      : new Date().toISOString(),
  }
}

async function saveSupabaseProjectBinding(
  userId: string,
  projectId: string,
  currentMetadata: Record<string, any> | null | undefined,
  binding: SupabaseProjectBinding,
) {
  const supabase = await createServerClient(true)
  const metadata = currentMetadata && typeof currentMetadata === 'object'
    ? currentMetadata
    : {}
  const { error } = await supabase
    .from('projects')
    .update({
      metadata: {
        ...metadata,
        supabaseProject: binding,
      },
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

async function createSupabaseProject(
  accessToken: string,
  organizationSlug: string,
  name: string,
) {
  const body: Record<string, any> = {
    db_pass: generateDatabasePassword(),
    name,
    organization_slug: organizationSlug,
  }

  const region = readFirstEnvValue(['SUPABASE_DEFAULT_REGION'])
  const instanceSize = readFirstEnvValue(['SUPABASE_DEFAULT_INSTANCE_SIZE'])

  if (region) {
    body.region_selection = {
      type: 'specific',
      code: region,
    }
  }

  if (instanceSize) {
    body.desired_instance_size = instanceSize
  }

  const response = await fetch(`${SUPABASE_API_BASE_URL}/v1/projects`, {
    method: 'POST',
    headers: supabaseManagementHeaders(accessToken),
    body: JSON.stringify(body),
  })
  const data = await readSupabaseApiResponse(response)

  if (!response.ok) {
    throw new Error(getSupabaseApiError(data, 'Could not create Supabase project.'))
  }

  return data
}

async function waitForSupabaseProjectReady(accessToken: string, projectRef: string) {
  const maxAttempts = 18

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const project = await fetchSupabaseProject(accessToken, projectRef).catch(() => null)
    const status = typeof project?.status === 'string' ? project.status : ''

    if (!status || status === 'ACTIVE_HEALTHY' || status === 'ACTIVE_UNHEALTHY') {
      return
    }

    if (status === 'INIT_FAILED' || status === 'REMOVED' || status === 'RESTORE_FAILED') {
      throw new Error(`Supabase project is not usable yet. Current status: ${status}.`)
    }

    await delay(5000)
  }

  throw new Error('Supabase project is still provisioning. Try applying the migration again in a minute.')
}

async function fetchSupabaseProject(accessToken: string, projectRef: string) {
  const response = await fetch(
    `${SUPABASE_API_BASE_URL}/v1/projects/${encodeURIComponent(projectRef)}`,
    {
      headers: supabaseManagementHeaders(accessToken),
    },
  )
  const body = await readSupabaseApiResponse(response)

  if (!response.ok) {
    throw new Error(getSupabaseApiError(body, 'Could not verify Supabase project.'))
  }

  return body
}

async function fetchSupabaseOrganizations(accessToken: string) {
  const response = await fetch(`${SUPABASE_API_BASE_URL}/v1/organizations`, {
    headers: supabaseManagementHeaders(accessToken),
  })
  const body = await readSupabaseApiResponse(response)

  if (!response.ok) {
    throw new Error(getSupabaseApiError(body, 'Could not load Supabase organizations.'))
  }

  return Array.isArray(body)
    ? body
        .map((organization) => ({
          id: typeof organization.id === 'string' ? organization.id : undefined,
          slug: typeof organization.slug === 'string' ? organization.slug : '',
          name: typeof organization.name === 'string'
            ? organization.name
            : organization.slug || 'Supabase organization',
        }))
        .filter((organization) => organization.slug)
    : []
}

async function fetchSupabaseApiKeys(accessToken: string, projectRef: string) {
  const response = await fetch(
    `${SUPABASE_API_BASE_URL}/v1/projects/${encodeURIComponent(projectRef)}/api-keys`,
    {
      headers: supabaseManagementHeaders(accessToken),
    },
  )
  const body = await readSupabaseApiResponse(response)

  if (!response.ok) {
    throw new Error(getSupabaseApiError(body, 'Could not load Supabase API keys.'))
  }

  return Array.isArray(body) ? body : []
}

function chooseSupabaseOrganization(organizations: SupabaseOrganization[]) {
  const preferredSlug = readFirstEnvValue([
    'SUPABASE_DEFAULT_ORGANIZATION_SLUG',
    'SUPABASE_ORGANIZATION_SLUG',
  ])

  if (preferredSlug) {
    const preferred = organizations.find(
      (organization) => organization.slug === preferredSlug,
    )

    if (preferred) {
      return preferred
    }
  }

  return organizations[0] || null
}

function getSupabasePublicApiKey(keys: any[]) {
  const publishable = keys.find(
    (key) => key?.api_key && key.type === 'publishable',
  )

  if (publishable?.api_key) {
    return String(publishable.api_key)
  }

  const anon = keys.find((key) => {
    const name = typeof key?.name === 'string' ? key.name.toLowerCase() : ''
    return key?.api_key && name.includes('anon') && !name.includes('service')
  })

  return anon?.api_key ? String(anon.api_key) : ''
}

function supabaseManagementHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function readFirstEnvValue(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()

    if (value) {
      return value
    }
  }

  return ''
}

function getProjectRefFromUrl(value: string) {
  if (!value) {
    return ''
  }

  try {
    const hostname = new URL(value).hostname
    const suffix = '.supabase.co'

    if (!hostname.endsWith(suffix)) {
      return ''
    }

    return hostname.slice(0, -suffix.length)
  } catch {
    return ''
  }
}

async function readSupabaseApiResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, any>
  } catch {
    return { message: text }
  }
}

function getSupabaseApiError(body: Record<string, any>, fallback: string) {
  return (
    body.message ||
    body.error ||
    body.error_description ||
    body.detail ||
    fallback
  )
}

function getProjectName(project: Record<string, any>) {
  return typeof project.name === 'string'
    ? project.name
    : typeof project.project_name === 'string'
      ? project.project_name
      : null
}

function buildSupabaseProjectName(value: string) {
  const normalized = value
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72)

  return normalized
    ? `Magical ${normalized}`
    : `Magical ${crypto.randomUUID().slice(0, 8)}`
}

function generateDatabasePassword() {
  return crypto.randomBytes(36).toString('base64url')
}

function getSupabaseOAuthExpiry(expiresIn?: number) {
  const seconds = typeof expiresIn === 'number' && expiresIn > 0
    ? expiresIn
    : 3600

  return new Date(Date.now() + Math.max(seconds - 60, 60) * 1000).toISOString()
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(supabaseServiceRoleKey).digest()
}

function encryptSupabaseToken(token: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${SUPABASE_TOKEN_PREFIX}${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`
}

function decryptSupabaseToken(value: string) {
  if (!value.startsWith(SUPABASE_TOKEN_PREFIX)) {
    return value
  }

  const payload = value.slice(SUPABASE_TOKEN_PREFIX.length)
  const [ivValue, authTagValue, encryptedValue] = payload.split(':')

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Invalid encrypted Supabase token')
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
