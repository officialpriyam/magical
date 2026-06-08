import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { storeSupabaseConnection } from '@/lib/supabase-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  const body = await req.json().catch(() => ({}))
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  const projectRef = typeof body.projectRef === 'string' ? body.projectRef.trim() : ''

  if (!accessToken || !projectRef) {
    return NextResponse.json(
      { error: 'Supabase access token and project ref are required.' },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(
      await storeSupabaseConnection({
        userId: user.id,
        accessToken,
        projectRef,
      }),
    )
  } catch (error) {
    console.error('Failed to connect Supabase:', error)
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Failed to connect Supabase.',
      },
      { status: 500 },
    )
  }
}
