'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { FileTree, FileSystemNode } from '@/components/file-tree'
import { CodeEditor } from '@/components/code-editor'
import { GitHubImport } from '@/components/github-import'
import { useAuth } from '@/lib/auth'
import { Button } from './ui/button'
import { GitBranch, RefreshCw, Search } from 'lucide-react'
import Spinner from './ui/spinner'

interface IDEProps {
  sandboxId?: string // Optional sandbox ID for viewing sandbox files
  projectId?: string
  initialFiles?: FileSystemNode[]
  onSave?: (path: string, content: string) => Promise<void>
  githubSaveRequired?: boolean
  githubWorkspaceConnected?: boolean
  onSaveBlocked?: () => void
}

export function IDE({
  sandboxId,
  projectId,
  initialFiles,
  onSave,
  githubSaveRequired = false,
  githubWorkspaceConnected = false,
  onSaveBlocked,
}: IDEProps = {}) {
  const { session, loading } = useAuth(() => {}, () => {})
  const [files, setFiles] = useState<FileSystemNode[]>(initialFiles ?? [])
  const [selectedFile, setSelectedFile] = useState<{
    path: string
    content: string
  } | null>(null)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [showGitHubImport, setShowGitHubImport] = useState(false)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const isSandboxMode = !!sandboxId
  const isGitHubSaveBlocked = githubSaveRequired && !githubWorkspaceConnected
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null)
  const selectedFileRef = useRef(selectedFile)
  const fileContentCacheRef = useRef<Map<string, string>>(new Map())

  const blockGitHubSave = useCallback(() => {
    onSaveBlocked?.()
  }, [onSaveBlocked])

  const visibleFiles = useMemo(
    () => filterFileTree(files, fileSearchQuery),
    [files, fileSearchQuery],
  )

  useEffect(() => {
    selectedFileRef.current = selectedFile
  }, [selectedFile])

  const fetchFiles = useCallback(async () => {
    if (isSandboxMode && sandboxId) {
      if (!projectId) {
        console.warn('Sandbox mode requires projectId to fetch files from sandbox-storage')
        return
      }

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        
        const storageResponse = await fetch(`/api/projects/${projectId}/sandbox-storage-files`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        
        if (storageResponse.ok) {
          const storageData = await storageResponse.json()
          if (Array.isArray(storageData.files)) {
            setFiles(storageData.files)
            return
          }
        } else {
          console.warn('Failed to fetch files from sandbox-storage')
        }
      } catch (error) {
        console.warn('Error fetching files from sandbox-storage (keeping existing list):', error)
      }
    } else if (session) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        
        const response = await fetch('/api/files', {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        
        if (response.ok) {
          const data = await response.json()
          setFiles(data)
        } else {
          console.warn('Failed to fetch files, keeping existing file list')
        }
      } catch (error) {
        console.warn('Error fetching files (keeping existing list):', error)
      }
    }
  }, [session, isSandboxMode, sandboxId, projectId])

  const persistFile = useCallback(async (path: string, content: string) => {
    if (isGitHubSaveBlocked) {
      blockGitHubSave()
      return
    }

    let saved = false

    if (onSave) {
      await onSave(path, content)
      saved = true
    } else if (isSandboxMode && sandboxId) {
      // Save file to sandbox
      const response = await fetch(`/api/sandbox/${sandboxId}/files/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, content, projectID: projectId }),
      })
      saved = response.ok
    } else if (session) {
      // Save file to Supabase
      const response = await fetch('/api/files/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, content }),
      })
      saved = response.ok
    }

    if (saved) {
      setSelectedFile((current) =>
        current?.path === path ? { path, content } : current,
      )
    }
  }, [
    blockGitHubSave,
    isGitHubSaveBlocked,
    isSandboxMode,
    onSave,
    projectId,
    sandboxId,
    session,
  ])

  const flushPendingSave = useCallback(async () => {
    const pendingSave = pendingSaveRef.current

    if (!pendingSave) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    pendingSaveRef.current = null
    try {
      await persistFile(pendingSave.path, pendingSave.content)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }, [persistFile])

  const scheduleFileSave = useCallback((path: string, content: string) => {
    pendingSaveRef.current = { path, content }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      void flushPendingSave()
    }, 900)
  }, [flushPendingSave])

  useEffect(() => {
    if (isSandboxMode || session) {
      fetchFiles()
    }
  }, [session, isSandboxMode, fetchFiles])

  useEffect(() => {
    if (isSandboxMode && initialFiles) {
      setFiles(initialFiles)
    }
  }, [initialFiles, isSandboxMode])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      const pendingSave = pendingSaveRef.current
      if (pendingSave) {
        pendingSaveRef.current = null
        void persistFile(pendingSave.path, pendingSave.content)
      }
    }
  }, [persistFile])

  if (loading && !isSandboxMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  async function handleSelectFile(path: string) {
    const cached = fileContentCacheRef.current.get(path)
    if (cached !== undefined) {
      setSelectedFile({ path, content: cached })
      return
    }

    if (isOpeningFile) {
      return
    }

    if (pendingSaveRef.current) {
      void flushPendingSave()
    }

    setIsOpeningFile(true)
    try {
      if (isSandboxMode && sandboxId && projectId) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(`/api/projects/${projectId}/sandbox-storage-files?path=${encodeURIComponent(path)}`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        
        if (response.ok) {
          const { content } = await response.json()
          fileContentCacheRef.current.set(path, content)
          setSelectedFile({ path, content })
        } else {
          throw new Error('Failed to load file from sandbox-storage')
        }
      } else if (session) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        
        if (!response.ok) {
          throw new Error('Failed to load workspace file')
        }
        const { content } = await response.json()
        fileContentCacheRef.current.set(path, content)
        setSelectedFile({ path, content })
      }
    } catch (error) {
      console.error('Error opening file:', error)
    } finally {
      setIsOpeningFile(false)
    }
  }

  function handleEditorChange(content: string | undefined) {
    const currentFile = selectedFileRef.current

    if (!currentFile) return

    const nextContent = content || ''
    const path = currentFile.path

    selectedFileRef.current = { path, content: nextContent }
    fileContentCacheRef.current.set(path, nextContent)
    scheduleFileSave(path, nextContent)
  }

  function handleEditorSave(content: string) {
    const currentFile = selectedFileRef.current

    if (!currentFile) return

    const path = currentFile.path
    selectedFileRef.current = { path, content }
    fileContentCacheRef.current.set(path, content)
    scheduleFileSave(path, content)
    void flushPendingSave()
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
          body: JSON.stringify({ path, projectID: projectId }),
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
          body: JSON.stringify({ oldPath, newPath, projectID: projectId }),
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
      <div className="h-full overflow-auto bg-[#181818] p-4 text-white">
        <GitHubImport
          onImport={handleImportRepository}
          onClose={() => setShowGitHubImport(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#181818] text-[#d4d4d4] md:flex-row">
      <aside className="flex h-56 min-h-0 shrink-0 flex-col border-b border-[#2b2b2b] bg-[#181818] md:h-full md:w-[268px] md:border-b-0 md:border-r">
        <div className="shrink-0 border-b border-[#2b2b2b] p-2">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" />
              <input
                value={fileSearchQuery}
                onChange={(event) => setFileSearchQuery(event.target.value)}
                placeholder="Search code"
                className="h-8 w-full rounded-md border border-white/10 bg-[#1f1f1f] pl-8 pr-2 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/25"
              />
            </label>
            <Button
              onClick={fetchFiles}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              title={isSandboxMode ? 'Refresh sandbox files' : 'Refresh files'}
              aria-label={isSandboxMode ? 'Refresh sandbox files' : 'Refresh files'}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {!isSandboxMode && (
            <Button
              onClick={() => setShowGitHubImport(true)}
              className="mt-2 w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
              variant="outline"
              size="sm"
            >
              <GitBranch className="h-4 w-4" />
              Import from GitHub
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
        <FileTree
          files={visibleFiles}
          onSelectFile={handleSelectFile}
          onCreateFile={isSandboxMode ? undefined : handleCreateFile}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
        />
        </div>
      </aside>
      <section className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e]">
        <div className="flex h-9 shrink-0 items-center border-b border-[#2b2b2b] bg-[#252526]">
          {selectedFile ? (
            <div className="flex h-full max-w-full items-center border-r border-[#2b2b2b] bg-[#1e1e1e] px-3 text-xs font-medium text-white">
              <span className="truncate">{selectedFile.path}</span>
            </div>
          ) : (
            <div className="px-3 text-xs text-white/45">IDE</div>
          )}
        </div>
        <div className="min-h-0 flex-1">
        {selectedFile ? (
          isGitHubSaveBlocked ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-sm space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-sm">
                <div className="text-sm font-medium">GitHub save required</div>
                <p className="text-sm text-white/60">
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
              onChange={handleEditorChange}
              onBlur={() => void flushPendingSave()}
              onSave={handleEditorSave}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/45">
            <p>Select a file from the tree to open it here</p>
          </div>
        )}
        </div>
      </section>
    </div>
  )
}

function filterFileTree(files: FileSystemNode[], query: string): FileSystemNode[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return files
  }

  const filteredFiles: FileSystemNode[] = []

  for (const file of files) {
    const children = file.children ? filterFileTree(file.children, normalizedQuery) : []
    const matches =
      file.name.toLowerCase().includes(normalizedQuery) ||
      file.path?.toLowerCase().includes(normalizedQuery)

    if (matches || children.length > 0) {
      filteredFiles.push({
        ...file,
        children: file.children ? children : file.children,
      })
    }
  }

  return filteredFiles
}
