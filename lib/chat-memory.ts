/**
 * Chat memory utilities for:
 * - Detecting resume requests
 * - Injecting previous conversation context
 * - Building context summaries from prior fragments
 */

import type { ModelMessage } from 'ai'

/**
 * Detect if the user wants to resume a previous task
 */
export function detectResumeRequest(
  messages: ModelMessage[],
): { isResume: boolean; originalPrompt?: string } {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) return { isResume: false }

  const text = typeof lastUserMessage.content === 'string'
    ? lastUserMessage.content
    : Array.isArray(lastUserMessage.content)
      ? lastUserMessage.content.map(p => (p as any).text || '').join(' ')
      : ''

  const lower = text.toLowerCase().trim()

  // Detect resume patterns
  const resumePatterns = [
    /^(resume|continue|go on|carry on|keep going|keep building|finish|complete)\b/i,
    /^(resume|continue)\s+(the|this|that|my|your)\s+(task|work|project|build|app|page|feature)/i,
    /^(where|how)\s+(did|were)\s+(we|you)\s+(leave|stop|end)/i,
    /\bresume\b/i,
    /\bcontinue\b.*\b(?:task|work|project|build|app|page)\b/i,
    /\bfinish\b.*\b(?:the|this|that)\b/i,
    /\bcomplete\b.*\b(?:the|this|that)\b/i,
  ]

  const isResume = resumePatterns.some(p => p.test(lower))

  return {
    isResume,
    originalPrompt: isResume ? text : undefined,
  }
}

/**
 * Build context summary from previous conversation messages
 * Used to give the AI memory of what was discussed before
 */
export function buildConversationContext(
  messages: ModelMessage[],
  maxMessages: number = 20,
): string {
  // Get the most recent messages (excluding the last user message which is the current request)
  const priorMessages = messages.slice(0, -1).slice(-maxMessages)

  if (priorMessages.length === 0) return ''

  const contextParts: string[] = []

  for (const msg of priorMessages) {
    const text = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(p => (p as any).text || '').join(' ')
        : ''

    if (!text.trim()) continue

    // Skip very short messages and injection metadata
    if (text.length < 10) continue

    const role = msg.role === 'user' ? 'User' : 'Assistant'
    const cleaned = text
      .replace(/\[Agent:\s*\w+\]\s*/gi, '')
      .replace(/\[Style:\s*[^\]]*\][\s\S]*$/g, '')
      .replace(/\[Custom Style\][\s\S]*$/g, '')
      .replace(/\[Search:\s*[^\]]*\]\s*/g, '')
      .replace(/\[Think:\s*[^\]]*\]\s*/g, '')
      .replace(/\[Canvas:\s*[^\]]*\]\s*/g, '')
      .trim()

    // Truncate long messages
    const truncated = cleaned.length > 500 ? cleaned.slice(0, 497) + '...' : cleaned
    if (truncated.length > 10) {
      contextParts.push(`${role}: ${truncated}`)
    }
  }

  if (contextParts.length === 0) return ''

  return `Previous conversation context:\n${contextParts.join('\n\n')}`
}

/**
 * Build a context message for resume requests that includes the previous state
 */
export function buildResumeContext(
  previousFragment: Record<string, any> | null,
  previousMessages: ModelMessage[],
  originalPrompt?: string,
): string {
  const parts: string[] = []

  if (originalPrompt) {
    parts.push(`The user originally asked: "${originalPrompt}"`)
  }

  parts.push('The user wants to resume/continue the previous task.')

  if (previousFragment) {
    const fragmentSummary: string[] = []

    if (previousFragment.title) {
      fragmentSummary.push(`Project title: ${previousFragment.title}`)
    }

    if (previousFragment.description) {
      fragmentSummary.push(`Description: ${previousFragment.description}`)
    }

    if (previousFragment.template) {
      fragmentSummary.push(`Template: ${previousFragment.template}`)
    }

    if (Array.isArray(previousFragment.files)) {
      const filePaths = previousFragment.files
        .filter((f: any) => f?.path)
        .map((f: any) => f.path)
      if (filePaths.length > 0) {
        fragmentSummary.push(`Existing files (${filePaths.length}):\n${filePaths.map((p: string) => `  - ${p}`).join('\n')}`)
      }
    }

    if (previousFragment.code) {
      const codePreview = previousFragment.code.length > 300
        ? previousFragment.code.slice(0, 300) + '...'
        : previousFragment.code
      fragmentSummary.push(`Main code preview:\n\`\`\`\n${codePreview}\n\`\`\``)
    }

    if (previousFragment.additional_dependencies?.length) {
      fragmentSummary.push(`Dependencies: ${previousFragment.additional_dependencies.join(', ')}`)
    }

    if (previousFragment.install_dependencies_command) {
      fragmentSummary.push(`Install command: ${previousFragment.install_dependencies_command}`)
    }

    if (previousFragment.agent_metadata) {
      const meta = previousFragment.agent_metadata
      const agentsUsed = Array.isArray(meta.agents_used) ? meta.agents_used.join(', ') : 'unknown'
      fragmentSummary.push(`Previously used agents: ${agentsUsed}`)
      if (meta.total_duration) {
        fragmentSummary.push(`Previous generation time: ${(meta.total_duration / 1000).toFixed(1)}s`)
      }
    }

    if (previousFragment.commentary) {
      const commentary = previousFragment.commentary.length > 400
        ? previousFragment.commentary.slice(0, 397) + '...'
        : previousFragment.commentary
      fragmentSummary.push(`Previous commentary:\n${commentary}`)
    }

    parts.push(`Previous project state:\n${fragmentSummary.join('\n')}`)
  }

  // Include conversation history context
  const conversationContext = buildConversationContext(previousMessages, 10)
  if (conversationContext) {
    parts.push(conversationContext)
  }

  parts.push('Continue building from where it was left off. Do NOT start from scratch — build upon the existing work. If files were already created, modify or extend them rather than recreating them.')

  return parts.join('\n\n')
}
