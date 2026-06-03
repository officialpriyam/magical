'use client'

import { ViewType } from '@/components/auth';
import { AuthDialog } from '@/components/auth-dialog';
import { Chat } from '@/components/chat';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { NavBar } from '@/components/navbar';
import { useAuth } from '@/lib/auth';
import dynamic from 'next/dynamic';
import { Project, createProject, saveMessage, getProjectMessages, generateProjectTitle, getProject } from '@/lib/database';
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages';
import { LLMModelConfig } from '@/lib/models';
import { FragmentSchema, fragmentSchema as schema } from '@/lib/schema';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import templates, { TemplateId } from '@/lib/templates';
import { ExecutionResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DeepPartial } from 'ai';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { useUserTeam } from '@/lib/user-team-provider';
import { HeroPillSecond } from '@/components/announcement';
import { SupabaseClient } from '@supabase/supabase-js';
import models from '@/lib/models.json';

const PricingModal = dynamic(() => import('@/components/pricing').then(mod => ({ default: mod.PricingModal })), {
  ssr: false,
});

const Sidebar = dynamic(() => import('@/components/sidebar').then(mod => ({ default: mod.Sidebar })), {
  ssr: false,
});

const Preview = dynamic(() => import('@/components/preview').then(mod => ({ default: mod.Preview })), {
  ssr: false,
});

export default function Home() {
  const supabase = createSupabaseBrowserClient()
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>('auto')
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: 'claude-3-5-sonnet-latest',
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
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema>>();
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
  
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  const { session } = useAuth(setAuthDialogCallback, setAuthViewCallback)
  const { userTeam } = useUserTeam()

  const handleChatSelected = async (chatId: string) => {
    const project = await getProject(supabase, chatId);
    if (project) {
      setCurrentProject(project);
    }
  };

  const filteredModels = models.models.filter((model: any) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      return model.providerId !== 'ollama'
    }
    return true
  })

  const currentModel = filteredModels.find(
    (model: any) => model.id === languageModel.model,
  );

  // Determine which API to use based on morph toggle and existing fragment
  const shouldUseMorph = useMorphApply && fragment && fragment.code && fragment.file_path
  const apiEndpoint = shouldUseMorph ? '/api/morph-chat' : '/api/chat'

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
          if (error.message.includes('limit') || error.message.includes('rate')) {
            isRateLimit = true
            displayMessage = 'Rate limit exceeded. Please try again later or use your own API key.'
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
      
      setIsRateLimited(isRateLimit);
      setErrorMessage(displayMessage);
    },
    onFinish: async ({ object: fragment, error }: { object: DeepPartial<FragmentSchema> | undefined, error: any }) => {
      if (!error && fragment) {
        setIsPreviewLoading(true);
        // Enhanced analytics tracking
        if (fragment.code && fragment.template) {
        }
        setFragmentsGenerated(prev => prev + 1)
        
        
        posthog.capture('fragment_generated', {
          template: fragment?.template,
        })

        const response = await fetch('/api/sandbox', {
          method: 'POST',
          body: JSON.stringify({
            fragment,
            userID: session?.user?.id,
            teamID: userTeam?.id,
            accessToken: session?.access_token,
          }),
        })

        const result = await response.json()
        
        if (!response.ok) {
          // If response is not ok, result is an error object
          const errorResult = result as { error?: string };
          console.error('Sandbox creation failed:', errorResult);
          setErrorMessage(errorResult.error || 'Failed to create sandbox environment');
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

        setResult(executionResult);
        setCurrentPreview({ fragment, result: executionResult });
        setMessage({ result: executionResult });
        setCurrentTab('fragment');
        setIsPreviewLoading(false);
      }
    },
  })

  useEffect(() => {
    async function loadProjectMessages() {
      if (!currentProject) {
        setMessages([])
        return
      }

      setIsLoadingProject(true)
      const projectMessages = await getProjectMessages(supabase, currentProject.id)
      setMessages(projectMessages)
      setIsLoadingProject(false)
    }

    loadProjectMessages()
  }, [currentProject, supabase])

  useEffect(() => {
    async function saveMessagesToDb() {
      if (!currentProject || !session || messages.length === 0) return

      const lastMessage = messages[messages.length - 1]
      const sequenceNumber = messages.length - 1

      await saveMessage(supabase, currentProject.id, lastMessage, sequenceNumber)
    }

    if (messages.length > 0 && currentProject && session) {
      saveMessagesToDb()
    }
  }, [messages, currentProject, session, supabase])

  useEffect(() => {
    if (object) {
      setFragment(object)
      const content: Message['content'] = [
        { type: 'text', text: object.commentary || '' },
        { type: 'code', text: object.code || '' },
      ]
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1]
        if (!lastMessage || lastMessage.role !== 'assistant') {
          return [
            ...prev,
            {
              role: 'assistant',
              content,
              object,
            },
          ]
        } else {
          const newMessages = [...prev]
          newMessages[prev.length - 1] = {
            ...lastMessage,
            content,
            object,
          }
          return newMessages
        }
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

  function setMessage(message: Partial<Message>, index?: number) {
    setMessages((previousMessages) => {
      const updatedMessages = [...previousMessages]
      updatedMessages[index ?? previousMessages.length - 1] = {
        ...previousMessages[index ?? previousMessages.length - 1],
        ...message,
      }
      return updatedMessages
    })
  }

  async function handleSendPrompt(message: string, files: File[] = []) {
    if (!session) {
      return setAuthDialog(true)
    }

    if (isLoading) {
      stop()
    }

    const currentInput = message
    const currentFiles = files
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
    const updatedMessages = [...messages, newMessage]
    setMessages(updatedMessages)

    const templateToSend =
      selectedTemplate === 'auto'
        ? templates
        : { [selectedTemplate]: templates[selectedTemplate] }

    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(updatedMessages),
      template: templateToSend,
      model: currentModel,
      config: languageModel,
      ...(shouldUseMorph && fragment ? { currentFragment: fragment } : {}),
    })

    if (!currentProject) {
      try {
        const title = await generateProjectTitle(currentInput)
        if (supabase) {
          const newProject = await createProject(supabase, title, selectedTemplate === 'auto' ? undefined : selectedTemplate)
          if (newProject) {
            setCurrentProject(newProject)
          }
        }
      } catch (error) {
        console.error('Error creating project:', error)
      }
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
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(messages),
      template: templates,
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

  function handleClearChat() {
    stop()
    setMessages([])
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    setIsPreviewLoading(false)
    setCurrentProject(null)
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
    setMessages((previousMessages) => [...previousMessages.slice(0, -2)])
    setCurrentPreview({ fragment: undefined, result: undefined })
  }

  function handleStartNewChat() {
    handleClearChat()
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
                setCurrentPreview={setCurrentPreview}
              />
            )}
          </div>
          
          <div className="space-y-4 mt-4">
            {error && (
              <div className="flex items-center justify-between p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                <span>{errorMessage}</span>
                <button onClick={retry} className="ml-4 p-1 rounded-md hover:bg-red-500/20">Retry</button>
              </div>
            )}
              <PromptInputBox
                onSend={handleSendPrompt}
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
