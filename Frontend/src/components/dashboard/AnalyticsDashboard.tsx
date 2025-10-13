import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUsageStats, useActivityTimeline, useExportData } from '@/hooks/api-hooks'
import { useAppStore } from '@/store/useAppStore'
import { DashboardCardSkeleton, LoadingSpinner, ButtonLoading } from '@/components/LoadingStates'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import PredictiveInsights from '@/components/analytics/PredictiveInsights'
import UsageHeatMap from '@/components/analytics/UsageHeatMap'
import TimeSeriesForecast from '@/components/analytics/TimeSeriesForecast'
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
  ResponsiveContainer
} from 'recharts'
import {
  TrendingUp,
  Users,
  Monitor,
  Gamepad2,
  BookOpen,
  Clock,
  Download,
  Calendar,
  Filter,
  FileText,
  Activity
} from 'lucide-react'

export function AnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [selectedChart, setSelectedChart] = useState('insights')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([])
  const [heatMapData, setHeatMapData] = useState<any[]>([])
  const [forecastData, setForecastData] = useState<any[]>([])
  const [selectedMetric, setSelectedMetric] = useState<'student_visits' | 'equipment_usage' | 'book_circulation'>('student_visits')
  const { activities } = useAppStore()
  const { mutate: exportData } = useExportData()
  const isLargeScreen = useBreakpoint('lg')

  // Mock data for charts
  const mockUsageData = {
    day: [
      { time: '8AM', students: 5, computers: 3, gaming: 2 },
      { time: '9AM', students: 12, computers: 8, gaming: 4 },
      { time: '10AM', students: 18, computers: 12, gaming: 6 },
      { time: '11AM', students: 15, computers: 10, gaming: 5 },
      { time: '12PM', students: 8, computers: 5, gaming: 3 },
      { time: '1PM', students: 22, computers: 15, gaming: 7 },
      { time: '2PM', students: 25, computers: 18, gaming: 7 },
      { time: '3PM', students: 20, computers: 14, gaming: 6 },
      { time: '4PM', students: 12, computers: 8, gaming: 4 },
      { time: '5PM', students: 6, computers: 4, gaming: 2 }
    ],
    week: [
      { day: 'Mon', students: 45, computers: 30, gaming: 15 },
      { day: 'Tue', students: 52, computers: 35, gaming: 17 },
      { day: 'Wed', students: 48, computers: 32, gaming: 16 },
      { day: 'Thu', students: 55, computers: 38, gaming: 17 },
      { day: 'Fri', students: 58, computers: 40, gaming: 18 },
      { day: 'Sat', students: 35, computers: 24, gaming: 11 },
      { day: 'Sun', students: 20, computers: 14, gaming: 6 }
    ],
    month: [
      { week: 'Week 1', students: 220, computers: 150, gaming: 70 },
      { week: 'Week 2', students: 245, computers: 168, gaming: 77 },
      { week: 'Week 3', students: 238, computers: 163, gaming: 75 },
      { week: 'Week 4', students: 252, computers: 173, gaming: 79 }
    ]
  }

  const mockActivityData = [
    { name: 'Computer Use', value: 45, color: 'hsl(var(--primary))' },
    { name: 'Gaming', value: 20, color: '#8b5cf6' },
    { name: 'Book Borrowing', value: 25, color: '#10b981' },
    { name: 'Book Return', value: 20, color: '#f59e0b' },
    { name: 'VR Sessions', value: 5, color: '#ef4444' },
    { name: 'Study', value: 15, color: '#6366f1' }
  ]

  const mockGradeDistribution = [
    { grade: 'Primary', students: 25, percentage: 20 },
    { grade: 'Grade School', students: 50, percentage: 40 },
    { grade: 'Junior High', students: 35, percentage: 28 },
    { grade: 'Senior High', students: 15, percentage: 12 }
  ]

  const currentUsageData = mockUsageData[selectedPeriod]
  const overviewChartHeight = isLargeScreen ? 400 : 280
  const activityChartHeight = isLargeScreen ? 300 : 240

  // Fetch predictive analytics data
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setIsLoading(true)

        // Fetch predictive insights
        const insightsResponse = await fetch(`${import.meta.env.VITE_API_URL}/analytics/insights?timeframe=${selectedPeriod}`)
        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json()
          setPredictiveInsights(insightsData.data.insights || [])
        }

        // Fetch heat map data
        const heatMapResponse = await fetch(`${import.meta.env.VITE_API_URL}/analytics/heatmap?timeframe=${selectedPeriod}`)
        if (heatMapResponse.ok) {
          const heatMapResult = await heatMapResponse.json()
          setHeatMapData(heatMapResult.data.heatMapData || [])
        }

        // Fetch forecast data
        const forecastResponse = await fetch(`${import.meta.env.VITE_API_URL}/analytics/forecast?metric=${selectedMetric}&timeframe=${selectedPeriod}&periods=7`)
        if (forecastResponse.ok) {
          const forecastResult = await forecastResponse.json()
          setForecastData(forecastResult.data.forecastData || [])
        }

      } catch (error) {
        console.error('Failed to fetch analytics data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [selectedPeriod, selectedMetric])

  const handleExport = (format: 'csv' | 'json') => {
    exportData({ format })
  }

  const handleInsightAction = async (insight: any, action: string) => {
    console.log('Insight action:', insight, action)
    // Implement insight action handling
  }

  const calculateTotalStudents = () => {
    return currentUsageData.reduce((sum, item) => sum + item.students, 0)
  }

  const calculatePeakTime = () => {
    const maxItem = currentUsageData.reduce((max, item) =>
      item.students > max.students ? item : max, currentUsageData[0])
    return 'time' in maxItem ? maxItem.time :
           'day' in maxItem ? maxItem.day :
           'week' in maxItem ? maxItem.week : 'Unknown'
  }

  const calculateAverageSessionTime = () => {
    // Mock calculation
    return '32 minutes'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Track library usage patterns and generate insights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <FileText className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`${import.meta.env.VITE_API_URL}/analytics/report?timeframe=${selectedPeriod}`, '_blank')}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calculateTotalStudents()}</div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === 'day' ? 'Today' : selectedPeriod === 'week' ? 'This week' : 'This month'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calculatePeakTime()}</div>
            <p className="text-xs text-muted-foreground">
              Busiest period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calculateAverageSessionTime()}</div>
            <p className="text-xs text-muted-foreground">
              Average duration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">+12%</div>
            <p className="text-xs text-muted-foreground">
              From last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Analytics with Predictive Insights */}
      <Tabs value={selectedChart} onValueChange={setSelectedChart} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="insights">Predictive Insights</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
          <TabsTrigger value="heatmap">Heat Map</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
        </TabsList>

        {/* Predictive Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <DashboardCardSkeleton />
                  </CardHeader>
                  <CardContent>
                    <DashboardCardSkeleton />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <PredictiveInsights
              insights={predictiveInsights}
              timeframe={selectedPeriod}
              onTimeframeChange={setSelectedPeriod}
              onInsightAction={handleInsightAction}
            />
          )}
        </TabsContent>

        {/* Forecasting Tab */}
        <TabsContent value="forecasting" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Time Series Forecasting</h3>
              <p className="text-sm text-muted-foreground">
                Predict future trends based on historical data patterns
              </p>
            </div>
            <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student_visits">Student Visits</SelectItem>
                <SelectItem value="equipment_usage">Equipment Usage</SelectItem>
                <SelectItem value="book_circulation">Book Circulation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <LoadingSpinner />
              </CardContent>
            </Card>
          ) : (
            <TimeSeriesForecast
              data={forecastData}
              metric={selectedMetric}
              timeframe={selectedPeriod}
              onMetricChange={setSelectedMetric}
              onTimeframeChange={setSelectedPeriod}
            />
          )}
        </TabsContent>

        {/* Heat Map Tab */}
        <TabsContent value="heatmap" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <LoadingSpinner />
              </CardContent>
            </Card>
          ) : (
            <UsageHeatMap
              data={heatMapData}
              filterType="all"
              onCellClick={(data) => console.log('Heat map cell clicked:', data)}
            />
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Overview</CardTitle>
              <CardDescription>
                Student traffic and equipment utilization over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={overviewChartHeight}>
                <LineChart data={currentUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey={selectedPeriod === 'month' ? 'week' : selectedPeriod === 'week' ? 'day' : 'time'}
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
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="students"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Students"
                  />
                  <Line
                    type="monotone"
                    dataKey="computers"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Computers"
                  />
                  <Line
                    type="monotone"
                    dataKey="gaming"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Gaming"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>
                  Breakdown of library activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={activityChartHeight}>
                  <PieChart>
                    <Pie
                      data={mockActivityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {mockActivityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Times</CardTitle>
                <CardDescription>
                  Busiest hours and activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={activityChartHeight}>
                  <BarChart data={currentUsageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey={selectedPeriod === 'month' ? 'week' : selectedPeriod === 'week' ? 'day' : 'time'}
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
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}
                    />
                    <Bar dataKey="students" fill="hsl(var(--primary))" name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Equipment Usage Tab */}
        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Utilization</CardTitle>
              <CardDescription>
                How different equipment types are being used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={overviewChartHeight}>
                <BarChart data={currentUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey={selectedPeriod === 'month' ? 'week' : selectedPeriod === 'week' ? 'day' : 'time'}
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
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="computers" fill="#10b981" name="Computers" />
                  <Bar dataKey="gaming" fill="#8b5cf6" name="Gaming" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
                <CardDescription>
                  Student usage by grade level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockGradeDistribution.map((grade) => (
                    <div key={grade.grade} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{grade.grade}</span>
                        <span className="text-sm text-muted-foreground">
                          {grade.students} students ({grade.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${grade.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time Limits by Grade</CardTitle>
                <CardDescription>
                  Standard time limits for different grade levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <div>
                      <div className="font-medium">Primary (K-3)</div>
                      <div className="text-sm text-muted-foreground">Supervised activities</div>
                    </div>
                    <Badge variant="outline">15 min</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <div>
                      <div className="font-medium">Grade School (4-6)</div>
                      <div className="text-sm text-muted-foreground">Basic computer access</div>
                    </div>
                    <Badge variant="outline">30 min</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <div>
                      <div className="font-medium">Junior High (7-10)</div>
                      <div className="text-sm text-muted-foreground">Full access + gaming</div>
                    </div>
                    <Badge variant="outline">45 min</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <div>
                      <div className="font-medium">Senior High (11-12)</div>
                      <div className="text-sm text-muted-foreground">Premium access</div>
                    </div>
                    <Badge variant="outline">60 min</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detailed Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Reports & Insights</CardTitle>
          <CardDescription>
            Generate detailed reports for administration and planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-16 flex-col">
              <FileText className="h-6 w-6 mb-2" />
              <span>Daily Report</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <Calendar className="h-6 w-6 mb-2" />
              <span>Weekly Summary</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <TrendingUp className="h-6 w-6 mb-2" />
              <span>Monthly Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AnalyticsDashboard