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
    id: 'google-drive',
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
    id: 'google-calendar',
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

export default function IntegrationsSettings() {
  const { session } = useAuth(() => {}, () => {})
  const { toast } = useToast()
  const handledGitHubStatusRef = useRef(false)
  
  const [integrations, setIntegrations] = useState<UserIntegration[]>([])
  const [githubNotice, setGitHubNotice] = useState<GitHubNotice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadIntegrations = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      console.log('Loading integrations for user:', session.user.id)
      const userIntegrations = await getUserIntegrations(session.user.id)
      console.log('Loaded integrations:', userIntegrations)

      const statusResponse = await fetch('/api/github/status')
      if (statusResponse.ok) {
        const githubStatus = await statusResponse.json()
        const withoutGitHub = userIntegrations.filter(
          (integration) => integration.service_name !== 'github',
        )

        setIntegrations([
          ...withoutGitHub,
          {
            id: 'github',
            user_id: session.user.id,
            service_name: 'github',
            is_connected: Boolean(githubStatus.connected),
            connection_data: githubStatus,
            created_at: githubStatus.connected_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
      } else {
        setIntegrations(userIntegrations)
      }
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


  const getIntegrationStatus = useCallback((serviceId: string) => {
    const integration = integrations.find(integration => integration.service_name === serviceId)
    console.log(`Integration status for ${serviceId}:`, integration)
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
      if (serviceId === 'github') {
        window.location.assign('/api/github/connect')
        return
      }

      setConnecting(serviceId)

      console.log(`Connecting ${serviceId} for user:`, session.user.id)
      
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
      console.log(`Disconnecting ${serviceId} for user:`, session.user.id)

      const success = serviceId === 'github'
        ? await fetch('/api/github/disconnect', { method: 'POST' }).then(response => response.ok)
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
              
              console.log(`Service ${service.id}: connected=${isConnected}, integration=`, integration)
              
              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
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
                            {isHealthy ? "Connected" : "Needs Attention"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not connected</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                      {isConnected && integration?.connection_data &&
                       typeof integration.connection_data === 'object' &&
                       'connected_at' in integration.connection_data && (
                        <p className="text-xs text-muted-foreground">
                          Connected {new Date(integration.connection_data.connected_at as string).toLocaleDateString()}
                        </p>
                      )}
                      {service.id === 'github' &&
                        integration?.connection_data &&
                        typeof integration.connection_data === 'object' &&
                        'username' in integration.connection_data &&
                        integration.connection_data.username && (
                          <p className="text-xs text-muted-foreground">
                            @{integration.connection_data.username as string}
                          </p>
                        )}
                      {integration?.connection_data &&
                       typeof integration.connection_data === 'object' &&
                       'simulated' in integration.connection_data &&
                       integration.connection_data.simulated && (
                        <p className="text-xs text-yellow-600">
                          Simulated connection
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isConnected ? (
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
                    ) : service.id === 'github' ? (
                      <Button
                        asChild
                        variant="default"
                        size="sm"
                      >
                        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                        <a href="/api/github/connect">
                          <Plus className="h-4 w-4 mr-2" />
                          Connect
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConnect(service.id)}
                        disabled={isProcessing}
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
