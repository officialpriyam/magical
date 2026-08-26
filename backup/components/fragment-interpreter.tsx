import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ExecutionResultInterpreter } from '@/lib/types'
import { Result as CellResultData } from '@e2b/code-interpreter'
import { Terminal, PlayIcon, LoaderIcon } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

function CellResult({ result }: { result: CellResultData }) {
  // Order of checks is important
  if (result.png) {
    return (
      <Image
        src={`data:image/png;base64,${result.png}`}
        alt="result"
        width={600}
        height={400}
      />
    )
  }
  if (result.jpeg) {
    return (
      <Image
        src={`data:image/jpeg;base64,${result.jpeg}`}
        alt="result"
        width={600}
        height={400}
      />
    )
  }
  if (result.pdf) {
    return (
      <iframe
        src={`data:application/pdf;base64,${result.pdf}`}
        className="w-full h-96 border-none"
        title="PDF result"
      />
    )
  }
  if (result.html) {
    return (
      <iframe
        srcDoc={result.html}
        className="w-full h-96 border-none"
        sandbox="allow-scripts"
        title="HTML result"
      />
    )
  }
  if (result.latex) {
    return <pre className="text-xs font-mono">{result.latex}</pre>
  }
  if (result.json) {
    return (
      <pre className="text-xs font-mono">
        {JSON.stringify(result.json, null, 2)}
      </pre>
    )
  }
  if (result.text) {
    return <pre className="text-xs font-mono">{result.text}</pre>
  }
  return null
}

function LogsOutput({
  stdout,
  stderr,
}: {
  stdout: string[]
  stderr: string[]
}) {
  if (stdout.length === 0 && stderr.length === 0) return null

  return (
    <div className="w-full h-32 max-h-32 overflow-y-auto flex flex-col items-start justify-start space-y-1 p-4">
      {stdout &&
        stdout.length > 0 &&
        stdout.map((out: string, index: number) => (
          <pre key={index} className="text-xs">
            {out}
          </pre>
        ))}
      {stderr &&
        stderr.length > 0 &&
        stderr.map((err: string, index: number) => (
          <pre key={index} className="text-xs text-red-500">
            {err}
          </pre>
        ))}
    </div>
  )
}

export function FragmentInterpreter({
  result,
  code,
  executeCode,
}: {
  result: ExecutionResultInterpreter
  code: string
  executeCode: (code: string) => Promise<void>
}) {
  const [isLoading, setIsLoading] = useState(false)
  const { cellResults, stdout, stderr, runtimeError } = result || {}

  const handleExecute = async () => {
    setIsLoading(true)
    await executeCode(code)
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="w-full flex-1 p-4 flex flex-col items-start justify-center border-b space-y-4">
        {cellResults && cellResults.length > 0 && cellResults.map((cellResult, index) => (
          <CellResult key={index} result={cellResult} />
        ))}
        {runtimeError && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>
              {runtimeError.name}: {runtimeError.value}
            </AlertTitle>
            <AlertDescription className="font-mono whitespace-pre-wrap">
              {runtimeError.traceback}
            </AlertDescription>
          </Alert>
        )}
        {(!cellResults || cellResults.length === 0) && !runtimeError && (
          <span>No output or logs</span>
        )}
      </div>
      <LogsOutput stdout={stdout || []} stderr={stderr || []} />
      <div className="p-4 border-t">
        <Button onClick={handleExecute} disabled={isLoading}>
          {isLoading ? (
            <LoaderIcon className="animate-spin mr-2" />
          ) : (
            <PlayIcon className="mr-2" />
          )}
          Execute
        </Button>
      </div>
    </div>
  )
}
