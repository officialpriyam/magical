'use client'

import { Task } from '@/lib/tasks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TaskDetailsProps {
  task: Task
}

export function TaskDetails({ task }: TaskDetailsProps) {
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
    <div className="space-y-6">
      {/* Task Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">Task Details</CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(task.status)}>
                  {task.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Progress: {task.progress}%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">Prompt</h4>
            <p className="text-sm text-muted-foreground">{task.prompt}</p>
          </div>

          <Progress value={task.progress} className="w-full" />

          {task.repo_url && (
            <div>
              <h4 className="font-medium mb-1">Repository URL</h4>
              <p className="text-sm text-muted-foreground">{task.repo_url}</p>
            </div>
          )}

          {task.selected_agent && (
            <div>
              <h4 className="font-medium mb-1">Selected Agent</h4>
              <p className="text-sm text-muted-foreground">{task.selected_agent}</p>
            </div>
          )}

          {task.sandbox_url && (
            <div>
              <h4 className="font-medium mb-1">Sandbox URL</h4>
              <a
                href={task.sandbox_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {task.sandbox_url}
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Created:</span>{' '}
              <span className="text-muted-foreground">
                {new Date(task.created_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="font-medium">Updated:</span>{' '}
              <span className="text-muted-foreground">
                {new Date(task.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Card */}
      <Card>
        <CardHeader>
          <CardTitle>Task Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {task.logs.length > 0 ? (
                task.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50"
                  >
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        log.type === 'error'
                          ? 'border-red-200 text-red-700'
                          : log.type === 'success'
                          ? 'border-green-200 text-green-700'
                          : log.type === 'command'
                          ? 'border-blue-200 text-blue-700'
                          : 'border-gray-200 text-gray-700'
                      }`}
                    >
                      {log.type}
                    </Badge>
                    <div className="flex-1 space-y-1">
                      <p className="text-muted-foreground">{log.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No logs available yet
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}