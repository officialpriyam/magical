import dynamic from 'next/dynamic'
import { Button } from './ui/button'
import { CopyButton } from './ui/copy-button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Download, FileText } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

const CodeView = dynamic(() => import('./code-view').then(mod => mod.CodeView), {
  ssr: false,
})

export function FragmentCode({
  files,
}: {
  files: { name: string; content: string }[]
}) {
  // Filter out any invalid files
  const validFiles = useMemo(
    () => Array.isArray(files)
      ? files.filter(file => file && typeof file === 'object' && file.name && file.content !== undefined)
      : [],
    [files]
  )

  const [currentFile, setCurrentFile] = useState(validFiles[0]?.name || '')
  const currentFileContent = validFiles.find(
    (file) => file.name === currentFile,
  )?.content

  // Update current file when validFiles changes
  useEffect(() => {
    if (validFiles.length > 0 && !validFiles.find(f => f.name === currentFile)) {
      setCurrentFile(validFiles[0].name)
    }
  }, [validFiles, currentFile])

  function download(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  if (!validFiles || validFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No files to display
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-2 pt-1 gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {validFiles.map((file) => (
            <div
              key={file.name}
              className={`flex gap-2 select-none cursor-pointer items-center text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-primary/5 dark:hover:bg-muted border ${
                file.name === currentFile ? 'bg-muted border-muted' : ''
              }`}
              onClick={() => setCurrentFile(file.name)}
            >
              <FileText className="h-4 w-4" />
              {file.name}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <CopyButton
                  content={currentFileContent || ''}
                  className="text-muted-foreground"
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() =>
                    download(currentFile, currentFileContent || '')
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex flex-col flex-1 overflow-x-auto">
        <CodeView
          code={currentFileContent || ''}
          lang={currentFile.split('.').pop() || ''}
        />
      </div>
    </div>
  )
}
