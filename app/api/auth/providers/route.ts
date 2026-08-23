import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/supabase-credentials'
import { Provider } from '@supabase/supabase-js'

const COMMON_PROVIDERS: Provider[] = ['github', 'google', 'discord', 'facebook', 'twitter', 'gitlab', 'bitbucket', 'linkedin', 'slack', 'twitch', 'apple', 'notion']

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

        // 302 redirect = provider is configured and working
        if (res.status === 302) {
          if (location && !location.includes('error=server_error') && !location.includes('unsupported')) {
            return provider
          }
        }

        // 200 with OAuth page = provider is configured
        if (res.status === 200 && body && body.length > 100) {
          // Only reject if it clearly says unsupported
          if (body.includes('Provider "' + provider + '" is not enabled')) {
            return null
          }
          return provider
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
