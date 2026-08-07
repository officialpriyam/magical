import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createSupabaseBrowserClient() {
    if (typeof window === 'undefined') {
        return null
    }
    
    if (supabaseClient) {
        return supabaseClient
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Dev/test mode: return mock client if env vars not set
    const isDevMode = process.env.NODE_ENV === 'development' && (!supabaseUrl || !supabaseAnonKey)
    
    if (isDevMode) {
        console.warn('[Dev Mode] Supabase not configured - using mock client for local testing')
        return createMockSupabaseClient()
    }
    
    if (!supabaseUrl || !supabaseAnonKey) {
        if (process.env.NODE_ENV === 'development') {
            return null
        }
        throw new Error('Supabase URL and Anon Key are required')
    }
    
    supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
    return supabaseClient
}

function createMockSupabaseClient() {
    // Mock user for testing
    const mockUser = {
        id: 'dev-user-123',
        email: 'dev@local.test',
        user_metadata: { is_fragments_user: true },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
    }
    
    const mockSession = {
        user: mockUser,
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
    }
    
    return {
        auth: {
            getSession: async () => ({ data: { session: mockSession }, error: null }),
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: () => {} } }
            }),
            updateUser: async () => ({ data: { user: mockUser }, error: null }),
            signInWithPassword: async () => ({ data: { user: mockUser, session: mockSession }, error: null }),
            signUp: async () => ({ data: { user: mockUser, session: mockSession }, error: null }),
            signOut: async () => ({ error: null }),
        },
        from: (table: string) => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        is: () => ({
                            maybeSingle: async () => ({ data: null, error: null }),
                            single: async () => ({ data: null, error: null }),
                        }),
                    }),
                }),
            }),
            insert: () => ({
                select: () => ({
                    single: async () => ({ data: null, error: null }),
                }),
            }),
            update: () => ({
                eq: () => ({
                    eq: () => ({
                        select: () => ({
                            single: async () => ({ data: null, error: null }),
                        }),
                    }),
                }),
            }),
            delete: () => ({
                eq: () => ({
                    eq: () => ({ error: null }),
                }),
            }),
        }),
        storage: {
            from: () => ({
                upload: async () => ({ data: null, error: null }),
                download: async () => ({ data: null, error: null }),
                remove: async () => ({ data: null, error: null }),
                list: async () => ({ data: [], error: null }),
                getPublicUrl: () => ({ data: { publicUrl: '' } }),
            }),
        },
    } as any
}