import { TaskPageClient } from '@/components/task-page-client'

interface TaskPageProps {
  params: Promise<{
    taskId: string
  }>
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params

  return <TaskPageClient taskId={taskId} />
}

export async function generateMetadata({ params }: TaskPageProps) {
  const { taskId } = await params

  return {
    title: `Task - Magical AI`,
    description: 'View task details and execution logs',
  }
}
