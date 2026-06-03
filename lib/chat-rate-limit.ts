import { Duration } from './duration'
import ratelimit from './ratelimit'
import type { LLMModelConfig } from './models'

const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100
const DEFAULT_RATE_LIMIT_WINDOW: Duration = '1d'

export async function applyChatRateLimit({
  req,
  config,
  userID,
  teamID,
}: {
  req: Request
  config: LLMModelConfig
  userID?: string
  teamID?: string
}) {
  if (config.apiKey || !isChatRateLimitEnabled()) {
    return false
  }

  return ratelimit(
    getRateLimitKey(req, userID, teamID),
    getRateLimitMaxRequests(),
    getRateLimitWindow(),
  )
}

function isChatRateLimitEnabled() {
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return false
  }

  return (
    process.env.RATE_LIMIT_ENABLED === 'true' ||
    Boolean(process.env.RATE_LIMIT_MAX_REQUESTS)
  )
}

function getRateLimitMaxRequests() {
  const parsed = process.env.RATE_LIMIT_MAX_REQUESTS
    ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10)
    : DEFAULT_RATE_LIMIT_MAX_REQUESTS

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RATE_LIMIT_MAX_REQUESTS
}

function getRateLimitWindow(): Duration {
  return (process.env.RATE_LIMIT_WINDOW as Duration | undefined) || DEFAULT_RATE_LIMIT_WINDOW
}

function getRateLimitKey(req: Request, userID?: string, teamID?: string) {
  if (teamID) return `team_${teamID}`
  if (userID) return `user_${userID}`

  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()

  return `ip_${forwardedFor || realIp || 'anonymous'}`
}
