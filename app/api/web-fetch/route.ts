import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface FetchResult {
  url: string
  title: string
  content: string
  success: boolean
  error?: string
}

async function fetchWithExa(url: string): Promise<FetchResult | null> {
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
        text: { maxCharacters: 8000 },
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
      success: true,
    }
  } catch {
    return null
  }
}

async function fetchUrlContent(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })

    if (!response.ok) {
      return { url, title: '', content: '', success: false, error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : ''

    // Extract meta description
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
      || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i)
    const metaDesc = metaDescMatch ? metaDescMatch[1].replace(/\s+/g, ' ').trim() : ''

    // Extract body text — strip scripts, styles, nav, footer, etc.
    let content = html
      // Remove script and style tags
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      // Remove nav, footer, header tags
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()

    // Truncate to a reasonable size for LLM context
    if (content.length > 8000) {
      content = content.slice(0, 8000) + '... [content truncated]'
    }

    return {
      url,
      title,
      content,
      success: true,
    }
  } catch (error: any) {
    return {
      url,
      title: '',
      content: '',
      success: false,
      error: error?.message || 'Failed to fetch URL',
    }
  }
}

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  // Validate URL
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Try Exa first for better content extraction, fall back to direct fetch
  const exaResult = await fetchWithExa(url)
  if (exaResult && exaResult.success && exaResult.content.length > 100) {
    return NextResponse.json(exaResult)
  }

  const result = await fetchUrlContent(url)
  return NextResponse.json(result)
}
