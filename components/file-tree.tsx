import { useState } from 'react'
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

  const handleCreateFile = () => {
    if (newFileName.trim() && onCreateFile) {
      onCreateFile(newFileName.trim(), createType === 'folder')
      setNewFileName('')
      setIsCreateDialogOpen(false)
    }
  }

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
      {Array.isArray(files) && files.map(file => (
        <FileTreeNode
          key={file.name}
          node={file}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
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
  level?: number
}

function FileTreeNode({
  node,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
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
      onSelectFile(newPath)
    }
  }

  const handleDelete = () => {
    if (onDeleteFile) {
      onDeleteFile(newPath)
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
            onClick={(e) => {
              e.stopPropagation()
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
        node.children?.map(child => (
          <FileTreeNode
            key={child.name}
            node={child}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
            level={level + 1}
            path={newPath}
          />
        ))}
    </div>
  )
}
