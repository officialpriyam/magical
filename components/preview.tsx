import { FragmentCode } from './fragment-code'
import { FragmentPreview } from './fragment-preview'
import { FragmentTerminal } from './fragment-terminal'
import { IDE } from './ide'
import { GitHubSave, type GitHubWorkspace } from './github-save'
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
import { getFragmentFiles } from '@/lib/fragment-files'
import { DeepPartial } from 'ai'
import { ChevronsRight, LoaderCircle, Terminal, Code, Folder } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

export type PreviewTab = 'code' | 'fragment' | 'terminal' | 'ide'

const PREVIEW_TABS: PreviewTab[] = ['code', 'fragment', 'terminal', 'ide']

export function Preview({
  teamID,
  accessToken,
  selectedTab,
  onSelectedTabChange,
  isChatLoading,
  isPreviewLoading,
  fragment,
  projectTitle,
  onGitHubWorkspaceSaved,
  githubSaveRequired = false,
  isGitHubWorkspaceConnected = false,
  onSaveBlocked,
  result,
  onClose,
  code,
  onSave,
  executeCode,
}: {
  teamID: string | undefined
  accessToken: string | undefined
  selectedTab: PreviewTab
  onSelectedTabChange: Dispatch<SetStateAction<PreviewTab>>
  isChatLoading: boolean
  isPreviewLoading: boolean
  fragment?: DeepPartial<FragmentSchema>
  projectTitle?: string
  onGitHubWorkspaceSaved?: (workspace: GitHubWorkspace) => Promise<void> | void
  githubSaveRequired?: boolean
  isGitHubWorkspaceConnected?: boolean
  onSaveBlocked?: () => void
  result?: ExecutionResult
  onClose: () => void
  code?: string
  onSave?: (path: string, content: string) => Promise<void>
  executeCode?: (code: string) => Promise<any>
}) {
  const [sandboxFiles, setSandboxFiles] = useState(result?.files || [])
  const [isGitHubSaveOpen, setIsGitHubSaveOpen] = useState(false)
  const isGitHubSaveBlocked = githubSaveRequired && !isGitHubWorkspaceConnected

  useEffect(() => {
    setSandboxFiles(result?.files || [])
  }, [result?.files, result?.sbxId])

  function handleOpenRequiredGitHubSave() {
    onSaveBlocked?.()
    setIsGitHubSaveOpen(true)
  }

  return (
    <div className="absolute left-0 top-0 z-10 h-full w-full overflow-hidden border border-white/10 bg-[#151615] shadow-2xl md:relative md:m-3 md:ml-0 md:h-[calc(100vh-1.5rem)] md:rounded-2xl">
      <Tabs
        value={selectedTab}
        onValueChange={(value) => {
          if (PREVIEW_TABS.includes(value as PreviewTab)) {
            onSelectedTabChange(value as PreviewTab)
          }
        }}
        className="h-full flex flex-col items-start justify-start"
      >
        <div className="relative z-10 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/10 bg-white/[0.03] p-2">
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
          <div className="relative z-20 flex min-w-0 justify-center overflow-x-auto">
            <TabsList className="relative z-30 h-8 w-max border px-1 py-0">
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
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="ide"
              >
                <Folder className="h-3 w-3" />
                IDE
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex items-center justify-end gap-2">
            <GitHubSave
              fragment={fragment}
              result={result}
              projectTitle={projectTitle}
              sandboxFiles={sandboxFiles}
              onWorkspaceSaved={onGitHubWorkspaceSaved}
              open={isGitHubSaveOpen}
              onOpenChange={setIsGitHubSaveOpen}
            />
          </div>
        </div>
        {isGitHubSaveBlocked && (
          <div className="w-full border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-300">
            Save this project to GitHub before editing files. Use the Save to GitHub button above to connect a repository.
          </div>
        )}
        <div className="min-h-0 w-full flex-1 overflow-hidden">
            <TabsContent value="code" className="h-full">
              {getFragmentFiles(fragment).length > 0 ? (
                <FragmentCode
                  files={getFragmentFiles(fragment).map((file) => ({
                    name: file.path,
                    content: file.content,
                  }))}
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
            <TabsContent value="ide" className="h-full m-0 p-0">
              <div className="h-full w-full">
                <IDE
                  sandboxId={result?.sbxId}
                  initialFiles={sandboxFiles}
                  onSave={onSave}
                  githubSaveRequired={githubSaveRequired}
                  githubWorkspaceConnected={isGitHubWorkspaceConnected}
                  onSaveBlocked={handleOpenRequiredGitHubSave}
                />
              </div>
            </TabsContent>
          </div>
      </Tabs>
    </div>
  )
}
