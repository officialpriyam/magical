'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'
import {
  TrendingUp,
  DollarSign,
  Users,
  Zap,
  Bot,
  Calendar,
  Download,
  RefreshCw,
  AlertTriangle,
  Target,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react'

// Business Intelligence Data Interfaces
interface RevenueMetrics {
  totalRevenue: number
  monthlyRevenue: number
  revenueGrowth: number
  averageRevenuePerUser: number
  lifetimeValue: number
  churnRate: number
  conversionRate: number
  trialConversionRate: number
}

interface UserSegmentation {
  totalUsers: number
  activeUsers: number
  paidUsers: number
  trialUsers: number
  enterpriseUsers: number
  userGrowthRate: number
  engagementScore: number
}

interface ProductAnalytics {
  totalFragmentsGenerated: number
  averageFragmentsPerUser: number
  mostPopularTemplates: Array<{ template: string; usage: number; revenue: number }>
  mostPopularModels: Array<{ model: string; usage: number; satisfaction: number }>
  featureAdoptionRates: Array<{ feature: string; adoptionRate: number; retentionImpact: number }>
  integrationUsage: Array<{ integration: string; users: number; revenue: number }>
}

interface ChurnAnalysis {
  churnRate: number
  churnReasons: Array<{ reason: string; percentage: number }>
  highRiskUsers: number
  savableUsers: number
  churnPrevention: {
    interventions: number
    successRate: number
    savedRevenue: number
  }
}

interface BusinessAnalyticsData {
  revenue: RevenueMetrics
  users: UserSegmentation
  product: ProductAnalytics
  churn: ChurnAnalysis
  trends: {
    daily: Array<{ date: string; revenue: number; users: number; fragments: number }>
    weekly: Array<{ week: string; revenue: number; conversions: number }>
    monthly: Array<{ month: string; revenue: number; churn: number; growth: number }>
  }
}

interface BusinessAnalyticsProps {
  className?: string
  timeRange?: '7d' | '30d' | '90d' | '1y'
  adminView?: boolean
}

export function BusinessAnalytics({ className, timeRange = '30d', adminView = false }: BusinessAnalyticsProps) {
  const [data, setData] = useState<BusinessAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('overview')

  const loadBusinessAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/analytics/business?timeRange=${timeRange}`)
      if (response.ok) {
        const analyticsData = await response.json()
        setData(analyticsData)
      } else {
        setError('Failed to load business analytics')
      }
    } catch (err) {
      setError('Failed to load business analytics')
      console.error('Business analytics error:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  const exportAnalytics = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const response = await fetch(`/api/analytics/export?format=${format}&timeRange=${timeRange}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `business-analytics-${timeRange}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  useEffect(() => {
    loadBusinessAnalytics()
  }, [loadBusinessAnalytics])

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error || 'No business analytics available'}</p>
            <Button onClick={loadBusinessAnalytics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { revenue, users, product, churn, trends } = data

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Export Options */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Business Intelligence Dashboard</h2>
          <p className="text-muted-foreground">Revenue analytics and growth insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportAnalytics('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => exportAnalytics('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${revenue.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{revenue.revenueGrowth}% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${revenue.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ${revenue.averageRevenuePerUser} ARPU
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.activeUsers.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="h-3 w-3 mr-1 text-blue-500" />
              {users.engagementScore}% engagement score
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{churn.churnRate}%</div>
            <p className="text-xs text-muted-foreground">
              {churn.highRiskUsers} users at risk
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="product">Product</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Daily revenue and user acquisition</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'revenue' ? `$${value}` : value,
                    name === 'revenue' ? 'Revenue' : name === 'users' ? 'New Users' : 'Fragments'
                  ]} />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="users" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Popular Templates */}
            <Card>
              <CardHeader>
                <CardTitle>Top Templates by Revenue</CardTitle>
                <CardDescription>Templates driving the most revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {product.mostPopularTemplates.map((template, index) => (
                    <div key={template.template} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{template.template}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">${template.revenue}</div>
                        <div className="text-xs text-muted-foreground">{template.usage} uses</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
                <CardDescription>User segments by subscription tier</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Free', value: users.totalUsers - users.paidUsers, color: '#94a3b8' },
                        { name: 'Pro', value: users.paidUsers - users.enterpriseUsers, color: '#3b82f6' },
                        { name: 'Enterprise', value: users.enterpriseUsers, color: '#10b981' },
                        { name: 'Trial', value: users.trialUsers, color: '#f59e0b' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                    >
                      {[
                        { name: 'Free', value: users.totalUsers - users.paidUsers, color: '#94a3b8' },
                        { name: 'Pro', value: users.paidUsers - users.enterpriseUsers, color: '#3b82f6' },
                        { name: 'Enterprise', value: users.enterpriseUsers, color: '#10b981' },
                        { name: 'Trial', value: users.trialUsers, color: '#f59e0b' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Lifetime Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">${revenue.lifetimeValue}</div>
                <Progress value={75} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">75% above industry average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{revenue.conversionRate}%</div>
                <Progress value={revenue.conversionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Trial to paid conversion</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trial Conversion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{revenue.trialConversionRate}%</div>
                <Progress value={revenue.trialConversionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Free to trial conversion</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Growth</CardTitle>
              <CardDescription>Revenue, churn, and growth trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'revenue' ? `$${value}` : `${value}%`,
                    name === 'revenue' ? 'Revenue' : name === 'churn' ? 'Churn Rate' : 'Growth Rate'
                  ]} />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="growth" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="churn" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product" className="space-y-6">
          {/* Feature Adoption */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption Rates</CardTitle>
              <CardDescription>Features by adoption rate and retention impact</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={product.featureAdoptionRates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="feature" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="adoptionRate" fill="#8884d8" />
                  <Bar dataKey="retentionImpact" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Model Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Model Performance</CardTitle>
                <CardDescription>Models by usage and satisfaction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {product.mostPopularModels.map((model, index) => (
                    <div key={model.model} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{model.model}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{model.usage}</div>
                        <div className="text-xs text-muted-foreground">{model.satisfaction}% satisfaction</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Revenue</CardTitle>
                <CardDescription>Revenue generated by integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {product.integrationUsage.map((integration, index) => (
                    <div key={integration.integration} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{integration.integration}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">${integration.revenue}</div>
                        <div className="text-xs text-muted-foreground">{integration.users} users</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="churn" className="space-y-6">
          {/* Churn Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Churn Reasons</CardTitle>
                <CardDescription>Why customers are leaving</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={churn.churnReasons.map((reason, index) => ({
                        ...reason,
                        color: `hsl(${index * 45}, 70%, 50%)`
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="percentage"
                    >
                      {churn.churnReasons.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Churn Prevention</CardTitle>
                <CardDescription>Intervention effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>High-risk users identified:</span>
                    <Badge variant="destructive">{churn.highRiskUsers}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Potentially savable:</span>
                    <Badge variant="outline">{churn.savableUsers}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Interventions launched:</span>
                    <span className="font-medium">{churn.churnPrevention.interventions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success rate:</span>
                    <span className="font-medium text-green-600">{churn.churnPrevention.successRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenue saved:</span>
                    <span className="font-bold text-green-600">${churn.churnPrevention.savedRevenue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}