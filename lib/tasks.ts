import { SupabaseClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

export interface Task {
  id: string
  user_id?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  prompt: string
  repo_url?: string
  selected_agent?: string
  selected_model?: string
  sandbox_url?: string
  branch_name?: string
  logs: TaskLog[]
  created_at: string
  updated_at: string
}

export interface TaskLog {
  id: string
  timestamp: string
  type: 'info' | 'error' | 'success' | 'command'
  message: string
}

export interface CreateTaskData {
  prompt: string
  repo_url?: string
  selected_agent?: string
  selected_model?: string
  user_id?: string
}

// Utility functions for creating log entries
export function createInfoLog(message: string): TaskLog {
  return {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    type: 'info',
    message,
  }
}

export function createErrorLog(message: string): TaskLog {
  return {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    type: 'error',
    message,
  }
}

export function createSuccessLog(message: string): TaskLog {
  return {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    type: 'success',
    message,
  }
}

export function createCommandLog(message: string): TaskLog {
  return {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    type: 'command',
    message,
  }
}

// Task operations using Supabase
export async function createTask(supabase: SupabaseClient, data: CreateTaskData): Promise<Task | null> {
  const task = {
    user_id: data.user_id,
    status: 'pending' as const,
    progress: 0,
    prompt: data.prompt,
    repo_url: data.repo_url,
    selected_agent: data.selected_agent || 'claude',
    selected_model: data.selected_model,
    logs: JSON.stringify([createInfoLog('Task created, preparing to start...')]),
  }

  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()

  if (error) {
    console.error('Error creating task:', error)
    return null
  }

  return {
    ...newTask,
    logs: JSON.parse(newTask.logs || '[]'),
  }
}

export async function getAllTasks(supabase: SupabaseClient): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }

  return data.map(task => ({
    ...task,
    logs: JSON.parse(task.logs || '[]'),
  }))
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: Task['status'],
  errorMessage?: string
): Promise<boolean> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (errorMessage && status === 'error') {
    // Add error log
    const { data: currentTask } = await supabase
      .from('tasks')
      .select('logs')
      .eq('id', taskId)
      .single()

    if (currentTask) {
      const logs = JSON.parse(currentTask.logs || '[]')
      logs.push(createErrorLog(errorMessage))
      updateData.logs = JSON.stringify(logs)
    }
  }

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  return !error
}

export async function updateTaskProgress(
  supabase: SupabaseClient,
  taskId: string,
  progress: number,
  message?: string
): Promise<boolean> {
  const updateData: any = {
    progress,
    updated_at: new Date().toISOString(),
  }

  if (message) {
    // Add progress log
    const { data: currentTask } = await supabase
      .from('tasks')
      .select('logs')
      .eq('id', taskId)
      .single()

    if (currentTask) {
      const logs = JSON.parse(currentTask.logs || '[]')
      logs.push(createInfoLog(message))
      updateData.logs = JSON.stringify(logs)
    }
  }

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  return !error
}

export async function addTaskLog(
  supabase: SupabaseClient,
  taskId: string,
  log: TaskLog
): Promise<boolean> {
  const { data: currentTask } = await supabase
    .from('tasks')
    .select('logs')
    .eq('id', taskId)
    .single()

  if (!currentTask) return false

  const logs = JSON.parse(currentTask.logs || '[]')
  logs.push(log)

  const { error } = await supabase
    .from('tasks')
    .update({
      logs: JSON.stringify(logs),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  return !error
}

export async function deleteTasksByStatus(
  supabase: SupabaseClient,
  statuses: Task['status'][]
): Promise<number> {
  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .in('status', statuses)
    .select()

  if (error) {
    console.error('Error deleting tasks:', error)
    return 0
  }

  return data?.length || 0
}

// Simple task logger for backward compatibility
export class TaskLogger {
  constructor(private supabase: SupabaseClient, private taskId: string) {}

  async info(message: string): Promise<void> {
    await addTaskLog(this.supabase, this.taskId, createInfoLog(message))
  }

  async error(message: string): Promise<void> {
    await addTaskLog(this.supabase, this.taskId, createErrorLog(message))
  }

  async success(message: string): Promise<void> {
    await addTaskLog(this.supabase, this.taskId, createSuccessLog(message))
  }

  async command(message: string): Promise<void> {
    await addTaskLog(this.supabase, this.taskId, createCommandLog(message))
  }

  async updateStatus(status: Task['status'], errorMessage?: string): Promise<void> {
    await updateTaskStatus(this.supabase, this.taskId, status, errorMessage)
  }

  async updateProgress(progress: number, message?: string): Promise<void> {
    await updateTaskProgress(this.supabase, this.taskId, progress, message)
  }
}

export function createTaskLogger(supabase: SupabaseClient, taskId: string): TaskLogger {
  return new TaskLogger(supabase, taskId)
}