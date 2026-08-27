'use client'

import { ViewType } from '@/components/auth';
import { AuthDialog } from '@/components/auth-dialog';
import { Chat } from '@/components/chat';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Project, saveMessage, getProjectMessages, generateProjectTitle, getProject, updateProject, getProjects } from '@/lib/database';
import { Message, MessagePlan, formatPlanForModel, toAISDKMessages, toMessageImage } from '@/lib/messages';
import type { LLMModel, LLMModelConfig } from '@/lib/models';
import { FragmentSchema, fragmentSchema as schema } from '@/lib/schema';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import templates, { TemplateId } from '@/lib/templates';
import { ExecutionResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { SandboxProviderMode } from '@/lib/sandbox-provider';
import { DeepPartial } from 'ai';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useRouter, useParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from 'usehooks-ts';
import { StyleSelector, type StylePreset, STYLE_PRESETS } from '@/components/style-selector'
import { useAgenticStream, type ToolAction, type TodoItem } from '@/lib/hooks/use-agentic-stream';
import { useUserTeam } from '@/lib/user-team-provider';
import { HeroPillSecond } from '@/components/announcement';
import { SupabaseClient } from '@supabase/supabase-js';
import { invalidateCache } from '@/lib/caching';
import type { GitHubWorkspace } from '@/components/github-save';
import type { PreviewTab } from '@/components/preview';
import { Clock3, FolderOpen, GitBranch, Globe2, Lock, PanelRightClose, PanelRightOpen, Trash, Undo, Cpu, Zap, LoaderIcon, ChevronDown, ArrowLeft, Settings, Star, ExternalLink, Database } from 'lucide-react';

const DEFAULT_MODEL_ID = 'auto'
const DEFAULT_NEW_CHAT_TITLE = 'New Chat'
const MAX_AUTO_FIX_ATTEMPTS = 2

type ChatMode = 'plan' | 'build'
type ProjectShelfView = 'all' | 'recent' | 'github'
type ProjectPreviewCard = {
  url?: string
  imageUrl?: string
  title?: string
  description?: string
  template?: string
}
type ProjectPreviewRow = {
  project_id: string | null
  object_data: unknown
  result_data: unknown
  sequence_number: number | null
}

function getSandboxErrorMessage(errorResult: { error?: string; type?: string }) {
  if (errorResult.type === 'config_error') {
    return errorResult.error || 'AI generated the code, but preview cannot start because no sandbox provider is configured.'
  }

  return errorResult.error || 'AI generated the code, but preview setup failed.'
}

type SandboxErrorResult = {
  error?: string
  type?: string
  details?: string
}

function getExecutionErrorDetails(result: ExecutionResult) {
  if (result.template !== 'code-interpreter-v1' || !result.runtimeError) {
    return ''
  }

  const error = result.runtimeError
  const parts = [
    error.name || 'Runtime error',
    error.value,
    error.traceback,
    result.stderr?.length ? `stderr:\n${result.stderr.join('\n')}` : '',
    result.stdout?.length ? `stdout:\n${result.stdout.join('\n')}` : '',
  ]

  return parts.filter(Boolean).join('\n\n')
}

function getSandboxErrorDetails(errorResult: SandboxErrorResult) {
  return [
    errorResult.error,
    errorResult.details ? `Details:\n${errorResult.details}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function isAutoFixableSandboxError(errorResult: SandboxErrorResult) {
  return errorResult.type === 'execution_error' || errorResult.type === 'validation_error'
}

function buildAutoFixPrompt({
  fragment,
  errorDetails,
  attempt,
}: {
  fragment: DeepPartial<FragmentSchema>
  errorDetails: string
  attempt: number
}) {
  return `Automatic error fix request.

The generated artifact failed when Magical AI tried to run it in the sandbox. Fix the current artifact and return a corrected complete artifact in the required response format.

Keep the user's original request and the current template unless the error requires a template change. If dependencies, install commands, ports, file paths, or code are wrong, update those fields too.

Template: ${fragment.template || 'unknown'}
File: ${fragment.file_path || 'unknown'}
Files: ${Array.isArray(fragment.files) && fragment.files.length > 0
  ? fragment.files.map((file) => file?.path).filter(Boolean).join(', ')
  : fragment.file_path || 'unknown'}
Supabase migrations: ${Array.isArray(fragment.supabase_migrations) && fragment.supabase_migrations.length > 0
  ? fragment.supabase_migrations.map((migration) => migration?.name).filter(Boolean).join(', ')
  : 'none'}
Attempt: ${attempt}/${MAX_AUTO_FIX_ATTEMPTS}

Sandbox error:
\`\`\`text
${errorDetails || 'Unknown sandbox error'}
\`\`\``
}

const PricingModal = dynamic(() => import('@/components/pricing').then(mod => ({ default: mod.PricingModal })), {
  ssr: false,
});

const Sidebar = dynamic(() => import('@/components/sidebar').then(mod => ({ default: mod.Sidebar })), {
  ssr: false,
});

const Preview = dynamic(() => import('@/components/preview').then(mod => ({ default: mod.Preview })), {
  ssr: false,
});

function ProjectDropdownMenu({ projectTitle, projectSubtitle, isPublic, onToggleVisibility, onNewChat, onBackToDashboard }: {
  projectTitle: string
  projectSubtitle: string
  isPublic?: boolean
  onToggleVisibility?: () => void
  onNewChat?: () => void
  onBackToDashboard?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    function handleEscape(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEscape) }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-[11px] font-bold text-white shrink-0">
          {projectTitle?.[0] || 'M'}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white max-w-[200px] sm:max-w-[300px]">{projectTitle}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-white/10 bg-[#1a1b1d] p-2 shadow-2xl">
          <div className="mb-2 rounded-lg bg-white/[0.04] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                {projectTitle?.[0] || 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{projectTitle}</div>
                <div className="text-xs text-white/40 truncate">{projectSubtitle}</div>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            {onNewChat && (
              <button type="button" onClick={() => { onNewChat(); setIsOpen(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white">
                <Zap className="h-4 w-4 text-white/40" />
                New chat
              </button>
            )}
            {onBackToDashboard && (
              <button type="button" onClick={() => { onBackToDashboard(); setIsOpen(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white">
                <ArrowLeft className="h-4 w-4 text-white/40" />
                Dashboard
              </button>
            )}
            <button type="button" onClick={() => { window.location.reload() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white">
              <Star className="h-4 w-4 text-white/40" />
              Star project
            </button>
            {onToggleVisibility && (
              <button type="button" onClick={() => { onToggleVisibility(); setIsOpen(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white">
                {isPublic ? <Globe2 className="h-4 w-4 text-white/40" /> : <Lock className="h-4 w-4 text-white/40" />}
                {isPublic ? 'Make private' : 'Make public'}
              </button>
            )}
            <button type="button" onClick={() => { setIsOpen(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white">
              <Settings className="h-4 w-4 text-white/40" />
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TodoBar({ todos }: { todos: { id: string; text: string; completed: boolean }[] }) {
  const [isOpen, setIsOpen] = useState(true)
  const completedCount = todos.filter(t => t.completed).length
  const allDone = completedCount === todos.length && todos.length > 0

  return (
    <div className={`mb-2 rounded-xl border transition-colors duration-300 ${allDone ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs"
      >
        {allDone ? (
          <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        )}
        <span className="font-medium text-white/60">To-dos</span>
        <span className={allDone ? 'text-emerald-400/80' : 'text-white/30'}>{completedCount}/{todos.length}</span>
        {allDone && <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
        <svg className={`ml-auto h-3 w-3 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {isOpen && (
        <div className="space-y-0.5 border-t border-white/[0.06] px-3 py-2">
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 py-0.5">
              {todo.completed ? (
                <svg className="h-3 w-3 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              ) : (
                <div className="h-3 w-3 shrink-0 rounded-full border border-white/20" />
              )}
              <span className={`text-[11px] ${todo.completed ? 'text-white/35 line-through' : 'text-white/50'}`}>
                {todo.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type HomeProps = {
  initialProjectId?: string
}

export default function Home({ initialProjectId }: HomeProps = {}) {
  const router = useRouter()
  const urlParams = useParams()
  const projectIdFromUrl = urlParams?.projectId as string | undefined
  const activeProjectId = projectIdFromUrl || initialProjectId
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>('auto')
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: DEFAULT_MODEL_ID,
    },
  )
  const [useMorphApply, setUseMorphApply] = useLocalStorage(
    'useMorphApply',
    false,
  )
  const [useAgentic, setUseAgentic] = useLocalStorage(
    'useAgentic',
    true,
  )
  const [selectedStyle, setSelectedStyle] = useLocalStorage<string | null>('selectedStyle', null)
  const [customStylePrompt, setCustomStylePrompt] = useLocalStorage<string>('customStylePrompt', '')
  const [showStyleSelector, setShowStyleSelector] = useState(false)
  const [chatMode, setChatMode] = useLocalStorage<ChatMode>('chatMode', 'plan')
  const [sandboxProvider, setSandboxProvider] = useLocalStorage<SandboxProviderMode>('sandboxProvider', 'auto')

  const posthog = usePostHog()

  const [result, setResult] = useState<ExecutionResult>()
  const [warmSandboxResult, setWarmSandboxResult] = useState<ExecutionResult>()
  const sessionStartTimeRef = useRef(0)
  useEffect(() => { sessionStartTimeRef.current = Date.now() }, [])
  const [fragmentsGenerated, setFragmentsGenerated] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [errorsEncountered, setErrorsEncountered] = useState(0)
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([])
  const githubSyncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const restoringProjectRef = useRef('')
  const warmingSandboxKeyRef = useRef('')
  const skipNextWorkspaceRestoreRef = useRef('')
  const planAbortControllerRef = useRef<AbortController | null>(null)
  const autoFixAttemptsRef = useRef(0)
  const lastAutoFixSignatureRef = useRef('')
  const lastSavedMessageSignatureRef = useRef('')
  const skipNextProjectMessagesLoadRef = useRef('')
  const isHydratingProjectMessagesRef = useRef(false)
  const pendingNavigateRef = useRef<string | null>(null)
  const isLandingPagePromptRef = useRef(false)
  const initialTabSetRef = useRef(false)
  const failedRestoresRef = useRef(new Set<string>())
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema>>();
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([])
  const [currentTab, setCurrentTab] = useState<PreviewTab>('code');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isPreviewPanelOpen, setIsPreviewPanelOpen] = useState(false);
  const [isAuthDialogOpen, setAuthDialog] = useState(false);
  const [authView, setAuthView] = useState<ViewType>('sign_in')
  const [, setIsRateLimited] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const [projectShelfView, setProjectShelfView] = useState<ProjectShelfView>('recent')
  // Message queue — stores messages sent while streaming
  const [messageQueue, setMessageQueue] = useState<{ message: string; files: File[]; mode: ChatMode }[]>([])
  // Message history — tracks which message the user is viewing
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const messageQueueRef = useRef<{ message: string; files: File[]; mode: ChatMode }[]>([])

  const setProjectShelfViewAndReset = useCallback((view: ProjectShelfView) => {
    setProjectShelfView(view)
  }, [])
  const setAuthDialogCallback = useCallback((isOpen: boolean) => {
    setAuthDialog(isOpen)
  }, [setAuthDialog])

  const setAuthViewCallback = useCallback((view: ViewType) => {
    setAuthView(view)
  }, [setAuthView])
  const [errorMessage, setErrorMessage] = useState('')
  const [autoFixMessage, setAutoFixMessage] = useState('')
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [projectPreviews, setProjectPreviews] = useState<Record<string, ProjectPreviewCard>>({})
  const [activePreviewProjectId, setActivePreviewProjectId] = useState('')
  const currentProjectRef = useRef<Project | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(Boolean(initialProjectId))
  const [chatHistoryRefreshKey, setChatHistoryRefreshKey] = useState(0)
  const [projectMessagesRefreshKey, setProjectMessagesRefreshKey] = useState(0)

  const { session, loading: authLoading } = useAuth(setAuthDialogCallback, setAuthViewCallback)
  const { userTeam } = useUserTeam()
  const currentProjectId = currentProject?.id
  const agenticStream = useAgenticStream(currentProjectId || projectIdFromUrl || initialProjectId || undefined)
  const currentProjectGitHubWorkspace = useMemo(
    () => getProjectGitHubWorkspace(currentProject),
    [currentProject],
  )
  const currentProjectR2Workspace = useMemo(
    () => getProjectR2Workspace(currentProject),
    [currentProject],
  )
  const previewExecutionResult = result || (currentTab === 'ide' ? warmSandboxResult : undefined)
  const isGitHubWorkspaceConnected = Boolean(currentProjectGitHubWorkspace)
  const dashboardProjects = useMemo(() => {
    const sortedProjects = [...recentProjects].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )

    if (projectShelfView === 'github') {
      return sortedProjects.filter((project) => getProjectGitHubWorkspace(project))
    }

    if (projectShelfView === 'all') {
      return [...recentProjects].sort((a, b) => a.title.localeCompare(b.title))
    }

    return sortedProjects
  }, [projectShelfView, recentProjects])
  const githubProjectCount = useMemo(
    () => recentProjects.filter((project) => getProjectGitHubWorkspace(project)).length,
    [recentProjects],
  )

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    currentProjectRef.current = currentProject
  }, [currentProject])

  useEffect(() => {
    const syncTimers = githubSyncTimersRef.current

    return () => {
      planAbortControllerRef.current?.abort()
      Object.values(syncTimers).forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadRecentProjects() {
      if (!session?.user?.id) {
        setRecentProjects([])
        return
      }

      const projects = await getProjects(supabase)
      if (isMounted) {
        setRecentProjects(projects)
      }
    }

    loadRecentProjects()

    return () => {
      isMounted = false
    }
  }, [chatHistoryRefreshKey, session?.user?.id, supabase])

  useEffect(() => {
    let isMounted = true

    async function loadProjectPreviews() {
      const projectIds = recentProjects.slice(0, 18).map((project) => project.id)

      if (!supabase || !session?.user?.id || projectIds.length === 0) {
        setProjectPreviews({})
        return
      }

      const { data, error } = (await supabase
        .from('messages')
        .select('project_id, object_data, result_data, sequence_number')
        .in('project_id', projectIds)
        .not('result_data', 'is', null)
        .order('sequence_number', { ascending: false })) as { data: ProjectPreviewRow[] | null; error: any }

      if (!isMounted) return

      if (error) {
        console.warn('Failed to load project preview thumbnails:', error)
        setProjectPreviews({})
        return
      }

      const previews: Record<string, ProjectPreviewCard> = {}
      const fallbackPreviews: Record<string, ProjectPreviewCard> = {}
      const rows = (data as unknown as ProjectPreviewRow[] | null) || []

      for (const row of rows) {
        const projectId = typeof row.project_id === 'string' ? row.project_id : ''

        if (!projectId || previews[projectId]) {
          continue
        }

        const resultData = row.result_data as Record<string, any> | null
        const objectData = row.object_data as Record<string, any> | null
        const preview = getMessageProjectPreview(resultData, objectData)

        if (preview.url || preview.imageUrl) {
          previews[projectId] = preview
        } else if (!fallbackPreviews[projectId] && (preview.title || preview.description || preview.template)) {
          fallbackPreviews[projectId] = preview
        }
      }

      setProjectPreviews({ ...fallbackPreviews, ...previews })
    }

    void loadProjectPreviews()

    return () => {
      isMounted = false
    }
  }, [recentProjects, session?.user?.id, supabase])

  const handleChatSelected = async (chatId: string) => {
    skipNextProjectMessagesLoadRef.current = ''
    const project = await getProject(supabase, chatId);
    if (project) {
      setErrorMessage('')
      setWarmSandboxResult(undefined)
      warmingSandboxKeyRef.current = ''
      currentProjectRef.current = project
      setCurrentProject(project);
      setProjectMessagesRefreshKey((key) => key + 1)
      router.push(`/chat/${project.id}`)
    } else {
      setErrorMessage('Chat not found or you do not have access.')
    }
  };

  const filteredModels = useMemo(() => availableModels.filter((model: any) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      return model.providerId !== 'ollama'
    }
    return true
  }), [availableModels])

  const currentModel = useMemo(() => {
    if (languageModel.model === 'auto') {
      return { id: 'auto', name: 'Auto', provider: 'Auto', providerId: 'auto' } as LLMModel
    }
    return (
      filteredModels.find((model: any) => model.id === languageModel.model) ||
      filteredModels.find((model: any) => model.id === DEFAULT_MODEL_ID) ||
      filteredModels[0]
    )
  }, [languageModel.model, filteredModels])

  // Determine which API to use based on morph toggle, agentic toggle, and existing fragment
  const shouldUseMorph = useMorphApply && fragment && fragment.code && fragment.file_path
  // useObject always uses the standard route (returns single JSON)
  // Agentic streaming is handled separately by agenticStream.submit()
  const apiEndpoint = shouldUseMorph
    ? '/api/chat/morph-chat'
    : '/api/chat'

  useEffect(() => {
    const projectId = activeProjectId

    if (!projectId) {
      setIsLoadingProject(false)
      return
    }

    if (authLoading) {
      setIsLoadingProject(true)
      return
    }

    if (!session?.user?.id) {
      setCurrentProject(null)
      setIsLoadingProject(false)
      setErrorMessage('Sign in to open this chat.')
      setAuthDialog(true)
      return
    }

    let isMounted = true

    async function loadInitialProject(projectId: string) {
      setIsLoadingProject(true)
      setErrorMessage('')
      const project = await getProject(supabase, projectId)

      if (!isMounted) return

      if (!project) {
        setIsLoadingProject(false)
        setCurrentProject(null)
        setErrorMessage('Chat not found or you do not have access.')
        return
      }

      setCurrentProject(project)
      currentProjectRef.current = project
      setResult(undefined)
      setWarmSandboxResult(undefined)
      warmingSandboxKeyRef.current = ''
      setFragment(undefined)
      initialTabSetRef.current = false
      setCurrentTab('code')
      setIsPreviewLoading(false)
      setIsPreviewPanelOpen(false)
      setIsLoadingProject(false)
    }

    loadInitialProject(projectId)

    return () => {
      isMounted = false
    }
  }, [authLoading, activeProjectId, session?.user?.id, supabase])

  useEffect(() => {
    let isMounted = true

    async function loadModels() {
      try {
        const response = await fetch('/api/models')
        if (!response.ok) return

        const data = await response.json()
        if (isMounted && Array.isArray(data.models)) {
          setAvailableModels(data.models)
        }
      } catch (error) {
        console.warn('Failed to load configured model list:', error)
      }
    }

    loadModels()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (filteredModels.length === 0) return

    if (languageModel.model === 'auto') return

    const selectedModelExists = filteredModels.some(
      (model: any) => model.id === languageModel.model,
    )

    if (!selectedModelExists) {
      const fallbackModel =
        filteredModels.find((model: any) => model.id === DEFAULT_MODEL_ID) ||
        filteredModels[0]

      setLanguageModel({
        ...languageModel,
        model: fallbackModel.id,
      })
    }
  }, [filteredModels, languageModel, setLanguageModel])

  const { object, submit, isLoading, stop, error } = useObject({
    api: apiEndpoint,
    schema,
    onError: (error: Error) => {
      setErrorsEncountered(prev => prev + 1)
      console.error('Error submitting request:', error);
      
      let displayMessage = error.message;
      let isRateLimit = false
      
      // Try to parse structured error response
      try {
        if (error.message.startsWith('{')) {
          const errorData = JSON.parse(error.message)
          displayMessage = errorData.error || error.message
          isRateLimit = errorData.type === 'rate_limit'
        } else {
          // Handle common error patterns
          const lowerMessage = error.message.toLowerCase()
          if (lowerMessage.includes('you have reached your request limit')) {
            isRateLimit = true
            displayMessage = 'You have reached your request limit. Please try again later.'
          } else if (lowerMessage.includes('provider') && (lowerMessage.includes('limit') || lowerMessage.includes('rate'))) {
            isRateLimit = true
            displayMessage = error.message
          } else if (lowerMessage.includes('limit') || lowerMessage.includes('rate')) {
            isRateLimit = true
            displayMessage = error.message || 'Rate limit exceeded. Please try again later.'
          } else if (error.message.includes('API key') || error.message.includes('unauthorized')) {
            displayMessage = 'Invalid API key. Please check your API key configuration in settings.'
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            displayMessage = 'Network error. Please check your connection and try again.'
          } else if (error.message.includes('timeout')) {
            displayMessage = 'Request timeout. Please try again.'
          }
        }
      } catch {
        // Use original error message if parsing fails
      }
      
      setAutoFixMessage('')
      setIsRateLimited(isRateLimit);
      setErrorMessage(displayMessage);

      // Don't navigate here — handleSendPrompt already pushed to /chat/:id
    },
    onFinish: async ({ object: fragment, error }: { object: DeepPartial<FragmentSchema> | undefined, error: any }) => {
      if (error) {
        setAutoFixMessage('')
        setIsPreviewLoading(false)
        setErrorMessage(error instanceof Error ? error.message : 'AI generation failed.')
        pendingNavigateRef.current = null
        try {
          sessionStorage.removeItem('isLandingPagePrompt')
          sessionStorage.removeItem('landingPageProjectId')
        } catch {}
        return
      }

      if (!fragment) {
        setAutoFixMessage('')
        setIsPreviewLoading(false)
        setErrorMessage('AI generation finished without returning code.')
        return
      }

      setFragment(fragment)
      setCurrentPreview({ fragment, result: undefined })
      setCurrentTab('fragment')
      setIsPreviewLoading(true);
        // Enhanced analytics tracking
        if (fragment.code && fragment.template) {
        }
        setFragmentsGenerated(prev => prev + 1)
        
        
        posthog.capture('fragment_generated', {
          template: fragment?.template,
        })

        if (!(await applyGeneratedSupabaseMigrations(fragment))) {
          setIsPreviewLoading(false)
          return
        }

        let response: Response
        let result: any

        try {
          response = await fetch('/api/sandbox', {
            method: 'POST',
            body: JSON.stringify({
              fragment,
              userID: session?.user?.id,
              teamID: userTeam?.id,
              accessToken: session?.access_token,
              projectID: currentProjectRef.current?.id,
              sandboxProvider,
              existingSandboxId: getReusableWarmSandboxId(fragment),
            }),
          })
          result = await response.json()
        } catch (sandboxError) {
          console.error('Sandbox request failed:', sandboxError)
          setAutoFixMessage('')
          setErrorMessage('AI generated the code, but preview setup failed. Check the selected sandbox provider configuration on Vercel.')
          setIsPreviewLoading(false)
          return
        }
        
        if (!response.ok) {
          // If response is not ok, result is an error object
          const errorResult = result as SandboxErrorResult;
          console.error('Sandbox creation failed:', errorResult);
          const errorDetails = getSandboxErrorDetails(errorResult)
          if (isAutoFixableSandboxError(errorResult) && startAutoFix(fragment, errorDetails)) {
            setIsPreviewLoading(false);
            return;
          }

          setAutoFixMessage('')
          setErrorMessage(getSandboxErrorMessage(errorResult));
          setIsPreviewLoading(false);
          return;
        }

        // If response is ok, result is an ExecutionResult
        const executionResult = result as ExecutionResult;

        // Enhanced sandbox tracking
        // const creationTime = Date.now() - Date.now() // Would track actual creation time
        
        // Only capture url if it's a web execution result
        if ('url' in executionResult) {
          posthog.capture('sandbox_created', { url: executionResult.url });
        }

        const messagesWithResult = withLatestAssistantFragment(messagesRef.current, fragment, executionResult)
        messagesRef.current = messagesWithResult
        setMessages(messagesWithResult)
        setWarmSandboxResult(executionResult)
        setResult(executionResult);
        setCurrentPreview({ fragment, result: executionResult });

        const executionErrorDetails = getExecutionErrorDetails(executionResult)
        if (executionErrorDetails) {
          if (startAutoFix(fragment, executionErrorDetails, executionResult)) {
            setCurrentTab('fragment');
            setIsPreviewLoading(false);
            return;
          }

          setAutoFixMessage('')
          setErrorMessage('Generated code still has runtime errors. Review the preview output or try a different prompt.')
          setCurrentTab('fragment');
          setIsPreviewLoading(false);
          return;
        }

        autoFixAttemptsRef.current = 0
        lastAutoFixSignatureRef.current = ''
        setAutoFixMessage('')
        setCurrentTab('fragment');
        setIsPreviewLoading(false);

        // Save message but don't navigate — already on the correct page
        pendingNavigateRef.current = null
        try {
          sessionStorage.removeItem('isLandingPagePrompt')
          sessionStorage.removeItem('landingPageProjectId')
        } catch {}
    },
  })
  const isPromptLoading = isLoading || isPlanLoading || agenticStream.isStreaming

  // Sync agentic stream errors to errorMessage so user can see them
  useEffect(() => {
    if (agenticStream.error) {
      setErrorMessage(agenticStream.error)
    }
  }, [agenticStream.error])

  // Sync agentic stream fragment to existing state + update message object
  useEffect(() => {
    if (useAgentic && agenticStream.fragment) {
      const frag = agenticStream.fragment
      const hasContent = frag.code || (frag.files && frag.files.length > 0) || frag.title
      if (hasContent) {
        setFragment(frag)
        setCurrentPreview({ fragment: frag, result: undefined })
        // Include latest commentary from agentic actions in the fragment
        // so the assistant message content persists with the full text
        const commentaryActions = agenticStream.actions.filter((a: any) => a.type === 'commentary' || a.type === 'commentary_chunk')
        const latestCommentary = commentaryActions.length > 0 ? commentaryActions[commentaryActions.length - 1].content : ''
        const fragWithCommentary = latestCommentary ? { ...frag, commentary: frag.commentary || latestCommentary } : frag
        // Also update the assistant message so GeneratedArtifactCard shows
        setMessages(prev => {
          const nextMessages = withLatestAssistantFragment(prev, fragWithCommentary)
          messagesRef.current = nextMessages
          return nextMessages
        })
      }
    }
  }, [useAgentic, agenticStream.fragment, agenticStream.actions])

  // Safety: when agentic streaming ends, ensure an assistant message exists AND persist agentic state
  useEffect(() => {
    if (!useAgentic || agenticStream.isStreaming) return
    // Only run once when streaming just ended
    const lastMsg = messagesRef.current[messagesRef.current.length - 1]
    const hasAssistantResponse = lastMsg?.role === 'assistant'

    // Calculate elapsed time
    const elapsed = agenticStream.actions.length > 0
      ? Date.now() - agenticStream.actions[0].timestamp
      : 0

    // Always persist agentic state into the assistant message
    if (hasAssistantResponse && agenticStream.actions.length > 0) {
      setMessages(prev => {
        const next = [...prev]
        const lastIdx = next.length - 1
        next[lastIdx] = {
          ...next[lastIdx],
          agenticActions: agenticStream.actions,
          agenticTodos: agenticStream.todos,
          agenticElapsed: elapsed,
        } as Message
        messagesRef.current = next
        return next
      })
    }

    if (!hasAssistantResponse && messagesRef.current.length > 0) {
      // Always create an assistant message so the Magical message persists
      const frag = agenticStream.fragment || fragment
      const commentaryActions = agenticStream.actions.filter((a: any) => a.type === 'commentary' || a.type === 'commentary_chunk')
      const latestCommentary = commentaryActions.length > 0 ? commentaryActions[commentaryActions.length - 1].content : ''
      const fragWithCommentary = latestCommentary ? { ...frag, commentary: frag?.commentary || latestCommentary } : frag
      // Create assistant message even with minimal data — agentic actions are the important part
      const assistantContent: Message['content'] = [
        { type: 'text', text: latestCommentary || fragWithCommentary?.commentary || 'Generation complete.' },
      ]
      const assistantMsg: Message = {
        role: 'assistant',
        content: assistantContent,
        agenticActions: agenticStream.actions,
        agenticTodos: agenticStream.todos,
        agenticElapsed: elapsed,
      }
      if (fragWithCommentary && (fragWithCommentary.code || fragWithCommentary.files || fragWithCommentary.title || fragWithCommentary.description || fragWithCommentary.commentary)) {
        // Merge fragment data into the assistant message
        assistantMsg.content = assistantContent
        setMessages(prev => {
          const nextMessages = withLatestAssistantFragment(prev, fragWithCommentary)
          const lastIdx = nextMessages.length - 1
          if (lastIdx >= 0) {
            nextMessages[lastIdx] = {
              ...nextMessages[lastIdx],
              agenticActions: agenticStream.actions,
              agenticTodos: agenticStream.todos,
              agenticElapsed: elapsed,
            } as Message
          }
          messagesRef.current = nextMessages
          return nextMessages
        })
      } else if (agenticStream.actions.length > 0) {
        // No fragment data but we have actions — still persist them
        setMessages(prev => {
          const next = [...prev, assistantMsg]
          messagesRef.current = next
          return next
        })
      }
    }
    // Process queued messages after streaming completes
    if (messageQueueRef.current.length > 0) {
      const next = messageQueueRef.current[0]
      messageQueueRef.current = messageQueueRef.current.slice(1)
      setMessageQueue(messageQueueRef.current)
      setTimeout(() => {
        handleSendPrompt(next.message, next.files, next.mode)
      }, 500)
    }

    // Auto-deploy sandbox when agentic stream ends with a fragment
    const finalFrag = agenticStream.fragment || fragment
    console.log('[Agentic] Stream ended. fragment:', !!finalFrag, 'code:', !!finalFrag?.code, 'files:', finalFrag?.files?.length || 0, 'actions:', agenticStream.actions.length)
    if (finalFrag && (finalFrag.code || (finalFrag.files && finalFrag.files.length > 0))) {
      console.log('[Agentic] Auto-deploying sandbox for generated fragment')
      setIsPreviewLoading(true)
      setIsPreviewPanelOpen(true)
      setCurrentTab('fragment')
      console.log('[Agentic] Preview panel opened, tab set to fragment')
      void (async () => {
        try {
          const response = await fetch('/api/sandbox', {
            method: 'POST',
            body: JSON.stringify({
              fragment: finalFrag,
              userID: session?.user?.id,
              teamID: userTeam?.id,
              accessToken: session?.access_token,
              projectID: currentProjectRef.current?.id,
              sandboxProvider,
              existingSandboxId: getReusableWarmSandboxId(finalFrag),
            }),
          })
          if (response.ok) {
            const executionResult = await response.json() as ExecutionResult
            setResult(executionResult)
            setCurrentPreview({ fragment: finalFrag, result: executionResult })
            console.log('[Agentic] Sandbox deployed:', 'url' in executionResult ? executionResult.url : executionResult.sbxId)
          } else {
            const errorData = await response.json().catch(() => ({ error: `Sandbox deploy failed (HTTP ${response.status})` }))
            console.warn('[Agentic] Sandbox deploy failed:', response.status, errorData)
            setErrorMessage(errorData.error || `Sandbox deploy failed (HTTP ${response.status})`)
          }
        } catch (err) {
          console.warn('[Agentic] Sandbox deploy error:', err)
          setErrorMessage(err instanceof Error ? err.message : 'Sandbox deploy failed')
        } finally {
          setIsPreviewLoading(false)
        }
      })()
    }
  }, [useAgentic, agenticStream.isStreaming, agenticStream.actions])

  function getTemplateForSubmission(preferredTemplate?: string) {
    if (selectedTemplate !== 'auto') {
      return { [selectedTemplate]: templates[selectedTemplate] }
    }

    if (
      preferredTemplate &&
      Object.prototype.hasOwnProperty.call(templates, preferredTemplate)
    ) {
      const templateId = preferredTemplate as TemplateId
      return { [templateId]: templates[templateId] }
    }

    return templates
  }

  function withLatestAssistantFragment(
    currentMessages: Message[],
    assistantFragment: DeepPartial<FragmentSchema>,
    executionResult?: ExecutionResult,
  ) {
    // Use description as the conversational chat response
    // commentary is internal planning text — clean it up if used as fallback
    let chatText = assistantFragment.description || ''
    if (!chatText && assistantFragment.commentary) {
      // Strip agent name prefixes like "Planner: ..." or "Frontend: ..."
      chatText = assistantFragment.commentary
        .replace(/^(?:Planner|Architect|Frontend|Backend|Reviewer|Optimizer|Orchestrator):\s*/gmi, '')
        .trim()
    }
    const assistantMessage: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: chatText },
        { type: 'code', text: assistantFragment.code || '' },
      ],
      object: assistantFragment,
      result: executionResult,
    }

    const nextMessages = [...currentMessages]
    const lastMessage = nextMessages[nextMessages.length - 1]

    if (lastMessage?.role === 'assistant') {
      // Preserve existing agentic state when merging fragment data
      const existingAgentic = {
        agenticActions: lastMessage.agenticActions,
        agenticTodos: lastMessage.agenticTodos,
        agenticElapsed: lastMessage.agenticElapsed,
      }
      nextMessages[nextMessages.length - 1] = {
        ...lastMessage,
        ...assistantMessage,
        // Only overwrite agentic if the new message has agentic data
        ...(assistantMessage.agenticActions ? {} : existingAgentic),
      }
      return nextMessages
    }

    return [...nextMessages, assistantMessage]
  }

  function startAutoFix(
    fragmentToFix: DeepPartial<FragmentSchema>,
    errorDetails: string,
    executionResult?: ExecutionResult,
  ) {
    if (!session || !currentModel || (!fragmentToFix?.code && !fragmentToFix?.files?.length)) {
      return false
    }

    const signature = [
      fragmentToFix.template,
      fragmentToFix.file_path,
      fragmentToFix.code,
      JSON.stringify(fragmentToFix.files || []),
      JSON.stringify(fragmentToFix.supabase_migrations || []),
      errorDetails,
    ].join('|')

    if (lastAutoFixSignatureRef.current === signature) {
      return false
    }

    if (autoFixAttemptsRef.current >= MAX_AUTO_FIX_ATTEMPTS) {
      return false
    }

    const attempt = autoFixAttemptsRef.current + 1
    autoFixAttemptsRef.current = attempt
    lastAutoFixSignatureRef.current = signature

    const fixPrompt = buildAutoFixPrompt({
      fragment: fragmentToFix,
      errorDetails,
      attempt,
    })

    const messagesWithFailedFragment = withLatestAssistantFragment(
      messagesRef.current,
      fragmentToFix,
      executionResult,
    )
    const updatedMessages: Message[] = [
      ...messagesWithFailedFragment,
      {
        role: 'user',
        content: [{ type: 'text', text: fixPrompt }],
      },
    ]

    messagesRef.current = updatedMessages
    setMessages(updatedMessages)
    // Keep error visible so user can see what went wrong
    setAutoFixMessage(`Auto-fixing code (${attempt}/${MAX_AUTO_FIX_ATTEMPTS}) — analyzing the error and regenerating...`)
    setCurrentTab('code')

    try {
      submit({
        userID: session.user.id,
        teamID: userTeam?.id,
        projectID: currentProjectRef.current?.id,
        messages: toAISDKMessages(updatedMessages),
        template: getTemplateForSubmission(fragmentToFix.template),
        model: currentModel,
        config: languageModel,
        ...(shouldUseMorph && fragmentToFix ? { currentFragment: fragmentToFix } : {}),
      })

      posthog.capture('auto_fix_started', {
        attempt,
        template: fragmentToFix.template,
      })

      return true
    } catch (error) {
      console.error('Automatic fix submission failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Automatic fix failed to start.')
      return false
    }
  }

  const warmProjectSandbox = useCallback(async (project: Project) => {
    if (!session?.user?.id || !project?.id) return

    const template =
      selectedTemplate !== 'auto'
        ? selectedTemplate
        : isTemplateId(project.template_id)
          ? project.template_id
          : 'nextjs-developer'
    const warmKey = `${project.id}:${template}:${sandboxProvider}`

    if (warmingSandboxKeyRef.current === warmKey) {
      return
    }

    warmingSandboxKeyRef.current = warmKey

    try {
      const response = await fetch(`/api/projects/${project.id}/start-sandbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template,
          teamID: userTeam?.id,
          accessToken: session.access_token,
          sandboxProvider,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start project sandbox.')
      }

      if (currentProjectRef.current?.id === project.id) {
        setWarmSandboxResult(data as ExecutionResult)
      }
    } catch (error) {
      warmingSandboxKeyRef.current = ''
      const msg = error instanceof Error ? error.message : 'Failed to start sandbox'
      console.warn('Project sandbox warm start failed:', error)
      setErrorMessage(`Sandbox failed: ${msg}. Check your sandbox provider settings.`)
    }
  }, [sandboxProvider, selectedTemplate, session?.access_token, session?.user?.id, userTeam?.id])

  const restoreProjectWorkspace = useCallback(async (
    project: Project,
    savedFragment: DeepPartial<FragmentSchema>,
  ) => {
    const workspace = getProjectGitHubWorkspace(project)
    const r2Workspace = getProjectR2Workspace(project)
    const sandboxStorageWorkspace = getProjectSandboxStorageWorkspace(project)

    // Skip if no template, already restoring, or already failed for this project
    if (
      !savedFragment?.template ||
      restoringProjectRef.current === project.id ||
      failedRestoresRef.current.has(project.id)
    ) {
      return
    }
    // Allow restore if any storage source is available (GitHub, R2, or RustFS)
    if (!workspace && !r2Workspace && !sandboxStorageWorkspace) {
      return
    }

    restoringProjectRef.current = project.id
    setAutoFixMessage(
      workspace
        ? 'Restoring files from GitHub...'
        : sandboxStorageWorkspace
          ? 'Restoring files from RustFS...'
          : 'Restoring files from private storage...'
    )
    setIsPreviewLoading(true)

    try {
      const response = await fetch(`/api/projects/${project.id}/restore-sandbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fragment: savedFragment,
          teamID: userTeam?.id,
          accessToken: session?.access_token,
          sandboxProvider,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        failedRestoresRef.current.add(project.id)
        console.warn('Workspace restore failed:', data.error)
        setAutoFixMessage('')
        setIsPreviewLoading(false)
        return
      }

      const restoredResult = data as ExecutionResult
      setResult(restoredResult)
      setCurrentPreview({
        fragment: savedFragment,
        result: restoredResult,
      })
      setIsPreviewPanelOpen(true)
      setCurrentTab('ide')
      setAutoFixMessage('')
    } catch (error) {
      failedRestoresRef.current.add(project.id)
      console.warn('Workspace restore failed:', error)
      setAutoFixMessage('')
    } finally {
      restoringProjectRef.current = ''
      setIsPreviewLoading(false)
    }
  }, [sandboxProvider, session?.access_token, userTeam?.id])

  useEffect(() => {
    let isMounted = true

    async function loadProjectMessages() {
      if (!currentProjectId) {
        skipNextProjectMessagesLoadRef.current = ''
        isHydratingProjectMessagesRef.current = false
        messagesRef.current = []
        setMessages([])
        setWarmSandboxResult(undefined)
        return
      }

      if (skipNextProjectMessagesLoadRef.current === currentProjectId) {
        skipNextProjectMessagesLoadRef.current = ''
        isHydratingProjectMessagesRef.current = false
        setIsLoadingProject(false)
        if (currentProject) {
          void warmProjectSandbox(currentProject)
        }
        return
      }

      // Don't set isLoadingProject here — loadInitialProject already handles it
      invalidateCache(new RegExp(`^project-messages:[^:]+:${currentProjectId}$`))
      const projectMessages = await getProjectMessages(supabase, currentProjectId)

      if (!isMounted) return

      messagesRef.current = projectMessages
      isHydratingProjectMessagesRef.current = projectMessages.length > 0
      setMessages(projectMessages)

      const latestPreviewMessage = [...projectMessages]
        .reverse()
        .find((message) => message.object)

      setFragment(latestPreviewMessage?.object)
      setResult(latestPreviewMessage?.result)
      setWarmSandboxResult(undefined)
      // Only force code tab on initial project load, not on re-runs
      if (!initialTabSetRef.current) {
        initialTabSetRef.current = true
        setCurrentTab('code')
      }
      setIsLoadingProject(false)

      if (isLandingPagePromptRef.current) {
        isLandingPagePromptRef.current = false
        const lastMsg = projectMessages[projectMessages.length - 1]
        if (lastMsg && lastMsg.role === 'user' && currentModel) {
          if (useAgentic) {
            agenticStream.reset()
            agenticStream.submit({
              userID: session?.user?.id,
              teamID: userTeam?.id,
              accessToken: session?.access_token,
              projectID: currentProjectId,
              sandboxID: result?.sbxId || warmSandboxResult?.sbxId,
              messages: toAISDKMessages(projectMessages),
              template: getTemplateForSubmission(),
              model: currentModel,
              config: languageModel,
            })
          } else {
            submit({
              userID: session?.user?.id,
              teamID: userTeam?.id,
              projectID: currentProjectId,
              messages: toAISDKMessages(projectMessages),
              template: getTemplateForSubmission(),
              model: currentModel,
              config: languageModel,
            })
          }
        }
      } else {
        try {
          const flag = sessionStorage.getItem('isLandingPagePrompt')
          const projectId = sessionStorage.getItem('landingPageProjectId')
          if (flag === 'true' && projectId === currentProjectId) {
            sessionStorage.removeItem('isLandingPagePrompt')
            sessionStorage.removeItem('landingPageProjectId')
            const lastMsg = projectMessages[projectMessages.length - 1]
            if (lastMsg && lastMsg.role === 'user' && currentModel) {
              if (useAgentic) {
                agenticStream.reset()
                agenticStream.submit({
                  userID: session?.user?.id,
                  teamID: userTeam?.id,
                  accessToken: session?.access_token,
                  projectID: currentProjectId,
                  sandboxID: result?.sbxId || warmSandboxResult?.sbxId,
                  messages: toAISDKMessages(projectMessages),
                  template: getTemplateForSubmission(),
                  model: currentModel,
                  config: languageModel,
                })
              } else {
                submit({
                  userID: session?.user?.id,
                  teamID: userTeam?.id,
                  projectID: currentProjectId,
                  messages: toAISDKMessages(projectMessages),
                  template: getTemplateForSubmission(),
                  model: currentModel,
                  config: languageModel,
                })
              }
            }
          }
        } catch {}
      }

      if (skipNextWorkspaceRestoreRef.current === currentProject?.id) {
        skipNextWorkspaceRestoreRef.current = ''
      } else if (currentProject && latestPreviewMessage?.object && hasRestorableWorkspace(currentProject)) {
        void restoreProjectWorkspace(currentProject, latestPreviewMessage.object)
      } else if (currentProject && !latestPreviewMessage?.result) {
        void warmProjectSandbox(currentProject)
      }
    }

    loadProjectMessages()

    return () => {
      isMounted = false
    }
  }, [currentProject, currentProjectId, projectMessagesRefreshKey, restoreProjectWorkspace, supabase, warmProjectSandbox, currentModel, session, userTeam, languageModel])

  useEffect(() => {
    async function saveMessagesToDb() {
      if (!currentProjectId || !session || messages.length === 0) return

      if (isHydratingProjectMessagesRef.current) {
        isHydratingProjectMessagesRef.current = false
        return
      }

      const lastMessage = messages[messages.length - 1]
      const sequenceNumber = messages.length - 1

      if (isLoading && lastMessage.role === 'assistant') {
        return
      }

      const saveSignature = `${currentProjectId}:${sequenceNumber}:${lastMessage.role}:${Boolean(lastMessage.object)}:${Boolean(lastMessage.result)}:${(lastMessage.agenticActions || []).length}:${(lastMessage.agenticTodos || []).length}`

      if (lastSavedMessageSignatureRef.current === saveSignature) {
        return
      }

      const saved = await saveMessage(supabase, currentProjectId, lastMessage, sequenceNumber)

      if (saved) {
        lastSavedMessageSignatureRef.current = saveSignature
      }
    }

    if (messages.length > 0 && currentProjectId && session) {
      saveMessagesToDb()
    }
  }, [isLoading, messages, currentProjectId, session, supabase])

  useEffect(() => {
    if (object) {
      setFragment(object)
      setMessages(prev => {
        const nextMessages = withLatestAssistantFragment(prev, object)
        messagesRef.current = nextMessages
        return nextMessages
      })
    }
  }, [object])

  useEffect(() => {
    if (error) stop()
  }, [error, stop])

  // Track session end when component unmounts
  useEffect(() => {
    return () => {
      if (session?.user?.id) {
        const sessionDuration = Date.now() - sessionStartTimeRef.current
        posthog.capture('session_end', {
          duration: sessionDuration,
          fragments_generated: fragmentsGenerated,
          messages_count: messagesCount,
          errors_encountered: errorsEncountered
        })
      }
    }
  }, [session?.user?.id, fragmentsGenerated, messagesCount, errorsEncountered])

  async function submitPlanResponse(updatedMessages: Message[], projectId?: string) {
    setIsPlanLoading(true)
    const abortController = new AbortController()
    planAbortControllerRef.current = abortController

    try {
      const response = await fetch('/api/chat/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          userID: session?.user?.id,
          teamID: userTeam?.id,
          projectID: projectId,
          messages: toAISDKMessages(updatedMessages),
          model: currentModel,
          config: languageModel,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Plan generation failed.')
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: [
          {
            type: 'plan',
            plan: typeof data.plan === 'string' && data.plan.trim()
              ? data.plan.trim()
              : 'I could not create a plan for that request.',
            question: typeof data.question === 'string' && data.question.trim()
              ? data.question.trim()
              : undefined,
            options: Array.isArray(data.options)
              ? data.options
                  .filter((option: unknown): option is string => typeof option === 'string' && option.trim().length > 0)
                  .map((option: string) => option.trim())
              : [],
            allowCustomInput: data.allowCustomInput !== false,
          },
        ],
      }
      const nextMessages = [...messagesRef.current, assistantMessage]
      messagesRef.current = nextMessages
      setMessages(nextMessages)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      console.error('Plan mode request failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Plan mode failed.')
    } finally {
      if (planAbortControllerRef.current === abortController) {
        planAbortControllerRef.current = null
      }
      setIsPlanLoading(false)
    }
  }

  function handleStopGeneration() {
    planAbortControllerRef.current?.abort()
    planAbortControllerRef.current = null
    stop()
    agenticStream.stop()
    setIsPlanLoading(false)
    setIsPreviewLoading(false)
    setAutoFixMessage('')
  }

  async function ensureGitHubConnectedBeforeCodeGeneration() {
    if (!session) {
      setAuthDialog(true)
      return false
    }

    return true
  }

  function handleAcceptPlan(plan: MessagePlan, answer?: string) {
    if (!session) {
      setAuthDialog(true)
      return
    }

    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    setErrorMessage('')
    setAutoFixMessage('')
    setChatMode('build')

    if (isPromptLoading) {
      handleStopGeneration()
    }

    if (!currentModel) {
      setErrorMessage('No AI model is available. Check your model list and provider configuration.')
      return
    }

    void (async () => {
      if (!(await ensureGitHubConnectedBeforeCodeGeneration())) {
        return
      }

      const answerText = answer?.trim()
      const continuePrompt = [
        'Accept this plan and continue building the project.',
        answerText ? `User answer: ${answerText}` : '',
        'Use the accepted plan as the implementation direction.',
        '',
        formatPlanForModel(plan),
      ]
        .filter(Boolean)
        .join('\n')

      const updatedMessages: Message[] = [
        ...messagesRef.current,
        {
          role: 'user',
          content: [{ type: 'text', text: continuePrompt }],
        },
      ]

      messagesRef.current = updatedMessages
      setMessages(updatedMessages)
      setCurrentTab('code')
      setIsPreviewPanelOpen(true)

      try {
        submit({
          userID: session.user.id,
          teamID: userTeam?.id,
          projectID: currentProjectRef.current?.id,
          messages: toAISDKMessages(updatedMessages),
          template: getTemplateForSubmission(fragment?.template),
          model: currentModel,
          config: languageModel,
          ...(shouldUseMorph && fragment ? { currentFragment: fragment } : {}),
        })

        setMessagesCount(prev => prev + 1)
        posthog.capture('chat_plan_accepted', {
          template: selectedTemplate,
          model: languageModel.model,
          answeredQuestion: Boolean(answerText),
        })
      } catch (error) {
        console.error('Plan continuation failed:', error)
        setErrorMessage(error instanceof Error ? error.message : 'Plan continuation failed.')
      }
    })()
  }

  async function handleSendPrompt(message: string, files: File[] = [], mode: ChatMode = chatMode) {
    if (!session) {
      return setAuthDialog(true)
    }

    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    setErrorMessage('')
    setAutoFixMessage('')

    // Handle sandbox commands directly without sending to AI
    const cmd = message.trim().toLowerCase()
    const isSandboxCommand = /^(redeploy|restart|start|deploy|rebuild|refresh|reload)\s+(sandbox|preview|project|server|page)/.test(cmd) || /^(redeploy|restart|start|deploy|rebuild|refresh|reload)$/.test(cmd)
    const isOpenIdeCommand = /^(open\s+)?(ide|editor|code|files?)$/i.test(cmd)
    if (isSandboxCommand) {
      const commandLabel = cmd.includes('redeploy') || cmd.includes('rebuild') ? 'Redeploying' : cmd.includes('restart') || cmd.includes('reload') || cmd.includes('refresh') ? 'Restarting' : cmd.includes('deploy') ? 'Deploying' : 'Starting'
      // Add a user message and assistant response to chat
      const userMsg: Message = { role: 'user', content: [{ type: 'text', text: message }] }
      const assistantMsg: Message = { role: 'assistant', content: [{ type: 'text', text: `${commandLabel} sandbox...` }] }
      setMessages(prev => {
        const next = [...prev, userMsg, assistantMsg]
        messagesRef.current = next
        return next
      })
      // Save both messages to DB
      if (currentProject?.id) {
        const seq = messagesRef.current.length - 2
        void saveMessage(supabase, currentProject.id, userMsg, seq)
        void saveMessage(supabase, currentProject.id, assistantMsg, seq + 1)
      }
      // Trigger the actual sandbox action
      setIsPreviewLoading(true)
      setIsPreviewPanelOpen(true)
      setCurrentTab('fragment')
      let commandFailed = false
      try {
        await handleRedeploy()
      } catch (err) {
        commandFailed = true
        console.warn('Sandbox command failed:', err)
      }
      // Update assistant message with result after a short delay (let state settle)
      setTimeout(() => {
        const hasError = !!errorMessage || commandFailed
        setMessages(prev => {
          const next = [...prev]
          const lastIdx = next.length - 1
          if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
            next[lastIdx] = {
              ...next[lastIdx],
              content: [{ type: 'text', text: hasError ? `${commandLabel} sandbox failed. Check the error above.` : `${commandLabel} sandbox successfully.` }],
            } as Message
            messagesRef.current = next
          }
          return next
        })
      }, 500)
      return
    }

    // Handle open IDE/editor commands
    if (isOpenIdeCommand) {
      setIsPreviewPanelOpen(true)
      setCurrentTab('ide')
      const userMsg: Message = { role: 'user', content: [{ type: 'text', text: message }] }
      const assistantMsg: Message = { role: 'assistant', content: [{ type: 'text', text: 'Opening the code editor...' }] }
      setMessages(prev => {
        const next = [...prev, userMsg, assistantMsg]
        messagesRef.current = next
        return next
      })
      return
    }

    // If currently streaming, queue the message instead of stopping
    if (isLoading || agenticStream.isStreaming) {
      const queued = { message, files, mode }
      setMessageQueue(prev => {
        const next = [...prev, queued]
        messageQueueRef.current = next
        return next
      })
      return
    }

    if (!currentModel) {
      setErrorMessage('No AI model is available. Check your model list and provider configuration.')
      return
    }

    const hadProjectBeforePrompt = !!currentProject
    const projectForPrompt = await ensureChatProject({ navigate: false })
    if (!projectForPrompt) {
      return
    }

    let currentInput = message

    // Inject selected style into the prompt
    if (selectedStyle) {
      if (selectedStyle === 'custom' && customStylePrompt) {
        currentInput = `${currentInput}

[Custom Style] ${customStylePrompt}`
      } else {
        const stylePreset = STYLE_PRESETS.find(s => s.id === selectedStyle)
        if (stylePreset) {
          currentInput = `${currentInput}

[Style: ${stylePreset.name}] ${stylePreset.prompt}`
        }
      }
    }

    const currentFiles = files
    const shouldRenameProject =
      projectForPrompt.title === DEFAULT_NEW_CHAT_TITLE &&
      messagesRef.current.length === 0
    // Don't force code tab — preserve user's current tab (e.g. IDE)

    const content: Message['content'] = [{ type: 'text', text: currentInput }]
    
    const images = await toMessageImage(currentFiles)
    if (images.length > 0) {
      images.forEach((image) => {
        content.push({ type: 'image', image })
      })
    }

    const newMessage: Message = {
      role: 'user',
      content,
    }
    const updatedMessages = [...messagesRef.current, newMessage]
    messagesRef.current = updatedMessages
    setMessages(updatedMessages)

    if (!hadProjectBeforePrompt) {
      pendingNavigateRef.current = projectForPrompt.id
      isLandingPagePromptRef.current = true
      try {
        sessionStorage.setItem('isLandingPagePrompt', 'true')
        sessionStorage.setItem('landingPageProjectId', projectForPrompt.id)
      } catch {}
      if (supabase) {
        void saveMessage(supabase, projectForPrompt.id, newMessage, 0)
      }
      router.push(`/chat/${projectForPrompt.id}`)
    }

    if (shouldRenameProject) {
      void renameProjectFromPrompt(projectForPrompt, currentInput)
    }

    if (mode === 'plan') {
      await submitPlanResponse(updatedMessages, projectForPrompt.id)
      setMessagesCount(prev => prev + 1)
      posthog.capture('chat_plan_submit', {
        template: selectedTemplate,
        model: languageModel.model,
      })
      return
    }

    if (!(await ensureGitHubConnectedBeforeCodeGeneration())) {
      return
    }

    try {
      if (useAgentic) {
        // Use real-time agentic streaming
        agenticStream.reset()
        agenticStream.submit({
          userID: session?.user?.id,
          teamID: userTeam?.id,
          accessToken: session?.access_token,
          projectID: projectForPrompt.id,
          sandboxID: result?.sbxId || warmSandboxResult?.sbxId,
          messages: toAISDKMessages(updatedMessages),
          template: getTemplateForSubmission(),
          model: currentModel,
          config: languageModel,
          ...(shouldUseMorph && fragment ? { currentFragment: fragment } : {}),
        })
      } else {
        submit({
          userID: session?.user?.id,
          teamID: userTeam?.id,
          projectID: projectForPrompt.id,
          messages: toAISDKMessages(updatedMessages),
          template: getTemplateForSubmission(),
          model: currentModel,
          config: languageModel,
          ...(shouldUseMorph && fragment ? { currentFragment: fragment } : {}),
        })
      }
    } catch (error) {
      console.error('Prompt submission failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Prompt submission failed.')
      return
    }

    // Enhanced chat analytics
    setMessagesCount(prev => prev + 1)
    
    const promptLength = currentInput.length
    const hasImages = currentFiles.length > 0
    
    // Track template selection
    if (selectedTemplate !== 'auto') {
      posthog.capture('template_selected', { template: selectedTemplate, source: 'manual' })
    }
        
    posthog.capture('chat_submit', {
      template: selectedTemplate,
      model: languageModel.model,
    })
  }

  async function retry() {
    if (!(await ensureGitHubConnectedBeforeCodeGeneration())) {
      return
    }

    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    setAutoFixMessage('')
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      projectID: currentProjectRef.current?.id,
      messages: toAISDKMessages(messagesRef.current),
      template: getTemplateForSubmission(fragment?.template),
      model: currentModel,
      config: languageModel,
      ...(shouldUseMorph && fragment ? { currentFragment: fragment } : {}),
    })
  }


  function logout() {
    if (supabase) {
      supabase.auth.signOut()
    } else {
      console.warn('Supabase is not initialized')
    }
  }

  function handleLanguageModelChange(e: LLMModelConfig) {
    const previousModel = languageModel.model
    const newModel = e.model
    
    if (previousModel && newModel && previousModel !== newModel) {
      // Track model switching
      posthog.capture('model_switch', {
        previousModel,
        newModel,
        source: 'experiment'
      })
      
      // Revenue tracking handled by analytics service
    }
    
    setLanguageModel({ ...languageModel, ...e })
  }

  async function createNewChatProject({ navigate = true }: { navigate?: boolean } = {}) {
    if (!session) {
      setAuthDialog(true)
      return null
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured, so a chat project cannot be created.')
      return null
    }

    let newProject: Project | null = null

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: DEFAULT_NEW_CHAT_TITLE,
          templateId: selectedTemplate === 'auto' ? undefined : selectedTemplate,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const code = data.code ? ` (${data.code})` : ''
        setErrorMessage(`${data.error || 'Could not create a new chat.'}${code}`)
        return null
      }

      newProject = data.project || null
    } catch (error) {
      console.error('Error creating chat project:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Could not create a new chat.')
      return null
    }

    if (!newProject) {
      setErrorMessage('Project creation API returned no project. Check Vercel logs for /api/projects.')
      return null
    }

    skipNextProjectMessagesLoadRef.current = newProject.id
    invalidateCache(new RegExp(`^projects:${session.user.id}:`))
    currentProjectRef.current = newProject
    setCurrentProject(newProject)
    setWarmSandboxResult(undefined)
    warmingSandboxKeyRef.current = ''
    setChatHistoryRefreshKey((key) => key + 1)
    if (navigate) {
      router.replace(`/chat/${newProject.id}`)
    }
    return newProject
  }

  async function ensureChatProject({ navigate = true }: { navigate?: boolean } = {}) {
    if (currentProject) {
      return currentProject
    }

    return createNewChatProject({ navigate })
  }

  async function renameProjectFromPrompt(project: Project, prompt: string) {
    if (!supabase) return

    try {
      const title = await generateProjectTitle(prompt)
      const updated = await updateProject(supabase, project.id, { title })

      if (updated) {
        setCurrentProject((current) =>
          current?.id === project.id ? { ...current, title } : current,
        )
        setChatHistoryRefreshKey((key) => key + 1)
      }
    } catch (error) {
      console.error('Error updating project title:', error)
    }
  }

  async function handleGitHubWorkspaceSaved(workspace: GitHubWorkspace) {
    if (!currentProject) return

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/github-workspace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workspace),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Could not connect this project to GitHub.')
      }

      if (data.project) {
        skipNextWorkspaceRestoreRef.current = data.project.id
        setCurrentProject(data.project)
        invalidateCache(new RegExp(`^projects:${session?.user?.id}:`))
        setChatHistoryRefreshKey((key) => key + 1)
      }
    } catch (error) {
      console.error('Error saving GitHub workspace metadata:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Could not connect this project to GitHub.')
    }
  }

  async function handleToggleProjectVisibility() {
    if (!currentProject) return

    const nextVisibility = !currentProject.is_public
    const updated = await updateProject(supabase, currentProject.id, {
      is_public: nextVisibility,
    })

    if (!updated) {
      setErrorMessage('Could not update project visibility.')
      return
    }

    setCurrentProject({
      ...currentProject,
      is_public: nextVisibility,
      updated_at: new Date().toISOString(),
    })
    invalidateCache(new RegExp(`^projects:${session?.user?.id}:`))
    setChatHistoryRefreshKey((key) => key + 1)
  }

  function scheduleGitHubFileSync(path: string, content: string) {
    const workspace = currentProject ? getProjectGitHubWorkspace(currentProject) : null

    if (!workspace?.autoSync) return

    if (githubSyncTimersRef.current[path]) {
      clearTimeout(githubSyncTimersRef.current[path])
    }

    githubSyncTimersRef.current[path] = setTimeout(() => {
      void syncFileToGitHub(workspace, path, content)
      delete githubSyncTimersRef.current[path]
    }, 1800)
  }

  async function syncFileToGitHub(workspace: GitHubWorkspace, path: string, content: string) {
    try {
      const repoPath = withGitHubPathPrefix(toRepoPath(path), workspace.pathPrefix)
      const response = await fetch(`/api/github/repos/${workspace.owner}/${workspace.repo}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: workspace.branch || 'main',
          message: `Update ${repoPath} from Magical AI`,
          files: [{ path: repoPath, content }],
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'GitHub sync failed.')
      }
    } catch (error) {
      console.error('GitHub auto-sync failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'GitHub auto-sync failed.')
    }
  }

  function resetChatState() {
    stop()
    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    lastSavedMessageSignatureRef.current = ''
    skipNextProjectMessagesLoadRef.current = ''
    isHydratingProjectMessagesRef.current = false
    messagesRef.current = []
    setMessages([])
    setFragment(undefined)
    setResult(undefined)
    setWarmSandboxResult(undefined)
    warmingSandboxKeyRef.current = ''
    initialTabSetRef.current = false
    setCurrentTab('code')
    setIsPreviewLoading(false)
    setAutoFixMessage('')
    setCurrentProject(null)
    currentProjectRef.current = null
    setIsPreviewPanelOpen(false)
  }

  function handleClearChat() {
    resetChatState()
    router.push('/')
  }

  function handleSidebarHomeClick() {
    resetChatState()
    router.push('/')
  }

  function handleProjectDeleted(projectId: string) {
    setRecentProjects((projects) => projects.filter((project) => project.id !== projectId))
    setProjectPreviews((previews) => {
      const nextPreviews = { ...previews }
      delete nextPreviews[projectId]
      return nextPreviews
    })
    invalidateCache(new RegExp(`^projects:${session?.user?.id}:`))
    setChatHistoryRefreshKey((key) => key + 1)

    if (currentProjectRef.current?.id === projectId) {
      resetChatState()
      router.push('/')
    }
  }

  function setCurrentPreview(preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) {
    setFragment(preview.fragment)
    setResult(preview.result)
  }

  function getReusableWarmSandboxId(nextFragment: DeepPartial<FragmentSchema>) {
    if (
      !warmSandboxResult?.sbxId ||
      !nextFragment?.template ||
      warmSandboxResult.template !== nextFragment.template
    ) {
      return undefined
    }

    return warmSandboxResult.sbxId
  }

  async function handleSaveFile(path: string, content: string) {
    if (!session) return

    try {
      const liveSandboxId = result?.sbxId || warmSandboxResult?.sbxId

      // 1. Save to RustFS directly (no live sandbox required)
      if (currentProject?.id) {
        try {
          await fetch(`/api/projects/${currentProject.id}/sandbox-storage-files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content }),
          })
        } catch {
          // Storage save is best-effort, don't block the rest
        }
      }

      // 2. Try to save to the live sandbox (optional, may fail if sandbox is dead)
      if (liveSandboxId) {
        try {
          const response = await fetch(`/api/sandbox/${liveSandboxId}/files/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, projectID: currentProject?.id }),
          })
          if (!response.ok) {
            console.warn('Live sandbox save failed (file saved to storage):', response.statusText)
          }
        } catch {
          // Sandbox save is best-effort, file is already in storage
        }
      } else {
        // Non-sandbox mode: save to IDE workspace
        try {
          await fetch('/api/files/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content }),
          })
        } catch {
          // Workspace save is best-effort
        }
      }

      // 3. Always trigger GitHub sync (file is in storage, sync works even if sandbox is dead)
      setErrorMessage('')
      scheduleGitHubFileSync(path, content)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  async function applyGeneratedSupabaseMigrations(fragmentToApply: DeepPartial<FragmentSchema>) {
    const migrations = Array.isArray(fragmentToApply.supabase_migrations)
      ? fragmentToApply.supabase_migrations
          .map((migration) => ({
            name: typeof migration?.name === 'string' ? migration.name.trim() : '',
            query: typeof migration?.query === 'string' ? migration.query.trim() : '',
          }))
          .filter((migration) => migration.name && migration.query)
      : []

    if (migrations.length === 0) {
      return true
    }

    const project = currentProjectRef.current

    if (!project?.id) {
      setErrorMessage('Create or open a Magical project before applying Supabase migrations.')
      return false
    }

    setAutoFixMessage(
      `Applying ${migrations.length} Supabase migration${migrations.length === 1 ? '' : 's'}...`,
    )

    try {
      for (const migration of migrations) {
        const response = await fetch('/api/supabase/migrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: migration.name,
            query: migration.query,
            projectId: project.id,
            projectTitle: project.title,
          }),
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || `Failed to apply ${migration.name}.`)
        }
      }

      return true
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Generated Supabase migrations could not be applied.',
      )
      return false
    } finally {
      setAutoFixMessage('')
    }
  }

  async function handleExecuteCode(code: string): Promise<any> {
    if (!session) {
      throw new Error('No active session')
    }

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          userID: session.user.id,
          teamID: userTeam?.id,
          accessToken: session.access_token,
        }),
      })

      if (!response.ok) {
        const errorData: { error?: string } = await response.json()
        throw new Error(errorData.error || 'Code execution failed')
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error executing code:', error)
      throw error
    }
  }

  async function handleRedeploy() {
    if (!fragment?.template || !currentProjectRef.current?.id) return
    setIsPreviewLoading(true)
    setAutoFixMessage('Redeploying sandbox...')
    try {
      const response = await fetch(`/api/projects/${currentProjectRef.current.id}/restore-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fragment,
          teamID: userTeam?.id,
          accessToken: session?.access_token,
          sandboxProvider,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Redeploy failed')
      }
      const newResult = data as ExecutionResult
      setResult(newResult)
      setWarmSandboxResult(newResult)
      setCurrentPreview({ fragment, result: newResult })
      setIsPreviewPanelOpen(true)
      setAutoFixMessage('')
    } catch (err) {
      console.error('Redeploy failed:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Redeploy failed')
      setAutoFixMessage('')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  function handleUndo() {
    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    setAutoFixMessage('')
    setMessages((previousMessages) => {
      const nextMessages = [...previousMessages.slice(0, -2)]
      messagesRef.current = nextMessages
      return nextMessages
    })
    setCurrentPreview({ fragment: undefined, result: undefined })
  }

  async function handleStartNewChat() {
    resetChatState()
    const newProject = await createNewChatProject()
    if (!newProject) {
      router.push('/')
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    // The actual filtering is handled in the Sidebar component
    // when it receives the search query through props
  }

  function handleGetFreeTokens() {
    // Open pricing modal to show subscription options and free token information
    setIsPricingModalOpen(true)
  }

  const isDashboardMode =
    !initialProjectId &&
    !currentProject &&
    !isLoadingProject &&
    messages.length === 0 &&
    !fragment &&
    !isPreviewPanelOpen
  const shouldShowPreviewPanel =
    !isDashboardMode && (isPreviewPanelOpen || Boolean(fragment) || Boolean(result))
  const projectHeaderTitle = currentProject?.title || 'Magical AI'
  const projectHeaderSubtitle = currentProjectGitHubWorkspace
    ? `Synced to ${currentProjectGitHubWorkspace.fullName}`
    : currentProjectR2Workspace
      ? 'Backed up to private storage'
    : currentProject
      ? 'Previewing last saved version'
      : 'Sign in to open this chat'
  const displayName =
    session?.user.user_metadata?.name ||
    session?.user.user_metadata?.full_name ||
    session?.user.email?.split('@')[0] ||
    'there'
  const promptInput = (
    <PromptInputBox
      onSend={handleSendPrompt}
      isLoading={isPromptLoading}
      chatMode={chatMode}
      onChatModeChange={setChatMode}
      sandboxProvider={sandboxProvider}
      onSandboxProviderChange={setSandboxProvider}
      onStop={handleStopGeneration}
      placeholder={
        chatMode === 'plan'
          ? 'Ask Magical AI to plan what to build...'
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
      useMorphApply={useMorphApply}
      onUseMorphApplyChange={setUseMorphApply}
      useAgentic={useAgentic}
      onUseAgenticChange={setUseAgentic}
      selectedStyle={selectedStyle}
      onStyleSelect={setSelectedStyle}
      onOpenStyleSelector={() => setShowStyleSelector(true)}
      className={!isDashboardMode ? "mb-0 border-white/10 bg-[#20211f] shadow-none" : undefined}
      messageHistory={messages.filter(m => m.role === 'user').map(m => {
        const textPart = m.content.find(c => c.type === 'text')
        return textPart && 'text' in textPart ? (textPart as any).text || '' : ''
      })}
    />
  )
  // Queue indicator when messages are queued while streaming
  const queueIndicator = messageQueue.length > 0 ? (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 md:mx-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex gap-1">
          {messageQueue.slice(0, 3).map((_, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full bg-blue-400/50" />
          ))}
        </div>
        <span className="text-[12px] text-white/40">{messageQueue.length} queued</span>
        <button
          onClick={() => { setMessageQueue([]); messageQueueRef.current = [] }}
          className="ml-auto text-[11px] text-white/30 hover:text-red-400 transition"
        >
          Clear all
        </button>
      </div>
      {messageQueue.map((q, i) => (
        <div key={i} className="flex items-center gap-2 py-1 border-t border-white/[0.04]">
          <span className="text-[12px] text-white/50 truncate flex-1">{q.message}</span>
          <button
            onClick={() => {
              const next = messageQueue.filter((_, idx) => idx !== i)
              setMessageQueue(next)
              messageQueueRef.current = next
            }}
            className="text-[11px] text-white/25 hover:text-red-400 transition shrink-0"
          >
            ×
          </button>
        </div>
      ))}
    </motion.div>
  ) : null
  const statusNotices = (
    <>
      {autoFixMessage && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm"
        >
          <LoaderIcon className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
          <span className="flex-1 min-w-0">{autoFixMessage}</span>
          {autoFixMessage.includes('Automatic fix') && (
            <button onClick={handleStopGeneration} className="px-3 py-1.5 rounded-lg hover:bg-amber-500/20 text-xs font-medium transition-colors shrink-0 text-amber-300">Stop</button>
          )}
        </motion.div>
      )}
      <AnimatePresence>
      {(error || errorMessage) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-red-400 font-medium">Generation failed</p>
              <p className="mt-1 text-xs text-red-400/70 break-words">{errorMessage || error?.message || 'An unexpected error occurred. Please try again.'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {fragment && (
              <button
                onClick={() => {
                  if (fragment) {
                    autoFixAttemptsRef.current = 0
                    lastAutoFixSignatureRef.current = ''
                    startAutoFix(fragment, errorMessage || error?.message || 'Unknown error')
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs font-medium transition-colors text-amber-400"
              >
                Auto Fix
              </button>
            )}
            <button onClick={retry} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors text-white/60">Retry</button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )

  return (
    <main className="flex h-dvh min-h-dvh overflow-hidden">
      {supabase && (
        <AuthDialog
          open={isAuthDialogOpen}
          setOpen={setAuthDialog}
          view={authView}
          supabase={supabase as unknown as SupabaseClient<any, "public", "public">}
        />
      )}

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />

      <AnimatePresence>
        {showStyleSelector && (
          <StyleSelector
            selectedStyle={selectedStyle}
            onSelectStyle={setSelectedStyle}
            customStylePrompt={customStylePrompt}
            onCustomStylePromptChange={setCustomStylePrompt}
            onClose={() => setShowStyleSelector(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar only shown in dashboard mode */}
      {session && isDashboardMode && (
        <Sidebar
          userPlan={userTeam?.tier}
          onChatSelected={handleChatSelected}
          onStartNewChat={handleStartNewChat}
          onSearch={handleSearch}
          onGetFreeTokens={handleGetFreeTokens}
          onSignOut={logout}
          searchQuery={searchQuery}
          refreshKey={chatHistoryRefreshKey}
          onHomeClick={handleSidebarHomeClick}
          onProjectDeleted={handleProjectDeleted}
        />
      )}

      <div
        className={cn(
          "grid min-w-0 flex-1 transition-all duration-300",
          isDashboardMode
            ? "w-full md:grid-cols-2"
            : shouldShowPreviewPanel
              ? "w-full grid-cols-1 md:grid-cols-[2fr_3fr]"
              : "w-full grid-cols-1",
        )}
      >
        <div
          className={cn(
            "relative flex h-[100dvh] w-full flex-col overflow-hidden",
            isDashboardMode
              ? "col-span-2 mx-auto max-w-none p-2 md:p-4"
              : "min-w-0 bg-[#111211]",
            isDashboardMode && (fragment || isPreviewPanelOpen ? 'col-span-1' : 'col-span-2'),
          )}
        >
          {!isDashboardMode && (
            <div className="flex h-[56px] shrink-0 items-center justify-between gap-1 border-b border-white/10 px-2 py-2 md:h-[64px] md:gap-3 md:px-4">
              <div className="min-w-0 flex-1 flex items-center gap-2">
                {/* Home button */}
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                  title="Dashboard"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
                {/* Project dropdown (like Lovable) */}
                <ProjectDropdownMenu
                  projectTitle={projectHeaderTitle}
                  projectSubtitle={projectHeaderSubtitle}
                  isPublic={currentProject?.is_public}
                  onToggleVisibility={handleToggleProjectVisibility}
                  onNewChat={handleStartNewChat}
                  onBackToDashboard={() => router.push('/')}
                />
                {/* Mode indicator */}
                <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px]">
                  <div className={`h-2 w-2 rounded-full ${isPromptLoading ? 'animate-pulse ' : ''}${chatMode === 'plan' ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                  <span className="text-white/50 uppercase font-medium tracking-wider">{chatMode === 'plan' ? 'Plan' : 'Build'}</span>
                  {isPromptLoading && (
                    <motion.div
                      className="h-1 w-1 rounded-full bg-white/40"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={messages.length <= 1 || isPromptLoading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-35"
                  title="Undo"
                >
                  <Undo className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-35"
                  title="Clear chat"
                >
                  <Trash className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (shouldShowPreviewPanel) {
                      setCurrentPreview({ fragment: undefined, result: undefined })
                      setIsPreviewPanelOpen(false)
                    } else {
                      setIsPreviewPanelOpen(true)
                      setCurrentTab('ide')
                    }
                  }}
                  className={cn(
                    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
                    shouldShowPreviewPanel
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                  )}
                  title={shouldShowPreviewPanel ? 'Close IDE' : 'Open IDE'}
                >
                  {shouldShowPreviewPanel ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{shouldShowPreviewPanel ? 'Close' : 'IDE'}</span>
                </button>
              </div>
            </div>
          )}

          {isDashboardMode ? (
            <div
              className="relative flex min-h-0 flex-1 overflow-hidden text-white"
            >
              <div className="relative z-10 flex w-full flex-col">
                {/* ─── Landing navbar (Meku-style, no logo, centered nav) ── */}
                {!session && isDashboardMode && (
                  <nav
                    className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] animate-[fadeDown_0.5s_ease-out]"
                  >
                    <div className="w-20" />
                    {/* Center nav links */}
                    <div className="hidden md:flex items-center gap-6">
                      <button type="button" onClick={() => router.push('/docs')} className="text-sm text-white/50 hover:text-white transition cursor-pointer bg-transparent border-none p-0">Docs</button>
                      <button type="button" onClick={() => router.push('/community')} className="text-sm text-white/50 hover:text-white transition cursor-pointer bg-transparent border-none p-0">Community</button>
                      <button type="button" onClick={() => router.push('/projects')} className="text-sm text-white/50 hover:text-white transition cursor-pointer bg-transparent border-none p-0">Templates</button>
                    </div>
                    {/* Right buttons */}
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => router.push('/auth/login')} className="text-sm text-white/60 hover:text-white transition cursor-pointer bg-transparent border-none p-0">
                        Sign In
                      </button>
                      <button type="button" onClick={() => router.push('/auth/register')} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 cursor-pointer border-none">
                        Start for Free
                      </button>
                    </div>
                  </nav>
                )}

                {/* ─── Signed-in top bar (centered nav) ──────────── */}
                {session && isDashboardMode && (
                  <nav
                    className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] animate-[fadeDown_0.5s_ease-out]"
                  >
                    <div className="w-20" />
                    <div className="hidden md:flex items-center gap-6">
                      <button type="button" onClick={() => router.push('/docs')} className="text-sm text-white/50 hover:text-white transition cursor-pointer bg-transparent border-none p-0">Docs</button>
                      <button type="button" onClick={() => router.push('/community')} className="text-sm text-white/50 hover:text-white transition cursor-pointer bg-transparent border-none p-0">Community</button>
                      <button type="button" onClick={() => router.push('/projects')} className="text-sm text-white/50 hover:text-white transition cursor-pointer bg-transparent border-none p-0">Templates</button>
                    </div>
                    <div className="w-20" />
                  </nav>
                )}

                <div className="flex flex-1 flex-col items-center justify-center px-3 pt-8 text-center sm:px-4 sm:pt-12">
                  {/* ─── Mesh gradient background (Meku-style) ─────────── */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Main mesh gradient orbs */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 2, ease: 'easeOut' }}
                      className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-br from-blue-500/15 via-purple-500/10 to-pink-500/8 rounded-full blur-[100px]"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 2.5, ease: 'easeOut', delay: 0.3 }}
                      className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-gradient-to-br from-violet-500/12 to-blue-500/8 rounded-full blur-[100px]"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 2.5, ease: 'easeOut', delay: 0.5 }}
                      className="absolute top-[25%] left-[5%] w-[350px] h-[350px] bg-gradient-to-br from-cyan-500/10 to-purple-500/8 rounded-full blur-[100px]"
                    />
                    {/* Subtle grid pattern overlay */}
                    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    {/* Bottom glow bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                  </div>

                  {!session ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    >
                      <div className="mb-4">
                        <div className="flex items-center justify-center">
                          <div className="flex -space-x-2">
                            {[
                              'bg-gradient-to-br from-blue-400 to-blue-600',
                              'bg-gradient-to-br from-purple-400 to-purple-600',
                              'bg-gradient-to-br from-pink-400 to-pink-600',
                              'bg-gradient-to-br from-cyan-400 to-cyan-600',
                              'bg-gradient-to-br from-emerald-400 to-emerald-600',
                            ].map((gradient, i) => (
                              <div key={i} className={`relative h-8 w-8 rounded-full ${gradient} ring-2 ring-[#0a0b0a] flex items-center justify-center text-[10px] font-bold text-white/80`} style={{ zIndex: 5 - i }}>
                                {['A', 'B', 'C', 'D', 'E'][i]}
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-white/40">Thousands of builders turning ideas into full-stack web apps with Magical AI</p>
                      </div>
                      <h1 className="mb-5 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl leading-tight">
                        Build Full-Stack Web Apps & Sites<br />with Simple AI Prompts
                      </h1>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    >
                      <div className="mb-4 sm:mb-6">
                        <HeroPillSecond />
                      </div>
                      <h1 className="mb-5 max-w-3xl text-xl font-semibold tracking-normal text-white sm:text-2xl sm:mb-7 md:text-4xl">
                        Let&apos;s build something, {displayName}
                      </h1>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                    className="w-full max-w-2xl"
                  >
                    {statusNotices}
                    {promptInput}
                    {queueIndicator}
                  </motion.div>
                </div>

                <div className="mx-auto mt-4 w-[calc(100%-1rem)] max-w-7xl border-t border-white/10 bg-[#111315]/80 p-2 backdrop-blur-md sm:mt-6 sm:w-[calc(100%-2rem)] sm:p-3 md:mt-8 md:p-4 lg:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:mb-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-1 text-xs text-white/60">
                      <button
                        type="button"
                        onClick={() => setProjectShelfViewAndReset('all')}
                        className={cn(
                          'inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 font-medium transition',
                          projectShelfView === 'all'
                            ? 'border-primary/50 bg-primary/15 text-primary'
                            : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white',
                        )}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        My projects
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectShelfViewAndReset('recent')}
                        className={cn(
                          'inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 font-medium transition',
                          projectShelfView === 'recent'
                            ? 'border-primary/50 bg-primary/15 text-primary'
                            : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white',
                        )}
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        Recently viewed
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectShelfViewAndReset('github')}
                        className={cn(
                          'inline-flex h-8 items-center justify-center gap-2 rounded-full border px-3 font-medium transition',
                          projectShelfView === 'github'
                            ? 'border-primary/50 bg-primary/15 text-primary'
                            : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white',
                        )}
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        Connected to GitHub
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                      <span>{recentProjects.length} project{recentProjects.length === 1 ? '' : 's'}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span>{githubProjectCount} connected to GitHub</span>
                      <Link
                        href="/projects"
                        className="ml-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                      >
                        Browse all
                      </Link>
                    </div>
                  </div>
                  <div className="max-h-[480px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {dashboardProjects.length > 0 ? dashboardProjects.slice(0, 6).map((project) => {
                      const workspace = getProjectGitHubWorkspace(project)
                      const r2Workspace = getProjectR2Workspace(project)
                      const preview = getProjectPreviewCard(project, projectPreviews[project.id])
                      const shouldLoadPreviewFrame = Boolean(preview.url && activePreviewProjectId === project.id)

                      return (
                        <div
                          key={project.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleChatSelected(project.id)}
                          onPointerEnter={() => {
                            if (preview.url) setActivePreviewProjectId(project.id)
                          }}
                          onPointerLeave={() => {
                            setActivePreviewProjectId((projectId) => (projectId === project.id ? '' : projectId))
                          }}
                          onFocus={() => {
                            if (preview.url) setActivePreviewProjectId(project.id)
                          }}
                          onBlur={() => {
                            setActivePreviewProjectId((projectId) => (projectId === project.id ? '' : projectId))
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              void handleChatSelected(project.id)
                            }
                          }}
                          className="group min-h-32 cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-left transition hover:border-white/15 hover:from-white/[0.08] hover:to-white/[0.03] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                        >
                          <div className="relative aspect-[16/9] overflow-hidden border-b border-white/10 bg-[#0b0d0b]">
                            {shouldLoadPreviewFrame ? (
                              <iframe
                                title={`${project.title} preview`}
                                src={preview.url}
                                loading="lazy"
                                sandbox="allow-forms allow-scripts allow-same-origin"
                                tabIndex={-1}
                                className="pointer-events-none absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 border-0 opacity-80 transition duration-300 group-hover:opacity-100"
                              />
                            ) : preview.imageUrl ? (
                              <div
                                className="absolute inset-0 bg-cover bg-center opacity-85 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
                                style={{ backgroundImage: toCssUrl(preview.imageUrl) }}
                              />
                            ) : preview.url ? (
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(84,198,139,0.24),transparent_34%),linear-gradient(135deg,#121814,#0b0d0b_60%,#10100c)]" />
                            ) : (
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,196,87,0.22),transparent_34%),linear-gradient(135deg,#151913,#0b0d0b_58%,#100d08)]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d0b]/85 via-transparent to-black/15" />
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium text-white/82">
                                {preview.template || project.template_id || 'Magical app'}
                              </span>
                              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white/65">
                                {preview.url || preview.imageUrl ? 'Preview' : 'No image'}
                              </span>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="line-clamp-2 text-sm font-semibold text-white">
                                  {preview.title || project.title}
                                </div>
                                <div className="mt-2 text-xs text-white/50">
                                  {new Date(project.updated_at).toLocaleDateString()}
                                </div>
                              </div>
                              <span className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/60">
                                {project.is_public ? 'Public' : 'Private'}
                              </span>
                            </div>
                            <div className="mt-5 flex items-center gap-2 text-xs text-white/65">
                              {workspace ? (
                                <>
                                  <GitBranch className="h-3.5 w-3.5 text-emerald-300" />
                                  <span className="truncate">{workspace.fullName}</span>
                                </>
                              ) : r2Workspace ? (
                                <>
                                  <FolderOpen className="h-3.5 w-3.5 text-sky-300" />
                                  <span>Private backup</span>
                                </>
                              ) : (
                                <>
                                  <FolderOpen className="h-3.5 w-3.5 text-white/45" />
                                  <span>Local project</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="clay-card p-5 text-sm text-white/70 md:col-span-2 xl:col-span-3">
                        {projectShelfView === 'github'
                          ? 'No projects are connected to GitHub yet.'
                          : 'Your Magical AI projects will appear here after your first chat.'}
                      </div>
                    )}
                    </div>
                  </div>
                  {dashboardProjects.length > 6 && (
                    <div className="mt-3 flex justify-center">
                      <Link
                        href="/projects"
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        Browse all {dashboardProjects.length} projects
                      </Link>
                    </div>
                  )}
                </div>

                {/* Footer links */}
                <div className="flex items-center justify-center gap-6 py-6 text-xs text-white/30">
                  <a href="https://discord.gg/p6Sz3X3YFe" target="_blank" rel="noopener noreferrer" className="transition hover:text-white/60">Discord</a>
                  <a href="#" className="transition hover:text-white/60">Terms</a>
                  <a href="#" className="transition hover:text-white/60">Privacy</a>
                  <span>Made by priyx</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1 sm:px-3 sm:py-2 md:px-3 md:py-2">
                {isLoadingProject ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4">
                    {/* Animated Magical logo */}
                    <div className="relative h-16 w-16">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 animate-ping" style={{ animationDuration: '2s' }} />
                      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="h-8 w-8 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                      </div>
                    </div>
                    {/* Animated steps */}
                    <div className="flex flex-col items-center gap-2">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-sm font-medium text-white/70"
                      >
                        Setting up environment
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-xs text-white/35"
                      >
                        Enhancing your prompt with AI
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="text-xs text-white/35"
                      >
                        Preparing workspace
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <Chat
                    messages={messages}
                    isLoading={isPromptLoading}
                    isPreviewLoading={isPreviewLoading}
                    currentFragment={fragment}
                    autoFixMessage={autoFixMessage}
                    onStop={() => { handleStopGeneration(); agenticStream.stop(); }}
                    onAcceptPlan={handleAcceptPlan}
                    setCurrentPreview={setCurrentPreview}
                    useAgentic={useAgentic}
                    agenticActions={useAgentic ? agenticStream.actions : []}
                    agenticTodos={useAgentic ? agenticStream.todos : []}
                    agenticStreaming={useAgentic && agenticStream.isStreaming}
                    onFileClick={(filePath) => {
                      // Switch to IDE tab and open the file
                      setCurrentTab('ide')
                      window.dispatchEvent(new CustomEvent('open-file', { detail: { path: filePath } }))
                    }}
                    sandboxSbxId={result?.sbxId}
                  />
                )}
              </div>

              <div className="shrink-0 border-t border-white/10 px-2 py-2 sm:px-3 sm:py-3 md:px-4">
                {/* Collapsible To-Do Bar — shows during and after generation */}
                {useAgentic && agenticStream.todos.length > 0 && (
                  <TodoBar todos={agenticStream.todos} />
                )}
                {statusNotices}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    {promptInput}
                    {queueIndicator}
                  </div>
                </div>
              </div>
            </>
            )}
        </div>
          <AnimatePresence>
          {shouldShowPreviewPanel && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn(
                "flex-1 overflow-hidden",
                "fixed inset-0 z-40 bg-[#111211] md:relative md:z-auto"
              )}
            >
              <Preview
                teamID={userTeam?.id}
                accessToken={session?.access_token}
                selectedTab={currentTab}
                onSelectedTabChange={setCurrentTab}
                isChatLoading={isPromptLoading}
                isPreviewLoading={isPreviewLoading}
                fragment={fragment}
                projectId={currentProject?.id}
                projectTitle={currentProject?.title}
                onGitHubWorkspaceSaved={handleGitHubWorkspaceSaved}
                githubSaveRequired={false}
                isGitHubWorkspaceConnected={isGitHubWorkspaceConnected}
                onSaveBlocked={() => {
                  setErrorMessage('Save this project to GitHub before editing files. Use Save to GitHub in the preview panel.')
                  setIsPreviewPanelOpen(true)
                }}
                result={previewExecutionResult}
                onClose={() => {
                  setCurrentPreview({ fragment: undefined, result: undefined })
                  setIsPreviewPanelOpen(false)
                }}
                code={fragment?.code || ''}
                onSave={handleSaveFile}
                onRedeploy={handleRedeploy}
                executeCode={handleExecuteCode}
                isSupabaseConnected={!!(currentProject?.metadata as any)?.supabaseProject}
                errorMessage={errorMessage || null}
                onDismissError={() => setErrorMessage('')}
              />
            </motion.div>
          )}
          </AnimatePresence>
      </div>
    </main>
  )
}

function getProjectGitHubWorkspace(project: Project | null): GitHubWorkspace | null {
  const workspace = project?.metadata?.githubWorkspace

  if (!workspace || typeof workspace !== 'object') {
    return null
  }

  const fullName =
    typeof workspace.fullName === 'string'
      ? workspace.fullName
      : `${workspace.owner || ''}/${workspace.repo || ''}`
  const [owner, repo] = fullName.split('/')

  if (!owner || !repo) {
    return null
  }

  return {
    fullName: `${owner}/${repo}`,
    owner,
    repo,
    branch: typeof workspace.branch === 'string' && workspace.branch ? workspace.branch : 'main',
    pathPrefix: typeof workspace.pathPrefix === 'string' ? workspace.pathPrefix : '',
    autoSync: workspace.autoSync !== false,
    lastCommitSha: typeof workspace.lastCommitSha === 'string' ? workspace.lastCommitSha : null,
  }
}

function getProjectR2Workspace(project: Project | null) {
  const workspace = project?.metadata?.r2Workspace

  if (
    !workspace ||
    typeof workspace !== 'object' ||
    workspace.provider !== 'cloudflare-r2' ||
    typeof workspace.keyPrefix !== 'string'
  ) {
    return null
  }

  return workspace
}

function getProjectSandboxStorageWorkspace(project: Project | null) {
  const workspace = project?.metadata?.sandboxStorage

  if (
    !workspace ||
    typeof workspace !== 'object' ||
    workspace.provider !== 'rustfs' ||
    typeof workspace.bucket !== 'string' ||
    typeof workspace.keyPrefix !== 'string'
  ) {
    return null
  }

  return workspace
}

function getProjectPreviewCard(project: Project, preview?: ProjectPreviewCard): ProjectPreviewCard {
  const metadata = project.metadata && typeof project.metadata === 'object' ? project.metadata : {}
  const metadataPreviewUrl =
    readSafeUrl(metadata.previewUrl) ||
    readSafeUrl(metadata.sandboxUrl) ||
    readSafeUrl(metadata.url)
  const metadataImageUrl =
    readSafeUrl(metadata.previewImageUrl) ||
    readSafeUrl(metadata.thumbnailUrl) ||
    readSafeUrl(metadata.imageUrl)

  return {
    url: preview?.url || metadataPreviewUrl || '',
    imageUrl: preview?.imageUrl || metadataImageUrl || '',
    title: preview?.title || project.title,
    description: preview?.description || project.description || '',
    template: preview?.template || project.template_id || '',
  }
}

function getMessageProjectPreview(
  resultData: Record<string, any> | null,
  objectData: Record<string, any> | null,
): ProjectPreviewCard {
  const resultTemplate = typeof resultData?.template === 'string' ? resultData.template : ''
  const objectTemplate = typeof objectData?.template === 'string' ? objectData.template : ''

  return {
    url: readSafeUrl(resultData?.url),
    imageUrl:
      readSafeUrl(objectData?.previewImageUrl) ||
      readSafeUrl(objectData?.thumbnailUrl) ||
      readSafeUrl(objectData?.imageUrl) ||
      readSafeUrl(resultData?.previewImageUrl) ||
      readSafeUrl(resultData?.thumbnailUrl) ||
      readSafeUrl(resultData?.imageUrl),
    title: typeof objectData?.title === 'string' ? objectData.title : '',
    description: typeof objectData?.description === 'string' ? objectData.description : '',
    template: resultTemplate || objectTemplate,
  }
}

function readSafeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }

  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function toCssUrl(value: string) {
  return `url("${value.replace(/["\\]/g, '\\$&')}")`
}

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && value in templates
}

function hasRestorableWorkspace(project: Project | null) {
  return Boolean(getProjectGitHubWorkspace(project) || getProjectR2Workspace(project) || getProjectSandboxStorageWorkspace(project))
}

function toRepoPath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/?home\/user\/?/, '')
    .replace(/^\/+/, '')
}

function withGitHubPathPrefix(path: string, prefix: string) {
  const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  const cleanPrefix = prefix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()

  return cleanPrefix ? `${cleanPrefix}/${cleanPath}` : cleanPath
}
