import { useState, useEffect } from 'react'
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
  AreaChart,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis
} from 'recharts'
import { Monitor, Clock, TrendingUp, AlertTriangle, CheckCircle, Settings, Users, Activity, Calendar, Zap, Thermometer, Wrench, BarChart3 } from 'lucide-react';

interface EquipmentUtilizationAnalyticsProps {
  timeframe: 'day' | 'week' | 'month'
  data?: any
  isLoading?: boolean
}

interface UtilizationData {
  type: string
  total: number
  inUse: number
  utilizationRate: number
  status: 'high' | 'medium' | 'low'
  avgSessionDuration: number
  maintenanceAlerts: number
}

interface PeakUsageTime {
  hour: number
  sessions: number
  timeRange: string
  utilizationRate: number
}

interface MaintenanceInsight {
  equipmentId: string
  nextMaintenance: string
  type: 'Preventive' | 'Corrective'
  urgency: 'high' | 'medium' | 'low'
  description: string
}

const UTILIZATION_COLORS = {
  high: '#ef4444',    // red
  medium: '#f59e0b',  // yellow
  low: '#10b981'      // green
}

export function EquipmentUtilizationAnalytics({ timeframe, data, isLoading = false }: EquipmentUtilizationAnalyticsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'utilization' | 'patterns' | 'maintenance'>('overview')
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([])
  const [peakUsageTimes, setPeakUsageTimes] = useState<PeakUsageTime[]>([])
  const [maintenanceInsights, setMaintenanceInsights] = useState<MaintenanceInsight[]>([])

  useEffect(() => {
    if (data) {
      processEquipmentData(data)
    }
  }, [data, timeframe])

  const processEquipmentData = (analyticsData: any) => {
    // Process utilization data
    const utilization = analyticsData.utilizationByType?.map((item: any) => ({
      ...item,
      status: getUtilizationStatus(item.utilizationRate),
      avgSessionDuration: Math.random() * 60 + 15, // Mock 15-75 min
      maintenanceAlerts: Math.floor(Math.random() * 3)
    })) || []
    setUtilizationData(utilization)

    // Process peak usage times
    const peakTimes = analyticsData.peakUsageTimes?.map((time: any) => ({
      ...time,
      utilizationRate: Math.random() * 40 + 60 // Mock 60-100% during peak
    })) || []
    setPeakUsageTimes(peakTimes)

    // Process maintenance insights
    const maintenance = analyticsData.maintenanceInsights?.maintenanceSchedule?.map((item: any) => ({
      ...item,
      urgency: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      description: generateMaintenanceDescription(item.type)
    })) || []
    setMaintenanceInsights(maintenance)
  }

  const getUtilizationStatus = (rate: number): 'high' | 'medium' | 'low' => {
    if (rate > 80) return 'high'
    if (rate > 50) return 'medium'
    return 'low'
  }

  const generateMaintenanceDescription = (type: string): string => {
    const descriptions = {
      Preventive: [
        'Routine performance check and calibration',
        'Software updates and security patches',
        'Hardware inspection and cleaning',
        'Component wear assessment'
      ],
      Corrective: [
        'Performance issue resolution',
        'Hardware replacement required',
        'Software malfunction fix',
        'Component repair needed'
      ]
    }

    const typeDesc = descriptions[type as keyof typeof descriptions] || []
    return typeDesc[Math.floor(Math.random() * typeDesc.length)]
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const EquipmentOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Utilization</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.overallUtilization?.toFixed(1) || 0}%</div>
            <Progress value={data?.overallUtilization || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data?.overallUtilization > 80 ? 'High demand' : data?.overallUtilization > 50 ? 'Optimal' : 'Underutilized'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.equipment?.totalSessions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {data?.equipment?.averageSessionDuration?.toFixed(0) || 0} min per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Equipment</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {utilizationData.reduce((sum, item) => sum + item.inUse, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {utilizationData.reduce((sum, item) => sum + item.total, 0)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">98.5%</div>
            <Progress value={98.5} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Excellent performance</p>
          </CardContent>
        </Card>
      </div>

      {/* Utilization by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment Utilization by Type</CardTitle>
          <CardDescription>
            Current utilization rates across different equipment categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={utilizationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="type"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                angle={-45}
                textAnchor="end"
                height={80}
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
              <Bar
                dataKey="utilizationRate"
                name="Utilization %"
                fill={(entry: any) => UTILIZATION_COLORS[entry.status]}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )

  const UtilizationAnalysis = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Utilization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Utilization Details</CardTitle>
          <CardDescription>
            Detailed breakdown of equipment usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {utilizationData.map((equipment) => (
              <div key={equipment.type} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span className="text-sm font-medium">{equipment.type}</span>
                    <Badge
                      variant="outline"
                      className={`${getUrgencyColor(equipment.status)} text-white border-0`}
                    >
                      {equipment.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {equipment.inUse}/{equipment.total} active
                  </span>
                </div>
                <Progress value={equipment.utilizationRate} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{equipment.utilizationRate.toFixed(1)}% utilized</span>
                  <span>Avg session: {equipment.avgSessionDuration.toFixed(0)} min</span>
                </div>
                {equipment.maintenanceAlerts > 0 && (
                  <div className="flex items-center gap-1 text-xs text-yellow-600">
                    <AlertTriangle className="h-3 w-3" />
                    {equipment.maintenanceAlerts} maintenance alert(s)
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Utilization Radial Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Utilization Distribution</CardTitle>
          <CardDescription>
            Visual representation of equipment usage patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="90%" data={utilizationData}>
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                tick={false}
              />
              <RadialBar
                dataKey="utilizationRate"
                cornerRadius={10}
                fill="#8884d8"
                label={({ position, value }) => {
                  if (position === 'inside') {
                    return `${value.toFixed(1)}%`
                  }
                  return null
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-4">
            {utilizationData.map((item) => (
              <Badge key={item.type} variant="outline" className="text-xs">
                {item.type}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const UsagePatterns = () => (
    <div className="space-y-6">
      {/* Peak Usage Times */}
      <Card>
        <CardHeader>
          <CardTitle>Peak Usage Patterns</CardTitle>
          <CardDescription>
            Busiest times and usage patterns throughout the day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={peakUsageTimes}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="timeRange"
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
                dataKey="sessions"
                stroke="#0088FE"
                fill="#0088FE"
                fillOpacity={0.6}
                name="Sessions"
              />
              <Area
                type="monotone"
                dataKey="utilizationRate"
                stroke="#00C49F"
                fill="#00C49F"
                fillOpacity={0.6}
                name="Utilization %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Usage Insights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Peak Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {peakUsageTimes.slice(0, 3).map((time, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{time.timeRange}</span>
                  <span className="font-medium">{time.sessions} sessions</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              High Demand Periods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>2:00 PM - 4:00 PM (85%+ usage)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>10:00 AM - 12:00 PM (70% usage)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>After 6:00 PM (Low usage)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Usage Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Session Efficiency</span>
                <span className="font-medium">87%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Resource Allocation</span>
                <span className="font-medium">92%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>User Satisfaction</span>
                <span className="font-medium">94%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const MaintenanceView = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Maintenance Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Schedule</CardTitle>
          <CardDescription>
            Upcoming maintenance tasks and equipment status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {maintenanceInsights.map((insight) => (
              <div key={insight.equipmentId} className="flex items-start gap-3 p-3 border rounded-lg">
                <Wrench className={`h-5 w-5 mt-0.5 ${
                  insight.urgency === 'high' ? 'text-red-500' :
                  insight.urgency === 'medium' ? 'text-yellow-500' : 'text-green-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium">{insight.equipmentId}</h4>
                    <Badge variant="outline" className={getUrgencyColor(insight.urgency)}>
                      {insight.urgency}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {insight.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {insight.nextMaintenance}
                    </span>
                    <span className="flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      {insight.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Analytics</CardTitle>
          <CardDescription>
            Equipment health and maintenance performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {data?.maintenanceInsights?.averageUptime?.toFixed(1) || 98.5}%
                </div>
                <div className="text-sm text-muted-foreground">Average Uptime</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {data?.maintenanceInsights?.equipmentNeedingMaintenance || 3}
                </div>
                <div className="text-sm text-muted-foreground">Need Maintenance</div>
              </div>
            </div>

            {/* Maintenance Recommendations */}
            <div className="space-y-3">
              <h4 className="font-medium">Recommendations</h4>
              {data?.recommendations?.slice(0, 3).map((rec: string, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>

            {/* Performance Trend */}
            <div className="space-y-2">
              <h4 className="font-medium">Performance Trend</h4>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm">5% improvement from last month</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Stable performance over past week</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

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
          <h3 className="text-lg font-semibold">Equipment Utilization Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Detailed analysis of equipment usage patterns and efficiency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data?.overallUtilization > 80 ? "destructive" : data?.overallUtilization > 50 ? "default" : "secondary"}>
            {data?.overallUtilization > 80 ? 'High Demand' : data?.overallUtilization > 50 ? 'Optimal' : 'Available'}
          </Badge>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <EquipmentOverview />
        </TabsContent>

        <TabsContent value="utilization" className="space-y-4">
          <UtilizationAnalysis />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <UsagePatterns />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceView />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EquipmentUtilizationAnalytics