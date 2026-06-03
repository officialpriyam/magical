/**
 * Security utilities for input validation and sanitization
 */

// Package name validation patterns
const NPM_PACKAGE_PATTERN = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/
const PYPI_PACKAGE_PATTERN = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i

// GitHub naming patterns
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+$/
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/

// Safe URL patterns
const ALLOWED_DOMAINS = [
  'api.github.com',
  'registry.npmjs.org',
  'pypi.org'
]

/**
 * Validates package names for different registries
 */
export function validatePackageName(packageName: string, registry: 'npm' | 'pypi'): boolean {
  if (!packageName || typeof packageName !== 'string') {
    return false
  }

  // Check length limits
  if (packageName.length > 214) {
    return false
  }

  // Validate against pattern
  const pattern = registry === 'npm' ? NPM_PACKAGE_PATTERN : PYPI_PACKAGE_PATTERN
  return pattern.test(packageName)
}

/**
 * Validates GitHub repository and owner names
 */
export function validateGitHubIdentifier(identifier: string, type: 'owner' | 'repo'): boolean {
  if (!identifier || typeof identifier !== 'string') {
    return false
  }

  // Check length limits
  if (type === 'owner' && identifier.length > 39) {
    return false
  }
  if (type === 'repo' && identifier.length > 100) {
    return false
  }

  const pattern = type === 'owner' ? GITHUB_OWNER_PATTERN : GITHUB_REPO_PATTERN
  return pattern.test(identifier)
}

/**
 * Validates GitHub repository paths
 */
export function validateGitHubPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return true // Empty path is valid
  }

  // Prevent path traversal
  if (path.includes('..') || path.includes('./') || path.startsWith('/')) {
    return false
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,
    /\/\./,
    /^\//,
    /\/$/,
    /\/\//
  ]

  return !suspiciousPatterns.some(pattern => pattern.test(path))
}

/**
 * Validates Git reference names (branch, tag, commit)
 */
export function validateGitRef(ref: string): boolean {
  if (!ref || typeof ref !== 'string') {
    return false
  }

  // Basic git ref validation (simplified)
  if (ref.length > 250) {
    return false
  }

  // Check for invalid characters and patterns
  const invalidPatterns = [
    /\.\./,
    /\//,
    /^\./,
    /\.$/,
    /@\{/,
    /[\x00-\x1f\x7f]/,
    /[ ~^:?*\[\]\\]/
  ]

  return !invalidPatterns.some(pattern => pattern.test(ref))
}

/**
 * Constructs safe URLs for external requests
 */
export function constructSafeURL(domain: string, path: string): URL | null {
  try {
    // Validate domain is in allowlist
    if (!ALLOWED_DOMAINS.includes(domain)) {
      throw new Error(`Domain not allowed: ${domain}`)
    }

    // Construct URL safely
    const url = new URL(`https://${domain}`)
    
    // Add path with validation
    if (path) {
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.slice(1) : path
      url.pathname = '/' + encodeURIComponent(cleanPath)
    }

    return url
  } catch {
    return null
  }
}

/**
 * Sanitizes strings for logging to prevent log injection
 */
export function sanitizeForLogging(input: string): string {
  if (!input || typeof input !== 'string') {
    return '[invalid_input]'
  }

  // Remove control characters and limit length
  return input
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
    .replace(/[<>'"&]/g, '') // Remove HTML/script injection chars
    .slice(0, 100) // Limit length
}

/**
 * Validates provider IDs against allowed list
 */
export function validateProviderId(providerId: string): boolean {
  const allowedProviders = [
    'openai',
    'anthropic',
    'google',
    'vertex',
    'mistral',
    'groq',
    'fireworks',
    'togetherai',
    'xai',
    'deepseek',
    'ollama'
  ]

  return allowedProviders.includes(providerId)
}

/**
 * Rate limiting for external requests
 */
class RequestLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequests = 100
  private readonly timeWindow = 60000 // 1 minute

  canMakeRequest(key: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // Remove old requests outside time window
    const recentRequests = requests.filter(time => now - time < this.timeWindow)
    
    if (recentRequests.length >= this.maxRequests) {
      return false
    }

    // Add current request
    recentRequests.push(now)
    this.requests.set(key, recentRequests)
    
    return true
  }
}

export const requestLimiter = new RequestLimiter()