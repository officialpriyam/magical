import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
  RefreshCw,
} from 'lucide-react'
import { Button } from './ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export interface FileSystemNode {
  name: string
  isDirectory: boolean
  path?: string
  children?: FileSystemNode[]
}

interface SandboxFileTreeProps {
  files: FileSystemNode[]
  onSelectFile: (path: string) => void
  onRefresh?: () => void
  isLoading?: boolean
}

export function SandboxFileTree({
  files,
  onSelectFile,
  onRefresh,
  isLoading = false
}: SandboxFileTreeProps) {
  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">Sandbox Files</span>
        {onRefresh && (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh files</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {Array.isArray(files) && files.length > 0 ? (
        files.map(file => (
          <FileTreeNode
            key={file.name}
            node={file}
            onSelectFile={onSelectFile}
          />
        ))
      ) : (
        <div className="text-sm text-muted-foreground p-2">
          {isLoading ? 'Loading files...' : 'No files in sandbox'}
        </div>
      )}
    </div>
  )
}

interface FileTreeNodeProps {
  node: FileSystemNode
  onSelectFile: (path: string) => void
  level?: number
}

function FileTreeNode({
  node,
  onSelectFile,
  level = 0,
  path = '',
}: FileTreeNodeProps & { path?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  const isDirectory = node.isDirectory
  const hasChildren = node.children && node.children.length > 0
  const newPath = path ? `${path}/${node.name}` : node.name

  const handleToggle = () => {
    if (isDirectory) {
      setIsOpen(!isOpen)
    } else {
      onSelectFile(node.path || newPath)
    }
  }

  return (
    <div>
      <div
        className="flex items-center cursor-pointer hover:bg-primary/5 dark:hover:bg-muted/50 rounded-sm p-1 group"
        style={{ paddingLeft: level * 16 + 4 }}
        onClick={handleToggle}
      >
        {isDirectory ? (
          <>
            {isOpen ? (
              <ChevronDown size={16} className="mr-1 text-muted-foreground" />
            ) : (
              <ChevronRight size={16} className="mr-1 text-muted-foreground" />
            )}
            <Folder size={16} className="mr-2 text-blue-500" />
          </>
        ) : (
          <FileIcon size={16} className="mr-2 ml-4 text-muted-foreground" />
        )}
        <span className="text-sm truncate flex-1">{node.name}</span>
      </div>
      {isOpen &&
        hasChildren &&
        node.children?.map(child => (
          <FileTreeNode
            key={child.name}
            node={child}
            onSelectFile={onSelectFile}
            level={level + 1}
            path={newPath}
          />
        ))}
    </div>
  )
}
