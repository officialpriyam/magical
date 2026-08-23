import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

// ─── Self-hosted open-webSearch MCP ──────────────────────
let owSessionCache: { sessionId: string; expiresAt: number } | null = null

async function getOpenWebSearchSession(): Promise<string | null> {
  const baseUrl = process.env.OPEN_WEBSEARCH_URL
  if (!baseUrl) return null
  if (owSessionCache && Date.now() < owSessionCache.expiresAt) return owSessionCache.sessionId
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/sse`, {
      headers: { 'Accept': 'text/event-stream' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const reader = res.body?.getReader()
    if (!reader) return null
    const decoder = new TextDecoder()
    let buffer = ''
    let sessionId = ''
    const readPromise = (async () => {
      const startTime = Date.now()
      while (Date.now() - startTime < 6000) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].startsWith('event: endpoint')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data: ')) {
              const urlMatch = dataLine.slice(6).trim().match(/sessionId=([\w-]+)/)
              if (urlMatch) sessionId = urlMatch[1]
            }
          }
        }
        if (sessionId) break
      }
    })()
    await Promise.race([readPromise, new Promise(r => setTimeout(r, 7000))])
    reader.cancel().catch(() => {})
    if (sessionId) {
      owSessionCache = { sessionId, expiresAt: Date.now() + 5 * 60 * 1000 }
    }
    return sessionId || null
  } catch { return null }
}

async function callOpenWebSearchMCP(method: string, params: Record<string, any>): Promise<any> {
  const baseUrl = process.env.OPEN_WEBSEARCH_URL
  if (!baseUrl) return null
  const sessionId = await getOpenWebSearchSession()
  if (!sessionId) return null
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: method, arguments: params } }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) { owSessionCache = null; return null }
    const data = await response.json()
    return data?.result || null
  } catch { return null }
}

async function searchOpenWebSearch(query: string): Promise<SearchResult[]> {
  const result = await callOpenWebSearchMCP('search', { query, limit: 5 })
  if (!result) return []
  let text = Array.isArray(result.content) ? result.content.map((c: any) => c.text || '').join('') : typeof result === 'string' ? result : ''
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    const results = Array.isArray(parsed) ? parsed : parsed.results || parsed.data || []
    return results.slice(0, 5).map((r: any) => ({ title: r.title || '', url: r.url || r.link || '', snippet: r.description || r.snippet || r.text || '' }))
  } catch {
    const urls = text.match(/https?:\/\/[^\s"']+/g) || []
    return urls.slice(0, 5).map((url: string) => ({ title: url, url, snippet: '' }))
  }
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query)

  // Try DuckDuckGo HTML endpoint with form POST
  try {
    const formData = new URLSearchParams()
    formData.append('q', query)
    formData.append('kl', 'us-en')

    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    if (!response.ok) return []

    const html = await response.text()
    const results: SearchResult[] = []

    // Pattern 1: Extract from result class divs
    const resultBlocks = html.split(/class="result__body"/gi)
    for (let i = 1; i < resultBlocks.length && results.length < 5; i++) {
      const block = resultBlocks[i]
      const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)<\/a>/i)
      const urlMatch = block.match(/class="result__url"[^>]*>\s*([^<\s]+)/i)
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+)<\/a>/i)
      if (titleMatch && urlMatch) {
        let url = urlMatch[1].trim()
        if (!url.startsWith('http')) url = 'https://' + url
        results.push({
          title: titleMatch[1].trim(),
          url,
          snippet: snippetMatch ? snippetMatch[1].trim() : '',
        })
      }
    }

    // Pattern 2: Extract from uddg redirect URLs
    if (results.length === 0) {
      const uddgRegex = /href="[^"]*uddg=([^&"]+)/gi
      let match
      const seen = new Set<string>()
      while ((match = uddgRegex.exec(html)) !== null && results.length < 5) {
        try {
          const decoded = decodeURIComponent(match[1])
          if (decoded.startsWith('http') && !seen.has(decoded)) {
            seen.add(decoded)
            results.push({
              title: decoded.replace(/^https?:\/\/[^/]+\//, '').split('/')[0].replace(/[\-_]/g, ' ').slice(0, 80),
              url: decoded,
              snippet: '',
            })
          }
        } catch {}
      }
    }

    // Pattern 3: generic external links as last resort
    if (results.length === 0) {
      const genericRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,80})<\/a>/gi
      let match
      const seen = new Set<string>()
      while ((match = genericRegex.exec(html)) !== null && results.length < 5) {
        const url = match[1]
        const title = match[2].trim()
        if (title && url && !seen.has(url) && !url.includes('duckduckgo.com')) {
          seen.add(url)
          results.push({ title, url, snippet: '' })
        }
      }
    }

    return results
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

  // Try providers in order: open-webSearch → Exa → Brave → DuckDuckGo
  let results = await searchOpenWebSearch(query.trim())
  if (results.length === 0) results = await searchExa(query.trim())
  if (results.length === 0) results = await searchBrave(query.trim())
  if (results.length === 0) results = await searchDuckDuckGo(query.trim())

  return NextResponse.json({ results })
}

export async function POST(req: Request) {
  const { query } = await req.json()

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  // Try providers in order: open-webSearch → Exa → Brave → DuckDuckGo
  let results = await searchOpenWebSearch(query.trim())
  if (results.length === 0) results = await searchExa(query.trim())
  if (results.length === 0) results = await searchBrave(query.trim())
  if (results.length === 0) results = await searchDuckDuckGo(query.trim())

  return NextResponse.json({ results })
}
