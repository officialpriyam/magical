// import "prismjs/plugins/line-numbers/prism-line-numbers.js";
// import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import './code-theme.css'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import { useEffect, useMemo, useRef } from 'react'

const MAX_HIGHLIGHT_CHARS = 120_000

export function CodeView({ code, lang }: { code: string; lang: string }) {
  const codeRef = useRef<HTMLElement | null>(null)
  const shouldHighlight = code.length <= MAX_HIGHLIGHT_CHARS
  const language = useMemo(() => normalizePrismLanguage(lang), [lang])

  useEffect(() => {
    if (!shouldHighlight || !codeRef.current) return

    Prism.highlightElement(codeRef.current)
  }, [code, language, shouldHighlight])

  return (
    <pre
      className="p-4 pt-2"
      style={{
        fontSize: 12,
        backgroundColor: 'transparent',
        borderRadius: 0,
        margin: 0,
      }}
    >
      <code ref={codeRef} className={shouldHighlight ? `language-${language}` : ''}>
        {code}
      </code>
    </pre>
  )
}

function normalizePrismLanguage(lang: string) {
  if (lang === 'ts') return 'typescript'
  if (lang === 'tsx') return 'tsx'
  if (lang === 'js') return 'javascript'
  if (lang === 'jsx') return 'jsx'
  if (lang === 'py') return 'python'

  return lang || 'text'
}
