import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
  Pencil,
  RefreshCw,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Input } from './ui/input'
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
  onRenameFile?: (oldPath: string, newPath: string) => void
  onDeleteFile?: (path: string) => void
  onRefresh?: () => void
  isLoading?: boolean
}

export function SandboxFileTree({
  files,
  onSelectFile,
  onRenameFile,
  onDeleteFile,
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
            onRenameFile={onRenameFile}
            onDeleteFile={onDeleteFile}
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
  onRenameFile?: (oldPath: string, newPath: string) => void
  onDeleteFile?: (path: string) => void
  level?: number
}

function FileTreeNode({
  node,
  onSelectFile,
  onRenameFile,
  onDeleteFile,
  level = 0,
  path = '',
}: FileTreeNodeProps & { path?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)

  const isDirectory = node.isDirectory
  const hasChildren = node.children && node.children.length > 0
  const newPath = node.path || (path ? `${path}/${node.name}` : node.name)

  const handleToggle = () => {
    if (isDirectory) {
      setIsOpen(!isOpen)
    } else {
      onSelectFile(node.path || newPath)
    }
  }

  const handleRename = () => {
    const nextName = renameValue.trim()

    if (!nextName || !onRenameFile) return

    const parentPath = newPath.includes('/')
      ? newPath.slice(0, newPath.lastIndexOf('/'))
      : ''
    const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName

    onRenameFile(newPath, nextPath)
    setIsRenameDialogOpen(false)
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
        {!isDirectory && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-60 group-hover:opacity-100 ml-1"
            aria-label={`Open ${node.name}`}
            title={`Open ${node.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onSelectFile(newPath)
            }}
          >
            <SquarePen className="h-3 w-3" />
          </Button>
        )}
        {onRenameFile && (
          <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-60 group-hover:opacity-100 ml-1"
                aria-label={`Rename ${node.name}`}
                title={`Rename ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setRenameValue(node.name)
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="sm:max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <DialogHeader>
                <DialogTitle>Rename {isDirectory ? 'Folder' : 'File'}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center space-x-2">
                <Input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleRename()
                    }
                  }}
                />
                <Button onClick={handleRename}>Rename</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {onDeleteFile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-60 group-hover:opacity-100 ml-1"
            aria-label={`Delete ${node.name}`}
            title={`Delete ${node.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onDeleteFile(newPath)
            }}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        )}
      </div>
      {isOpen &&
        hasChildren &&
        node.children?.map(child => (
          <FileTreeNode
            key={child.name}
            node={child}
            onSelectFile={onSelectFile}
            onRenameFile={onRenameFile}
            onDeleteFile={onDeleteFile}
            level={level + 1}
            path={newPath}
          />
        ))}
    </div>
  )
}
