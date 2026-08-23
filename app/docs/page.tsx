'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, Search, BookOpen, Zap, Code, Palette, Smartphone, Database, Globe, Settings, Rocket } from 'lucide-react'

const DOCS_SECTIONS = [
  {
    title: 'Getting Started',
    icon: Zap,
    items: [
      { title: 'Introduction', slug: 'introduction', description: 'What is Magical AI and how it works' },
      { title: 'Quick Start', slug: 'quickstart', description: 'Build your first app in 60 seconds' },
      { title: 'Account Setup', slug: 'account', description: 'Sign up and configure your account' },
      { title: 'Templates', slug: 'templates', description: 'Available project templates and stacks' },
    ],
  },
  {
    title: 'Building',
    icon: Code,
    items: [
      { title: 'Writing Good Prompts', slug: 'prompts', description: 'How to get the best results from AI' },
      { title: 'Plan Mode vs Build Mode', slug: 'modes', description: 'When to plan and when to build directly' },
      { title: 'Agent Skills', slug: 'skills', description: 'Using slash commands and agent skills' },
      { title: 'Web Search', slug: 'web-search', description: 'How AI uses web search while building' },
      { title: 'Style Themes', slug: 'styles', description: 'Customizing your app\'s design' },
    ],
  },
  {
    title: 'Code & Preview',
    icon: Palette,
    items: [
      { title: 'Built-in IDE', slug: 'ide', description: 'Editing code in the built-in editor' },
      { title: 'Live Preview', slug: 'preview', description: 'How the preview sandbox works' },
      { title: 'File Operations', slug: 'files', description: 'Reading, writing, and managing files' },
      { title: 'Viewport Toggle', slug: 'viewport', description: 'Testing on desktop, tablet, and mobile' },
    ],
  },
  {
    title: 'Integrations',
    icon: Database,
    items: [
      { title: 'Supabase', slug: 'supabase', description: 'Database, auth, and storage integration' },
      { title: 'Sandbox Providers', slug: 'sandboxes', description: 'E2B, Vercel, Modal, Daytona' },
      { title: 'GitHub', slug: 'github', description: 'Connecting and pushing to GitHub repos' },
      { title: 'AI Providers', slug: 'providers', description: 'Supported AI models and configuration' },
    ],
  },
  {
    title: 'Mobile',
    icon: Smartphone,
    items: [
      { title: 'Mobile App Generation', slug: 'mobile', description: 'Building mobile apps with Expo' },
      { title: 'Progressive Web Apps', slug: 'pwa', description: 'Creating installable PWAs' },
    ],
  },
  {
    title: 'Advanced',
    icon: Settings,
    items: [
      { title: 'Message Queue', slug: 'queue', description: 'Sending follow-up prompts while AI works' },
      { title: 'Community Gallery', slug: 'community', description: 'Sharing and discovering public projects' },
      { title: 'Environment Variables', slug: 'env', description: 'Configuring API keys and settings' },
      { title: 'Self-Hosting', slug: 'self-host', description: 'Running Magical AI on your own server' },
    ],
  },
]

const DOC_CONTENT: Record<string, { title: string; content: string }> = {
  introduction: {
    title: 'Introduction',
    content: `Magical AI is an AI-powered application builder that turns natural language prompts into full-stack web applications. Describe what you want to build, and Magical AI's multi-agent pipeline will plan, architect, and generate your app with live preview.\n\n## How It Works\n\n1. **You describe** what you want to build in plain English\n2. **The AI plans** the approach and asks clarifying questions\n3. **Agents build** the frontend, backend, and styling\n4. **You preview** the result in real-time\n5. **You iterate** by sending follow-up prompts\n\n## Key Features\n\n- Multi-agent AI pipeline (Planner, Architect, Frontend, Backend, Reviewer)\n- Live preview sandbox with instant deployment\n- Built-in code editor with syntax highlighting\n- Web search integration for up-to-date information\n- 9+ project templates (Next.js, React, Vue, Svelte, Python, Mobile)\n- Community gallery for sharing and discovering projects`,
  },
  quickstart: {
    title: 'Quick Start',
    content: `## Build Your First App in 60 Seconds\n\n### Step 1: Sign Up\nClick "Start for Free" and create an account using Google, GitHub, or email.\n\n### Step 2: Choose a Template\nSelect a template from the persona dropdown, or leave it on "Auto" to let the AI choose.\n\n### Step 3: Write a Prompt\nDescribe what you want to build. Be specific about:\n- What the app does\n- Who it's for\n- Any specific features\n\nExample prompts:\n- "A modern SaaS landing page for a project management tool with pricing section"\n- "A Spotify clone with playlist management and music player UI"\n- "A portfolio website for a photographer with gallery and contact form"\n\n### Step 4: Watch It Build\nThe AI will plan, architect, and generate your app. You'll see:\n- Thinking steps as the AI reasons through the design\n- File writes as code is generated\n- Live preview as the sandbox deploys\n\n### Step 5: Iterate\nSend follow-up prompts to refine your app:\n- "Change the hero section to have a gradient background"\n- "Add a contact form with validation"\n- "Make it responsive for mobile"`,
  },
  prompts: {
    title: 'Writing Good Prompts',
    content: `## Tips for Great Prompts\n\n### Be Specific\n❌ "Build a website"\n✅ "Build a modern SaaS landing page for a project management tool with hero section, features grid, pricing table, and contact form. Use a blue color scheme with Inter font."\n\n### Mention the Stack\n✅ "Build a Next.js app with TypeScript, Tailwind CSS, and Shadcn UI components"\n✅ "Create a Vue 3 app with Nuxt and dark mode support"\n\n### Describe the Layout\n✅ "A dashboard with a sidebar navigation, top bar with search, and a main content area with card grid"\n\n### Reference Existing Designs\n✅ "Clone the Stripe pricing page layout with our brand colors"\n✅ "Build something like Notion's clean, minimal interface"\n\n### Use Web Search\nToggle the Search button (🌐) to have the AI research real-world examples and best practices while building.`,
  },
  ide: {
    title: 'Built-in IDE',
    content: `## Code Editor\n\nThe built-in IDE lets you edit generated code directly in the browser.\n\n### Features\n- **File Tree:** Browse and navigate all generated files\n- **Syntax Highlighting:** Full syntax highlighting for all supported languages\n- **Inline Editing:** Click any file to open and edit it\n- **Save & Redeploy:** Save changes and instantly redeploy the preview\n\n### How to Use\n1. Click the IDE button in the top-right corner\n2. Browse the file tree on the left\n3. Click a file to open it in the editor\n4. Make your changes\n5. Click Save (or Ctrl+S) to persist changes\n\n### File Persistence\nFiles are saved to sandbox storage. When you reopen a project, your changes are restored automatically.`,
  },
  supabase: {
    title: 'Supabase Integration',
    content: `## Connecting Supabase\n\nMagical AI integrates with Supabase for database, authentication, and file storage.\n\n### Setup\n1. Create a Supabase project at supabase.com\n2. Get your Project URL and Anon Key\n3. Add them to your environment variables\n4. The AI will automatically use Supabase when generating full-stack apps\n\n### What Supabase Enables\n- **Database:** PostgreSQL tables with real-time subscriptions\n- **Auth:** User registration, login, and session management\n- **Storage:** File uploads and image hosting\n- **Edge Functions:** Server-side logic\n\n### Database Tab\nWhen your project is connected to Supabase, you can manage tables, auth providers, and storage directly from the Database tab in the IDE panel.`,
  },
  mobile: {
    title: 'Mobile App Generation',
    content: `## Building Mobile Apps\n\nMagical AI can generate mobile apps using React Native with Expo.\n\n### How to Create a Mobile App\n1. Toggle the Mobile button (📱) in the prompt box\n2. Describe your mobile app\n3. The AI generates a complete Expo app with:\n   - Navigation (expo-router)\n   - Native components (View, Text, ScrollView)\n   - StyleSheet for styling\n   - SafeAreaView for notch handling\n\n### Mobile Preview\nMobile apps render inside a phone frame preview in the IDE panel, showing exactly how they'll look on a real device.\n\n### Expo Go\nYou can test your generated app on your phone using Expo Go — just scan the QR code from the dev server.`,
  },
  sandboxes: {
    title: 'Sandbox Providers',
    content: `## Sandbox Providers\n\nSandboxes are where your generated code runs. Magical AI supports multiple providers.\n\n### Available Providers\n\n| Provider | Speed | Free Tier | Setup |\n|----------|-------|-----------|-------|\n| E2B | Fast | 100 hours/month | E2B_API_KEY |\n| Vercel | Fast | Generous | VERCEL_TOKEN |\n| Modal | Medium | $30 credits | MODAL_TOKEN_ID + SECRET |\n| Daytona | Medium | Limited | DAYTONA_API_KEY |\n\n### Auto Mode\nWhen set to "AI choose" (default), Magical AI randomly selects from configured providers for each sandbox. This provides redundancy — if one provider is down, others are used.\n\n### Configuration\nAdd at least one sandbox provider API key to your .env.local:\n\n\`\`\`\nE2B_API_KEY=your_key_here\n\`\`\``,
  },
}

export default function DocsPage() {
  const [activeSlug, setActiveSlug] = useState('introduction')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>('Getting Started')

  const activeDoc = DOC_CONTENT[activeSlug]

  const filteredSections = DOCS_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(section => section.items.length > 0)

  return (
    <div className="min-h-screen bg-[#0a0b0a]">
      <header className="border-b border-white/[0.06] bg-[#0a0b0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/icon.png" alt="" className="h-7 w-7" />
            <span className="text-lg font-bold text-white">Magical AI</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/docs" className="text-sm text-white font-medium">Docs</Link>
            <Link href="/community" className="text-sm text-white/50 hover:text-white transition">Community</Link>
            <Link href="/projects" className="text-sm text-white/50 hover:text-white transition">Templates</Link>
            <Link href="/auth/login" className="text-sm text-white/60 hover:text-white transition">Sign In</Link>
          </nav>
        </div>
      </header>

      <div className="flex mx-auto max-w-7xl">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-white/[0.06] p-4 h-[calc(100vh-56px)] sticky top-14 overflow-y-auto">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
            />
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {filteredSections.map(section => {
              const Icon = section.icon
              const isExpanded = expandedSection === section.title
              return (
                <div key={section.title}>
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.title)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.04]"
                  >
                    <Icon className="h-3.5 w-3.5 text-white/40" />
                    <span className="flex-1 text-left">{section.title}</span>
                    <ChevronRight className={`h-3 w-3 text-white/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5 mt-0.5">
                      {section.items.map(item => (
                        <button
                          key={item.slug}
                          onClick={() => setActiveSlug(item.slug)}
                          className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition ${
                            activeSlug === item.slug
                              ? 'bg-white/[0.08] text-white'
                              : 'text-white/45 hover:text-white/70 hover:bg-white/[0.03]'
                          }`}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 max-w-3xl">
          {activeDoc ? (
            <div>
              <h1 className="text-2xl font-bold text-white mb-4">{activeDoc.title}</h1>
              <div className="prose prose-invert prose-sm max-w-none">
                {activeDoc.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-white mt-8 mb-3">{line.slice(3)}</h2>
                  if (line.startsWith('### ')) return <h3 key={i} className="text-base font-medium text-white mt-6 mb-2">{line.slice(4)}</h3>
                  if (line.startsWith('✅')) return <p key={i} className="text-emerald-400/80 text-sm ml-4">{line}</p>
                  if (line.startsWith('❌')) return <p key={i} className="text-red-400/80 text-sm ml-4">{line}</p>
                  if (line.startsWith('- ')) return <li key={i} className="text-white/60 text-sm ml-4 list-disc">{line.slice(2)}</li>
                  if (line.startsWith('|')) {
                    const cells = line.split('|').filter(c => c.trim()).map(c => c.trim())
                    if (cells.every(c => c.match(/^[-:]+$/))) return null
                    return (
                      <div key={i} className="flex gap-4 text-xs text-white/50 border-b border-white/[0.04] py-1.5">
                        {cells.map((cell, j) => <span key={j} className="flex-1">{cell}</span>)}
                      </div>
                    )
                  }
                  if (line.startsWith('```')) return <pre key={i} className="bg-white/[0.04] rounded-lg p-3 text-xs text-white/70 font-mono overflow-x-auto my-2"><code>{line.slice(3)}</code></pre>
                  if (line.trim() === '') return <div key={i} className="h-2" />
                  return <p key={i} className="text-sm text-white/60 leading-relaxed mb-2">{line}</p>
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen className="h-12 w-12 text-white/15 mb-4" />
              <p className="text-sm text-white/40">Select a topic from the sidebar to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
