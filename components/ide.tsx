'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { FileTree, FileSystemNode } from '@/components/file-tree'
import { CodeEditor } from '@/components/code-editor'
import { GitHubImport } from '@/components/github-import'
import { useAuth } from '@/lib/auth'
import { Button } from './ui/button'
import { GitBranch, RefreshCw, Search, AlertTriangle, Wifi, WifiOff, Save, Download, RotateCcw } from 'lucide-react'
import Spinner from './ui/spinner'

type StorageStatus = 'idle' | 'loading' | 'ok' | 'error' | 'degraded'

interface IDEProps {
  sandboxId?: string
  projectId?: string
  onSave?: (path: string, content: string) => Promise<void>
  onRedeploy?: () => Promise<void>
  githubSaveRequired?: boolean
  githubWorkspaceConnected?: boolean
  onSaveBlocked?: () => void
}

export function IDE({
  sandboxId,
  projectId,
  onSave,
  onRedeploy,
  githubSaveRequired = false,
  githubWorkspaceConnected = false,
  onSaveBlocked,
}: IDEProps = {}) {
  const noOpDialog = useCallback(() => {}, [])
  const noOpView = useCallback(() => {}, [])
  const { session, loading } = useAuth(noOpDialog, noOpView)
  const [files, setFiles] = useState<FileSystemNode[]>([])
  const [selectedFile, setSelectedFile] = useState<{
    path: string
    content: string
  } | null>(null)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [showGitHubImport, setShowGitHubImport] = useState(false)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [storageSlow, setStorageSlow] = useState(false)
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('idle')
  const isSandboxMode = !!sandboxId
  const isGitHubSaveBlocked = githubSaveRequired && !githubWorkspaceConnected
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null)
  const selectedFileRef = useRef(selectedFile)
  const fileContentCacheRef = useRef<Map<string, string>>(new Map())
  const fetchInFlightRef = useRef(false)
  const isOpeningRef = useRef(false)
  const mountedRef = useRef(true)
  const [isRedeploying, setIsRedeploying] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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
    if (fetchInFlightRef.current) {
      return
    }

    if (isSandboxMode && sandboxId) {
      if (!projectId) {
        setLoadError('Sandbox mode requires a project ID to fetch files from storage.')
        setStorageStatus('error')
        return
      }

      fetchInFlightRef.current = true
      setIsRefreshing(true)
      setStorageStatus('loading')

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)

        const storageResponse = await fetch(`/api/projects/${projectId}/sandbox-storage-files`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (storageResponse.ok) {
          const storageData = await storageResponse.json()

          if (Array.isArray(storageData.files)) {
            if (storageData.files.length > 0) {
              setFiles(storageData.files)
              setLoadError(null)
              setStorageSlow(Boolean(storageData.slow))
              setStorageStatus('ok')
              return
            }

            setFiles([])
            setStorageSlow(false)
            setStorageStatus('degraded')
            setLoadError(
              storageData.error ||
                'Sandbox storage returned no files. Save a file to sync the workspace, then refresh.',
            )
            return
          }

          setFiles([])
          setStorageStatus('error')
          setLoadError('Sandbox storage returned an unexpected response.')
        } else {
          const errorData = await storageResponse.json().catch(() => null)
          const message =
            errorData?.error || `Failed to fetch files (HTTP ${storageResponse.status}).`
          setLoadError(message)
          setStorageStatus('error')
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          setLoadError('Sandbox storage took too long to respond. Check the storage server and retry.')
        } else {
          setLoadError('Could not reach sandbox storage. Check that the storage server is running.')
        }
        setStorageStatus('error')
      } finally {
        fetchInFlightRef.current = false
        setIsRefreshing(false)
      }
    } else if (session) {
      fetchInFlightRef.current = true
      setIsRefreshing(true)
      setLoadError(null)

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        const response = await fetch('/api/files', {
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (response.ok) {
          const data = await response.json()
          setFiles(data)
        } else {
          setLoadError('Failed to fetch workspace files.')
        }
      } catch (error) {
        console.warn('Error fetching files (keeping existing list):', error)
        setLoadError('Could not load the workspace file list.')
      } finally {
        fetchInFlightRef.current = false
        setIsRefreshing(false)
      }
    }
  }, [session, isSandboxMode, sandboxId, projectId])

  const persistFile = useCallback(async (path: string, content: string) => {
    if (isGitHubSaveBlocked) {
      blockGitHubSave()
      return false
    }

    let saved = false

    if (onSave) {
      await onSave(path, content)
      saved = true
    } else if (isSandboxMode && sandboxId) {
      try {
        const response = await fetch(`/api/sandbox/${sandboxId}/files/content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path, content, projectID: projectId }),
        })
        saved = response.ok

        if (!saved) {
          const errorData = await response.json().catch(() => null)
          setLoadError(
            errorData?.error || `Failed to save "${path}" (HTTP ${response.status}).`,
          )
        }
      } catch (error: any) {
        setLoadError(
          error?.name === 'AbortError'
            ? `Saving "${path}" timed out. The sandbox may be unreachable.`
            : `Could not save "${path}". Check the sandbox connection.`,
        )
      }
    } else if (session) {
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
      setLoadError((current) => (current?.startsWith(`Could not save "${path}"`) ? null : current))
    }

    return saved
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

  const handleSelectFile = useCallback(async (path: string) => {
    const cached = fileContentCacheRef.current.get(path)
    if (cached !== undefined) {
      setSelectedFile({ path, content: cached })
      return
    }

    if (isOpeningRef.current) {
      return
    }

    if (pendingSaveRef.current) {
      void flushPendingSave()
    }

    isOpeningRef.current = true
    setIsOpeningFile(true)
    setOpeningPath(path)
    try {
      if (isSandboxMode && projectId) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        try {
          const response = await fetch(
            `/api/projects/${projectId}/sandbox-storage-files?path=${encodeURIComponent(path)}`,
            { signal: controller.signal },
          )

          if (response.ok) {
            const { content } = await response.json()
            fileContentCacheRef.current.set(path, content)
            setSelectedFile({ path, content })
            setLoadError(null)
          } else {
            const errorData = await response.json().catch(() => null)
            setLoadError(
              errorData?.error ||
                `"${path}" could not be loaded from sandbox storage.`,
            )
          }
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            setLoadError(
              `Loading "${path}" timed out. Sandbox storage may be unreachable.`,
            )
          } else {
            setLoadError(
              `Could not reach sandbox storage to load "${path}". Check the storage connection.`,
            )
          }
        } finally {
          clearTimeout(timeout)
        }
      } else if (session) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        try {
          const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`, {
            signal: controller.signal,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            setLoadError(
              errorData?.error || `Failed to load "${path}".`,
            )
            return
          }
          const { content } = await response.json()
          fileContentCacheRef.current.set(path, content)
          setSelectedFile({ path, content })
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            setLoadError(`Loading "${path}" timed out. The workspace server may be slow.`)
          }
        } finally {
          clearTimeout(timeout)
        }
      }
    } finally {
      isOpeningRef.current = false
      setIsOpeningFile(false)
      setOpeningPath(null)
    }
  }, [isSandboxMode, projectId, session, flushPendingSave])

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
      await fetchFiles()
      setShowGitHubImport(false)
    } catch (error) {
      console.error('Error after repository import:', error)
    }
  }

  function handleManualSave() {
    const currentFile = selectedFileRef.current
    if (!currentFile) return
    void flushPendingSave()
  }

  function handleDownloadFile() {
    const currentFile = selectedFileRef.current
    if (!currentFile) return

    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = currentFile.path.split('/').pop() || 'file'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleRedeploy() {
    if (!onRedeploy || isRedeploying) return
    setIsRedeploying(true)
    try {
      await onRedeploy()
    } catch (err) {
      console.error('Redeploy failed:', err)
    } finally {
      setIsRedeploying(false)
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

  const storageIndicator = isSandboxMode ? (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs">
      {storageStatus === 'loading' || isRefreshing ? (
        <>
          <Spinner />
          <span className="text-white/50">Loading...</span>
        </>
      ) : storageStatus === 'error' ? (
        <>
          <WifiOff className="h-3 w-3 text-red-400" />
          <span className="text-red-400">Storage offline</span>
        </>
      ) : storageStatus === 'degraded' ? (
        <>
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span className="text-amber-400">Partial</span>
        </>
      ) : storageStatus === 'ok' ? (
        <>
          <Wifi className="h-3 w-3 text-green-400" />
          <span className="text-green-400">Synced</span>
        </>
      ) : null}
    </div>
  ) : null

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
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
        {storageIndicator}
        <div className="min-h-0 flex-1 overflow-auto">
          {storageStatus === 'error' && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
              <WifiOff className="h-8 w-8 text-red-400/60" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-300">Storage Unavailable</p>
                <p className="text-xs text-white/40 max-w-[200px]">
                  Cannot connect to sandbox storage. Files may still be available in the live sandbox.
                </p>
              </div>
              <Button
                onClick={fetchFiles}
                variant="outline"
                size="sm"
                className="border-red-500/20 text-red-300 hover:bg-red-500/10"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry Connection
              </Button>
            </div>
          ) : (
            <FileTree
              files={visibleFiles}
              onSelectFile={handleSelectFile}
              onCreateFile={isSandboxMode ? undefined : handleCreateFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
            />
          )}
        </div>
        {loadError && (
          <div className="shrink-0 border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
              <p className="min-w-0 flex-1 leading-5">{loadError}</p>
              <Button
                onClick={() => void fetchFiles()}
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2 text-red-200/80 hover:bg-red-500/20 hover:text-red-100"
                title="Retry"
                aria-label="Retry load files"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        {storageSlow && !loadError && (
          <div className="shrink-0 border-t border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/80">
            Sandbox storage is responding slowly. Files may take a moment to refresh.
          </div>
        )}
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
          <div className="ml-auto flex items-center gap-0.5 pr-1">
            {selectedFile && (
              <>
                <button
                  onClick={handleManualSave}
                  className="flex h-7 items-center gap-1 rounded px-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                  title="Save file (Ctrl+S)"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Save</span>
                </button>
                <button
                  onClick={handleDownloadFile}
                  className="flex h-7 items-center gap-1 rounded px-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                  title="Download file"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Download</span>
                </button>
              </>
            )}
            {isSandboxMode && (
              <button
                onClick={handleRedeploy}
                disabled={isRedeploying}
                className="flex h-7 items-center gap-1 rounded px-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Redeploy sandbox"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRedeploying ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{isRedeploying ? 'Redeploying...' : 'Redeploy'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {isOpeningFile && !selectedFile ? (
            <div className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm text-white/45">
              <Spinner />
              <span>Loading {openingPath || 'file'}...</span>
            </div>
          ) : selectedFile ? (
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
