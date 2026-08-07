export interface APIError {
  statusCode?: number
  message: string
}

export function isRateLimitError(error: any): boolean {
  return (
    error &&
    (error.statusCode === 429 ||
      error.message.toLowerCase().includes('limit') ||
      error.message.toLowerCase().includes('billing'))
  )
}

export function isOverloadedError(error: any): boolean {
  return error && (error.statusCode === 529 || error.statusCode === 503)
}

export function isAccessDeniedError(error: any): boolean {
  return error && (error.statusCode === 403 || error.statusCode === 401)
}

export function isObjectGenerationError(error: any): boolean {
  const errorName = error?.name || error?.constructor?.name || ''
  const causeName = error?.cause?.name || error?.cause?.constructor?.name || ''
  const message = `${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase()

  return (
    errorName.includes('NoObjectGeneratedError') ||
    errorName.includes('TypeValidationError') ||
    errorName.includes('JSONParseError') ||
    causeName.includes('TypeValidationError') ||
    causeName.includes('JSONParseError') ||
    message.includes('no object generated') ||
    message.includes('type validation failed') ||
    message.includes('json')
  )
}

export function handleAPIError(
  error: any,
  context?: { hasOwnApiKey?: boolean },
): Response {
  // Log the error for debugging
  console.error('API Error:', error)

  if (isRateLimitError(error)) {
    const message = context?.hasOwnApiKey
      ? 'The provider is currently unavailable due to request limit.'
      : 'The provider is currently unavailable due to request limit. Try using your own API key.'

    return new Response(message, { status: 429 })
  }

  if (isOverloadedError(error)) {
    return new Response(
      'The provider is currently unavailable. Please try again later.',
      { status: 529 },
    )
  }

  if (isAccessDeniedError(error)) {
    return new Response(
      'Access denied. Please make sure your API key is valid.',
      { status: 403 },
    )
  }

  if (isObjectGenerationError(error)) {
    return new Response(
      'The AI provider returned an empty or invalid code response. Try again, or choose a different model.',
      { status: 422 },
    )
  }

  // Generic error handling
  return new Response(
    'An unexpected error has occurred. Please try again later.',
    { status: 500 },
  )
}

export function createRateLimitResponse(limit: {
  amount: number
  remaining: number
  reset: number
}): Response {
  const resetDate = new Date(limit.reset * 1000)
  const now = new Date()
  const minutesUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60))
  
  let resetMessage = 'Please try again later.'
  if (minutesUntilReset > 0) {
    if (minutesUntilReset < 60) {
      resetMessage = `Please try again in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}.`
    } else {
      const hours = Math.ceil(minutesUntilReset / 60)
      resetMessage = `Please try again in ${hours} hour${hours !== 1 ? 's' : ''}.`
    }
  }

  return new Response(JSON.stringify({
    type: 'rate_limit',
    error: `You have reached your request limit. ${resetMessage}`,
    limit,
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': limit.amount.toString(),
      'X-RateLimit-Remaining': limit.remaining.toString(),
      'X-RateLimit-Reset': limit.reset.toString(),
    },
  })
}
