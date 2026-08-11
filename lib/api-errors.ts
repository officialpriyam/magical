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
  console.error('API Error:', error?.message || error)
  if (error?.cause) {
    console.error('API Error cause:', error.cause?.message || error.cause)
  }
  if (error?.statusCode) {
    console.error('API Error status:', error.statusCode)
  }

  if (isRateLimitError(error)) {
    const message = context?.hasOwnApiKey
      ? 'The provider is currently unavailable due to request limit.'
      : 'The provider is currently unavailable due to request limit. Try using your own API key.'

    return new Response(message, { status: 429 })
  }

  if (isOverloadedError(error)) {
    return new Response(
      'The provider is currently overloaded. Please try again in a moment.',
      { status: 529 },
    )
  }

  if (isAccessDeniedError(error)) {
    return new Response(
      'Access denied. Please check your API key is valid and has credits remaining.',
      { status: 403 },
    )
  }

  if (isObjectGenerationError(error)) {
    const detail = error?.cause?.message || error?.message || ''
    let hint = 'Try again, or choose a different model.'
    
    if (detail.includes('empty response') || detail.includes('NoObjectGeneratedError')) {
      hint = 'The model returned no code. This can happen with some models — try again or use a different model.'
    } else if (detail.includes('invalid JSON') || detail.includes('JSONParseError')) {
      hint = 'The model returned malformed JSON. Try again — this is often a transient issue.'
    } else if (detail.includes('schema validation') || detail.includes('TypeValidationError')) {
      hint = 'The model response did not match the expected format. Try again with a simpler request.'
    }
    
    return new Response(
      `The AI provider returned an empty or invalid code response. ${hint}`,
      { status: 422 },
    )
  }

  // Surface the actual error message when available
  const msg = error?.message || ''
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
    return new Response(
      'Network error. Could not reach the AI provider. Please check your connection and try again.',
      { status: 502 },
    )
  }
  if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
    return new Response(
      'The request timed out. The model may be too busy. Please try again or choose a different model.',
      { status: 504 },
    )
  }
  if (msg.includes('invalid') || msg.includes('not found') || msg.includes('does not exist')) {
    return new Response(
      `Model error: ${msg}`,
      { status: 422 },
    )
  }

  // Generic error handling — include a useful snippet of the real error
  const detail = error?.cause?.message || error?.message || 'Unknown error'
  return new Response(
    `An unexpected error has occurred: ${detail.slice(0, 200)}. Please try again or choose a different model.`,
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
