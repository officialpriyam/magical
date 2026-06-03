export interface SlashCommand {
  command: string
  description: string
  icon?: string
  category?: string
  handler?: (args: string) => void
}

export const slashCommands: SlashCommand[] = [
  {
    command: '/edit',
    description: 'Edit the current code or file',
    category: 'Code',
    icon: '✏️'
  },
  {
    command: '/fix',
    description: 'Fix errors or bugs in the code',
    category: 'Code',
    icon: '🔧'
  },
  {
    command: '/apply',
    description: 'Apply changes or suggestions',
    category: 'Code',
    icon: '✅'
  },
  {
    command: '/explain',
    description: 'Explain the selected code',
    category: 'Code',
    icon: '💡'
  },
  {
    command: '/refactor',
    description: 'Refactor the selected code',
    category: 'Code',
    icon: '♻️'
  },
  {
    command: '/optimize',
    description: 'Optimize code performance',
    category: 'Code',
    icon: '⚡'
  },
  {
    command: '/test',
    description: 'Generate tests for the code',
    category: 'Testing',
    icon: '🧪'
  },
  {
    command: '/document',
    description: 'Generate documentation',
    category: 'Documentation',
    icon: '📝'
  },
  {
    command: '/review',
    description: 'Review code for issues',
    category: 'Code',
    icon: '👀'
  },
  {
    command: '/help',
    description: 'Show available commands',
    category: 'System',
    icon: '❓'
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
