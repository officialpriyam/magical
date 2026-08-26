'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { useToast } from './ui/use-toast'
import { 
  GitBranch, 
  Search, 
  Download, 
  Loader2, 
  RefreshCw,
  Star,
  GitFork,
  Calendar,
  FileText,
  Folder,
  ExternalLink
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ScrollArea } from './ui/scroll-area'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string
  html_url: string
  clone_url: string
  private: boolean
  fork: boolean
  language: string
  stargazers_count: number
  forks_count: number
  updated_at: string
  owner: {
    login: string
    avatar_url: string
  }
}

interface UsageLimits {
  can_import: boolean
  current_usage: number
  limit: number
  is_unlimited: boolean
  plan_name: string
  upgrade_required: boolean
}

interface GitHubStatus {
  connected: boolean
  username?: string
}

interface GitHubImportProps {
  onImport?: (repo: GitHubRepo, files: any[]) => void
  onClose?: () => void
}

const noop = () => {}

export function GitHubImport({ onImport, onClose }: GitHubImportProps) {
  const { session } = useAuth(noop, noop)
  const { toast } = useToast()  
  const [repositories, setRepositories] = useState<GitHubRepo[]>([])
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [publicRepoUrl, setPublicRepoUrl] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus | null>(null)

  const parseGitHubRepoUrl = (value: string) => {
    const trimmed = value.trim()
    const match = trimmed.match(
      /^(?:https?:\/\/github\.com\/|git@github\.com:)?([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/,
    )

    if (!match) return null

    return {
      owner: match[1],
      repo: match[2],
    }
  }

  const loadRepositories = useCallback(async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const statusResponse = await fetch('/api/github/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setGitHubStatus(statusData)

        if (!statusData.connected) {
          setRepositories([])
          return
        }
      }

      // First get the current user
      const userResponse = await fetch('/api/github/user')
      if (!userResponse.ok) {
        throw new Error('Failed to fetch GitHub user')
      }
      const userData = await userResponse.json()

      // Get user's repositories
      const reposResponse = await fetch(`/api/github/repos?owner=${userData.login}`)
      if (!reposResponse.ok) {
        throw new Error('Failed to fetch repositories')
      }
      const userRepos = await reposResponse.json()

      // Get user's organizations
      const orgsResponse = await fetch('/api/github/orgs')
      let orgRepos: any[] = []
      if (orgsResponse.ok) {
        const orgs = await orgsResponse.json()

        // Fetch repos from each organization
        for (const org of orgs) {
          try {
            const orgReposResponse = await fetch(`/api/github/repos?owner=${org.login}`)
            if (orgReposResponse.ok) {
              const repos = await orgReposResponse.json()
              orgRepos.push(...repos)
            }
          } catch (error) {
            console.warn(`Failed to fetch repos for org ${org.login}:`, error)
          }
        }
      }

      // Combine all repositories and format them
      const allRepos = [...userRepos, ...orgRepos].map((repo: any) => ({
        id: repo.id || Math.random(), // fallback ID if not present
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url || `https://github.com/${repo.full_name}`,
        clone_url: repo.clone_url,
        private: repo.private,
        fork: repo.fork ?? false,
        language: repo.language,
        stargazers_count: repo.stargazers_count ?? 0,
        forks_count: repo.forks_count ?? 0,
        updated_at: repo.updated_at,
        owner: {
          login: repo.full_name.split('/')[0],
          avatar_url: repo.owner?.avatar_url || userData.avatar_url
        }
      }))

      setRepositories(allRepos)
      // For now, set basic usage limits - this would need to be integrated with your subscription system
      setUsageLimits({
        can_import: true,
        current_usage: 0,
        limit: 10,
        is_unlimited: false,
        plan_name: 'free',
        upgrade_required: false
      })
    } catch (error) {
      console.error('Error loading repositories:', error)
      toast({
        title: "Error",
        description: "Connect your GitHub account for private repos, or paste a public repository URL below.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id, toast])

  const loadPublicRepository = async () => {
    const parsed = parseGitHubRepoUrl(publicRepoUrl)

    if (!parsed) {
      toast({
        title: 'Invalid repository URL',
        description: 'Use a GitHub URL like https://github.com/owner/repo.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to load repository')
      }

      const repo: GitHubRepo = {
        id: Date.now(),
        name: parsed.repo,
        full_name: `${parsed.owner}/${parsed.repo}`,
        description: 'Public GitHub repository',
        html_url: `https://github.com/${parsed.owner}/${parsed.repo}`,
        clone_url: `https://github.com/${parsed.owner}/${parsed.repo}.git`,
        private: false,
        fork: false,
        language: '',
        stargazers_count: 0,
        forks_count: 0,
        updated_at: new Date().toISOString(),
        owner: {
          login: parsed.owner,
          avatar_url: '',
        },
      }

      setRepositories((current) => {
        const withoutDuplicate = current.filter((item) => item.full_name !== repo.full_name)
        return [repo, ...withoutDuplicate]
      })
      setSearchTerm('')

      toast({
        title: 'Repository loaded',
        description: `${repo.full_name} is ready to import.`,
      })
    } catch (error) {
      console.error('Error loading public repository:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load public repository.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const importRepository = async (repo: GitHubRepo) => {
    if (!session?.user?.id) return

    setIsImporting(true)
    setSelectedRepo(repo)

    try {
      const [owner, repoName] = repo.full_name.split('/')

      // Fetch root directory contents
      const rootResponse = await fetch(`/api/github/repos/${owner}/${repoName}`)
      if (!rootResponse.ok) {
        throw new Error('Failed to fetch repository contents')
      }

      const rootData = await rootResponse.json()

      // Fetch all files recursively
      const allFiles = await fetchAllFiles(owner, repoName, rootData.contents || [])

      // Save files to workspace using batch endpoint
      const filesToImport = allFiles.map(file => ({
        path: `${repo.name}/${file.path}`,
        content: file.content,
        isDirectory: false
      }))

      const response = await fetch('/api/files/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: filesToImport
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import files')
      }

      const result = await response.json()
      const importedCount = result.imported || 0

      toast({
        title: "Success",
        description: `Successfully imported ${repo.name} with ${importedCount} files.`,
      })

      // Update usage limits
      if (usageLimits) {
        const remainingImports = usageLimits.limit - (usageLimits.current_usage + 1)
        setUsageLimits({
          ...usageLimits,
          current_usage: usageLimits.current_usage + 1,
          can_import: remainingImports > 0
        })
      }

      if (onImport) {
        onImport(repo, allFiles)
      }

    } catch (error) {
      console.error('Error importing repository:', error)
      toast({
        title: "Error",
        description: typeof error === 'object' && error && 'message' in error ? error.message as string : "Failed to import repository. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      setSelectedRepo(null)
    }
  }

  const fetchAllFiles = async (owner: string, repo: string, contents: any[], path = ''): Promise<any[]> => {
    const files: any[] = []

    for (const item of contents) {
      if (item.type === 'file') {
        try {
          const fileResponse = await fetch(
            `/api/github/repos/${owner}/${repo}?path=${item.path}`
          )

          if (fileResponse.ok) {
            const fileData = await fileResponse.json()
            files.push({
              name: item.name,
              path: item.path,
              content: fileData.content?.content ? atob(fileData.content.content) : '',
              size: item.size,
              type: 'file'
            })
          }
        } catch (error) {
          console.warn(`Failed to fetch file ${item.path}:`, error)
        }
      } else if (item.type === 'dir') {
        try {
          const dirResponse = await fetch(
            `/api/github/repos/${owner}/${repo}?path=${item.path}`
          )

          if (dirResponse.ok) {
            const dirData = await dirResponse.json()
            const subFiles = await fetchAllFiles(owner, repo, dirData.contents || [], item.path)
            files.push(...subFiles)
          }
        } catch (error) {
          console.warn(`Failed to fetch directory ${item.path}:`, error)
        }
      }
    }

    return files
  }

  useEffect(() => {
    loadRepositories()
  }, [session?.user?.id, loadRepositories])

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!session?.user?.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitHub Import
          </CardTitle>
          <CardDescription>
            Please log in to import repositories from GitHub.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <CardTitle>Import from GitHub</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={githubStatus?.connected ? 'secondary' : 'default'}
              size="sm"
              onClick={() => { window.location.assign('/api/github/connect') }}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              {githubStatus?.connected ? githubStatus.username || 'Connected' : 'Connect GitHub'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadRepositories}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Select a connected repository to import into your workspace, or load a public repository by URL.
          {usageLimits && (
            <span className="block mt-2">
              <Badge variant={usageLimits.can_import ? "secondary" : "destructive"} className="mr-2">
                {usageLimits.current_usage} / {usageLimits.is_unlimited ? '∞' : usageLimits.limit} imports used
              </Badge>
              {usageLimits.plan_name === 'free' && (
                <span className="text-xs text-muted-foreground">
                  Upgrade to Pro for more imports
                </span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {githubStatus && !githubStatus.connected && (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Connect GitHub to list your private repositories and organization repositories.
            </div>
          )}
           
          <div className="flex gap-2">
            <Input
              placeholder="https://github.com/owner/repo"
              value={publicRepoUrl}
              onChange={(event) => setPublicRepoUrl(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={loadPublicRepository}
              disabled={isLoading || !publicRepoUrl.trim()}
            >
              Load Public Repo
            </Button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredRepositories.map((repo) => (
                  <Card key={repo.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-sm truncate">
                              {repo.name}
                            </h3>
                            {repo.private && (
                              <Badge variant="secondary" className="text-xs">
                                Private
                              </Badge>
                            )}
                            {repo.fork && (
                              <Badge variant="outline" className="text-xs">
                                Fork
                              </Badge>
                            )}
                          </div>
                          
                          {repo.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {repo.language && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                {repo.language}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {repo.stargazers_count}
                            </div>
                            <div className="flex items-center gap-1">
                              <GitFork className="h-3 w-3" />
                              {repo.forks_count}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(repo.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(repo.html_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => importRepository(repo)}
                            disabled={isImporting || (usageLimits ? !usageLimits.can_import : false)}
                          >
                            {isImporting && selectedRepo?.id === repo.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {usageLimits && !usageLimits.can_import ? 'Upgrade Required' : 'Import'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {filteredRepositories.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No repositories found matching your search.' : 'No repositories found.'}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
