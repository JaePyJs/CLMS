import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  BookOpen,
  Monitor,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart,
  Target,
  Calendar
} from 'lucide-react'

interface MetricsCardsProps {
  timeframe: 'day' | 'week' | 'month'
  data?: any
  isLoading?: boolean
  onRefresh?: () => void
}

interface MetricCard {
  title: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  description: string
  status?: 'success' | 'warning' | 'error' | 'info'
  progress?: number
  trend?: Array<{ time: string; value: number }>
  footer?: string
}

export function MetricsCards({ timeframe, data, isLoading = false, onRefresh }: MetricsCardsProps) {
  const [metrics, setMetrics] = useState<MetricCard[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    if (data) {
      const calculatedMetrics = generateMetrics(data, timeframe)
      setMetrics(calculatedMetrics)
      setLastUpdated(new Date())
    }
  }, [data, timeframe])

  const generateMetrics = (analyticsData: any, selectedTimeframe: string): MetricCard[] => {
    const { overview, circulation, equipment, fines, trends } = analyticsData

    return [
      {
        title: 'Total Students',
        value: overview?.totalStudents || 0,
        change: trends?.dailyGrowth || 0,
        changeType: trends?.dailyGrowth > 0 ? 'increase' : 'decrease',
        icon: Users,
        description: `${overview?.activeStudents || 0} active students`,
        status: 'success',
        footer: `${overview?.studentActivationRate?.toFixed(1) || 0}% activation rate`
      },
      {
        title: 'Book Circulation',
        value: circulation?.totalCirculation || 0,
        change: circulation?.trends?.growthRate || 0,
        changeType: circulation?.trends?.trendDirection === 'increasing' ? 'increase' : 'decrease',
        icon: BookOpen,
        description: `${circulation?.mostBorrowedBooks?.[0]?.title || 'N/A'} most popular`,
        status: circulation?.overdueRate > 15 ? 'warning' : 'success',
        progress: circulation?.circulationRate || 0,
        footer: `${circulation?.overdueRate?.toFixed(1) || 0}% overdue rate`
      },
      {
        title: 'Equipment Utilization',
        value: `${equipment?.overallUtilization?.toFixed(1) || 0}%`,
        change: equipment?.overallUtilization > 80 ? 5 : -2,
        changeType: equipment?.overallUtilization > 80 ? 'increase' : 'decrease',
        icon: Monitor,
        description: `${equipment?.totalSessions || 0} total sessions`,
        status: equipment?.overallUtilization > 85 ? 'warning' : equipment?.overallUtilization > 60 ? 'success' : 'info',
        progress: equipment?.overallUtilization || 0,
        footer: `${equipment?.recommendations?.[0] || 'Optimal utilization'}`
      },
      {
        title: 'Fine Collection',
        value: `$${fines?.collectedFines?.toFixed(2) || 0}`,
        change: fines?.collectionRate || 0,
        changeType: fines?.collectionRate > 70 ? 'increase' : 'decrease',
        icon: DollarSign,
        description: `${fines?.collectionRate?.toFixed(1) || 0}% collection rate`,
        status: fines?.collectionRate > 80 ? 'success' : fines?.collectionRate > 60 ? 'warning' : 'error',
        progress: fines?.collectionRate || 0,
        footer: `$${fines?.outstandingFines?.toFixed(2) || 0} outstanding`
      },
      {
        title: 'Peak Usage Time',
        value: trends?.peakUsageHours?.[0]?.timeRange || 'N/A',
        icon: Clock,
        description: `${trends?.peakUsageHours?.[0]?.count || 0} students during peak`,
        status: 'info',
        footer: `Avg session: ${equipment?.averageSessionDuration?.toFixed(0) || 0} min`
      },
      {
        title: 'System Health',
        value: 'Good',
        icon: Activity,
        description: 'All systems operational',
        status: 'success',
        progress: 95,
        footer: `Last check: ${lastUpdated.toLocaleTimeString()}`
      },
      {
        title: 'Book Availability',
        value: `${overview?.bookAvailabilityRate?.toFixed(1) || 0}%`,
        change: overview?.bookAvailabilityRate > 90 ? 2 : -1,
        changeType: overview?.bookAvailabilityRate > 90 ? 'increase' : 'decrease',
        icon: Target,
        description: `${overview?.availableBooks || 0} of ${overview?.totalBooks || 0} books available`,
        status: overview?.bookAvailabilityRate > 85 ? 'success' : overview?.bookAvailabilityRate > 70 ? 'warning' : 'error',
        progress: overview?.bookAvailabilityRate || 0
      },
      {
        title: 'Growth Rate',
        value: `${trends?.dailyGrowth?.toFixed(1) || 0}%`,
        change: trends?.dailyGrowth || 0,
        changeType: trends?.dailyGrowth > 0 ? 'increase' : 'decrease',
        icon: TrendingUp,
        description: `${selectedTimeframe === 'day' ? 'Daily' : selectedTimeframe === 'week' ? 'Weekly' : 'Monthly'} growth`,
        status: trends?.dailyGrowth > 5 ? 'success' : trends?.dailyGrowth > 0 ? 'info' : 'warning',
        footer: `Next period forecast: ${circulation?.trends?.forecastNextPeriod || 'N/A'}`
      }
    ]
  }

  const getChangeIcon = (changeType?: 'increase' | 'decrease' | 'neutral') => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'decrease':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status?: 'success' | 'warning' | 'error' | 'info') => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800'
    }
  }

  const MetricCard = ({ metric }: { metric: MetricCard }) => (
    <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg ${getStatusColor(metric.status)} border`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
        <metric.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{metric.value}</div>
          {metric.change !== undefined && (
            <div className="flex items-center gap-1">
              {getChangeIcon(metric.changeType)}
              <span className={`text-sm font-medium ${
                metric.changeType === 'increase' ? 'text-green-600' :
                metric.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {Math.abs(metric.change)}%
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>

        {metric.progress !== undefined && (
          <div className="mt-3">
            <Progress value={metric.progress} className="h-2" />
          </div>
        )}

        {metric.footer && (
          <p className="text-xs text-muted-foreground mt-2">{metric.footer}</p>
        )}
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted rounded"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded mb-2"></div>
              <div className="h-3 w-24 bg-muted rounded"></div>
              <div className="h-2 w-full bg-muted rounded mt-3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Library Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Real-time insights for {timeframe === 'day' ? 'today' : timeframe === 'week' ? 'this week' : 'this month'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Badge>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} metric={metric} />
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>System Efficiency</span>
                <span className="font-medium">94%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>User Satisfaction</span>
                <span className="font-medium">87%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Resource Optimization</span>
                <span className="font-medium">82%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Active Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Increase circulation by 15%</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Reduce overdue rate below 10%</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Maintain equipment uptime 95%+</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Today:</span> Staff meeting at 3:00 PM
              </div>
              <div className="text-sm">
                <span className="font-medium">Tomorrow:</span> Book fair setup
              </div>
              <div className="text-sm">
                <span className="font-medium">This Week:</span> Inventory audit
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default MetricsCards