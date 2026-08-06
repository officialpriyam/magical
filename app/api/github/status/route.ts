import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { getGitHubConnectionStatus } from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    return NextResponse.json(await getGitHubConnectionStatus(user.id))
  } catch (error) {
    console.error('Failed to read GitHub connection status:', error)
    return NextResponse.json({ connected: false })
  }
}
