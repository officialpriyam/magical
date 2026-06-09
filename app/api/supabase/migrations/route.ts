import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-utils'
import { applySupabaseMigration } from '@/lib/supabase-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const DESTRUCTIVE_SQL_PATTERN = /\b(drop\s+(table|schema|database)|truncate\s+table|delete\s+from)\b/i

export async function POST(req: Request) {
  const { user, error } = await authenticateUser()

  if (error) {
    return error
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  const projectTitle = typeof body.projectTitle === 'string' ? body.projectTitle.trim() : ''
  const allowDestructive = body.allowDestructive === true

  if (!name || !query) {
    return NextResponse.json(
      { error: 'Migration name and SQL query are required.' },
      { status: 400 },
    )
  }

  if (!allowDestructive && DESTRUCTIVE_SQL_PATTERN.test(query)) {
    return NextResponse.json(
      {
        error:
          'This migration contains destructive SQL. Ask the user for explicit confirmation before applying it.',
      },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(
      await applySupabaseMigration(user.id, {
        name,
        query,
      }, {
        projectId,
        projectTitle,
        regionCountry: getRequestCountry(req),
      }),
    )
  } catch (error) {
    console.error('Failed to apply Supabase migration:', error)
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Failed to apply Supabase migration.',
      },
      { status: 500 },
    )
  }
}

function getRequestCountry(req: Request) {
  return (
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    ''
  )
}
