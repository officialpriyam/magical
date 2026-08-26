'use client'

import { FragmentInterpreter } from './fragment-interpreter'
import { FragmentWeb } from './fragment-web'
import { ExecutionResult } from '@/lib/types'

export function FragmentPreview({
  result,
  code,
  executeCode,
}: {
  result: ExecutionResult
  code: string
  executeCode: (code: string) => Promise<void>
}) {
  if (result.template === 'code-interpreter-v1') {
    return (
      <FragmentInterpreter
        result={result}
        code={code}
        executeCode={executeCode}
      />
    )
  }

  return <FragmentWeb result={result} />
}
