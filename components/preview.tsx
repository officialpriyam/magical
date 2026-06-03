import { FragmentCode } from './fragment-code'
import { FragmentPreview } from './fragment-preview'
import { FragmentTerminal } from './fragment-terminal'
import { FragmentInterpreter } from './fragment-interpreter'
import { CodeEditor } from './code-editor'
import { SandboxFileTree } from './sandbox-file-tree'
import { IDE } from './ide'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { ChevronsRight, LoaderCircle, Terminal, Code, FileCode, FolderTree, Folder } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'

export function Preview({
  teamID,
  accessToken,
  selectedTab,
  onSelectedTabChange,
  isChatLoading,
  isPreviewLoading,
  fragment,
  result,
  onClose,
  code,
  selectedFile,
  onSelectFile,
  onSave,
  executeCode,
}: {
  teamID: string | undefined
  accessToken: string | undefined
  selectedTab: 'code' | 'fragment' | 'terminal' | 'interpreter' | 'editor' | 'files' | 'ide'
  onSelectedTabChange: Dispatch<SetStateAction<'code' | 'fragment' | 'terminal' | 'interpreter' | 'editor' | 'files' | 'ide'>>
  isChatLoading: boolean
  isPreviewLoading: boolean
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  onClose: () => void
  code?: string
  selectedFile?: { path: string; content: string } | null
  onSelectFile?: (file: { path: string; content: string }) => void
  onSave?: (path: string, content: string) => Promise<void>
  executeCode?: (code: string) => Promise<any>
}) {
  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false)

  async function handleSelectSandboxFile(path: string) {
    if (!result?.sbxId) return

    try {
      const response = await fetch(`/api/sandbox/${result.sbxId}/files/content?path=${encodeURIComponent(path)}`)
      const data = await response.json()

      if (response.ok && data.content !== undefined) {
        // Update the selected file in the parent component
        if (onSelectFile) {
          onSelectFile({ path: data.path, content: data.content })
        }
        // Switch to editor tab
        onSelectedTabChange('editor')
      }
    } catch (error) {
      console.error('Error loading sandbox file:', error)
    }
  }

  async function handleRefreshFiles() {
    if (!result?.sbxId) return

    setIsRefreshingFiles(true)
    try {
      const response = await fetch(`/api/sandbox/${result.sbxId}/files`)
      const data = await response.json()

      if (response.ok && data.files) {
        // Files refreshed - this would need to update result.files in parent
        console.log('Files refreshed:', data.files)
      }
    } catch (error) {
      console.error('Error refreshing files:', error)
    } finally {
      setIsRefreshingFiles(false)
    }
  }

  return (
    <div className="absolute md:relative z-10 top-0 left-0 shadow-2xl md:rounded-tl-3xl md:rounded-bl-3xl md:border-l md:border-y bg-popover h-full w-full overflow-auto">
      <Tabs
        value={selectedTab}
        onValueChange={(value) => {
          console.log('Tab changed to:', value)
          onSelectedTabChange(value as 'code' | 'fragment' | 'terminal' | 'interpreter' | 'editor' | 'files' | 'ide')
        }}
        className="h-full flex flex-col items-start justify-start"
      >
        <div className="w-full p-2 grid grid-cols-3 items-center border-b relative z-10">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={onClose}
                >
                  <ChevronsRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex justify-center relative z-20">
            <TabsList className="px-1 py-0 border h-8 relative z-30">
              <TabsTrigger
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="code"
              >
                {isChatLoading && (
                  <LoaderCircle
                    strokeWidth={3}
                    className="h-3 w-3 animate-spin"
                  />
                )}
                <Code className="h-3 w-3" />
                Code
              </TabsTrigger>
              <TabsTrigger
                disabled={!result}
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="fragment"
              >
                Preview
                {isPreviewLoading && (
                  <LoaderCircle
                    strokeWidth={3}
                    className="h-3 w-3 animate-spin"
                  />
                )}
              </TabsTrigger>
              <TabsTrigger
                disabled={!result}
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="terminal"
              >
                <Terminal className="h-3 w-3" />
                Terminal
              </TabsTrigger>
              <TabsTrigger
                disabled={!result || result.template !== 'code-interpreter-v1'}
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="interpreter"
              >
                <Code className="h-3 w-3" />
                Interpreter
              </TabsTrigger>
              <TabsTrigger
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="editor"
              >
                <FileCode className="h-3 w-3" />
                Editor
              </TabsTrigger>
              <TabsTrigger
                disabled={!result || !result.files || result.files.length === 0}
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="files"
              >
                <FolderTree className="h-3 w-3" />
                Files
              </TabsTrigger>
              <TabsTrigger
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="ide"
              >
                <Folder className="h-3 w-3" />
                IDE
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex items-center justify-end gap-2">
            {/* Add any additional buttons here */}
          </div>
        </div>
        <div className="overflow-y-auto w-full h-full">
            <TabsContent value="code" className="h-full">
              {fragment?.code ? (
                <FragmentCode
                  files={[
                    {
                      name: fragment?.file_path || 'code.txt',
                      content: fragment?.code || '',
                    },
                  ]}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No code to display
                </div>
              )}
            </TabsContent>
            <TabsContent value="fragment" className="h-full">
              {result ? (
                <FragmentPreview
                  result={result as ExecutionResult}
                  code={code || fragment?.code || ''}
                  executeCode={executeCode || (async () => {})}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Preview will appear here once the code is executed
                </div>
              )}
            </TabsContent>
            <TabsContent value="terminal" className="h-full">
              {result ? (
                <FragmentTerminal
                  teamID={teamID}
                  accessToken={accessToken}
                  result={result as ExecutionResult}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Terminal access will appear here once the sandbox is created
                </div>
              )}
            </TabsContent>
            <TabsContent value="interpreter" className="h-full">
              {result && result.template === 'code-interpreter-v1' ? (
                <FragmentInterpreter
                  result={result}
                  code={code || fragment?.code || ''}
                  executeCode={executeCode || (async () => {})}
                />
              ) : result ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Interpreter only available for code-interpreter-v1 template
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Interpreter will appear here once the sandbox is created
                </div>
              )}
            </TabsContent>
            <TabsContent value="editor" className="h-full">
              {selectedFile && onSave ? (
                <CodeEditor
                  code={selectedFile.content}
                  lang={selectedFile.path.split('.').pop() || 'txt'}
                  onChange={(value) => {
                    if (value !== undefined) {
                      onSave(selectedFile.path, value)
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a file from the file tree to edit
                </div>
              )}
            </TabsContent>
            <TabsContent value="files" className="h-full">
              {result && result.files && result.files.length > 0 ? (
                <SandboxFileTree
                  files={result.files}
                  onSelectFile={handleSelectSandboxFile}
                  onRefresh={handleRefreshFiles}
                  isLoading={isRefreshingFiles}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No sandbox files available
                </div>
              )}
            </TabsContent>
            <TabsContent value="ide" className="h-full m-0 p-0">
              <div className="h-full w-full">
                <IDE />
              </div>
            </TabsContent>
          </div>
      </Tabs>
    </div>
  )
}
