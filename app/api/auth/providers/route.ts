import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/supabase-credentials'
import { Provider } from '@supabase/supabase-js'

const COMMON_PROVIDERS: Provider[] = ['github', 'google', 'discord', 'twitter', 'facebook', 'gitlab', 'bitbucket']

export async function GET() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return Response.json({ providers: [] })
  }

  const enabledProviders: Provider[] = []

  const results = await Promise.allSettled(
    COMMON_PROVIDERS.map(async (provider) => {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/authorize?provider=${provider}`, {
          method: 'HEAD',
          headers: {
            apikey: supabaseServiceRoleKey,
          },
          redirect: 'manual',
        })

        if (res.status === 302 || res.status === 200) {
          const location = res.headers.get('location') || ''
          if (location && !location.includes('error') && !location.includes('unsupported')) {
            return provider
          }
        }

        return null
      } catch {
        return null
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      enabledProviders.push(result.value)
    }
  }

  return Response.json({ providers: enabledProviders })
}
