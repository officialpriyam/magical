'use client'

import { ViewType } from '@/components/auth';
import { AuthDialog } from '@/components/auth-dialog';
import { Chat } from '@/components/chat';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { NavBar } from '@/components/navbar';
import { useAuth } from '@/lib/auth';
import dynamic from 'next/dynamic';
import { Project, saveMessage, getProjectMessages, generateProjectTitle, getProject, updateProject } from '@/lib/database';
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages';
import type { LLMModel, LLMModelConfig } from '@/lib/models';
import { FragmentSchema, fragmentSchema as schema } from '@/lib/schema';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import templates, { TemplateId } from '@/lib/templates';
import { ExecutionResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DeepPartial } from 'ai';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { useUserTeam } from '@/lib/user-team-provider';
import { HeroPillSecond } from '@/components/announcement';
import { SupabaseClient } from '@supabase/supabase-js';
import models from '@/lib/models.json';
import { invalidateCache } from '@/lib/caching';

const DEFAULT_MODEL_ID = 'models/gemini-2.0-flash'
const DEFAULT_NEW_CHAT_TITLE = 'New Chat'
const MAX_AUTO_FIX_ATTEMPTS = 2

function getSandboxErrorMessage(errorResult: { error?: string; type?: string }) {
  if (errorResult.type === 'config_error') {
    return 'AI generated the code, but preview cannot start because E2B_API_KEY is missing in Vercel.'
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

type HomeProps = {
  initialProjectId?: string
}

export default function Home({ initialProjectId }: HomeProps = {}) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>('auto')
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: DEFAULT_MODEL_ID,
    },
  )
  const [useMorphApply, setUseMorphApply] = useLocalStorage(
    'useMorphApply',
    process.env.NEXT_PUBLIC_USE_MORPH_APPLY === 'true',
  )

  const posthog = usePostHog()

  const [result, setResult] = useState<ExecutionResult>()
  const [sessionStartTime] = useState(Date.now())
  const [fragmentsGenerated, setFragmentsGenerated] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [errorsEncountered, setErrorsEncountered] = useState(0)
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([])
  const autoFixAttemptsRef = useRef(0)
  const lastAutoFixSignatureRef = useRef('')
  const skipNextProjectMessagesLoadRef = useRef('')
  const isHydratingProjectMessagesRef = useRef(false)
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema>>();
  const [availableModels, setAvailableModels] = useState<LLMModel[]>(models.models as LLMModel[])
  const [currentTab, setCurrentTab] = useState<'code' | 'fragment' | 'terminal' | 'interpreter' | 'editor' | 'files' | 'ide'>('code');
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPanelOpen, setIsPreviewPanelOpen] = useState(false);
  const [isAuthDialogOpen, setAuthDialog] = useState(false);
  const [authView, setAuthView] = useState<ViewType>('sign_in')
  const [, setIsRateLimited] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const setAuthDialogCallback = useCallback((isOpen: boolean) => {
    setAuthDialog(isOpen)
  }, [setAuthDialog])

  const setAuthViewCallback = useCallback((view: ViewType) => {
    setAuthView(view)
  }, [setAuthView])
  const [errorMessage, setErrorMessage] = useState('')
  const [autoFixMessage, setAutoFixMessage] = useState('')
  
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [chatHistoryRefreshKey, setChatHistoryRefreshKey] = useState(0)
  const [projectMessagesRefreshKey, setProjectMessagesRefreshKey] = useState(0)

  const { session } = useAuth(setAuthDialogCallback, setAuthViewCallback)
  const { userTeam } = useUserTeam()
  const currentProjectId = currentProject?.id

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const handleChatSelected = async (chatId: string) => {
    skipNextProjectMessagesLoadRef.current = ''
    const project = await getProject(supabase, chatId);
    if (project) {
      setErrorMessage('')
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

  const currentModel =
    filteredModels.find((model: any) => model.id === languageModel.model) ||
    filteredModels.find((model: any) => model.id === DEFAULT_MODEL_ID) ||
    filteredModels[0]

  // Determine which API to use based on morph toggle and existing fragment
  const shouldUseMorph = useMorphApply && fragment && fragment.code && fragment.file_path
  const apiEndpoint = shouldUseMorph ? '/api/chat/morph-chat' : '/api/chat'

  useEffect(() => {
    const projectId = initialProjectId
    if (!projectId || !session?.user?.id) return

    let isMounted = true

    async function loadInitialProject(projectId: string) {
      setIsLoadingProject(true)
      const project = await getProject(supabase, projectId)

      if (!isMounted) return

      if (!project) {
        setIsLoadingProject(false)
        setErrorMessage('Chat not found or you do not have access.')
        router.replace('/')
        return
      }

      setCurrentProject(project)
      setResult(undefined)
      setFragment(undefined)
      setSelectedFile(null)
      setCurrentTab('code')
      setIsPreviewLoading(false)
      setIsPreviewPanelOpen(false)
      setIsLoadingProject(false)
    }

    loadInitialProject(projectId)

    return () => {
      isMounted = false
    }
  }, [initialProjectId, router, session?.user?.id, supabase])

  useEffect(() => {
    let isMounted = true

    async function loadModels() {
      try {
        const response = await fetch('/api/models')
        if (!response.ok) return

        const data = await response.json()
        if (isMounted && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models)
        }
      } catch (error) {
        console.warn('Using bundled model list because dynamic models failed:', error)
      }
    }

    loadModels()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (filteredModels.length === 0) return

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
    },
    onFinish: async ({ object: fragment, error }: { object: DeepPartial<FragmentSchema> | undefined, error: any }) => {
      if (error) {
        setAutoFixMessage('')
        setIsPreviewLoading(false)
        setErrorMessage(error instanceof Error ? error.message : 'AI generation failed.')
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
            }),
          })
          result = await response.json()
        } catch (sandboxError) {
          console.error('Sandbox request failed:', sandboxError)
          setAutoFixMessage('')
          setErrorMessage('AI generated the code, but preview setup failed. Check E2B configuration on Vercel.')
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
        setResult(executionResult);
        setCurrentPreview({ fragment, result: executionResult });

        const executionErrorDetails = getExecutionErrorDetails(executionResult)
        if (executionErrorDetails) {
          if (startAutoFix(fragment, executionErrorDetails, executionResult)) {
            setCurrentTab('interpreter');
            setIsPreviewLoading(false);
            return;
          }

          setAutoFixMessage('')
          setErrorMessage('Generated code still has runtime errors. Review the interpreter output or try a different prompt.')
          setCurrentTab('interpreter');
          setIsPreviewLoading(false);
          return;
        }

        autoFixAttemptsRef.current = 0
        lastAutoFixSignatureRef.current = ''
        setAutoFixMessage('')
        setCurrentTab('fragment');
        setIsPreviewLoading(false);
    },
  })

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
    const assistantMessage: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: assistantFragment.commentary || '' },
        { type: 'code', text: assistantFragment.code || '' },
      ],
      object: assistantFragment,
      result: executionResult,
    }

    const nextMessages = [...currentMessages]
    const lastMessage = nextMessages[nextMessages.length - 1]

    if (lastMessage?.role === 'assistant') {
      nextMessages[nextMessages.length - 1] = {
        ...lastMessage,
        ...assistantMessage,
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
    if (!session || !currentModel || !fragmentToFix?.code) {
      return false
    }

    const signature = [
      fragmentToFix.template,
      fragmentToFix.file_path,
      fragmentToFix.code,
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
    setErrorMessage('')
    setAutoFixMessage(`Automatic fix ${attempt}/${MAX_AUTO_FIX_ATTEMPTS} is running...`)
    setCurrentTab('code')

    try {
      submit({
        userID: session.user.id,
        teamID: userTeam?.id,
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

  useEffect(() => {
    let isMounted = true

    async function loadProjectMessages() {
      if (!currentProjectId) {
        skipNextProjectMessagesLoadRef.current = ''
        isHydratingProjectMessagesRef.current = false
        messagesRef.current = []
        setMessages([])
        return
      }

      if (skipNextProjectMessagesLoadRef.current === currentProjectId) {
        skipNextProjectMessagesLoadRef.current = ''
        isHydratingProjectMessagesRef.current = false
        setIsLoadingProject(false)
        return
      }

      setIsLoadingProject(true)
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
      setSelectedFile(null)
      setCurrentTab(latestPreviewMessage?.object ? 'fragment' : 'code')
      setIsLoadingProject(false)
    }

    loadProjectMessages()

    return () => {
      isMounted = false
    }
  }, [currentProjectId, projectMessagesRefreshKey, supabase])

  useEffect(() => {
    async function saveMessagesToDb() {
      if (!currentProjectId || !session || messages.length === 0) return

      if (isHydratingProjectMessagesRef.current) {
        isHydratingProjectMessagesRef.current = false
        return
      }

      const lastMessage = messages[messages.length - 1]
      const sequenceNumber = messages.length - 1

      await saveMessage(supabase, currentProjectId, lastMessage, sequenceNumber)
    }

    if (messages.length > 0 && currentProjectId && session) {
      saveMessagesToDb()
    }
  }, [messages, currentProjectId, session, supabase])

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
        const sessionDuration = Date.now() - sessionStartTime
        posthog.capture('session_end', {
          duration: sessionDuration,
          fragments_generated: fragmentsGenerated,
          messages_count: messagesCount,
          errors_encountered: errorsEncountered
        })
      }
    }
  }, [session?.user?.id, sessionStartTime, fragmentsGenerated, messagesCount, errorsEncountered])

  async function handleSendPrompt(message: string, files: File[] = []) {
    if (!session) {
      return setAuthDialog(true)
    }

    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    setErrorMessage('')
    setAutoFixMessage('')

    if (isLoading) {
      stop()
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

    const currentInput = message
    const currentFiles = files
    const shouldRenameProject =
      projectForPrompt.title === DEFAULT_NEW_CHAT_TITLE &&
      messagesRef.current.length === 0
    setCurrentTab('code')

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

    try {
      submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(updatedMessages),
      template: getTemplateForSubmission(),
      model: currentModel,
      config: languageModel,
      ...(shouldUseMorph && fragment ? { currentFragment: fragment } : {}),
      })
    } catch (error) {
      console.error('Prompt submission failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Prompt submission failed.')
      return
    }

    if (!hadProjectBeforePrompt) {
      window.history.replaceState(null, '', `/chat/${projectForPrompt.id}`)
    }

    if (shouldRenameProject) {
      void renameProjectFromPrompt(projectForPrompt, currentInput)
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

  function retry() {
    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    setAutoFixMessage('')
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
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

  function handleSocialClick(target: 'github' | 'x' | 'discord') {
    if (target === 'github') {
      window.open('https://github.com/priyx/magical-ai', '_blank')
    } else if (target === 'x') {
      window.open('https://x.com/priyx', '_blank')
    }

    // Enhanced social tracking
    posthog.capture(`${target}_click`, { target })
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
    setCurrentProject(newProject)
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

  function resetChatState() {
    stop()
    autoFixAttemptsRef.current = 0
    lastAutoFixSignatureRef.current = ''
    skipNextProjectMessagesLoadRef.current = ''
    isHydratingProjectMessagesRef.current = false
    messagesRef.current = []
    setMessages([])
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    setIsPreviewLoading(false)
    setAutoFixMessage('')
    setCurrentProject(null)
    setSelectedFile(null)
    setIsPreviewPanelOpen(false)
  }

  function handleClearChat() {
    resetChatState()
    router.push('/')
  }

  function setCurrentPreview(preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) {
    setFragment(preview.fragment)
    setResult(preview.result)
  }

  async function handleSaveFile(path: string, content: string) {
    if (!session) return

    try {
      // Check if this is a sandbox file (when result.sbxId exists)
      if (result?.sbxId) {
        // Save to sandbox
        const response = await fetch(`/api/sandbox/${result.sbxId}/files/content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path,
            content
          }),
        })

        if (response.ok) {
          // Update selected file only if it's the same file being edited
          if (selectedFile?.path === path) {
            setSelectedFile({ path, content })
          }
        } else {
          console.error('Failed to save sandbox file:', response.statusText)
        }
      } else {
        // Save to IDE workspace
        const response = await fetch('/api/files/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path,
            content
          }),
        })

        if (response.ok) {
          // Update selected file only if it's the same file being edited
          if (selectedFile?.path === path) {
            setSelectedFile({ path, content })
          }
        } else {
          console.error('Failed to save file:', response.statusText)
        }
      }
    } catch (error) {
      console.error('Error saving file:', error)
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


  return (
    <main className="flex min-h-screen max-h-screen">
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

      {session && (
        <Sidebar
          userPlan={userTeam?.tier}
          onChatSelected={handleChatSelected}
          onStartNewChat={handleStartNewChat}
          onSearch={handleSearch}
          onGetFreeTokens={handleGetFreeTokens}
          onSignOut={logout}
          searchQuery={searchQuery}
          refreshKey={chatHistoryRefreshKey}
        />
      )}

      <div className={cn(
        "grid w-full md:grid-cols-2 transition-all duration-300",
        session ? "ml-16" : ""
      )}>
        <div
          className={`flex flex-col w-full h-screen max-w-[800px] mx-auto px-4 ${fragment || isPreviewPanelOpen ? 'col-span-1' : 'col-span-2'}`}
        >
          <NavBar
            session={session}
            showLogin={() => setAuthDialog(true)}
            signOut={logout}
            onSocialClick={handleSocialClick}
            onClear={handleClearChat}
            canClear={messages.length > 0}
            canUndo={messages.length > 1 && !isLoading}
            onUndo={handleUndo}
            onTogglePanel={() => {
              setIsPreviewPanelOpen(!isPreviewPanelOpen)
              if (!isPreviewPanelOpen) {
                setCurrentTab('ide')
              }
            }}
            isPanelOpen={isPreviewPanelOpen || !!fragment}
          />
          
          <div className="flex justify-center mb-4">
            <HeroPillSecond />
          </div>

          <div className="flex-grow overflow-y-auto">
            {isLoadingProject ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading project...</div>
              </div>
            ) : (
              <Chat
                messages={messages}
                isLoading={isLoading}
                isPreviewLoading={isPreviewLoading}
                currentFragment={fragment}
                autoFixMessage={autoFixMessage}
                setCurrentPreview={setCurrentPreview}
              />
            )}
          </div>
          
          <div className="space-y-4 mt-4">
            {autoFixMessage && (
              <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 text-sm">
                <span>{autoFixMessage}</span>
                <button onClick={stop} className="ml-4 p-1 rounded-md hover:bg-amber-500/20">Stop</button>
              </div>
            )}
            {(error || errorMessage) && (
              <div className="flex items-center justify-between p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                <span>{errorMessage || error?.message || 'AI generation failed.'}</span>
                <button onClick={retry} className="ml-4 p-1 rounded-md hover:bg-red-500/20">Retry</button>
              </div>
            )}
              <PromptInputBox
                onSend={handleSendPrompt}
                isLoading={isLoading}
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
              />
          </div>
        </div>
          <Preview
          teamID={userTeam?.id}
          accessToken={session?.access_token}
          selectedTab={currentTab}
          onSelectedTabChange={setCurrentTab}
          isChatLoading={isLoading}
          isPreviewLoading={isPreviewLoading}
          fragment={fragment}
          result={result as ExecutionResult}
          onClose={() => {
            setFragment(undefined)
            setIsPreviewPanelOpen(false)
          }}
          code={fragment?.code || ''}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onSave={handleSaveFile}
          executeCode={handleExecuteCode}
          />
      </div>
    </main>
  )
}
