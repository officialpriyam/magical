'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  Mail, 
  Calendar, 
  FolderOpen, 
  Plus, 
  Unlink,
  Loader2,
  RefreshCw,
  GitBranch,
  ExternalLink,
  Database,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { 
  getUserIntegrations, 
  upsertUserIntegration, 
  disconnectUserIntegration,
} from '@/lib/user-settings'
import { UserIntegration } from '@/lib/database.types'

const availableIntegrations = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Import private repositories and save generated code',
    icon: GitBranch,
    color: 'bg-neutral-900 text-white'
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Let AI create and apply database migrations for generated apps',
    icon: Database,
    color: 'bg-emerald-600 text-white'
  },
  {
    id: 'google_drive',
    name: 'Google Drive', 
    description: 'Import and export files from your Drive',
    icon: FolderOpen,
    color: 'bg-blue-600 text-white'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send emails and access your inbox',
    icon: Mail,
    color: 'bg-red-600 text-white'
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Schedule meetings and manage your calendar',
    icon: Calendar,
    color: 'bg-green-600 text-white'
  }
]

type GitHubNotice = {
  title: string
  description: string
  variant?: 'destructive'
}

const githubStatusMessages: Record<string, GitHubNotice> = {
  connected: {
    title: 'GitHub connected',
    description: 'Private repositories and generated-code saves are enabled.',
  },
  invalid_state: {
    title: 'GitHub connection expired',
    description: 'Start the GitHub connection again from this page.',
    variant: 'destructive',
  },
  login_required: {
    title: 'Sign in required',
    description: 'Sign in to Magical AI before connecting GitHub.',
    variant: 'destructive',
  },
  not_configured: {
    title: 'GitHub OAuth is not configured',
    description: 'Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel, then redeploy.',
    variant: 'destructive',
  },
  access_denied: {
    title: 'GitHub connection cancelled',
    description: 'Approve the GitHub OAuth request to connect your account.',
    variant: 'destructive',
  },
  authorization_failed: {
    title: 'GitHub authorization failed',
    description: 'Start the GitHub connection again and check the OAuth app settings.',
    variant: 'destructive',
  },
  token_exchange_failed: {
    title: 'GitHub token exchange failed',
    description: 'Check the GitHub OAuth client secret and callback URL.',
    variant: 'destructive',
  },
  user_lookup_failed: {
    title: 'GitHub account lookup failed',
    description: 'GitHub authorized the app, but account details could not be loaded.',
    variant: 'destructive',
  },
  storage_failed: {
    title: 'Could not save GitHub connection',
    description: 'Run the Supabase user_integrations migration, then connect again.',
    variant: 'destructive',
  },
  error: {
    title: 'GitHub connection failed',
    description: 'Check Vercel logs for the GitHub OAuth callback.',
    variant: 'destructive',
  },
}

const supabaseStatusMessages: Record<string, GitHubNotice> = {
  connected: {
    title: 'Supabase connected',
    description: 'AI can create one Supabase project per Magical project and apply generated migrations.',
  },
  invalid_state: {
    title: 'Supabase connection expired',
    description: 'Start the Supabase connection again from this page.',
    variant: 'destructive',
  },
  login_required: {
    title: 'Sign in required',
    description: 'Sign in to Magical AI before connecting Supabase.',
    variant: 'destructive',
  },
  not_configured: {
    title: 'Supabase OAuth is not configured',
    description: 'Add SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET in Vercel, then redeploy.',
    variant: 'destructive',
  },
  access_denied: {
    title: 'Supabase connection cancelled',
    description: 'Approve the Supabase OAuth request to connect your account.',
    variant: 'destructive',
  },
  authorization_failed: {
    title: 'Supabase authorization failed',
    description: 'Start the Supabase connection again and check the OAuth app settings.',
    variant: 'destructive',
  },
  token_exchange_failed: {
    title: 'Supabase token exchange failed',
    description: 'Check the exact callback URL and client secret. Magical retries Basic and body client auth by default; set SUPABASE_OAUTH_TOKEN_AUTH_METHOD only if your OAuth app requires one.',
    variant: 'destructive',
  },
  organization_lookup_failed: {
    title: 'Supabase organization lookup failed',
    description: 'The OAuth app needs organizations:read so Magical can choose where to create projects.',
    variant: 'destructive',
  },
  error: {
    title: 'Supabase connection failed',
    description: 'Check Vercel logs for the Supabase OAuth callback.',
    variant: 'destructive',
  },
}

function upsertLoadedIntegration(
  integrations: UserIntegration[],
  integration: UserIntegration,
) {
  const index = integrations.findIndex(
    (item) => item.service_name === integration.service_name,
  )

  if (index >= 0) {
    integrations[index] = integration
    return
  }

  integrations.push(integration)
}

export default function IntegrationsSettings() {
  const { session } = useAuth(() => {}, () => {})
  const { toast } = useToast()
  const handledGitHubStatusRef = useRef(false)
  const handledSupabaseStatusRef = useRef(false)
  
  const [integrations, setIntegrations] = useState<UserIntegration[]>([])
  const [githubNotice, setGitHubNotice] = useState<GitHubNotice | null>(null)
  const [supabaseNotice, setSupabaseNotice] = useState<GitHubNotice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadIntegrations = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      const userIntegrations = await getUserIntegrations(session.user.id)
      const [githubStatusResponse, supabaseStatusResponse] = await Promise.all([
        fetch('/api/github/status'),
        fetch('/api/supabase/status'),
      ])

      const normalizedIntegrations = [...userIntegrations]

      if (githubStatusResponse.ok) {
        const githubStatus = await githubStatusResponse.json()
        upsertLoadedIntegration(
          normalizedIntegrations,
          {
            id: 'github',
            user_id: session.user.id,
            service_name: 'github',
            is_connected: Boolean(githubStatus.connected),
            connection_data: githubStatus,
            created_at: githubStatus.connected_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        )
      }

      if (supabaseStatusResponse.ok) {
        const supabaseStatus = await supabaseStatusResponse.json()
        upsertLoadedIntegration(
          normalizedIntegrations,
          {
            id: 'supabase',
            user_id: session.user.id,
            service_name: 'supabase',
            is_connected: Boolean(supabaseStatus.connected),
            connection_data: supabaseStatus,
            created_at: supabaseStatus.connected_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        )
      }

      setIntegrations(normalizedIntegrations)
    } catch (error) {
      console.error('Error loading integrations:', error)
      toast({
        title: "Error",
        description: "Failed to load integrations. Please try again.",
        variant: "destructive",
      })
    }
  }, [session?.user?.id, toast])

  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoading(false)
      return
    }

    const initializeIntegrations = async () => {
      setIsLoading(true)
      await loadIntegrations()
      setIsLoading(false)
    }

    initializeIntegrations()
  }, [session?.user?.id, loadIntegrations])

  useEffect(() => {
    if (handledGitHubStatusRef.current || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const githubStatus = url.searchParams.get('github')

    if (!githubStatus) return

    handledGitHubStatusRef.current = true

    const message = githubStatusMessages[githubStatus] || githubStatusMessages.error

    setGitHubNotice(message)
    toast(message)

    if (githubStatus === 'connected') {
      void loadIntegrations()
    }

    url.searchParams.delete('github')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [loadIntegrations, toast])

  useEffect(() => {
    if (handledSupabaseStatusRef.current || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const supabaseStatus = url.searchParams.get('supabase')

    if (!supabaseStatus) return

    handledSupabaseStatusRef.current = true

    const message =
      supabaseStatusMessages[supabaseStatus] || supabaseStatusMessages.error

    setSupabaseNotice(message)
    toast(message)

    if (supabaseStatus === 'connected') {
      void loadIntegrations()
    }

    url.searchParams.delete('supabase')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [loadIntegrations, toast])


  const getIntegrationStatus = useCallback((serviceId: string) => {
    const integration = integrations.find(integration => integration.service_name === serviceId)
    return integration
  }, [integrations])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadIntegrations()
    setRefreshing(false)
    toast({
      title: "Refreshed",
      description: "Integration status updated.",
    })
  }

  const handleConnect = async (serviceId: string) => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "Please log in to connect integrations.",
        variant: "destructive",
      })
      return
    }

    try {
      if (serviceId === 'github' || serviceId === 'supabase') {
        window.location.assign(`/api/${serviceId}/connect`)
        return
      }

      setConnecting(serviceId)
      
      const success = await upsertUserIntegration(session.user.id, serviceId, {
        is_connected: true,
        connection_data: {
          connected_at: new Date().toISOString(),
          simulated: true,
        }
      })

      if (success) {
        await loadIntegrations()
        
        toast({
          title: "Success",
          description: `${availableIntegrations.find(int => int.id === serviceId)?.name} connected successfully.`,
        })
      } else {
        throw new Error('Failed to save integration to database')
      }
    } catch (error) {
      console.error('Error connecting service:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect service. Please try again.",
        variant: "destructive",
      })
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (serviceId: string) => {
    if (!session?.user?.id) return

    setDisconnecting(serviceId)
    
    try {
      const success = serviceId === 'github'
        ? await fetch('/api/github/disconnect', { method: 'POST' }).then(response => response.ok)
        : serviceId === 'supabase'
          ? await fetch('/api/supabase/disconnect', { method: 'POST' }).then(response => response.ok)
        : await disconnectUserIntegration(session.user.id, serviceId)

      if (success) {
        await loadIntegrations()
        
        toast({
          title: "Success",
          description: `${availableIntegrations.find(int => int.id === serviceId)?.name} disconnected successfully.`,
        })
      } else {
        throw new Error('Failed to disconnect service')
      }
    } catch (error) {
      console.error('Error disconnecting service:', error)
      toast({
        title: "Error",
        description: "Failed to disconnect service. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDisconnecting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect external services to enhance your workflow.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  if (!session?.user?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Please log in to manage your integrations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect external services to enhance your workflow.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {githubNotice && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            githubNotice.variant === 'destructive'
              ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <div className="font-medium">{githubNotice.title}</div>
          <div className="mt-1 opacity-90">{githubNotice.description}</div>
        </div>
      )}

      {supabaseNotice && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            supabaseNotice.variant === 'destructive'
              ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <div className="font-medium">{supabaseNotice.title}</div>
          <div className="mt-1 opacity-90">{supabaseNotice.description}</div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connected Services</CardTitle>
          <CardDescription>
            Manage your connected third-party services and applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availableIntegrations.map((service) => {
              const Icon = service.icon
              const integration = getIntegrationStatus(service.id)
              const isConnected = Boolean(integration?.is_connected)
              const isConnecting = connecting === service.id
              const isDisconnecting = disconnecting === service.id
              const isProcessing = isConnecting || isDisconnecting
              const isHealthy = isConnected
              const connectionData = integration?.connection_data &&
                typeof integration.connection_data === 'object'
                ? integration.connection_data
                : null
              const isEnvironmentSupabase =
                service.id === 'supabase' &&
                connectionData &&
                'source' in connectionData &&
                connectionData.source === 'environment'
              const isOAuthSupabase =
                service.id === 'supabase' &&
                connectionData &&
                'source' in connectionData &&
                connectionData.source === 'oauth'
              
              return (
                <div
                  key={service.id}
                  className="flex flex-col gap-4 border rounded-lg p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${service.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{service.name}</h4>
                        {isConnected ? (
                          <Badge variant={isHealthy ? "default" : "secondary"}>
                            {isEnvironmentSupabase
                              ? "Environment"
                              : isOAuthSupabase
                                ? "OAuth"
                              : isHealthy
                                ? "Connected"
                                : "Needs Attention"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not connected</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                      {isConnected && connectionData &&
                       'connected_at' in connectionData && (
                        <p className="text-xs text-muted-foreground">
                          Connected {new Date(connectionData.connected_at as string).toLocaleDateString()}
                        </p>
                      )}
                      {service.id === 'github' &&
                        connectionData &&
                        'username' in connectionData &&
                        connectionData.username && (
                          <p className="text-xs text-muted-foreground">
                            @{connectionData.username as string}
                          </p>
                        )}
                      {service.id === 'supabase' &&
                        connectionData &&
                        'projectRef' in connectionData &&
                        connectionData.projectRef && (
                          <p className="text-xs text-muted-foreground">
                            Project {connectionData.projectRef as string}
                          </p>
                        )}
                      {isEnvironmentSupabase && (
                        <p className="text-xs text-muted-foreground">
                          Configured through server environment variables.
                        </p>
                      )}
                      {isOAuthSupabase && (
                        <p className="text-xs text-muted-foreground">
                          Creates a separate Supabase project for each Magical project.
                        </p>
                      )}
                      {service.id === 'supabase' &&
                        connectionData &&
                        'organizationSlug' in connectionData &&
                        connectionData.organizationSlug && (
                          <p className="text-xs text-muted-foreground">
                            Organization {connectionData.organizationSlug as string}
                          </p>
                        )}
                      {connectionData &&
                       'simulated' in connectionData &&
                       connectionData.simulated && (
                        <p className="text-xs text-yellow-600">
                          Simulated connection
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 lg:min-w-72 lg:items-end">
                    <div className="flex items-center gap-2">
                    {isConnected && !isEnvironmentSupabase ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(service.id)}
                        disabled={isProcessing}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Unlink className="h-4 w-4 mr-2" />
                        )}
                        Disconnect
                      </Button>
                    ) : isEnvironmentSupabase ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConnect(service.id)}
                        disabled={isProcessing}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect account
                      </Button>
                    ) : service.id === 'github' || service.id === 'supabase' ? (
                      <Button
                        asChild
                        variant="default"
                        size="sm"
                      >
                        <a href={`/api/${service.id}/connect`}>
                          <Plus className="h-4 w-4 mr-2" />
                          Connect
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConnect(service.id)}
                        disabled={
                          isProcessing
                        }
                      >
                        {isConnecting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Connect
                      </Button>
                    )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Platform Capabilities</CardTitle>
          <CardDescription>
            Core features and capabilities enabled in your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-medium">Artifacts</h4>
                <p className="text-sm text-muted-foreground">
                  Enable creation and execution of code artifacts in the sandbox environment
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-medium">Fragment Templates</h4>
                <p className="text-sm text-muted-foreground">
                  Access to pre-built templates for common development patterns
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-medium">E2B Sandbox</h4>
                <p className="text-sm text-muted-foreground">
                  Cloud-based development environment for running and testing code
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Access</CardTitle>
          <CardDescription>
            Manage API keys and access tokens for external integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Personal Access Token</h4>
              <p className="text-sm text-muted-foreground">
                Generate tokens for API access and automation
              </p>
            </div>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Tokens
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
