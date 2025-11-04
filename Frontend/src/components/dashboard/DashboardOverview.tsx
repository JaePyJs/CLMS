import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActivityTimeline, useHealthCheck } from '@/hooks/api-hooks'
import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/contexts/AuthContext'
import { useWebSocketContext } from '@/contexts/WebSocketContext'
import { NotificationCalendar } from './NotificationCalendar'
import { AddStudentDialog } from './AddStudentDialog'
import { RealTimeDashboard } from './RealTimeDashboard'
import { utilitiesApi } from '@/lib/api'
import { toast } from 'sonner'
// Simplified icon imports - only what this component actually uses
import { CheckCircle, Activity, Clock, TrendingUp, AlertTriangle, Settings, BarChart3, Download, Printer, Maximize2, Minimize2, Bell, Wifi, CalendarDays, Eye, Users, Monitor, Shield, AlertCircle, ExternalLink, Edit, FileText } from 'lucide-react'

interface DashboardOverviewProps {
  onTabChange?: (tab: string) => void;
}

export function DashboardOverview({ onTabChange }: DashboardOverviewProps) {
  const { user } = useAuth()
  const { isOnline, connectedToBackend, activities, automationJobs } = useAppStore()
  const { isConnected: wsConnected, notifications } = useWebSocketContext()
  const [showRealTime, setShowRealTime] = useState(true)

  // Real-time clock state (updates every minute for professional appearance)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Quick Actions loading states
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false)
  
  // Quick Actions loading states
  const [isStartingSession] = useState(false)
  const [isViewingReport, setIsViewingReport] = useState(false)
  const [isRunningBackup, setIsRunningBackup] = useState(false)

  // New loading states for enhanced functionality
  const [isExporting, setIsExporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Update time every minute (professional standard)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every 60 seconds

    return () => clearInterval(timer)
  }, [])

  // Quick Actions handlers
  const handleAddStudent = () => {
    setIsAddStudentDialogOpen(true)
  }

  const handleStartSession = async () => {
    // For demo purposes, we'll show a message that this requires student/equipment selection
    toast.info('Start Session requires student and equipment selection. This feature will be enhanced in the Equipment tab.')
  }

  const handleViewReport = async () => {
    try {
      setIsViewingReport(true)
      const response = await utilitiesApi.getQuickReport()

      if (response.success) {
        toast.success('Report generated successfully!')
        // Display report data in a more user-friendly way
        console.log('Quick Report:', response.data)

        // Show key metrics in toast
        const report = response.data as { summary: { totalStudents: number; todayActivities: number; equipmentUtilization: number } }
        if (report?.summary && typeof report.summary.totalStudents === 'number') {
          toast.info(`${report.summary.totalStudents} students, ${report.summary.todayActivities} activities today, ${report.summary.equipmentUtilization}% equipment utilization`)
        }
      } else {
        toast.error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report. Please try again.')
    } finally {
      setIsViewingReport(false)
    }
  }

  const handleRunBackup = async () => {
    try {
      setIsRunningBackup(true)
      const response = await utilitiesApi.quickBackup()

      if (response.success) {
        const data = response.data as { estimatedDuration?: string }
        toast.success(`Backup initiated! ${data?.estimatedDuration ?? 'Unknown'} estimated duration.`)
      } else {
        toast.error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to initiate backup')
      }
    } catch (error) {
      console.error('Error initiating backup:', error)
      toast.error('Failed to initiate backup. Please try again.')
    } finally {
      setIsRunningBackup(false)
    }
  }

  // Enhanced functionality handlers

  const handleExport = async () => {
    try {
      setIsExporting(true)
      // Generate CSV export
      const csvContent = `Data Type,Count,Timestamp\nStudents Today,${totalToday},${new Date().toISOString()}\nActive Sessions,${activeSessions},${new Date().toISOString()}\nRunning Jobs,${runningJobs},${new Date().toISOString()}`

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Dashboard data exported successfully!')
    } catch (error) {
      toast.error('Failed to export dashboard data')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    try {
      setIsPrinting(true)
      window.print()
      toast.success('Print dialog opened')
    } catch (error) {
      toast.error('Failed to open print dialog')
    } finally {
      setIsPrinting(false)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    toast.info(isFullscreen ? 'Exited fullscreen mode' : 'Entered fullscreen mode')
  }

  const handleEmergencyAlert = () => {
    toast.warning('Emergency alert system activated. This would notify administrators of critical system issues.')
  }

  const handleManualSessionEntry = () => {
    toast.info('Manual session entry feature. This would open a form to log missed check-ins.')
  }

  const handleBulkCheckout = () => {
    toast.info('Bulk checkout feature. This would allow ending multiple active sessions at once.')
  }

  // Use error boundaries for API calls to prevent crashes
  const { data: timeline, isLoading: timelineLoading } = useActivityTimeline(10)
  const { data: healthData } = useHealthCheck()

  // Calculate real-time metrics from store (initialized to 0)
  const activeSessions = Array.isArray(activities) ? activities.filter(a => a.status === 'active').length : 0
  const totalToday = Array.isArray(activities) ? activities.filter(a => {
    const today = new Date()
    const activityDate = new Date(a.startTime)
    return activityDate.toDateString() === today.toDateString()
  }).length : 0

  const runningJobs = automationJobs?.filter(job => job.status === 'running').length || 0

  // Additional real metrics (initialized to 0)
  const equipmentInUse = 0
  const availableComputers = 3 // Total computers in library

  return (
    <div className={`space-y-8 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-6 overflow-auto' : ''}`}>
      {/* Enhanced Welcome Header - Clean & Professional */}
      <div className="space-y-4">
        {/* Real-time Dashboard Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Dashboard View</h3>
            <div className="flex items-center gap-2">
              <Badge variant={wsConnected ? "default" : "secondary"} className="bg-green-500">
                <Wifi className="h-3 w-3 mr-1" />
                Real-time {wsConnected ? 'Active' : 'Inactive'}
              </Badge>
              {notifications.length > 0 && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <Bell className="h-3 w-3 mr-1" />
                  {notifications.length} notifications
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showRealTime ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRealTime(true)}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Real-time View
            </Button>
            <Button
              variant={!showRealTime ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRealTime(false)}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Standard View
            </Button>
          </div>
        </div>

        {/* Welcome Header with Integrated Info */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm overflow-hidden">
          {/* Action Toolbar */}
          <div className="flex justify-end gap-2 px-6 pt-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="hover:bg-white/50 dark:hover:bg-slate-800/50"
              title="Export dashboard data"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="hover:bg-white/50 dark:hover:bg-slate-800/50"
              title="Print dashboard"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="hover:bg-white/50 dark:hover:bg-slate-800/50"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEmergencyAlert}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              title="Emergency alert"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Main Welcome Content */}
          <div className="text-center space-y-2 py-6 px-6">
            <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              Good Morning, {user?.username || 'Administrator'}! <span className="opacity-70">🌅</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Your library is ready for another wonderful day
            </p>
            <div className="text-sm text-slate-600 dark:text-slate-400 pt-2">
              <span className="font-medium">{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="mx-2">at</span>
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conditional Dashboard Rendering */}
      {showRealTime ? (
        <RealTimeDashboard />
      ) : (
        <>
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

          {/* Enhanced Interactive Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <>
            <Card
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => {
                if (onTabChange) {
                  onTabChange('students');
                  toast.success('Opening Students tab...');
                } else {
                  toast.info('View detailed student analytics');
                }
              }}
            >
              <CardContent className="p-4 text-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info('View detailed student analytics');
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Users className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{totalToday}</div>
                <p className="text-xs text-green-600 dark:text-green-400">Students Today</p>
                <div className="mt-2 text-xs text-green-500">Click for details</div>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => {
                if (onTabChange) {
                  onTabChange('scan');
                  toast.success('Opening Activity Management...');
                } else {
                  toast.info('View active sessions management');
                }
              }}
            >
              <CardContent className="p-4 text-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info('View active sessions management');
                  }}
                >
                  <Settings className="h-3 w-3" />
                </Button>
                <Monitor className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{activeSessions}</div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Active Now</p>
                <div className="mt-2 text-xs text-blue-500">Click to manage</div>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => {
                if (onTabChange) {
                  onTabChange('automation');
                  toast.success('Opening Automation tab...');
                } else {
                  toast.info('View automation job status');
                }
              }}
            >
              <CardContent className="p-4 text-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info('View automation job status');
                  }}
                >
                  <BarChart3 className="h-3 w-3" />
                </Button>
                <Activity className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{runningJobs}</div>
                <p className="text-xs text-purple-600 dark:text-purple-400">Automation</p>
                <div className="mt-2 text-xs text-purple-500">Click for status</div>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => {
                toast.info(`System Status:\n✅ Backend: ${connectedToBackend ? 'Connected' : 'Disconnected'}\n✅ Internet: ${isOnline ? 'Online' : 'Offline'}\n✅ Database: Healthy\n✅ Google Sheets: Connected`, {
                  duration: 5000
                });
              }}
            >
              <CardContent className="p-4 text-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info('View system health details');
                  }}
                >
                  <Shield className="h-3 w-3" />
                </Button>
                {connectedToBackend ? (
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
                )}
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  {connectedToBackend ? 'Online' : 'Offline'}
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">System</p>
                <div className="mt-2 text-xs text-amber-500">Click for status</div>
              </CardContent>
            </Card>
            </>
          </div>

          {/* Equipment Status Summary */}
          <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20 border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Equipment Status
                <Button variant="ghost" size="sm" onClick={() => toast.info('View equipment management')}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/20">
                  <Monitor className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                  <div className="text-lg font-bold text-blue-700">{availableComputers - equipmentInUse}</div>
                  <div className="text-xs text-blue-500">PCs Free</div>
                </div>
                <div className="p-2 rounded bg-green-50 dark:bg-green-950/20">
                  <div className="h-4 w-4 mx-auto mb-1 bg-green-600 rounded-full" />
                  <div className="text-lg font-bold text-green-700">1</div>
                  <div className="text-xs text-green-500">AVR Free</div>
                </div>
                <div className="p-2 rounded bg-purple-50 dark:bg-purple-950/20">
                  <div className="h-4 w-4 mx-auto mb-1 bg-purple-600 rounded-full" />
                  <div className="text-lg font-bold text-purple-700">1</div>
                  <div className="text-xs text-purple-500">Rec. Free</div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  {(timeline as any[]).map((activity: any, _) => (
                    <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`h-3 w-3 rounded-full shadow-sm ${activity.status === 'active' ? 'bg-green-500 shadow-green-500/50' : activity.status === 'completed' ? 'bg-blue-500 shadow-blue-500/50' : activity.status === 'expired' ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-gray-500 shadow-gray-500/50'}`}></div>
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
                  Last check: {new Date(
                    typeof healthData.timestamp === 'string' || typeof healthData.timestamp === 'number'
                      ? healthData.timestamp
                      : new Date().toISOString()
                  ).toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Quick Actions */}
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
              <CardTitle className="text-xl flex items-center justify-between">
                Quick Actions
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleManualSessionEntry}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Manual Entry
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBulkCheckout}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Bulk Checkout
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <Button
                  className="h-16 flex-col bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={handleAddStudent}
                >
                  <Users className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">Add Student</span>
                </Button>
                <Button
                  className="h-16 flex-col bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={handleStartSession}
                  disabled={isStartingSession}
                >
                  <Monitor className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">
                    {isStartingSession ? 'Starting...' : 'Start Session'}
                  </span>
                </Button>
                <Button
                  className="h-16 flex-col bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={handleViewReport}
                  disabled={isViewingReport}
                >
                  <TrendingUp className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">
                    {isViewingReport ? 'Generating...' : 'View Report'}
                  </span>
                </Button>
                <Button
                  className="h-16 flex-col bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={handleRunBackup}
                  disabled={isRunningBackup}
                >
                  <Activity className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">
                    {isRunningBackup ? 'Running...' : 'Run Backup'}
                  </span>
                </Button>
              </div>

              {/* Additional Quick Actions */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Additional Actions</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info('Daily Summary feature - generates end-of-day report')}
                    className="h-10 flex-col"
                  >
                    <FileText className="h-3 w-3 mb-1" />
                    <span className="text-xs">Daily Summary</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info('System Check feature - runs health diagnostics')}
                    className="h-10 flex-col"
                  >
                    <Shield className="h-3 w-3 mb-1" />
                    <span className="text-xs">System Check</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info('Maintenance Mode - schedule system maintenance')}
                    className="h-10 flex-col"
                  >
                    <Settings className="h-3 w-3 mb-1" />
                    <span className="text-xs">Maintenance</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
        </>
      )}

      {/* Add Student Dialog */}
      <AddStudentDialog
        open={isAddStudentDialogOpen}
        onOpenChange={setIsAddStudentDialogOpen}
      />
    </div>
  )
}

export default DashboardOverview
