'use client'

import { type NewsArticle } from '@/components/ui/sidebar-news'

const DEMO_ARTICLES: NewsArticle[] = [
  {
    href: '/',
    title: 'Magical AI',
    summary: 'AI app builder and coding workspace developed by priyx.',
    image: '/icon.png',
  },
  {
    href: '/',
    title: 'Sandboxed Code',
    summary: 'Generate, inspect, and execute code in isolated E2B environments.',
    image: '/icon.png',
  },
  {
    href: '/',
    title: 'Multiple AI Providers',
    summary: 'Use OpenAI, Anthropic, Google, Groq, Fireworks, Together AI, and more.',
    image: '/icon.png',
  },
]

export function NewsArticles() {
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-foreground mb-3">About</h3>
      <div className="space-y-3">
        {DEMO_ARTICLES.map((article) => (
          <div
            key={article.title}
            className="group cursor-pointer"
            onClick={() => window.open(article.href, '_self')}
          >
            <div className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="relative w-12 h-12 shrink-0 rounded overflow-hidden bg-muted">
                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {article.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {article.summary}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { type NewsArticle }
