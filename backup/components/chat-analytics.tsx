'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  MessageSquare,
  TrendingUp,
  Clock,
  Zap,
  Bot,
  Calendar,
  Trash2,
  RefreshCw,
} from 'lucide-react'

interface UserChatSummary {
  userId: string
  totalSessions: number
  totalMessages: number
  lastActivity: string
  favoriteModels: string[]
  favoriteTemplates: string[]
  totalTokensUsed?: number
  totalCost?: number
}

interface ChatAnalyticsProps {
  className?: string
}

export function ChatAnalytics({ className }: ChatAnalyticsProps) {
  const [summary, setSummary] = useState<UserChatSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/chat/analytics')
      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
      } else {
        setError('Failed to load analytics')
      }
    } catch (err) {
      setError('Failed to load analytics')
      console.error('Analytics error:', err)
    } finally {
      setLoading(false)
    }
  }

  const cleanupOldSessions = async (daysOld: number) => {
    try {
      const response = await fetch(`/api/chat/analytics?daysOld=${daysOld}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.deletedCount} old sessions`)
        loadAnalytics() // Refresh data
      }
    } catch (err) {
      console.error('Cleanup error:', err)
      alert('Failed to cleanup old sessions')
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !summary) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error || 'No analytics data available'}</p>
            <Button onClick={loadAnalytics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const averageMessagesPerSession = summary.totalSessions > 0 
    ? Math.round(summary.totalMessages / summary.totalSessions)
    : 0

  const modelData = summary.favoriteModels.slice(0, 5).map((model, index) => ({
    name: model,
    value: Math.max(10 - index * 2, 1), // Mock usage data
    color: `hsl(${index * 72}, 70%, 50%)`
  }))

  const templateData = summary.favoriteTemplates.slice(0, 5).map((template, index) => ({
    name: template,
    usage: Math.max(20 - index * 3, 2) // Mock usage data
  }))

  const activityData = [
    { day: 'Mon', sessions: Math.floor(Math.random() * 10) + 1 },
    { day: 'Tue', sessions: Math.floor(Math.random() * 10) + 1 },
    { day: 'Wed', sessions: Math.floor(Math.random() * 10) + 1 },
    { day: 'Thu', sessions: Math.floor(Math.random() * 10) + 1 },
    { day: 'Fri', sessions: Math.floor(Math.random() * 10) + 1 },
    { day: 'Sat', sessions: Math.floor(Math.random() * 10) + 1 },
    { day: 'Sun', sessions: Math.floor(Math.random() * 10) + 1 },
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              Chat conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              Messages exchanged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. per Session</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageMessagesPerSession}</div>
            <p className="text-xs text-muted-foreground">
              Messages per chat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {new Date(summary.lastActivity).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent chat
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>Chat sessions per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sessions" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Model Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Model Usage</CardTitle>
            <CardDescription>Your favorite AI models</CardDescription>
          </CardHeader>
          <CardContent>
            {modelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={modelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {modelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No model data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Favorite Models and Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Favorite Models</CardTitle>
            <CardDescription>Most used AI models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.favoriteModels.length > 0 ? (
                summary.favoriteModels.slice(0, 5).map((model, index) => (
                  <div key={model} className="flex items-center justify-between">
                    <Badge variant="outline">{model}</Badge>
                    <span className="text-sm text-muted-foreground">#{index + 1}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No model preferences yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Favorite Templates</CardTitle>
            <CardDescription>Most used templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.favoriteTemplates.length > 0 ? (
                summary.favoriteTemplates.slice(0, 5).map((template, index) => (
                  <div key={template} className="flex items-center justify-between">
                    <Badge variant="outline">{template}</Badge>
                    <span className="text-sm text-muted-foreground">#{index + 1}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No template preferences yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Manage your chat history and storage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary.totalTokensUsed && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Token Usage</span>
                  <span className="text-sm text-muted-foreground">{summary.totalTokensUsed.toLocaleString()}</span>
                </div>
                <Progress value={Math.min((summary.totalTokensUsed / 100000) * 100, 100)} />
              </div>
            )}

            <Separator />

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => cleanupOldSessions(30)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clean up 30+ days old
              </Button>
              <Button
                variant="outline"
                onClick={() => cleanupOldSessions(90)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clean up 90+ days old
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('/api/chat/export?format=json')}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Cleanup removes archived sessions older than specified days. Active sessions are never deleted.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}