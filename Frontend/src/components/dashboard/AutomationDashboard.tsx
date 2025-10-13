import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAutomationJobs, useTriggerJob, useGoogleSheetsTest } from '@/hooks/api-hooks'
import { useAppStore } from '@/store/useAppStore'
import { DashboardCardSkeleton, CardSkeleton, ButtonLoading, LoadingSpinner } from '@/components/LoadingStates'
import {
  Bot,
  Play,
  Square,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
  FileSpreadsheet,
  Calendar,
  Activity,
  Wifi,
  WifiOff,
  Settings,
  RefreshCw
} from 'lucide-react'

interface AutomationJob {
  id: string
  name: string
  type: 'backup' | 'notification' | 'sync' | 'cleanup'
  status: 'running' | 'completed' | 'failed' | 'queued'
  lastRun?: Date
  nextRun?: Date
  duration?: number
  errorMessage?: string
  progress?: number
}

export function AutomationDashboard() {
  const [selectedTab, setSelectedTab] = useState('jobs')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null)
  const { automationJobs } = useAppStore()
  const { mutate: triggerJob } = useTriggerJob()
  const { data: googleSheetsStatus } = useGoogleSheetsTest()

  // Mock automation jobs for now
  const mockJobs: AutomationJob[] = [
    {
      id: 'daily-backup',
      name: 'Daily Backup',
      type: 'backup',
      status: 'completed',
      lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000), // 22 hours from now
      duration: 45
    },
    {
      id: 'teacher-notifications',
      name: 'Teacher Notifications',
      type: 'notification',
      status: 'completed',
      lastRun: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      nextRun: new Date(Date.now() + 16 * 60 * 60 * 1000), // 16 hours from now
      duration: 12
    },
    {
      id: 'google-sync',
      name: 'Google Sheets Sync',
      type: 'sync',
      status: 'running',
      progress: 75,
      lastRun: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    {
      id: 'system-cleanup',
      name: 'System Cleanup',
      type: 'cleanup',
      status: 'queued',
      nextRun: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    }
  ]

  const jobs = automationJobs.length > 0 ? automationJobs : mockJobs

  const handleTriggerJob = (jobId: string) => {
    triggerJob(jobId)
  }

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'backup': return <Database className="h-4 w-4" />
      case 'notification': return <Calendar className="h-4 w-4" />
      case 'sync': return <FileSpreadsheet className="h-4 w-4" />
      case 'cleanup': return <Settings className="h-4 w-4" />
      default: return <Bot className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'queued': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge variant="default" className="bg-blue-500">Running</Badge>
      case 'completed': return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'failed': return <Badge variant="destructive">Failed</Badge>
      case 'queued': return <Badge variant="secondary">Queued</Badge>
      default: return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Automation</h2>
          <p className="text-muted-foreground">
            Monitor and control your automated tasks and Google Sheets sync.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <p className="text-xs text-muted-foreground">
              Automated tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {jobs.filter(job => job.status === 'running').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently executing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(job => job.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Successful executions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Sheets</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {googleSheetsStatus && typeof googleSheetsStatus === 'object' && 'data' in googleSheetsStatus && (googleSheetsStatus as any).data?.connected ? 'Connected' : 'Offline'}
            </div>
            <p className="text-xs text-muted-foreground">
              Sync status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Google Sheets Status */}
      <Alert>
        {googleSheetsStatus && typeof googleSheetsStatus === 'object' && 'data' in googleSheetsStatus && (googleSheetsStatus as any).data?.connected ? (
          <>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Google Sheets integration is active and syncing data successfully.
            </AlertDescription>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Sheets integration is not connected. Please check your configuration.
            </AlertDescription>
          </>
        )}
      </Alert>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Automation Jobs</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="grid gap-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getJobIcon(job.type)}
                      <div>
                        <CardTitle className="text-lg">{job.name}</CardTitle>
                        <CardDescription>
                          {job.type.charAt(0).toUpperCase() + job.type.slice(1)} Job
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(job.status)}`}></div>
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progress Bar for Running Jobs */}
                  {job.status === 'running' && (job as any).progress !== undefined && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{(job as any).progress}%</span>
                      </div>
                      <Progress value={(job as any).progress} className="h-2" />
                    </div>
                  )}

                  {/* Job Details */}
                  <div className="grid gap-2 text-sm">
                    {job.lastRun && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Run:</span>
                        <span>{formatRelativeTime(job.lastRun)}</span>
                      </div>
                    )}
                    {job.nextRun && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Next Run:</span>
                        <span>{job.nextRun.toLocaleString()}</span>
                      </div>
                    )}
                    {job.duration && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span>{formatDuration(job.duration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {job.errorMessage && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{job.errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    {job.status === 'running' ? (
                      <Button variant="destructive" size="sm">
                        <Square className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTriggerJob(job.id)}
                        disabled={job.status !== 'queued'}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Run Now
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restart
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-3 w-3 mr-1" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>
                Recent execution history for all automation jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4" />
                <p>Execution history will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Configuration</CardTitle>
              <CardDescription>
                Configure when automation jobs should run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Daily Backup</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Runs every day at 11:00 PM
                    </p>
                    <Button variant="outline" size="sm">Edit Schedule</Button>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Teacher Notifications</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Runs every day at 7:00 AM
                    </p>
                    <Button variant="outline" size="sm">Edit Schedule</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                Detailed logs from automation system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4" />
                <p>System logs will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common automation tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-16 flex-col">
              <Database className="h-6 w-6 mb-2" />
              <span>Run Backup Now</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <FileSpreadsheet className="h-6 w-6 mb-2" />
              <span>Sync to Google Sheets</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <Calendar className="h-6 w-6 mb-2" />
              <span>Send Notifications</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AutomationDashboard