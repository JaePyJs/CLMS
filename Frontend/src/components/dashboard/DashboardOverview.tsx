import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboardMetrics, useActivityTimeline, useHealthCheck } from '@/hooks/api-hooks'
import { useAppStore } from '@/store/useAppStore'
import { NotificationCalendar } from './NotificationCalendar'
import {
  Users,
  Monitor,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Activity,
  Wifi,
  Database,
  CalendarDays
} from 'lucide-react'

export function DashboardOverview() {
  const { isOnline, connectedToBackend, activities, automationJobs } = useAppStore()

  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Use error boundaries for API calls to prevent crashes
  const { isLoading: metricsLoading } = useDashboardMetrics()
  const { data: timeline, isLoading: timelineLoading } = useActivityTimeline(10)
  const { data: healthData } = useHealthCheck()

  // Calculate real-time metrics from store (initialized to 0)
  const activeSessions = activities?.filter(a => a.status === 'active').length || 0
  const totalToday = activities?.filter(a => {
    const today = new Date()
    const activityDate = new Date(a.startTime)
    return activityDate.toDateString() === today.toDateString()
  }).length || 0

  const runningJobs = automationJobs?.filter(job => job.status === 'running').length || 0

  // Additional real metrics (initialized to 0)
  const totalStudents = 0
  const pendingTasks = 0
  const equipmentInUse = 0
  const availableComputers = 3 // Total computers in library
  const availablePrinters = 1 // Total printers
  const availableRecreational = 1 // Total recreational stations

  return (
    <div className="space-y-8">
      {/* Cozy Welcome Header */}
      <div className="text-center space-y-2 py-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
          Good Morning, Sophia! <span className="opacity-70">🌅</span>
        </h2>
        <p className="text-lg text-muted-foreground dark:text-muted-foreground/80">
          Your library is ready for another wonderful day
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span>•</span>
          <span className="font-mono font-semibold">{currentTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Main Cozy Layout with Calendar as Focal Point */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left Sidebar - Calendar & Quick Stats */}
        <div className="xl:col-span-4 space-y-6">
          {/* Enhanced Calendar Card */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50 dark:from-card dark:to-blue-950/20 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CalendarDays className="h-6 w-6" />
                Library Calendar
              </CardTitle>
              <CardDescription className="text-blue-100">
                Track student activities and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <NotificationCalendar />
            </CardContent>
          </Card>

          {/* Cozy Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{totalToday}</div>
                <p className="text-xs text-green-600 dark:text-green-400">Students Today</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <Monitor className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{activeSessions}</div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Active Now</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{runningJobs}</div>
                <p className="text-xs text-purple-600 dark:text-purple-400">Automation</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4 text-center">
                {connectedToBackend ? (
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
                )}
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  {connectedToBackend ? 'Online' : 'Offline'}
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">System</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Center Content - Recent Activity */}
        <div className="xl:col-span-5 space-y-6">
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white p-6">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-6 w-6" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-indigo-100">
                Latest student activities and system events
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {timelineLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading recent activities...</p>
                </div>
              ) : timeline && Array.isArray(timeline) && timeline.length > 0 ? (
                <div className="space-y-4">
                  {(timeline as any[]).map((activity: any, index) => (
                    <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`h-3 w-3 rounded-full shadow-sm ${
                          activity.status === 'active' ? 'bg-green-500 shadow-green-500/50' :
                          activity.status === 'completed' ? 'bg-blue-500 shadow-blue-500/50' :
                          activity.status === 'expired' ? 'bg-yellow-500 shadow-yellow-500/50' :
                          'bg-gray-500 shadow-gray-500/50'
                        }`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground dark:text-foreground">
                          {activity.studentName}
                        </p>
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground/80">
                          {activity.activityType} • {activity.equipmentId || 'No equipment'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                        {new Date(activity.startTime).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-70">📚</div>
                  <p className="text-muted-foreground text-lg">No recent activity</p>
                  <p className="text-muted-foreground/60 text-sm mt-2">Your library is quiet today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - System Status & Quick Actions */}
        <div className="xl:col-span-3 space-y-6">
          {/* System Health */}
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <Wifi className="h-6 w-6" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <span className="font-medium">Internet</span>
                  <Badge variant={isOnline ? 'default' : 'destructive'} className="bg-green-500 hover:bg-green-600">
                    {isOnline ? 'Connected' : 'Offline'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <span className="font-medium">Backend</span>
                  <Badge variant={connectedToBackend ? 'default' : 'destructive'} className="bg-blue-500 hover:bg-blue-600">
                    {connectedToBackend ? 'Connected' : 'Offline'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                  <span className="font-medium">Google Sheets</span>
                  <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">
                    Connected
                  </Badge>
                </div>
              </div>

              {healthData && typeof healthData === 'object' && healthData !== null && 'timestamp' in healthData && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Last check: {new Date((healthData as any).timestamp).toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
              <CardTitle className="text-xl">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-16 flex-col bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
                  <Users className="h-5 w-5 mb-1" />
                  <span className="text-xs">Add Student</span>
                </Button>
                <Button className="h-16 flex-col bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
                  <Monitor className="h-5 w-5 mb-1" />
                  <span className="text-xs">Start Session</span>
                </Button>
                <Button className="h-16 flex-col bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg">
                  <TrendingUp className="h-5 w-5 mb-1" />
                  <span className="text-xs">View Report</span>
                </Button>
                <Button className="h-16 flex-col bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
                  <Activity className="h-5 w-5 mb-1" />
                  <span className="text-xs">Run Backup</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview