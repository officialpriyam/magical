import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  // Use DuckDuckGo lite (HTML) endpoint
  const encoded = encodeURIComponent(query)
  const url = `https://lite.duckduckgo.com/lite/?q=${encoded}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    if (!response.ok) return []

    const html = await response.text()
    const results: SearchResult[] = []

    // Try multiple regex patterns for DuckDuckGo lite HTML
    // Pattern 1: table-based layout with result links
    const linkRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*class="result-link"[^>]*>([^<]+)<\/a>/gi
    let match
    while ((match = linkRegex.exec(html)) !== null) {
      const rawUrl = match[1]
      const title = match[2].trim()
      if (title && rawUrl) {
        results.push({ title, url: rawUrl, snippet: '' })
      }
    }

    // Pattern 2: try extracting from href with uddg parameter
    if (results.length === 0) {
      const uddgRegex = /href="([^"]*uddg=([^&"]+)[^"]*)"/gi
      while ((match = uddgRegex.exec(html)) !== null) {
        try {
          const decoded = decodeURIComponent(match[2])
          if (decoded.startsWith('http') && decoded.length > 10) {
            results.push({ title: decoded.replace(/^https?:\/\/[^/]+\//, '').slice(0, 80), url: decoded, snippet: '' })
          }
        } catch {}
      }
    }

    // Pattern 3: generic link extraction from result blocks
    if (results.length === 0) {
      const genericRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,80})<\/a>/gi
      const seen = new Set<string>()
      while ((match = genericRegex.exec(html)) !== null) {
        const url = match[1]
        const title = match[2].trim()
        if (title && url && !seen.has(url) && !url.includes('duckduckgo.com')) {
          seen.add(url)
          results.push({ title, url, snippet: '' })
        }
      }
    }

    return results.slice(0, 5)
  } catch {
    return []
  }
}

async function searchBrave(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) return []

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) return []

  const data = await response.json()
  const webResults = data.web?.results || []

  return webResults.slice(0, 5).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
  }))
}

async function searchExa(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) return []

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query,
        type: 'neural',
        numResults: 5,
        contents: { text: { maxCharacters: 200 } },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return []

    const data = await response.json()
    const results = data.results || []

    return results.slice(0, 5).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.text || '',
    }))
  } catch {
    return []
  }
}

async function fetchExaUrl(url: string): Promise<{ url: string; title: string; content: string } | null> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.exa.ai/contents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        urls: [url],
        text: { maxCharacters: 5000 },
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const data = await response.json()
    const result = (data.results || [])[0]
    if (!result) return null

    return {
      url: result.url || url,
      title: result.title || '',
      content: result.text || '',
    }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  // Try providers in order: Exa → Brave → DuckDuckGo
  let results = await searchExa(query.trim())

  if (results.length === 0) {
    results = await searchBrave(query.trim())
  }

  if (results.length === 0) {
    results = await searchDuckDuckGo(query.trim())
  }

  return NextResponse.json({ results })
}

export async function POST(req: Request) {
  const { query } = await req.json()

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  // Try providers in order: Exa → Brave → DuckDuckGo
  let results = await searchExa(query.trim())

  if (results.length === 0) {
    results = await searchBrave(query.trim())
  }

  if (results.length === 0) {
    results = await searchDuckDuckGo(query.trim())
  }

  return NextResponse.json({ results })
}
