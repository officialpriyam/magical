/**
 * Skills registry — curated skills from skills.sh that enhance agent capabilities.
 * Each skill has a name, description, source URL, and auto-detect keywords.
 * Skills are injected into the agent system prompt when matched.
 */

export interface Skill {
  id: string
  name: string
  description: string
  source: string // skills.sh URL
  category: 'design' | 'development' | 'research' | 'workflow' | 'quality'
  /** Keywords that trigger auto-detection when found in the user prompt */
  autoDetectKeywords: string[]
  /** The actual skill prompt/instructions to inject into the agent */
  prompt: string
  /** Whether this skill should auto-apply by default */
  autoApply: boolean
  /** Slash command trigger (e.g. /design, /research) */
  slashCommand?: string
  /** Icon component name from lucide-react */
  icon?: string
}

export const SKILLS_REGISTRY: Skill[] = [
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    description: 'Distinctive, production-grade frontend interfaces with intentional design choices',
    source: 'https://www.skills.sh/anthropics/skills/frontend-design',
    category: 'design',
    autoDetectKeywords: ['landing page', 'frontend', 'ui', 'design', 'website', 'web page', 'react component', 'css', 'styling', 'visual', 'modern', 'beautiful', 'aesthetic'],
    autoApply: true,
    slashCommand: '/design',
    icon: 'Palette',
    prompt: `FRONTEND DESIGN SKILL — Approach as a design lead known for distinctive visual identity.
- Make deliberate, opinionated choices about palette, typography, and layout
- Typography carries the personality: pair display and body faces deliberately
- The hero is a thesis — open with the most characteristic thing in the subject's world
- Leverage motion deliberately: page-load sequences, scroll reveals, hover micro-interactions
- Match complexity to the vision: maximalist directions need elaborate execution
- Avoid overused fonts, clichéd color schemes, and predictable layouts
- Generate COMPLETE, RUNNABLE code — never placeholder or "Hello World" content
- Use CSS variables for theming, proper responsive design, and semantic HTML`,
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming',
    description: 'Structured design dialogue that validates ideas before implementation',
    source: 'https://www.skills.sh/obra/superpowers/brainstorming',
    category: 'workflow',
    autoDetectKeywords: ['brainstorm', 'ideas', 'explore', 'what if', 'should i', 'thinking about', 'consider', 'plan first'],
    autoApply: false,
    slashCommand: '/brainstorm',
    icon: 'Lightbulb',
    prompt: `BRAINSTORMING SKILL — Validate ideas before implementation.
- Classify how much process the request needs
- Understand context, refine the idea, present a design, get approval
- No code or implementation until design is presented and approved
- Work through: context exploration → clarifying questions → approach proposals → design presentation → spec documentation → user sign-off
- Even simple tasks require a brief design review to catch unexamined assumptions`,
  },
  {
    id: 'agent-browser',
    name: 'Agent Browser',
    description: 'Full browser automation: navigate, click, fill forms, extract data, screenshot',
    source: 'https://www.skills.sh/vercel-labs/agent-browser/agent-browser',
    category: 'development',
    autoDetectKeywords: ['browser', 'screenshot', 'scrape', 'automate', 'navigate', 'web page', 'click', 'fill form', 'extract data'],
    autoApply: false,
    slashCommand: '/browser',
    icon: 'Globe',
    prompt: `AGENT BROWSER SKILL — Browser automation for web interaction.
- Use Playwright or Puppeteer for browser automation
- Navigate pages, click elements, fill forms, extract data
- Take screenshots for visual verification
- Handle dynamic content, SPAs, and authentication flows
- Extract structured data from web pages`,
  },
  {
    id: 'ui-ux-pro-max',
    name: 'UI/UX Pro Max',
    description: 'Advanced UI/UX patterns for complex interfaces and interaction design',
    source: 'https://www.skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max',
    category: 'design',
    autoDetectKeywords: ['dashboard', 'admin', 'complex ui', 'data table', 'form', 'modal', 'navigation', 'sidebar', 'settings page', 'saas'],
    autoApply: true,
    slashCommand: '/uiux',
    icon: 'Layout',
    prompt: `UI/UX PRO MAX SKILL — Advanced interface patterns for professional applications.
- Dashboard layouts with data density and readability
- Complex form patterns with validation and multi-step flows
- Data tables with sorting, filtering, pagination, and bulk actions
- Navigation patterns: sidebar, breadcrumbs, tabs, command palettes
- Modal and drawer patterns with proper focus management
- Settings and configuration page layouts
- Use shadcn/ui components where available, Tailwind CSS for styling
- Ensure proper accessibility (ARIA labels, keyboard navigation, focus traps)
- Responsive design that works on mobile, tablet, and desktop`,
  },
  {
    id: 'web-design-guidelines',
    name: 'Web Design Guidelines',
    description: "Vercel's Web Interface Guidelines for spacing, typography, interaction, and accessibility",
    source: 'https://www.skills.sh/vercel-labs/agent-skills',
    category: 'design',
    autoDetectKeywords: ['vercel', 'next.js', 'nextjs', 'tailwind', 'responsive', 'accessible', 'a11y', 'guidelines', 'best practice'],
    autoApply: true,
    slashCommand: '/guidelines',
    icon: 'BookOpen',
    prompt: `WEB DESIGN GUIDELINES — Follow Vercel's interface standards.
- Use consistent spacing: 4px base unit (1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128)
- Typography scale: use rem units, maintain consistent line heights
- Color system: use CSS custom properties, support dark/light themes
- Interactive elements: clear hover, focus, active, and disabled states
- Animations: purposeful, smooth, 150-300ms duration, ease-out for enters
- Responsive: mobile-first, test at 320px, 768px, 1024px, 1280px breakpoints
- Accessibility: semantic HTML, ARIA labels, keyboard navigation, sufficient contrast`,
  },
  {
    id: 'grill-with-docs',
    name: 'Grill with Docs',
    description: 'Reference documentation and API specs while building',
    source: 'https://www.skills.sh/mattpocock/skills/grill-with-docs',
    category: 'research',
    autoDetectKeywords: ['documentation', 'api', 'docs', 'reference', 'how to use', 'library docs', 'framework docs', 'read the docs'],
    autoApply: false,
    slashCommand: '/docs',
    icon: 'FileText',
    prompt: `GRILL WITH DOCS SKILL — Reference documentation while building.
- When using a library or framework, search for its latest documentation
- Check API references for correct function signatures and types
- Look for usage examples and best practices from official docs
- Verify version compatibility before using features
- Search for known issues or deprecations`,
  },
  {
    id: 'vercel-composition',
    name: 'React Composition Patterns',
    description: 'React composition patterns for flexible, scalable UI component architecture',
    source: 'https://www.skills.sh/vercel-labs/agent-skills',
    category: 'development',
    autoDetectKeywords: ['react', 'component', 'composition', 'props', 'children', 'compound', 'render prop', 'hoc', 'hook'],
    autoApply: true,
    slashCommand: '/composition',
    icon: 'Boxes',
    prompt: `REACT COMPOSITION PATTERNS — Build flexible, scalable component architecture.
- Use composition over inheritance: compose small components into larger ones
- Prefer render props or children-as-function for flexible APIs
- Use React.memo, useMemo, useCallback for performance optimization
- Implement proper error boundaries around component trees
- Use context sparingly — prefer prop drilling for 2-3 levels
- Create reusable hook patterns for shared stateful logic
- Separate container (logic) and presentational (UI) components when beneficial
- Use TypeScript generics for reusable component types`,
  },
  {
    id: 'systematic-debugging',
    name: 'Systematic Debugging',
    description: 'Hypothesis-driven debugging loop: observe, hypothesize, test, verify',
    source: 'https://www.skills.sh/obra/superpowers/systematic-debugging',
    category: 'quality',
    autoDetectKeywords: ['bug', 'error', 'broken', 'fix', 'debug', 'issue', 'problem', 'not working', 'failing', 'crash'],
    autoApply: true,
    slashCommand: '/debug',
    icon: 'Bug',
    prompt: `SYSTEMATIC DEBUGGING SKILL — Hypothesis-driven debugging.
- Observe the symptoms: what exactly happens vs what's expected
- Form hypotheses: what could cause this behavior?
- Test hypotheses one at a time with minimal experiments
- Verify the fix: ensure it doesn't introduce new issues
- Document the root cause and the fix applied
- Check for similar issues elsewhere in the codebase`,
  },
  {
    id: 'supabase-best-practices',
    name: 'Supabase Best Practices',
    description: 'Supabase/PostgreSQL patterns for database, auth, and real-time',
    source: 'https://www.skills.sh/supabase/agent-skills',
    category: 'development',
    autoDetectKeywords: ['supabase', 'database', 'postgres', 'sql', 'rls', 'row level security', 'auth', 'realtime', 'real-time'],
    autoApply: false,
    slashCommand: '/supabase',
    icon: 'Database',
    prompt: `SUPABASE BEST PRACTICES — Database, auth, and real-time patterns.
- Use Row Level Security (RLS) for all tables
- Create proper indexes for query performance
- Use Supabase client with typed responses
- Implement proper auth flows with session management
- Use real-time subscriptions for live data
- Follow migration patterns for schema changes
- Use Edge Functions for server-side logic when needed`,
  },
  {
    id: 'mobile-responsive',
    name: 'Mobile-First Responsive',
    description: 'Mobile-first responsive design with touch-friendly interactions',
    source: 'https://www.skills.sh/vercel-labs/agent-skills',
    category: 'design',
    autoDetectKeywords: ['mobile', 'responsive', 'phone', 'tablet', 'touch', 'swipe', 'pwa', 'progressive'],
    autoApply: true,
    slashCommand: '/mobile',
    icon: 'Smartphone',
    prompt: `MOBILE-FIRST RESPONSIVE DESIGN — Build for all screen sizes.
- Start with mobile layout, enhance for larger screens
- Use responsive breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Touch targets: minimum 44x44px for interactive elements
- Use relative units (rem, %, vw/vh) instead of fixed px
- Implement proper viewport meta tag
- Test with Chrome DevTools device toolbar
- Handle safe areas on notched phones
- Use CSS Grid/Flexbox for responsive layouts
- Optimize images with srcset and responsive sizes`,
  },
]

/**
 * Auto-detect which skills apply to a given prompt.
 * Returns skills whose keywords match the prompt content.
 */
export function detectSkillsFromPrompt(prompt: string): Skill[] {
  const lowerPrompt = prompt.toLowerCase()
  const matched: Skill[] = []

  for (const skill of SKILLS_REGISTRY) {
    if (!skill.autoApply) continue
    const hasMatch = skill.autoDetectKeywords.some(kw => lowerPrompt.includes(kw))
    if (hasMatch) {
      matched.push(skill)
    }
  }

  return matched
}

/**
 * Get a skill by its slash command trigger (e.g. '/design').
 */
export function getSkillByCommand(command: string): Skill | undefined {
  return SKILLS_REGISTRY.find(s => s.slashCommand === command.toLowerCase())
}

/**
 * Get a skill by its ID.
 */
export function getSkillById(id: string): Skill | undefined {
  return SKILLS_REGISTRY.find(s => s.id === id)
}

/**
 * Build a combined skill prompt from matched skills.
 */
export function buildSkillPrompt(skills: Skill[]): string {
  if (skills.length === 0) return ''
  return '\n\nAPPLIED SKILLS:\n' + skills.map(s => `\n[${s.name}]\n${s.prompt}`).join('\n')
}

/**
 * Get all available slash commands for skills.
 */
export function getSkillCommands(): { command: string; name: string; description: string; icon?: string }[] {
  return SKILLS_REGISTRY
    .filter(s => s.slashCommand)
    .map(s => ({
      command: s.slashCommand!,
      name: s.name,
      description: s.description,
      icon: s.icon,
    }))
}
