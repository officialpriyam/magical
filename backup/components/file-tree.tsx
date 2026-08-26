import { useState, useCallback, memo, useRef, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
  Pencil,
  Plus,
  SquarePen,
  Trash2,
  FolderPlus,
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

export interface FileSystemNode {
  name: string
  isDirectory: boolean
  path?: string
  children?: FileSystemNode[]
}

interface FileTreeProps {
  files: FileSystemNode[]
  onSelectFile: (path: string) => void
  onCreateFile?: (path: string, isDirectory: boolean) => void
  onDeleteFile?: (path: string) => void
  onRenameFile?: (oldPath: string, newPath: string) => void
}

export function FileTree({ files, onSelectFile, onCreateFile, onDeleteFile, onRenameFile }: FileTreeProps) {
  const [newFileName, setNewFileName] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createType, setCreateType] = useState<'file' | 'folder'>('file')

  const handleCreateFile = useCallback(() => {
    if (newFileName.trim() && onCreateFile) {
      onCreateFile(newFileName.trim(), createType === 'folder')
      setNewFileName('')
      setIsCreateDialogOpen(false)
    }
  }, [newFileName, createType, onCreateFile])

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">Files</span>
        {onCreateFile && (
          <div className="flex gap-1">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Create file or folder"
                  title="Create file or folder"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New {createType === 'file' ? 'File' : 'Folder'}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder={createType === 'file' ? 'filename.ts' : 'folder-name'}
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFile()
                      }
                    }}
                  />
                  <Button onClick={handleCreateFile}>Create</Button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={createType === 'file' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCreateType('file')}
                  >
                    <FileIcon className="h-3 w-3 mr-1" />
                    File
                  </Button>
                  <Button
                    variant={createType === 'folder' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCreateType('folder')}
                  >
                    <FolderPlus className="h-3 w-3 mr-1" />
                    Folder
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      {Array.isArray(files) && files.map((file) => (
        <FileTreeNode
          key={file.path || file.name}
          node={file}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
          level={0}
          parentPath=""
        />
      ))}
    </div>
  )
}

interface FileTreeNodeProps {
  node: FileSystemNode
  onSelectFile: (path: string) => void
  onDeleteFile?: (path: string) => void
  onRenameFile?: (oldPath: string, newPath: string) => void
  level: number
  parentPath: string
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
  level,
  parentPath,
}: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenameDialogOpen && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenameDialogOpen])

  const fullPath = node.path || (parentPath ? `${parentPath}/${node.name}` : node.name)
  const isDirectory = node.isDirectory
  const hasChildren = node.children && node.children.length > 0

  const handleToggle = useCallback(() => {
    if (isDirectory) {
      setIsOpen((prev) => !prev)
    } else {
      onSelectFile(fullPath)
    }
  }, [isDirectory, onSelectFile, fullPath])

  const handleDelete = useCallback(() => {
    if (onDeleteFile) {
      onDeleteFile(fullPath)
    }
  }, [onDeleteFile, fullPath])

  const handleRename = useCallback(() => {
    const nextName = renameValue.trim()
    if (!nextName || !onRenameFile) return

    const parentDir = fullPath.includes('/')
      ? fullPath.slice(0, fullPath.lastIndexOf('/'))
      : ''
    const nextPath = parentDir ? `${parentDir}/${nextName}` : nextName

    onRenameFile(fullPath, nextPath)
    setIsRenameDialogOpen(false)
  }, [renameValue, onRenameFile, fullPath])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRename()
      } else if (e.key === 'Escape') {
        setIsRenameDialogOpen(false)
      }
    },
    [handleRename],
  )

  const indent = level * 16 + 4

  return (
    <div>
      <div
        className="flex items-center cursor-pointer hover:bg-primary/5 dark:hover:bg-muted/50 rounded-sm p-1 group"
        style={{ paddingLeft: indent }}
        onClick={handleToggle}
      >
        {isDirectory ? (
          <>
            {isOpen ? (
              <ChevronDown size={16} className="mr-1 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight size={16} className="mr-1 shrink-0 text-muted-foreground" />
            )}
            <Folder size={16} className="mr-2 shrink-0 text-blue-500" />
          </>
        ) : (
          <FileIcon size={16} className="mr-2 ml-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm truncate flex-1 min-w-0">{node.name}</span>
        {!isDirectory && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 ml-1 shrink-0 transition-opacity"
            aria-label={`Open ${node.name}`}
            title={`Open ${node.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelectFile(fullPath)
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
                className="h-5 w-5 opacity-0 group-hover:opacity-100 ml-1 shrink-0 transition-opacity"
                aria-label={`Rename ${node.name}`}
                title={`Rename ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation()
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
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={handleRenameKeyDown}
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
            className="h-5 w-5 opacity-0 group-hover:opacity-100 ml-1 shrink-0 transition-opacity"
            aria-label={`Delete ${node.name}`}
            title={`Delete ${node.name}`}
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        )}
      </div>
      {isOpen &&
        hasChildren &&
        node.children?.map((child) => (
          <FileTreeNode
            key={child.path || child.name}
            node={child}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
            level={level + 1}
            parentPath={fullPath}
          />
        ))}
    </div>
  )
})
