import { Templates, templatesToPrompt } from '@/lib/templates'
import { AI_GENERATION_GUIDE } from '@/lib/ai-generation-guide'

export type PromptContext = {
  supabase?: {
    connected: boolean
    projectRef?: string
    source?: 'user' | 'environment' | 'oauth'
    projectsMode?: 'single' | 'per_project'
  }
}

export function toPrompt(template: Templates, context: PromptContext = {}) {
  const supabaseContext = context.supabase?.connected
    ? context.supabase.projectsMode === 'per_project'
      ? 'Supabase is connected by OAuth. Do not ask the user for a Supabase project ref. If the request needs database schema changes, include supabase_migrations[]; Magical will create or reuse a separate Supabase project for this Magical project and apply the migrations there.'
      : `Supabase is connected for project ref ${context.supabase.projectRef || 'unknown'} via ${context.supabase.source === 'environment' ? 'server environment variables' : 'the user integration'}. If the request needs database schema changes, include supabase_migrations[].`
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
