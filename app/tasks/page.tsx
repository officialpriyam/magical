'use client'

import { useState, useEffect } from 'react'
import { useTasks } from '@/hooks/use-tasks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, RefreshCw, ExternalLink, Loader2, ListTodo } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTypingEffect } from '@/hooks/use-typing-effect'

export default function TasksPage() {
  const router = useRouter()
  const { tasks, isLoading, error, refetch, createTask, deleteTasks } = useTasks()
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Form state
  const [prompt, setPrompt] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('claude')
  const [selectedModel, setSelectedModel] = useState('')

  // Typing effect for empty state
  const emptyStateText = useTypingEffect(
    ['No tasks yet...', 'Create your first task!', 'AI-powered automation awaits!'],
    100,
    2000
  )

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleCreateTask = async () => {
    if (!prompt.trim()) return

    setIsCreating(true)
    const task = await createTask({
      prompt,
      repoUrl: repoUrl || undefined,
      selectedAgent,
      selectedModel: selectedModel || undefined,
    })

    if (task) {
      setPrompt('')
      setRepoUrl('')
      setSelectedAgent('claude')
      setSelectedModel('')
      setShowCreateForm(false)

      // Navigate to the task detail page
      router.push(`/${task.id}`)
    }

    setIsCreating(false)
  }

  const handleDeleteCompleted = async () => {
    setIsDeleting(true)
    await deleteTasks(['completed'])
    setIsDeleting(false)
  }

  const handleDeleteFailed = async () => {
    setIsDeleting(true)
    await deleteTasks(['failed'])
    setIsDeleting(false)
  }

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    await deleteTasks(['completed', 'failed'])
    setIsDeleting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks = tasks.filter(t => t.status === 'error')

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ListTodo className="h-8 w-8" />
              Tasks Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage and monitor your AI automation tasks
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{pendingTasks.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{completedTasks.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{failedTasks.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Create Task Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Task</CardTitle>
              <CardDescription>
                Describe what you want the AI to do
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Task Description *</Label>
                <Textarea
                  id="prompt"
                  placeholder="E.g., Fix the authentication bug in the login component..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repoUrl">Repository URL (optional)</Label>
                <Input
                  id="repoUrl"
                  placeholder="https://github.com/username/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agent">Agent</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger id="agent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude">Claude</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model (optional)</Label>
                  <Input
                    id="model"
                    placeholder="E.g., claude-3-5-sonnet"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateTask}
                  disabled={!prompt.trim() || isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Task
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="mb-6 border-red-500/50 bg-red-500/5">
            <CardContent className="pt-6">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Tasks List */}
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <ListTodo className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {isMounted ? emptyStateText : 'No tasks yet...'}
              </h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first automation task
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bulk Actions */}
            {(completedTasks.length > 0 || failedTasks.length > 0) && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Bulk Actions:</span>
                    {completedTasks.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isDeleting}>
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete Completed ({completedTasks.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Completed Tasks?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {completedTasks.length} completed task(s). This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteCompleted}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {failedTasks.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isDeleting}>
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete Failed ({failedTasks.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Failed Tasks?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {failedTasks.length} failed task(s). This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteFailed}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {(completedTasks.length > 0 || failedTasks.length > 0) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isDeleting}>
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete All Non-Active
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete All Non-Active Tasks?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all completed and failed tasks. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAll}>
                              Delete All
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tasks Grid */}
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getStatusColor(task.status)}>
                            {task.status}
                          </Badge>
                          {task.selected_agent && (
                            <Badge variant="outline">{task.selected_agent}</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg mb-1">{task.prompt}</CardTitle>
                        <CardDescription>
                          Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      <Link href={`/${task.id}`}>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} />
                      </div>

                      {/* Task Metadata */}
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {task.repo_url && (
                          <div>
                            <span className="text-muted-foreground">Repository:</span>
                            <a
                              href={task.repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-blue-500 hover:underline truncate"
                            >
                              {task.repo_url.split('/').slice(-2).join('/')}
                            </a>
                          </div>
                        )}
                        {task.selected_model && (
                          <div>
                            <span className="text-muted-foreground">Model:</span>
                            <p className="font-mono text-xs">{task.selected_model}</p>
                          </div>
                        )}
                        {task.sandbox_url && (
                          <div>
                            <span className="text-muted-foreground">Sandbox:</span>
                            <a
                              href={task.sandbox_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-blue-500 hover:underline truncate"
                            >
                              View sandbox
                            </a>
                          </div>
                        )}
                        {task.branch_name && (
                          <div>
                            <span className="text-muted-foreground">Branch:</span>
                            <p className="font-mono text-xs">{task.branch_name}</p>
                          </div>
                        )}
                      </div>

                      {/* Latest Log */}
                      {task.logs && task.logs.length > 0 && (
                        <>
                          <Separator />
                          <div className="text-sm">
                            <span className="text-muted-foreground">Latest: </span>
                            <span>{task.logs[task.logs.length - 1].message}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
