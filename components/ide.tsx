'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileTree, FileSystemNode } from '@/components/file-tree'
import { CodeEditor } from '@/components/code-editor'
import { GitHubImport } from '@/components/github-import'
import { useAuth } from '@/lib/auth'
import { Button } from './ui/button'
import { GitBranch, FolderOpen } from 'lucide-react'
import Spinner from './ui/spinner'

interface IDEProps {
  sandboxId?: string // Optional sandbox ID for viewing sandbox files
  onSave?: (path: string, content: string) => Promise<void>
  githubSaveRequired?: boolean
  githubWorkspaceConnected?: boolean
  onSaveBlocked?: () => void
}

export function IDE({
  sandboxId,
  onSave,
  githubSaveRequired = false,
  githubWorkspaceConnected = false,
  onSaveBlocked,
}: IDEProps = {}) {
  const { session, loading } = useAuth(() => {}, () => {})
  const [files, setFiles] = useState<FileSystemNode[]>([])
  const [selectedFile, setSelectedFile] = useState<{
    path: string
    content: string
  } | null>(null)
  const [showGitHubImport, setShowGitHubImport] = useState(false)
  const isSandboxMode = !!sandboxId
  const isGitHubSaveBlocked = githubSaveRequired && !githubWorkspaceConnected

  function blockGitHubSave() {
    onSaveBlocked?.()
  }

  const fetchFiles = useCallback(async () => {
    if (isSandboxMode && sandboxId) {
      // Fetch files from sandbox
      try {
        const response = await fetch(`/api/sandbox/${sandboxId}/files`)
        if (response.ok) {
          const data = await response.json()
          setFiles(data.files || [])
        } else {
          console.error('Failed to fetch sandbox files')
          setFiles([])
        }
      } catch (error) {
        console.error('Error fetching sandbox files:', error)
        setFiles([])
      }
    } else if (session) {
      // Fetch files from Supabase
      try {
        const response = await fetch('/api/files')
        if (response.ok) {
          const data = await response.json()
          setFiles(data)
        } else {
          console.error('Failed to fetch files')
          setFiles([])
        }
      } catch (error) {
        console.error('Error fetching files:', error)
        setFiles([])
      }
    }
  }, [session, isSandboxMode, sandboxId])

  useEffect(() => {
    if (isSandboxMode || session) {
      fetchFiles()
    }
  }, [session, isSandboxMode, fetchFiles])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  async function handleSelectFile(path: string) {
    if (isSandboxMode && sandboxId) {
      // Load file from sandbox
      const response = await fetch(`/api/sandbox/${sandboxId}/files/content?path=${encodeURIComponent(path)}`)
      const { content } = await response.json()
      setSelectedFile({ path, content })
    } else if (session) {
      // Load file from Supabase
      const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`)
      const { content } = await response.json()
      setSelectedFile({ path, content })
    }
  }

  async function handleSaveFile(path: string, content: string) {
    if (isGitHubSaveBlocked) {
      blockGitHubSave()
      return
    }

    if (onSave) {
      await onSave(path, content)
      setSelectedFile({ path, content })
      return
    }

    if (isSandboxMode && sandboxId) {
      // Save file to sandbox
      await fetch(`/api/sandbox/${sandboxId}/files/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, content }),
      })
    } else if (session) {
      // Save file to Supabase
      await fetch('/api/files/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, content }),
      })
    }
  }

  async function handleCreateFile(path: string, isDirectory: boolean) {
    if (isGitHubSaveBlocked) {
      blockGitHubSave()
      return
    }

    // File creation in sandbox mode is not supported via this UI
    if (isSandboxMode) {
      console.log('File creation in sandbox mode not supported')
      return
    }

    if (!session) return
    try {
      const content = isDirectory ? '' : '// New file\n'

      if (onSave && !isDirectory) {
        await onSave(path, content)
        await fetchFiles()
        return
      }

      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          isDirectory,
          content,
        }),
      })
      if (response.ok) {
        await fetchFiles()
      }
    } catch (error) {
      console.error('Error creating file:', error)
    }
  }

  async function handleDeleteFile(path: string) {
    if (isGitHubSaveBlocked) {
      blockGitHubSave()
      return
    }

    if (isSandboxMode && sandboxId) {
      try {
        const response = await fetch(`/api/sandbox/${sandboxId}/files/content`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path }),
        })

        if (response.ok) {
          await fetchFiles()
          if (selectedFile?.path === path) {
            setSelectedFile(null)
          }
        }
      } catch (error) {
        console.error('Error deleting sandbox file:', error)
      }
      return
    }

    if (!session) return
    try {
      const response = await fetch('/api/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
        }),
      })
      if (response.ok) {
        await fetchFiles()
        if (selectedFile?.path === path) {
          setSelectedFile(null)
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  async function handleRenameFile(oldPath: string, newPath: string) {
    if (isGitHubSaveBlocked) {
      blockGitHubSave()
      return
    }

    if (isSandboxMode && sandboxId) {
      try {
        const response = await fetch(`/api/sandbox/${sandboxId}/files/content`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oldPath, newPath }),
        })

        if (response.ok) {
          await fetchFiles()
          if (selectedFile?.path === oldPath) {
            setSelectedFile({ path: newPath, content: selectedFile.content })
          }
        }
      } catch (error) {
        console.error('Error renaming sandbox file:', error)
      }
      return
    }

    if (!session) return

    try {
      const response = await fetch('/api/files', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldPath, newPath }),
      })

      if (response.ok) {
        await fetchFiles()
        if (selectedFile?.path === oldPath) {
          setSelectedFile({ path: newPath, content: selectedFile.content })
        }
      }
    } catch (error) {
      console.error('Error renaming file:', error)
    }
  }

  async function handleImportRepository(repo: any, repoFiles: any[]) {
    if (!session) return
    try {
      // The files have been imported via the GitHubImport component
      // Just refresh the file list to show the newly imported files
      await fetchFiles()
      setShowGitHubImport(false)
    } catch (error) {
      console.error('Error after repository import:', error)
    }
  }

  if (showGitHubImport) {
    return (
      <div className="h-full p-4 overflow-auto">
        <GitHubImport
          onImport={handleImportRepository}
          onClose={() => setShowGitHubImport(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-1/4 border-r overflow-auto">
        <div className="p-2 border-b space-y-2">
          <Button
            onClick={fetchFiles}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {isSandboxMode ? 'Refresh Sandbox Files' : 'Refresh Files'}
          </Button>
          {!isSandboxMode && (
            <Button
              onClick={() => setShowGitHubImport(true)}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Import from GitHub
            </Button>
          )}
        </div>
        <FileTree 
          files={files} 
          onSelectFile={handleSelectFile}
          onCreateFile={isSandboxMode ? undefined : handleCreateFile}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
        />
      </div>
      <div className="w-3/4">
        {selectedFile ? (
          isGitHubSaveBlocked ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-sm space-y-3 rounded-lg border bg-background/70 p-5 shadow-sm">
                <div className="text-sm font-medium">GitHub save required</div>
                <p className="text-sm text-muted-foreground">
                  Save this project to GitHub before editing files. Use the Save to GitHub button in the preview toolbar.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={blockGitHubSave}>
                  Use Save to GitHub
                </Button>
              </div>
            </div>
          ) : (
            <CodeEditor
              key={selectedFile.path}
              code={selectedFile.content}
              lang={selectedFile.path.split('.').pop() || 'typescript'}
              onChange={(content) => handleSaveFile(selectedFile.path, content || '')}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Select a file to view its content</p>
          </div>
        )}
      </div>
    </div>
  )
}
