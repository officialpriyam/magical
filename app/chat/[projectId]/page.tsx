import Home from '../../page'

export default async function ChatProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  return <Home initialProjectId={projectId} />
}
