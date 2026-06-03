'use client'

import { useState } from 'react'
import { useTask } from '@/hooks/use-task'
import { TaskDetails } from '@/components/task-details'
import { TaskPageHeader } from '@/components/task-page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListTodo, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskPageClientProps {
  taskId: string
}

export function TaskPageClient({ taskId }: TaskPageClientProps) {
  const { task, isLoading, error } = useTask(taskId)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        {/* Main content */}
        <div className="flex-1 relative">
          {/* Task toggle button */}
          <Button
            variant="outline"
            size="icon"
            className="fixed top-4 right-4 z-50"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <ListTodo className="h-4 w-4" />
          </Button>

          <div className="mx-auto p-3">
            <div className="max-w-4xl mx-auto">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Task Info Skeleton - 339px height */}
                  <Card className="h-[339px]">
                    <CardContent className="space-y-4"></CardContent>
                  </Card>

                  {/* Logs Skeleton - 512px height */}
                  <Card className="h-[512px]">
                    <CardContent></CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className={cn(
          "fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out z-40",
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Task Details</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            <div className="text-sm text-muted-foreground">Loading task details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="flex h-screen bg-background">
        {/* Main content */}
        <div className="flex-1 relative">
          {/* Task toggle button */}
          <Button
            variant="outline"
            size="icon"
            className="fixed top-4 right-4 z-50"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <ListTodo className="h-4 w-4" />
          </Button>

          <div className="mx-auto p-3">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-2">Task Not Found</h2>
                <p className="text-muted-foreground">{error || 'The requested task could not be found.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className={cn(
          "fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out z-40",
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Task Details</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            <div className="text-sm text-muted-foreground">No task data available</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main content */}
      <div className="flex-1 relative">
        {/* Task toggle button */}
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-50"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <ListTodo className="h-4 w-4" />
        </Button>

        <div className="mx-auto p-3 overflow-y-auto h-full">
          <TaskPageHeader task={task} />

          {/* Task details */}
          <div className="max-w-4xl mx-auto">
            <TaskDetails task={task} />
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out z-40",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Task Details</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 overflow-y-auto">
          {task && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Task ID</h3>
                <p className="text-sm text-muted-foreground font-mono">{task.id}</p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Status</h3>
                <p className="text-sm text-muted-foreground">{task.status}</p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Created</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(task.created_at).toLocaleString()}
                </p>
              </div>

              {task.prompt && (
                <div>
                  <h3 className="font-medium mb-2">Prompt</h3>
                  <p className="text-sm text-muted-foreground">{task.prompt}</p>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-2">Progress</h3>
                <p className="text-sm text-muted-foreground">{task.progress}%</p>
              </div>

              {task.selected_model && (
                <div>
                  <h3 className="font-medium mb-2">Model</h3>
                  <p className="text-sm text-muted-foreground">{task.selected_model}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
