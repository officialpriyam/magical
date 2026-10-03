'use client'

import { AuthDialog } from '@/components/auth-dialog'
import { ViewType } from '@/components/auth'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
import { useAuth } from '@/lib/auth'
import type { LLMModel, LLMModelConfig } from '@/lib/models'
import type { SandboxProviderMode } from '@/lib/sandbox-provider'
import templates, { TemplateId } from '@/lib/templates'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  Blocks,
  Brain,
  Check,
  Code2,
  Cpu,
  GitBranch,
  Globe2,
  Layers,
  LayoutGrid,
  Menu,
  Monitor,
  Rocket,
  Smartphone,
  Sparkles,
  Terminal,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

const DEFAULT_MODEL_ID = 'auto'

type LandingTab = 'features' | 'how' | 'templates' | 'about'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Templates', href: '/templates' },
  { label: 'Community', href: '/community' },
  { label: 'Docs', href: '/docs' },
]

const FEATURE_TABS: { id: LandingTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'features', label: 'Features', icon: Sparkles },
  { id: 'how', label: 'How it works', icon: Layers },
  { id: 'templates', label: 'Templates', icon: LayoutGrid },
  { id: 'about', label: 'About', icon: Brain },
]

const FEATURES = [
  {
    icon: Brain,
    title: 'Multi-agent AI pipeline',
    body: 'Planner, architect, frontend, backend, reviewer and optimizer agents cooperate on every prompt — so the output is planned, not guessed.',
  },
  {
    icon: Monitor,
    title: 'Live preview in seconds',
    body: 'Your app boots in a real sandbox while it is being written. Watch it run, click through it, and iterate without leaving the chat.',
  },
  {
    icon: Code2,
    title: 'Built-in IDE',
    body: 'A full file tree, syntax highlighting, and inline editing on top of everything the AI generates. Nothing is locked away.',
  },
  {
    icon: Globe2,
    title: 'Web search built in',
    body: 'Magical AI fetches live data from the web when a build needs current facts, prices, or docs instead of stale training data.',
  },
  {
    icon: Terminal,
    title: 'Real code execution',
    body: 'Shell commands, package installs, and build steps run inside the sandbox — you get a working project, not a snippet.',
  },
  {
    icon: GitBranch,
    title: 'Save to GitHub',
    body: 'Connect a repository and every generated file syncs straight into your repo, ready for review and deployment.',
  },
]

const HOW_STEPS = [
  {
    step: '01',
    title: 'Describe it',
    body: 'Tell Magical AI what you want to build in plain language. Attach a reference image, pick a style, or let the agents choose.',
  },
  {
    step: '02',
    title: 'Plan mode asks first',
    body: 'In plan mode the AI asks the clarifying questions a senior engineer would ask, then waits for your answer before writing code.',
  },
  {
    step: '03',
    title: 'Agents build it',
    body: 'The pipeline plans, architects, writes frontend and backend code, reviews itself, and fixes runtime errors automatically.',
  },
  {
    step: '04',
    title: 'Preview, edit, ship',
    body: 'Inspect the live preview, edit any file in the IDE, then push the whole project to GitHub or keep it private.',
  },
]

const TEMPLATE_GROUPS = [
  { name: 'Next.js', detail: 'React · TypeScript · Tailwind', icon: Layers },
  { name: 'React + Vite', detail: 'SPA · fast refresh', icon: Zap },
  { name: 'Vue / Svelte', detail: 'Nuxt · SvelteKit-style', icon: Blocks },
  { name: 'HTML / CSS / JS', detail: 'No build step', icon: Code2 },
  { name: 'Python', detail: 'Streamlit · Gradio', icon: Cpu },
  { name: 'Mobile (Expo)', detail: 'React Native · PWA', icon: Smartphone },
]

const TECH_MARQUEE = [
  'Next.js',
  'React',
  'TypeScript',
  'Tailwind CSS',
  'Supabase',
  'Node.js',
  'Vue',
  'Svelte',
  'Python',
  'Streamlit',
  'Gradio',
  'Expo',
  'Vite',
  'Prisma',
]

const STATS = [
  { value: '9+', label: 'Project templates' },
  { value: '200+', label: 'Models via OpenRouter' },
  { value: '4', label: 'Sandbox providers' },
  { value: '0', label: 'Local setup required' },
]

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [isAuthDialogOpen, setAuthDialog] = useState(false)
  const [authView, setAuthView] = useState<ViewType>('sign_in')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LandingTab>('features')
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([])
  const [scrolled, setScrolled] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useLocalStorage<'auto' | TemplateId>(
    'selectedTemplate',
    'auto',
  )
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
    model: DEFAULT_MODEL_ID,
  })
  const [chatMode, setChatMode] = useLocalStorage<'plan' | 'build'>('chatMode', 'plan')
  const [sandboxProvider, setSandboxProvider] = useLocalStorage<SandboxProviderMode>(
    'sandboxProvider',
    'vercel',
  )

  const setAuthDialogCallback = useCallback((isOpen: boolean) => setAuthDialog(isOpen), [])
  const setAuthViewCallback = useCallback((view: ViewType) => setAuthView(view), [])
  const { session, loading: authLoading } = useAuth(setAuthDialogCallback, setAuthViewCallback)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadModels() {
      try {
        const response = await fetch('/api/models')
        if (!response.ok) return
        const data = await response.json()
        if (mounted && Array.isArray(data.models)) {
          setAvailableModels(data.models)
        }
      } catch {
        // The picker falls back to "Auto" when the model list is unavailable.
      }
    }

    void loadModels()
    return () => {
      mounted = false
    }
  }, [])

  const filteredModels = useMemo(
    () =>
      availableModels.filter((model: any) => {
        if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
          return model.providerId !== 'ollama'
        }
        return true
      }),
    [availableModels],
  )

  const handleLanguageModelChange = useCallback(
    (config: LLMModelConfig) => setLanguageModel({ ...languageModel, ...config }),
    [languageModel, setLanguageModel],
  )

  const openAuth = useCallback(
    (view: ViewType) => {
      setAuthView(view)
      setAuthDialog(true)
    },
    [],
  )

  const handleSend = useCallback(
    (message: string, _files?: File[], mode?: 'plan' | 'build') => {
      const trimmed = message.trim()
      if (!trimmed) return

      if (!session) {
        openAuth('sign_up')
        return
      }

      try {
        sessionStorage.setItem('landingPagePrompt', trimmed)
        sessionStorage.setItem('landingPagePromptMode', mode || chatMode)
      } catch {
        // sessionStorage may be unavailable in strict privacy modes.
      }
      router.push('/web')
    },
    [chatMode, openAuth, router, session],
  )

  const displayName =
    session?.user.user_metadata?.name ||
    session?.user.user_metadata?.full_name ||
    session?.user.email?.split('@')[0] ||
    ''

  const promptInput = (
    <PromptInputBox
      onSend={handleSend}
      isLoading={false}
      chatMode={chatMode}
      onChatModeChange={setChatMode}
      sandboxProvider={sandboxProvider}
      onSandboxProviderChange={setSandboxProvider}
      placeholder={
        chatMode === 'plan'
          ? 'Describe an app and let Magical AI plan it...'
          : 'Ask Magical AI to build an app, page, or tool...'
      }
      templates={templates}
      selectedTemplate={selectedTemplate}
      onSelectedTemplateChange={setSelectedTemplate}
      models={filteredModels}
      languageModel={languageModel}
      onLanguageModelChange={handleLanguageModelChange}
      apiKeyConfigurable={!process.env.NEXT_PUBLIC_NO_API_KEY_INPUT}
      baseURLConfigurable={!process.env.NEXT_PUBLIC_NO_BASE_URL_INPUT}
    />
  )

  return (
    <main className="relative min-h-dvh overflow-x-hidden text-white">
      {supabase && (
        <AuthDialog
          open={isAuthDialogOpen}
          setOpen={setAuthDialog}
          view={authView}
          supabase={supabase as unknown as SupabaseClient<any, 'public', 'public'>}
        />
      )}

      {/* ─── Ambient background ───────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-glow-pulse absolute left-1/2 top-[-10%] h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-600/25 via-blue-500/15 to-transparent blur-[120px]" />
        <div className="animate-glow-pulse absolute right-[-8%] top-[22%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-500/18 to-transparent blur-[120px] [animation-delay:1.6s]" />
        <div className="animate-glow-pulse absolute left-[-6%] top-[48%] h-[380px] w-[380px] rounded-full bg-gradient-to-br from-fuchsia-500/14 to-transparent blur-[120px] [animation-delay:3.2s]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '38px 38px',
          }}
        />
      </div>

      {/* ─── Navbar ───────────────────────────────────────────────── */}
      <header
        className={cn(
          'sticky top-0 z-50 border-b transition-all duration-300',
          scrolled
            ? 'border-white/[0.08] bg-[#08090a]/80 backdrop-blur-xl'
            : 'border-transparent bg-transparent',
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/icon.png" alt="Magical AI" className="h-8 w-8 object-contain" />
            <span className="text-base font-semibold tracking-tight">Magical AI</span>
          </Link>

          {/* Center tabs */}
          <div className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-full px-3.5 py-1.5 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!authLoading && session ? (
              <>
                <Link
                  href="/web"
                  className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white sm:inline-flex"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/web"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  {displayName ? `Continue, ${displayName}` : 'Open app'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('sign_in')}
                  className="hidden rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white sm:block"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('sign_up')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Sign up free
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:text-white lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden border-t border-white/[0.06] bg-[#08090a]/95 backdrop-blur-xl lg:hidden"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
                {!session && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false)
                      openAuth('sign_in')
                    }}
                    className="rounded-xl px-3 py-2.5 text-left text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white sm:hidden"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/60"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Magical AI — developed by priyx
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.08 }}
            className="mt-6 max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl"
          >
            Build full-stack apps &{' '}
            <span className="animate-gradient-text bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
              websites with AI
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.16 }}
            className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/55 sm:text-lg"
          >
            Describe what you want in one prompt. Magical AI plans it, writes the code, runs it in
            a live sandbox, fixes its own errors, and syncs the result to GitHub.
          </motion.p>

          {/* Same chatbox as the app */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.24 }}
            className="mt-9 w-full max-w-3xl"
          >
            <div className="landing-ring rounded-2xl">
              {promptInput}
            </div>
            <p className="mt-3 text-xs text-white/35">
              {session
                ? 'Press enter to start building — you will land straight in your workspace.'
                : 'Free to start. No credit card required.'}
            </p>
          </motion.div>

          {/* Quick prompts */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.34 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {[
              'A SaaS dashboard with Stripe billing',
              'A portfolio site with dark editorial layout',
              'A habit tracker PWA with charts',
              'An Expo mobile app for recipes',
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => handleSend(idea, [], 'build')}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              >
                {idea}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Tech marquee ─────────────────────────────────────────── */}
      <section className="relative border-y border-white/[0.06] bg-white/[0.015] py-5">
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
            {[...TECH_MARQUEE, ...TECH_MARQUEE].map((tech, index) => (
              <span
                key={`${tech}-${index}`}
                className="whitespace-nowrap text-sm font-medium tracking-wide text-white/30"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tabbed feature / about / how-it-works section ────────── */}
      <section id="features" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="flex flex-col items-center text-center">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-white/35">
            Everything in one place
          </span>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            An AI engineer, an IDE and a live sandbox
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-white/50 sm:text-base">
            Instead of a project list, here is what actually happens when you hit send.
          </p>
        </Reveal>

        {/* Tab buttons */}
        <Reveal delay={0.08} className="mt-10 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5">
            {FEATURE_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                    isActive ? 'text-white' : 'text-white/50 hover:text-white/80',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="landing-tab-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/25 to-sky-500/20 ring-1 ring-inset ring-white/15"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </Reveal>

        <div className="mt-12">
          <AnimatePresence mode="wait">
            {activeTab === 'features' && (
              <motion.div
                key="features"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {FEATURES.map((feature, index) => {
                  const Icon = feature.icon
                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: index * 0.06, ease: 'easeOut' }}
                      className="landing-ring group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 transition hover:from-white/[0.08] hover:to-white/[0.02]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-sky-500/20 ring-1 ring-inset ring-white/10">
                        <Icon className="h-5 w-5 text-white/85" />
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">{feature.body}</p>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}

            {activeTab === 'how' && (
              <motion.div
                key="how"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
              >
                {HOW_STEPS.map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
                    className="landing-ring relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
                  >
                    <span className="bg-gradient-to-br from-white/25 to-white/5 bg-clip-text text-3xl font-bold text-transparent">
                      {item.step}
                    </span>
                    <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{item.body}</p>
                    {index < HOW_STEPS.length - 1 && (
                      <div className="pointer-events-none absolute right-3 top-5 hidden text-white/15 lg:block">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === 'templates' && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TEMPLATE_GROUPS.map((group, index) => {
                    const Icon = group.icon
                    return (
                      <motion.div
                        key={group.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: index * 0.05, ease: 'easeOut' }}
                        className="landing-ring flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.03] ring-1 ring-inset ring-white/10">
                          <Icon className="h-5 w-5 text-white/80" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{group.name}</div>
                          <div className="truncate text-xs text-white/45">{group.detail}</div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <div className="mt-6 flex justify-center">
                  <Link
                    href="/templates"
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    Browse all templates
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            )}

            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="grid gap-6 lg:grid-cols-[1.15fr_1fr]"
              >
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 sm:p-8">
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">
                    Software that writes software — carefully
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-white/55">
                    Magical AI is a proprietary AI app builder created by priyx. The goal is
                    simple: remove the gap between an idea and a running application. Not a
                    snippet generator, not a mockup tool — a system that produces real projects
                    with real dependencies, running on real infrastructure.
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-white/55">
                    Every build goes through a multi-agent pipeline with an explicit planning
                    stage, self-review, and automatic error recovery. You stay in control: read
                    the plan, inspect the code, edit any file, and export to GitHub whenever you
                    want.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      'Plan before code, always',
                      'Full source access, no lock-in',
                      'Bring your own model provider',
                      'Private projects by default',
                    ].map((point) => (
                      <div key={point} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="text-sm text-white/60">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    {STATS.map((stat, index) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: index * 0.06 }}
                        className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-4"
                      >
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                        <div className="mt-1 text-xs text-white/45">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <Wand2 className="h-4 w-4 text-violet-300" />
                      Open source spirit
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">
                      Fork it for reference, study the agent pipeline, and learn from the
                      implementation. Commercial use requires permission from the author.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ─── Coming soon: desktop & mobile ────────────────────────── */}
      <section id="coming-soon" className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28">
        <Reveal className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] via-white/[0.025] to-transparent p-6 sm:p-10">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
                <Rocket className="h-3.5 w-3.5" />
                Coming up
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Desktop and mobile apps are on the way
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">
                The same agentic builder is being packaged for native desktop and mobile — start a
                build on your laptop, keep steering it from your phone.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                icon: Monitor,
                title: 'Magical AI Desktop',
                status: 'In development',
                points: [
                  'Native window with docked IDE and preview',
                  'Local project folders alongside cloud sandboxes',
                  'Offline prompt queue and background builds',
                ],
              },
              {
                icon: Smartphone,
                title: 'Magical AI Mobile',
                status: 'Planned',
                points: [
                  'Prompt and approve plans on the go',
                  'Push notifications when a build finishes',
                  'Review and merge generated changes from your phone',
                ],
              },
            ].map((platform, index) => {
              const Icon = platform.icon
              return (
                <motion.div
                  key={platform.title}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
                  className="landing-ring rounded-2xl border border-white/[0.07] bg-[#0b0d0e]/60 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="animate-float-soft flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-violet-500/20 ring-1 ring-inset ring-white/10">
                        <Icon className="h-5 w-5 text-white/85" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{platform.title}</div>
                        <div className="text-xs text-white/40">{platform.status}</div>
                      </div>
                    </div>
                    <span className="relative overflow-hidden rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] text-white/60">
                      Soon
                      <span className="animate-shimmer absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {platform.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm text-white/55">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </div>
        </Reveal>
      </section>

      {/* ─── Try the chat version ─────────────────────────────────── */}
      <section id="try" className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 sm:pb-32">
        <Reveal className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[520px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-[110px]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Try our chat version
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/55 sm:text-base">
              The full workspace — agent timeline, live sandbox, IDE, database panel and GitHub
              sync — lives behind one click.
            </p>

            <div className="mx-auto mt-9 w-full max-w-3xl">
              <div className="landing-ring rounded-2xl">{promptInput}</div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/web"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Open the full workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/community"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                See what others built
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.07] bg-[#08090a]/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/icon.png" alt="Magical AI" className="h-8 w-8 object-contain" />
              <span className="text-base font-semibold">Magical AI</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/40">
              Build full-stack web and mobile apps with simple AI prompts. Developed by priyx.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
              Product
            </div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/50">
              <Link href="/web" className="transition hover:text-white">Workspace</Link>
              <Link href="/templates" className="transition hover:text-white">Templates</Link>
              <Link href="/community" className="transition hover:text-white">Community</Link>
              <Link href="/projects" className="transition hover:text-white">Projects</Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
              Resources
            </div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/50">
              <Link href="/docs" className="transition hover:text-white">Documentation</Link>
              <a href="#coming-soon" className="transition hover:text-white">Desktop &amp; mobile</a>
              <a
                href="https://discord.gg/p6Sz3X3YFe"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-white"
              >
                Discord
              </a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
              Legal
            </div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/50">
              <Link href="/terms" className="transition hover:text-white">Terms</Link>
              <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-white/30 sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} Magical AI. All rights reserved.</span>
            <span>Made by priyx</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
