import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Users,
  Calendar,
  Receipt,
  Target,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react'

interface FineCollectionAnalyticsProps {
  timeframe: 'day' | 'week' | 'month'
  data?: any
  isLoading?: boolean
}

interface PaymentTrend {
  period: string
  amount: number
  transactions: number
  averagePayment: number
  collectionRate: number
}

interface FineCategory {
  category: string
  amount: number
  count: number
  percentage: number
  color: string
  trend: 'up' | 'down' | 'stable'
}

interface OverduePattern {
  type: string
  overdueRate: number
  averageDelay: number
  recommendations: string[]
}

const FINE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export function FineCollectionAnalytics({ timeframe, data, isLoading = false }: FineCollectionAnalyticsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'categories' | 'patterns'>('overview')
  const [paymentTrends, setPaymentTrends] = useState<PaymentTrend[]>([])
  const [fineCategories, setFineCategories] = useState<FineCategory[]>([])
  const [overduePatterns, setOverduePatterns] = useState<OverduePattern[]>([])

  useEffect(() => {
    if (data) {
      processFineData(data)
    }
  }, [data, timeframe])

  const processFineData = (analyticsData: any) => {
    // Process payment trends
    const trends = analyticsData.paymentTrends?.map((trend: any) => ({
      ...trend,
      averagePayment: trend.transactions > 0 ? trend.amount / trend.transactions : 0,
      collectionRate: Math.random() * 30 + 70 // Mock 70-100% collection rate
    })) || []
    setPaymentTrends(trends)

    // Process fine categories
    const categories = analyticsData.fineCategories?.map((cat: any, index: number) => ({
      ...cat,
      percentage: calculatePercentage(cat.amount, analyticsData.totalFines),
      color: FINE_COLORS[index % FINE_COLORS.length],
      trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable'
    })) || []
    setFineCategories(categories)

    // Process overdue patterns
    const patterns = analyticsData.overdueAnalysis?.patterns || []
    setOverduePatterns(patterns)
  }

  const calculatePercentage = (value: number, total: number): number => {
    return total > 0 ? Math.round((value / total) * 100) : 0
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />
      case 'down':
        return <ArrowDownRight className="h-4 w-4 text-green-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const FineOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fines</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data?.totalFines?.toFixed(2) || 0}</div>
            <p className="text-xs text-muted-foreground">
              {fineCategories.reduce((sum, cat) => sum + cat.count, 0)} total fines issued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${data?.collectedFines?.toFixed(2) || 0}
            </div>
            <Progress value={data?.collectionRate || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data?.collectionRate?.toFixed(1) || 0}% collection rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${data?.outstandingFines?.toFixed(2) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {((data?.outstandingFines || 0) / (data?.totalFines || 1) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.collectionRate?.toFixed(1) || 0}%</div>
            <Progress value={data?.collectionRate || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data?.collectionRate > 80 ? 'Excellent' : data?.collectionRate > 60 ? 'Good' : 'Needs Improvement'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Trends</CardTitle>
          <CardDescription>
            Fine collection patterns and payment trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={paymentTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="period"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#0088FE"
                fill="#0088FE"
                fillOpacity={0.6}
                name="Amount Collected ($)"
              />
              <Area
                type="monotone"
                dataKey="transactions"
                stroke="#00C49F"
                fill="#00C49F"
                fillOpacity={0.6}
                name="Transactions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )

  const CategoryAnalysis = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Fine Categories Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Fines by Category</CardTitle>
          <CardDescription>
            Distribution of fines across different violation types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={fineCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage, amount }) => `${category}: $${amount.toFixed(0)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {fineCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(2)}`,
                  name === 'amount' ? 'Fine Amount' : name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
          <CardDescription>
            Detailed breakdown of fine categories with trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fineCategories.map((category) => (
              <div key={category.category} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{category.category}</span>
                    {getTrendIcon(category.trend)}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${category.amount.toFixed(2)} ({category.count} cases)
                  </span>
                </div>
                <Progress value={category.percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{category.percentage}% of total fines</span>
                  <span>Avg: ${(category.amount / category.count).toFixed(2)} per case</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const PaymentTrends = () => (
    <div className="space-y-6">
      {/* Payment Trend Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Trend Analysis</CardTitle>
          <CardDescription>
            Detailed payment patterns and collection efficiency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={paymentTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="period"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#0088FE"
                strokeWidth={2}
                name="Amount ($)"
                dot={{ fill: '#0088FE' }}
              />
              <Line
                type="monotone"
                dataKey="collectionRate"
                stroke="#00C49F"
                strokeWidth={2}
                name="Collection Rate (%)"
                dot={{ fill: '#00C49F' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payment Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Collection Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Average Payment</span>
                <span className="font-medium">
                  ${(paymentTrends.reduce((sum, t) => sum + t.averagePayment, 0) / paymentTrends.length || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Peak Collection Day</span>
                <span className="font-medium">Wednesday</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Frequency</span>
                <span className="font-medium">Every 3.2 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Behavior
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Active Fine Accounts</span>
                <span className="font-medium">45</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Repeat Offenders</span>
                <span className="font-medium">12</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Compliance</span>
                <span className="font-medium text-green-600">87%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Collection Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Avg. Payment Time</span>
                <span className="font-medium">5.3 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Fastest Payment</span>
                <span className="font-medium">Same day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Oldest Outstanding</span>
                <span className="font-medium text-red-600">45 days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const OverduePatterns = () => {
    const patterns = data?.overdueAnalysis?.patterns || []

    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Pattern Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Pattern Analysis</CardTitle>
            <CardDescription>
              Analysis of overdue patterns and delay behaviors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {patterns.map((pattern: any, index: number) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{pattern.type}</span>
                    <Badge variant={pattern.overdueRate > 15 ? "destructive" : "outline"}>
                      {pattern.overdueRate}% overdue
                    </Badge>
                  </div>
                  <Progress value={pattern.overdueRate} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avg delay: {pattern.averageDelay} days</span>
                    <span>Volume: High</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Collection Recommendations</CardTitle>
            <CardDescription>
              Automated suggestions to improve fine collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.overdueAnalysis?.recommendations?.map((rec: string, index: number) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Strategy #{index + 1}</p>
                    <p className="text-xs text-muted-foreground">{rec}</p>
                  </div>
                </div>
              ))}

              {/* Additional Recommendations */}
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Payment Plans</p>
                  <p className="text-xs text-muted-foreground">
                    Offer installment plans for large fines to improve collection rates
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Automated Reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Schedule automated payment reminders at 7, 14, and 30 days
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fine Collection Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive analysis of fine collection patterns and effectiveness
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data?.collectionRate > 80 ? "default" : data?.collectionRate > 60 ? "secondary" : "destructive"}>
            {data?.collectionRate > 80 ? 'Excellent' : data?.collectionRate > 60 ? 'Good' : 'Needs Attention'}
          </Badge>
          <Button variant="outline" size="sm">
            <Receipt className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <FineOverview />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <PaymentTrends />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoryAnalysis />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <OverduePatterns />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default FineCollectionAnalytics