import 'server-only'

import crypto from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import { supabaseServiceRoleKey } from '@/lib/supabase-credentials'

export type SupabaseConnectionData = {
  access_token?: string
  project_ref?: string
  project_name?: string | null
  connected_at?: string
}

export type SupabaseConnectionStatus = {
  connected: boolean
  projectRef?: string
  projectName?: string | null
  connected_at?: string
}

export type SupabaseMigrationInput = {
  name: string
  query: string
}

const SUPABASE_TOKEN_PREFIX = 'enc:supabase:v1:'

export async function getSupabaseConnectionStatus(
  userId: string,
): Promise<SupabaseConnectionStatus> {
  const integration = await getSupabaseIntegration(userId)

  if (!integration?.is_connected || !integration.connection_data) {
    return { connected: false }
  }

  const data = integration.connection_data

  return {
    connected: true,
    projectRef: data.project_ref,
    projectName: data.project_name,
    connected_at: data.connected_at,
  }
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
  const supabase = await createServerClient(true)

  const connectionData: SupabaseConnectionData = {
    access_token: encryptSupabaseToken(accessToken),
    project_ref: projectRef,
    project_name: getProjectName(project),
    connected_at: now,
  }

  const { error } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: userId,
      service_name: 'supabase',
      is_connected: true,
      connection_data: connectionData,
      updated_at: now,
    } as never)

  if (error) {
    throw error
  }

  return getSupabaseConnectionStatus(userId)
}

export async function disconnectSupabase(userId: string) {
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
    throw error
  }
}

export async function applySupabaseMigration(
  userId: string,
  migration: SupabaseMigrationInput,
) {
  const integration = await getSupabaseIntegration(userId)

  if (!integration?.is_connected || !integration.connection_data) {
    throw new Error('Supabase is not connected.')
  }

  const token = integration.connection_data.access_token
    ? decryptSupabaseToken(integration.connection_data.access_token)
    : ''
  const projectRef = integration.connection_data.project_ref

  if (!token || !projectRef) {
    throw new Error('Supabase connection is missing a token or project ref.')
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/migrations`,
    {
      method: 'POST',
      headers: supabaseManagementHeaders(token),
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

  return body
}

async function fetchSupabaseProject(accessToken: string, projectRef: string) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`,
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

async function getSupabaseIntegration(userId: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('user_integrations')
    .select('is_connected, connection_data')
    .eq('user_id', userId)
    .eq('service_name', 'supabase')
    .maybeSingle()

  if (error) {
    return null
  }

  return data as {
    is_connected: boolean
    connection_data: SupabaseConnectionData | null
  } | null
}

function supabaseManagementHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
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
