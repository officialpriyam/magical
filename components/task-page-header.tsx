'use client'

import { Task } from '@/lib/tasks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, ExternalLink } from 'lucide-react'

interface TaskPageHeaderProps {
  task: Task
}

export function TaskPageHeader({ task }: TaskPageHeaderProps) {
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'processing':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="border-b bg-background px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Task {task.id.slice(0, 8)}</h1>
            <Badge className={getStatusColor(task.status)}>
              {task.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {task.prompt}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {task.sandbox_url && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={task.sandbox_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Sandbox
              </a>
            </Button>
          )}

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}