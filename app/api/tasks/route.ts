import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  Task,
  CreateTaskData,
  createTask,
  getAllTasks,
  deleteTasksByStatus,
  createTaskLogger,
} from '@/lib/tasks'

export const maxDuration = 300 // 5 minutes timeout
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const tasks = await getAllTasks(supabase)
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()

    // Get user from Supabase auth
    const { data: { user } } = await supabase.auth.getUser()

    const taskData: CreateTaskData = {
      prompt: body.prompt,
      repo_url: body.repoUrl,
      selected_agent: body.selectedAgent || 'claude',
      selected_model: body.selectedModel,
      user_id: user?.id,
    }

    // Validate required fields
    if (!taskData.prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const newTask = await createTask(supabase, taskData)

    if (!newTask) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // Process the task asynchronously with timeout
    processTaskWithTimeout(newTask.id, taskData)

    return NextResponse.json({ task: newTask })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

async function processTaskWithTimeout(taskId: string, taskData: CreateTaskData) {
  const TASK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes in milliseconds

  // Add a warning at 4 minutes
  const warningTimeout = setTimeout(async () => {
    try {
      const supabase = await createServerClient()
      const logger = createTaskLogger(supabase, taskId)
      await logger.info('Task is taking longer than expected (4+ minutes). Will timeout in 1 minute.')
    } catch (error) {
      console.error('Failed to add timeout warning:', error)
    }
  }, 4 * 60 * 1000) // 4 minutes

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Task execution timed out after 5 minutes'))
    }, TASK_TIMEOUT_MS)
  })

  try {
    await Promise.race([
      processTask(taskId, taskData),
      timeoutPromise
    ])

    // Clear the warning timeout if task completes successfully
    clearTimeout(warningTimeout)
  } catch (error: any) {
    // Clear the warning timeout on any error
    clearTimeout(warningTimeout)

    // Handle timeout specifically
    if (error.message?.includes('timed out after 5 minutes')) {
      console.error('Task timed out:', taskId)

      const supabase = await createServerClient()
      const logger = createTaskLogger(supabase, taskId)
      await logger.error('Task execution timed out after 5 minutes')
      await logger.updateStatus('error', 'Task execution timed out after 5 minutes. The operation took too long to complete.')
    } else {
      // Re-throw other errors to be handled by the original error handler
      throw error
    }
  }
}

async function processTask(taskId: string, taskData: CreateTaskData) {
  const supabase = await createServerClient()
  const logger = createTaskLogger(supabase, taskId)

  try {
    // Update task status to processing with real-time logging
    await logger.updateStatus('processing', 'Task created, preparing to start...')
    await logger.updateProgress(10, 'Initializing task execution...')

    // Simulate task processing (replace with actual implementation)
    await logger.updateProgress(25, 'Setting up environment...')

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 2000))

    await logger.updateProgress(50, 'Processing request...')

    // For now, we'll simulate the task completion
    // In a real implementation, you would:
    // 1. Create sandbox environment
    // 2. Execute the selected agent
    // 3. Process the results
    // 4. Handle git operations

    await logger.success('Task processing completed successfully')

    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, 1000))

    await logger.updateProgress(75, 'Finalizing results...')

    // Simulate final steps
    await new Promise(resolve => setTimeout(resolve, 1000))

    await logger.updateProgress(100, 'Task completed successfully')
    await logger.updateStatus('completed')

    await logger.success(`Task completed: ${taskData.prompt}`)

  } catch (error) {
    console.error('Error processing task:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    await logger.error(`Error: ${errorMessage}`)
    await logger.updateStatus('error', errorMessage)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (!action) {
      return NextResponse.json({ error: 'Action parameter is required' }, { status: 400 })
    }

    const actions = action.split(',').map((a) => a.trim())
    const validActions = ['completed', 'failed']
    const invalidActions = actions.filter((a) => !validActions.includes(a))

    if (invalidActions.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid action(s): ${invalidActions.join(', ')}. Valid actions: ${validActions.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Map actions to task statuses
    const statusesToDelete: Task['status'][] = []
    if (actions.includes('completed')) {
      statusesToDelete.push('completed')
    }
    if (actions.includes('failed')) {
      statusesToDelete.push('error')
    }

    if (statusesToDelete.length === 0) {
      return NextResponse.json({ error: 'No valid actions specified' }, { status: 400 })
    }

    // Delete tasks based on statuses
    const deletedCount = await deleteTasksByStatus(supabase, statusesToDelete)

    // Build response message
    const actionMessages = []
    if (actions.includes('completed')) {
      actionMessages.push('completed')
    }
    if (actions.includes('failed')) {
      actionMessages.push('failed')
    }

    const message = deletedCount > 0
      ? `${deletedCount} ${actionMessages.join(' and ')} task(s) deleted successfully`
      : 'No tasks found to delete'

    return NextResponse.json({
      message,
      deletedCount,
    })
  } catch (error) {
    console.error('Error deleting tasks:', error)
    return NextResponse.json({ error: 'Failed to delete tasks' }, { status: 500 })
  }
}
