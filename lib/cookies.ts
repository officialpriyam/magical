const SIDEBAR_WIDTH_COOKIE = 'sidebar-width'
const SIDEBAR_OPEN_COOKIE = 'sidebar-open'
const DEFAULT_SIDEBAR_WIDTH = 288
const DEFAULT_SIDEBAR_OPEN = false // Default to false to avoid hydration issues

// Simple cookie utilities using native browser APIs
function getCookie(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined

  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift()
  }
  return undefined
}

function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof window === 'undefined') return

  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=strict`
}

export function getSidebarWidth(): number {
  if (typeof window === 'undefined') {
    // Server-side: return default
    return DEFAULT_SIDEBAR_WIDTH
  }

  const cookieValue = getCookie(SIDEBAR_WIDTH_COOKIE)
  if (cookieValue) {
    const width = parseInt(cookieValue, 10)
    if (!isNaN(width) && width >= 200 && width <= 600) {
      return width
    }
  }

  return DEFAULT_SIDEBAR_WIDTH
}

export function setSidebarWidth(width: number): void {
  if (typeof window === 'undefined') return

  // Validate width
  if (width >= 200 && width <= 600) {
    setCookie(SIDEBAR_WIDTH_COOKIE, width.toString())
  }
}

export function getSidebarWidthFromCookie(cookieString?: string): number {
  if (!cookieString) return DEFAULT_SIDEBAR_WIDTH

  const cookies = cookieString
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value
        return acc
      },
      {} as Record<string, string>,
    )

  const width = parseInt(cookies[SIDEBAR_WIDTH_COOKIE] || '', 10)
  if (!isNaN(width) && width >= 200 && width <= 600) {
    return width
  }

  return DEFAULT_SIDEBAR_WIDTH
}

export function getSidebarOpen(): boolean {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDEBAR_OPEN
  }

  const cookieValue = getCookie(SIDEBAR_OPEN_COOKIE)
  if (cookieValue) {
    return cookieValue === 'true'
  }

  return DEFAULT_SIDEBAR_OPEN
}

export function setSidebarOpen(isOpen: boolean): void {
  if (typeof window === 'undefined') return

  setCookie(SIDEBAR_OPEN_COOKIE, isOpen.toString())
}

export function getSidebarOpenFromCookie(cookieString?: string): boolean {
  if (!cookieString) return DEFAULT_SIDEBAR_OPEN

  const cookies = cookieString
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value
        return acc
      },
      {} as Record<string, string>,
    )

  const isOpen = cookies[SIDEBAR_OPEN_COOKIE]
  if (isOpen !== undefined) {
    return isOpen === 'true'
  }

  return DEFAULT_SIDEBAR_OPEN
}