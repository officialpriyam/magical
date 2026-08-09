import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) return []

  const html = await response.text()
  const results: SearchResult[] = []

  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  let match
  while ((match = resultRegex.exec(html)) !== null) {
    const rawUrl = match[1]
    const title = match[2].replace(/<[^>]*>/g, '').trim()
    const snippet = match[3].replace(/<[^>]*>/g, '').trim()

    let cleanUrl = rawUrl
    try {
      const u = new URL(rawUrl, 'https://duckduckgo.com')
      cleanUrl = u.searchParams.get('uddg') || rawUrl
    } catch {
      cleanUrl = rawUrl
    }

    if (title && cleanUrl && !cleanUrl.startsWith('//')) {
      results.push({ title, url: cleanUrl, snippet })
    }
  }

  if (results.length === 0) {
    const simpleRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/gi
    while ((match = simpleRegex.exec(html)) !== null) {
      const cleanUrl = match[1]
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      if (title && cleanUrl) {
        results.push({ title, url: cleanUrl, snippet: '' })
      }
    }
  }

  return results.slice(0, 5)
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  let results = await searchBrave(query.trim())

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

  let results = await searchBrave(query.trim())

  if (results.length === 0) {
    results = await searchDuckDuckGo(query.trim())
  }

  return NextResponse.json({ results })
}
