import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { disconnectGitHub } from '@/lib/github-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  try {
    await disconnectGitHub(user.id)
    return NextResponse.json({ connected: false })
  } catch (error) {
    console.error('Failed to disconnect GitHub:', error)
    return NextResponse.json({ error: 'Failed to disconnect GitHub' }, { status: 500 })
  }
}
