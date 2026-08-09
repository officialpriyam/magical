import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/supabase-credentials'
import { Provider } from '@supabase/supabase-js'

const COMMON_PROVIDERS: Provider[] = ['github', 'google', 'discord', 'gitlab', 'bitbucket', 'facebook', 'twitter']

export async function GET() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return Response.json({ providers: ['github', 'google'] })
  }

  const enabledProviders: Provider[] = []

  const results = await Promise.allSettled(
    COMMON_PROVIDERS.map(async (provider) => {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/authorize?provider=${provider}`, {
          headers: {
            apikey: supabaseServiceRoleKey,
          },
          redirect: 'manual',
        })

        const location = res.headers.get('location') || ''
        const body = await res.text().catch(() => '')

        if (res.status === 302) {
          if (location && !location.includes('error') && !location.includes('unsupported') && !location.includes('invalid_request')) {
            return provider
          }
        }

        if (res.status === 200 && body) {
          if (!body.includes('unsupported') && !body.includes('Provider not found') && !body.includes('invalid')) {
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

  if (enabledProviders.length === 0) {
    return Response.json({ providers: ['github', 'google'] })
  }

  return Response.json({ providers: enabledProviders })
}
