import { nanoid } from 'nanoid'

export interface GitHubOAuthConfig {
  clientId: string
  redirectUri: string
  scopes: string[]
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  clone_url: string
  ssh_url: string
  private: boolean
  fork: boolean
  archived: boolean
  disabled: boolean
  owner: {
    login: string
    avatar_url: string
    type: string
  }
  created_at: string
  updated_at: string
  pushed_at: string
  language: string | null
  stargazers_count: number
  watchers_count: number
  forks_count: number
  open_issues_count: number
  size: number
  default_branch: string
  topics: string[]
  has_issues: boolean
  has_projects: boolean
  has_wiki: boolean
  has_pages: boolean
  has_downloads: boolean
  license: {
    key: string
    name: string
    spdx_id: string
  } | null
}

export interface GitHubUserIntegration {
  access_token: string
  refresh_token?: string
  token_type: string
  scope: string
  github_user_id: number
  username: string
  avatar_url: string
  connected_at: string
  last_webhook_event?: {
    type: string
    repository?: string
    branch?: string
    commits?: number
    action?: string
    pr_number?: number
    pr_title?: string
    issue_number?: number
    issue_title?: string
    timestamp: string
    author?: string
    pusher?: string
  }
}

export function generateGitHubOAuthUrl(config: GitHubOAuthConfig): string {
  const state = nanoid()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    allow_signup: 'true',
  })

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('github_oauth_state', state)
  }

  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export function getGitHubScopes(): string[] {
  return [
    'user:email',
    'repo',
    'write:repo_hook',
    'read:org',
  ]
}

export async function revokeGitHubToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/github/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Error revoking GitHub token:', error)
    return false
  }
}

export async function fetchGitHubRepositories(options?: {
  page?: number
  per_page?: number
  sort?: 'created' | 'updated' | 'pushed' | 'full_name'
  type?: 'all' | 'owner' | 'public' | 'private' | 'member'
}): Promise<{ repositories: GitHubRepository[]; total_count: number; has_more: boolean } | null> {
  try {
    // First get the current user to know whose repos to fetch
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

    // Get user's organizations and their repos if type allows
    let orgRepos: any[] = []
    if (!options?.type || options.type === 'all' || options.type === 'member') {
      const orgsResponse = await fetch('/api/github/orgs')
      if (orgsResponse.ok) {
        const orgs = await orgsResponse.json()

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
    }

    // Filter repositories based on type
    let allRepos = [...userRepos, ...orgRepos]
    if (options?.type === 'owner') {
      allRepos = userRepos // Only user's own repos
    }

    // Convert to expected format
    const repositories: GitHubRepository[] = allRepos.map((repo: any) => ({
      id: repo.id || Math.random(),
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: `https://github.com/${repo.full_name}`,
      clone_url: repo.clone_url,
      ssh_url: `git@github.com:${repo.full_name}.git`,
      private: repo.private,
      fork: false,
      archived: false,
      disabled: false,
      owner: {
        login: repo.full_name.split('/')[0],
        avatar_url: userData.avatar_url,
        type: 'User'
      },
      created_at: new Date().toISOString(),
      updated_at: repo.updated_at,
      pushed_at: repo.updated_at,
      language: repo.language,
      stargazers_count: 0,
      watchers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      size: 0,
      default_branch: 'main',
      topics: [],
      has_issues: true,
      has_projects: true,
      has_wiki: true,
      has_pages: false,
      has_downloads: true,
      license: null
    }))

    // Apply sorting if specified
    if (options?.sort) {
      repositories.sort((a, b) => {
        switch (options.sort) {
          case 'full_name':
            return a.full_name.localeCompare(b.full_name)
          case 'updated':
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          default:
            return 0
        }
      })
    }

    // Apply pagination
    const page = options?.page || 1
    const perPage = options?.per_page || 30
    const startIndex = (page - 1) * perPage
    const endIndex = startIndex + perPage
    const paginatedRepos = repositories.slice(startIndex, endIndex)

    return {
      repositories: paginatedRepos,
      total_count: repositories.length,
      has_more: endIndex < repositories.length
    }
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error)
    return null
  }
}

export function isGitHubIntegrationHealthy(integration: any): boolean {
  if (!integration?.is_connected) return false
  if (!integration?.connection_data?.access_token) return false
  
  if (integration.last_sync_at) {
    const lastSync = new Date(integration.last_sync_at)
    const now = new Date()
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceSync > 24) {
      return false
    }
  }
  
  return true
}

export function formatGitHubWebhookEvent(event: any): string {
  if (!event) return 'No recent activity'

  switch (event.type) {
    case 'push':
      return `${event.commits} commit(s) pushed to ${event.branch} in ${event.repository}`
    case 'pull_request':
      return `Pull request #${event.pr_number} ${event.action} in ${event.repository}`
    case 'issues':
      return `Issue #${event.issue_number} ${event.action} in ${event.repository}`
    default:
      return `${event.type} event in ${event.repository || 'repository'}`
  }
}

export function getGitHubEventIcon(eventType: string): string {
  switch (eventType) {
    case 'push':
      return '📤'
    case 'pull_request':
      return '🔀'
    case 'issues':
      return '❗'
    default:
      return '📋'
  }
}

export function validateGitHubWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false

  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return signature === `sha256=${expectedSignature}`
}