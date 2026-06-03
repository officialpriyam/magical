import { NextRequest, NextResponse } from 'next/server'
import {
  getGitHubAccessToken,
  getOptionalAuthenticatedUser,
  githubHeaders,
} from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const owner = request.nextUrl.searchParams.get('owner')
    const user = await getOptionalAuthenticatedUser()
    const userAccessToken = user ? await getGitHubAccessToken(user.id) : null
    const accessToken = userAccessToken || process.env.GITHUB_TOKEN || null

    if (!owner) {
      return NextResponse.json({ error: 'Owner parameter is required' }, { status: 400 })
    }

    // First, get the authenticated user to check if this is their repos
    let isAuthenticatedUser = false
    if (accessToken) {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: githubHeaders(accessToken),
      })

      if (userResponse.ok) {
        const githubUser = await userResponse.json()
        isAuthenticatedUser = githubUser.login === owner
      }
    }

    // Fetch all repositories by paginating through all pages
    const allRepos: any[] = []
    let page = 1
    const perPage = 100 // GitHub's maximum per page

    while (true) {
      let apiUrl: string

      if (isAuthenticatedUser) {
        // Use /user/repos for authenticated user to get private repos, but only owned repos
        apiUrl = `https://api.github.com/user/repos?sort=name&direction=asc&per_page=${perPage}&page=${page}&visibility=all&affiliation=owner`
      } else {
        // Check if it's an organization
        const orgResponse = await fetch(`https://api.github.com/orgs/${owner}`, {
          headers: githubHeaders(accessToken),
        })

        if (orgResponse.ok) {
          // Use /orgs/{org}/repos for organizations to get private repos
          apiUrl = `https://api.github.com/orgs/${owner}/repos?sort=name&direction=asc&per_page=${perPage}&page=${page}`
        } else {
          // Fallback to /users/{owner}/repos (public only)
          apiUrl = `https://api.github.com/users/${owner}/repos?sort=name&direction=asc&per_page=${perPage}&page=${page}`
        }
      }

      const response = await fetch(apiUrl, {
        headers: githubHeaders(accessToken),
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const repos = await response.json()

      // If we get fewer repos than the per_page limit, we've reached the end
      if (repos.length === 0) {
        break
      }

      allRepos.push(...repos)

      // If we got fewer than the max per page, we've reached the end
      if (repos.length < perPage) {
        break
      }

      page++
    }

    // Remove duplicates based on full_name (owner/repo)
    const uniqueRepos = allRepos.filter(
      (repo, index, self) => index === self.findIndex((r) => r.full_name === repo.full_name),
    )

    // Sort alphabetically by name (GitHub API sort might not be perfect)
    uniqueRepos.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

    return NextResponse.json(
      uniqueRepos.map((repo: any) => ({
        name: repo.name,
        id: repo.id,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        fork: repo.fork,
        clone_url: repo.clone_url,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        owner: repo.owner,
      })),
    )
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error)
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 })
  }
}
