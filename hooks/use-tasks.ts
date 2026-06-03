'use client'

import { useState, useEffect } from 'react'
import { Task } from '@/lib/tasks'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
        setError(null)
      } else {
        setError('Failed to fetch tasks')
      }
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setError('Failed to fetch tasks')
    } finally {
      setIsLoading(false)
    }
  }

  // Create a new task
  const createTask = async (taskData: {
    prompt: string
    repoUrl?: string
    selectedAgent?: string
    selectedModel?: string
  }) => {
    try {
      setError(null)
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      })

      if (response.ok) {
        const data = await response.json()
        setTasks(prev => [data.task, ...prev])
        return data.task
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create task')
        return null
      }
    } catch (err) {
      console.error('Error creating task:', err)
      setError('Failed to create task')
      return null
    }
  }

  // Delete tasks by status
  const deleteTasks = async (actions: string[]) => {
    try {
      setError(null)
      const response = await fetch(`/api/tasks?action=${actions.join(',')}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh the tasks list
        await fetchTasks()
        const data = await response.json()
        return data
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete tasks')
        return null
      }
    } catch (err) {
      console.error('Error deleting tasks:', err)
      setError('Failed to delete tasks')
      return null
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchTasks()
  }, [])

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    createTask,
    deleteTasks
  }
}