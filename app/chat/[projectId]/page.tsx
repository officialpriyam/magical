import Home from '../../page'
import { createServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'

export default async function ChatProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !project) {
    notFound()
  }

  return <Home initialProjectId={projectId} />
}
