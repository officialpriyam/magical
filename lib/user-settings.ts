import { createSupabaseBrowserClient } from './supabase-browser'
import {
  UserProfile,
  UserPreferences,
  UserIntegration,
  UserSecuritySettings
} from './database.types'

type DynamicSupabaseClient = {
  from: (tableName: string) => any
  auth: {
    getSession: () => Promise<{ data: { session: unknown | null } }>
  }
}

// Lazy getter for supabase instance
function getSupabase(): DynamicSupabaseClient | null {
  return createSupabaseBrowserClient() as unknown as DynamicSupabaseClient | null
}

// Cache to prevent excessive API calls
let tablesExistCache: { [key: string]: boolean } = {}
export let cacheTime: { [key: string]: number } = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Check if a table exists with caching
export async function tableExists(tableName: string): Promise<boolean> {
  const now = Date.now()
  
  // Return cached result if recent
  if (tablesExistCache[tableName] && (now - cacheTime[tableName]) < CACHE_DURATION) {
    return tablesExistCache[tableName]
  }

  const supabase = getSupabase()
  if (!supabase) {
    tablesExistCache[tableName] = false
    cacheTime[tableName] = now
    return false
  }

  try {
    const { error } = await supabase.from(tableName).select('id').limit(1)
    const exists = !error || error.code !== 'PGRST106'
    
    tablesExistCache[tableName] = exists
    cacheTime[tableName] = now
    
    if (!exists) {
      console.warn(`Table ${tableName} does not exist. API calls will return defaults.`)
    }
    
    return exists
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error)
    tablesExistCache[tableName] = false
    cacheTime[tableName] = now
    return false
  }
}

// Safe wrapper to prevent API calls when tables don't exist
async function safeOperation<T>(
  tableName: string,
  operation: () => Promise<T>,
  fallback: T,
  operationName: string
): Promise<T> {
  if (!(await tableExists(tableName))) {
    console.warn(`Skipping ${operationName} - table ${tableName} does not exist`)
    return fallback
  }
  
  try {
    return await operation()
  } catch (error) {
    console.error(`${operationName} failed:`, error)
    return fallback
  }
}


export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null

  return safeOperation(
    'profiles',
    async () => {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase not available')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId) // Uses idx_profiles_user_id index
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found, create one
          return await createUserProfile(userId)
        }
        throw error
      }
      return data
    },
    getDefaultProfile(userId),
    'getUserProfile'
  )
}

function getDefaultProfile(userId: string): UserProfile {
  return {
    id: '',
    user_id: userId,
    full_name: '',
    display_name: '',
    first_name: '',
    last_name: '',
    work_description: '',
    avatar_url: '',
    onboarding_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export async function createUserProfile(userId: string, profile?: Partial<UserProfile>): Promise<UserProfile | null> {
  if (!userId) return null

  return safeOperation(
    'profiles',
    async () => {
      const { data, error } = await getSupabase()!
        .from('profiles')
        .insert({
          user_id: userId, // Uses idx_profiles_user_id index
          full_name: profile?.full_name || '',
          display_name: profile?.display_name || '',
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          work_description: profile?.work_description || '',
          avatar_url: profile?.avatar_url || '',
          onboarding_completed: profile?.onboarding_completed || false
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    getDefaultProfile(userId),
    'createUserProfile'
  )
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
  if (!userId) return false

  return safeOperation(
    'profiles',
    async () => {
      const { error } = await getSupabase()!
        .from('profiles')
        .update(updates)
        .eq('user_id', userId) // Uses idx_profiles_user_id index

      if (error) throw error
      return true
    },
    false,
    'updateUserProfile'
  )
}

// =============================================
// USER PREFERENCES OPERATIONS  
// =============================================

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (!userId) return null

  return safeOperation(
    'user_preferences',
    async () => {
      const { data, error } = await getSupabase()!
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return await createUserPreferences(userId)
        }
        throw error
      }
      return data
    },
    getDefaultPreferences(userId),
    'getUserPreferences'
  )
}

function getDefaultPreferences(userId: string): UserPreferences {
  return {
    id: '',
    user_id: userId,
    ai_assistance: true,
    smart_suggestions: false,
    theme: 'system',
    font_family: 'inter',
    email_notifications: true,
    marketing_emails: false,
    security_alerts: true,
    analytics_enabled: true,
    data_sharing_enabled: false,
    telemetry_enabled: false,
    auto_template: 'nextjs-developer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export async function createUserPreferences(userId: string, preferences?: Partial<UserPreferences>): Promise<UserPreferences | null> {
  if (!userId) return null

  return safeOperation(
    'user_preferences',
    async () => {
      const { data, error } = await getSupabase()!
        .from('user_preferences')
        .insert({
          user_id: userId,
          ai_assistance: preferences?.ai_assistance ?? true,
          smart_suggestions: preferences?.smart_suggestions ?? false,
          theme: preferences?.theme ?? 'system',
          font_family: preferences?.font_family ?? 'inter',
          email_notifications: preferences?.email_notifications ?? true,
          marketing_emails: preferences?.marketing_emails ?? false,
          security_alerts: preferences?.security_alerts ?? true,
          analytics_enabled: preferences?.analytics_enabled ?? true,
          data_sharing_enabled: preferences?.data_sharing_enabled ?? false,
          telemetry_enabled: preferences?.telemetry_enabled ?? false,
          auto_template: preferences?.auto_template ?? 'nextjs-developer',
          ...preferences
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    getDefaultPreferences(userId),
    'createUserPreferences'
  )
}

export async function updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<boolean> {
  if (!userId) return false

  return safeOperation(
    'user_preferences',
    async () => {
      // Try to update first
      const { data, error } = await getSupabase()!
        .from('user_preferences')
        .update(updates)
        .eq('user_id', userId)
        .select()

      if (error) throw error

      // If no rows updated, create preferences
      if (!data || data.length === 0) {
        const created = await createUserPreferences(userId, updates)
        return !!created
      }

      return true
    },
    false,
    'updateUserPreferences'
  )
}

export async function getUserIntegrations(userId: string): Promise<UserIntegration[]> {
  if (!userId) return []

  return safeOperation(
    'user_integrations',
    async () => {
      const { data, error } = await getSupabase()!
        .from('user_integrations')
        .select('*')
        .eq('user_id', userId)
        .order('service_name')

      if (error) throw error
      return data || []
    },
    getDefaultIntegrations(userId),
    'getUserIntegrations'
  )
}

function getDefaultIntegrations(userId: string): UserIntegration[] {
  const services = ['github', 'supabase', 'google_drive', 'gmail', 'google_calendar', 'artifacts']
  const now = new Date().toISOString()
  
  return services.map(service => ({
    id: '',
    user_id: userId,
    service_name: service,
    is_connected: service === 'artifacts',
    connection_data: undefined,
    last_sync_at: undefined,
    created_at: now,
    updated_at: now
  }))
}

export async function upsertUserIntegration(userId: string, serviceName: string, integration: Partial<UserIntegration>): Promise<boolean> {
  if (!userId) return false

  return safeOperation(
    'user_integrations',
    async () => {
      const { error } = await getSupabase()!
        .from('user_integrations')
        .upsert({
          user_id: userId,
          service_name: serviceName,
          ...integration
        })

      if (error) throw error
      return true
    },
    false,
    'upsertUserIntegration'
  )
}

export async function disconnectUserIntegration(userId: string, serviceName: string): Promise<boolean> {
  if (!userId) return false

  return safeOperation(
    'user_integrations',
    async () => {
      const { error } = await getSupabase()!
        .from('user_integrations')
        .update({ 
          is_connected: false,
          connection_data: null
        })
        .eq('user_id', userId)
        .eq('service_name', serviceName)

      if (error) throw error
      return true
    },
    false,
    'disconnectUserIntegration'
  )
}

export async function getUserSecuritySettings(userId: string): Promise<UserSecuritySettings | null> {
  if (!userId) return null

  return safeOperation(
    'user_security_settings',
    async () => {
      const { data, error } = await getSupabase()!
        .from('user_security_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return await createUserSecuritySettings(userId)
        }
        throw error
      }
      return data
    },
    getDefaultSecuritySettings(userId),
    'getUserSecuritySettings'
  )
}

function getDefaultSecuritySettings(userId: string): UserSecuritySettings {
  return {
    id: '',
    user_id: userId,
    two_factor_enabled: false,
    backup_codes: undefined,
    last_password_change: undefined,
    login_notifications: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export async function createUserSecuritySettings(userId: string): Promise<UserSecuritySettings | null> {
  if (!userId) return null

  return safeOperation(
    'user_security_settings',
    async () => {
      const { data, error } = await getSupabase()!
        .from('user_security_settings')
        .insert({
          user_id: userId,
          two_factor_enabled: false,
          login_notifications: true
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    getDefaultSecuritySettings(userId),
    'createUserSecuritySettings'
  )
}

export async function updateUserSecuritySettings(userId: string, updates: Partial<UserSecuritySettings>): Promise<boolean> {
  if (!userId) return false

  return safeOperation(
    'user_security_settings',
    async () => {
      const { data, error } = await getSupabase()!
        .from('user_security_settings')
        .update(updates)
        .eq('user_id', userId)
        .select()

      if (error) throw error

      // If no rows updated, create settings
      if (!data || data.length === 0) {
        const created = await createUserSecuritySettings(userId)
        if (created) {
          return await updateUserSecuritySettings(userId, updates)
        }
      }

      return true
    },
    false,
    'updateUserSecuritySettings'
  )
}


export async function getUserData(userId: string) {
  if (!userId) return null

  const [profile, preferences, integrations, securitySettings] = await Promise.all([
    getUserProfile(userId),
    getUserPreferences(userId),
    getUserIntegrations(userId),
    getUserSecuritySettings(userId)
  ])

  return {
    profile,
    preferences,
    integrations,
    securitySettings
  }
}

// Clear the cache (useful after running migration)
export function clearSettingsCache(): void {
  tablesExistCache = {}
  cacheTime = {}
}

export async function checkSupabaseConnection(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  } catch (error) {
    console.error('Supabase connection check failed:', error)
    return false
  }
}

export async function checkEnhancedTablesExist() {
  const tables = [
    'profiles',
    'user_preferences',
    'user_integrations',
    'user_security_settings'
  ]
  
  const status: { [key: string]: boolean } = {}
  
  for (const table of tables) {
    status[table] = await tableExists(table)
  }
  
  return status
}
