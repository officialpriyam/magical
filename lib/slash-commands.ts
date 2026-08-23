export interface SlashCommand {
  command: string
  description: string
  icon?: string
  category?: string
  agent?: string
  handler?: (args: string) => void
}

export const slashCommands: SlashCommand[] = [
  // ─── Agent Skills (auto-select based on prompt) ──────────────
  {
    command: '/generate',
    description: 'Auto-select best agents for your request',
    icon: '✨',
    category: 'Agent',
    agent: 'auto'
  },
  {
    command: '/plan',
    description: 'Planner agent — analyze and plan the implementation',
    icon: '📋',
    category: 'Agent',
    agent: 'planner'
  },
  {
    command: '/build',
    description: 'Full build — architect + frontend + backend agents',
    icon: '🏗️',
    category: 'Agent',
    agent: 'build'
  },
  {
    command: '/frontend',
    description: 'Frontend agent — generate React/UI components',
    icon: '🎨',
    category: 'Agent',
    agent: 'frontend'
  },
  {
    command: '/backend',
    description: 'Backend agent — generate API routes and database',
    icon: '⚙️',
    category: 'Agent',
    agent: 'backend'
  },
  {
    command: '/review',
    description: 'Reviewer agent — analyze code quality and security',
    icon: '🔍',
    category: 'Agent',
    agent: 'reviewer'
  },
  {
    command: '/optimize',
    description: 'Optimizer agent — improve performance and UX',
    icon: '⚡',
    category: 'Agent',
    agent: 'optimizer'
  },
  {
    command: '/fix',
    description: 'Fixer agent — fix errors and bugs',
    icon: '🔧',
    category: 'Agent',
    agent: 'fixer'
  },
  {
    command: '/search',
    description: 'Search the web for up-to-date information',
    icon: '🌐',
    category: 'Agent',
    agent: 'search'
  },
  {
    command: '/think',
    description: 'Deep thinking — analyze before building',
    icon: '🧠',
    category: 'Agent',
    agent: 'think'
  },
  // ─── Skills (from skills.sh) ─────────────────────────────────
  {
    command: '/design',
    description: 'Frontend design skill — distinctive, intentional visual design',
    icon: '🎨',
    category: 'Skills',
    agent: 'frontend'
  },
  {
    command: '/uiux',
    description: 'UI/UX Pro Max — advanced interface patterns',
    icon: '📐',
    category: 'Skills',
    agent: 'frontend'
  },
  {
    command: '/brainstorm',
    description: 'Brainstorming — validate ideas before building',
    icon: '💡',
    category: 'Skills',
    agent: 'planner'
  },
  {
    command: '/browser',
    description: 'Browser automation — navigate, scrape, interact',
    icon: '🌐',
    category: 'Skills',
    agent: 'search'
  },
  {
    command: '/docs',
    description: 'Reference docs and API specs while building',
    icon: '📚',
    category: 'Skills',
    agent: 'frontend'
  },
  {
    command: '/debug',
    description: 'Systematic debugging — hypothesis-driven fixes',
    icon: '🐛',
    category: 'Skills',
    agent: 'fixer'
  },
  {
    command: '/composition',
    description: 'React composition patterns — flexible component architecture',
    icon: '🧩',
    category: 'Skills',
    agent: 'frontend'
  },
  {
    command: '/guidelines',
    description: 'Web design guidelines — Vercel standards',
    icon: '📏',
    category: 'Skills',
    agent: 'frontend'
  },
  {
    command: '/mobile',
    description: 'Mobile-first responsive design',
    icon: '📱',
    category: 'Skills',
    agent: 'frontend'
  },
  {
    command: '/supabase',
    description: 'Supabase/PostgreSQL best practices',
    icon: '🗄️',
    category: 'Skills',
    agent: 'backend'
  },
  // ─── Code Actions ────────────────────────────────────────────
  {
    command: '/edit',
    description: 'Edit the current code or file',
    icon: '✏️',
    category: 'Code'
  },
  {
    command: '/explain',
    description: 'Explain the selected code',
    icon: '💡',
    category: 'Code'
  },
  {
    command: '/refactor',
    description: 'Refactor the selected code',
    icon: '♻️',
    category: 'Code'
  },
  {
    command: '/test',
    description: 'Generate tests for the code',
    icon: '🧪',
    category: 'Testing'
  },
  {
    command: '/document',
    description: 'Generate documentation',
    icon: '📝',
    category: 'Docs'
  },
  {
    command: '/help',
    description: 'Show available commands',
    icon: '❓',
    category: 'System'
  }
]

export function getMatchingCommands(input: string): SlashCommand[] {
  if (!input.startsWith('/')) return []

  const query = input.toLowerCase()
  return slashCommands.filter(cmd =>
    cmd.command.toLowerCase().startsWith(query)
  )
}

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/')
}

export function extractCommand(input: string): { command: string; args: string } | null {
  if (!input.startsWith('/')) return null

  const parts = input.trim().split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1).join(' ')

  return { command, args }
}

// ─── Auto-detect agent skill from prompt content ───────────────
export function detectAgentFromPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase()

  // Fix errors / bugs
  if (/\b(fix|bug|error|broken|issue|crash|debug|not work|doesn't work)\b/i.test(lower)) {
    return 'fixer'
  }

  // Search for information
  if (/\b(search|find|look up|what is|who is|latest|news|current|google)\b/i.test(lower)) {
    return 'search'
  }

  // Review / analyze
  if (/\b(review|analyze|check|audit|security|vulnerability|lint)\b/i.test(lower)) {
    return 'reviewer'
  }

  // Optimize
  if (/\b(optimize|performance|faster|speed|bundle|lazy|cache|improve)\b/i.test(lower)) {
    return 'optimizer'
  }

  // Frontend specific
  if (/\b(ui|ux|component|button|form|layout|page|landing|hero|navbar|sidebar|design|css|style|tailwind|responsive|animation)\b/i.test(lower)) {
    return 'frontend'
  }

  // Backend specific
  if (/\b(api|endpoint|database|sql|auth|database|server|route|middleware|supabase|postgres)\b/i.test(lower)) {
    return 'backend'
  }

  // Planning
  if (/\b(plan|architect|design|structure|organize|outline|roadmap)\b/i.test(lower)) {
    return 'planner'
  }

  // Full build (default for new projects)
  if (/\b(build|create|make|generate|app|website|project|landing page|dashboard|saas)\b/i.test(lower)) {
    return 'build'
  }

  return null
}
