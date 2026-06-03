'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { FileSystemNode } from '@/components/file-tree'
import type { FragmentSchema } from '@/lib/schema'
import type { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { GitBranch, Loader2, UploadCloud } from 'lucide-react'

type GitHubRepo = {
  id: number
  full_name: string
  name: string
  private: boolean
}

type GitHubStatus = {
  connected: boolean
  username?: string
}

type SaveFile = {
  path: string
  content: string
}

export function GitHubSave({
  fragment,
  result,
}: {
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GitHubStatus | null>(null)
  const [repositories, setRepositories] = useState<GitHubRepo[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [pathPrefix, setPathPrefix] = useState('')
  const [message, setMessage] = useState('Save generated code from Magical AI')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const hasGeneratedFiles = useMemo(
    () => Boolean(fragment?.code || (result?.sbxId && result.files?.length)),
    [fragment?.code, result?.files?.length, result?.sbxId],
  )

  const loadGitHub = useCallback(async () => {
    setIsLoading(true)

    try {
      const statusResponse = await fetch('/api/github/status')

      if (!statusResponse.ok) {
        throw new Error('GitHub connection status failed')
      }

      const statusData = (await statusResponse.json()) as GitHubStatus
      setStatus(statusData)

      if (!statusData.connected) {
        setRepositories([])
        return
      }

      const userResponse = await fetch('/api/github/user')
      if (!userResponse.ok) {
        throw new Error('GitHub user lookup failed')
      }

      const userData = await userResponse.json()
      const userReposResponse = await fetch(`/api/github/repos?owner=${userData.login}`)
      const userRepos = userReposResponse.ok ? await userReposResponse.json() : []
      const orgsResponse = await fetch('/api/github/orgs')
      const orgRepos: GitHubRepo[] = []

      if (orgsResponse.ok) {
        const orgs = await orgsResponse.json()

        for (const org of orgs) {
          const orgReposResponse = await fetch(`/api/github/repos?owner=${org.login}`)
          if (orgReposResponse.ok) {
            orgRepos.push(...(await orgReposResponse.json()))
          }
        }
      }

      const repos = [...userRepos, ...orgRepos]
        .filter(
          (repo, index, list) =>
            index === list.findIndex((candidate) => candidate.full_name === repo.full_name),
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name))

      setRepositories(repos)
      setSelectedRepo((current) => current || repos[0]?.full_name || '')
    } catch (error) {
      console.error('Failed to load GitHub save options:', error)
      toast({
        title: 'GitHub unavailable',
        description: 'Connect GitHub again, then retry.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!open) return

    loadGitHub()
  }, [loadGitHub, open])

  async function saveToGitHub() {
    if (!selectedRepo) return

    setIsSaving(true)

    try {
      const files = await collectFiles()
      const [owner, repo] = selectedRepo.split('/')

      if (files.length === 0) {
        throw new Error('No generated files to save')
      }

      const response = await fetch(`/api/github/repos/${owner}/${repo}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch,
          message,
          files,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'GitHub save failed')
      }

      toast({
        title: 'Saved to GitHub',
        description: `${data.committed} file${data.committed === 1 ? '' : 's'} committed to ${selectedRepo}.`,
      })
      setOpen(false)
    } catch (error) {
      console.error('Failed to save to GitHub:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save to GitHub.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function collectFiles(): Promise<SaveFile[]> {
    if (result?.sbxId && result.files?.length) {
      const nodes = flattenFileNodes(result.files)
      const files: SaveFile[] = []

      for (const node of nodes.slice(0, 100)) {
        const nodePath = node.path || node.name
        const response = await fetch(
          `/api/sandbox/${result.sbxId}/files/content?path=${encodeURIComponent(nodePath)}`,
        )

        if (!response.ok) {
          continue
        }

        const data = await response.json()
        files.push({
          path: withPathPrefix(toRepoPath(nodePath)),
          content: data.content || '',
        })
      }

      return files
    }

    if (!fragment?.code) {
      return []
    }

    return [
      {
        path: withPathPrefix(fragment.file_path || 'code.txt'),
        content: fragment.code,
      },
    ]
  }

  function withPathPrefix(path: string) {
    const prefix = pathPrefix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '').trim()

    return prefix ? `${prefix}/${cleanPath}` : cleanPath
  }

  if (!hasGeneratedFiles) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UploadCloud className="mr-2 h-4 w-4" />
          Save to GitHub
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to GitHub</DialogTitle>
          <DialogDescription>
            Commit the current generated code to a repository connected to your GitHub account.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Repository</Label>
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.full_name} value={repo.full_name}>
                      {repo.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="github-branch">Branch</Label>
                <Input
                  id="github-branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-path-prefix">Folder</Label>
                <Input
                  id="github-path-prefix"
                  placeholder="optional"
                  value={pathPrefix}
                  onChange={(event) => setPathPrefix(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-message">Commit message</Label>
              <Input
                id="github-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="text-sm">
              <div className="font-medium">GitHub is not connected</div>
              <div className="text-muted-foreground">Connect your account to save private code.</div>
            </div>
            <Button onClick={() => { window.location.assign('/api/github/connect') }}>
              <GitBranch className="mr-2 h-4 w-4" />
              Connect
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {status?.connected && (
            <Button onClick={saveToGitHub} disabled={isSaving || !selectedRepo}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function flattenFileNodes(nodes: FileSystemNode[]): FileSystemNode[] {
  const files: FileSystemNode[] = []

  for (const node of nodes) {
    if (node.isDirectory) {
      files.push(...flattenFileNodes(node.children || []))
    } else {
      files.push(node)
    }
  }

  return files
}

function toRepoPath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/?home\/user\/?/, '')
    .replace(/^\/+/, '')
}
