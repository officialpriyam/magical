import { Templates, templatesToPrompt } from '@/lib/templates'
import { AI_GENERATION_GUIDE } from '@/lib/ai-generation-guide'

export type PromptContext = {
  supabase?: {
    connected: boolean
    projectRef?: string
  }
}

export function toPrompt(template: Templates, context: PromptContext = {}) {
  const supabaseContext = context.supabase?.connected
    ? `Supabase is connected for project ref ${context.supabase.projectRef || 'unknown'}. If the request needs database schema changes, include supabase_migrations[].`
    : 'Supabase is not connected. If the request needs a database, explain that Supabase should be connected or use local/mock data until connected.'

  return `
    You are a skilled software engineer.
    You do not make mistakes.
    Generate a runnable fragment.
    You can install additional dependencies.
    Do not touch project dependencies files like package.json, package-lock.json, requirements.txt, etc.
    Do not wrap code in backticks.
    Always break the lines correctly.
    ${AI_GENERATION_GUIDE}
    Supabase context: ${supabaseContext}
    You can use one of the following templates:
    ${templatesToPrompt(template)}
  `
}
