import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Monitor,
  Gamepad2,
  Activity,
  Settings,
  Users,
  Clock,
  Wifi,
  WifiOff,
  Bot
} from 'lucide-react'

// Dashboard Components (placeholder - will be created)
const DashboardOverview = () => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
    <p className="text-muted-foreground">Welcome back, Sophia! Here's what's happening in your library today.</p>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Students Today</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45</div>
          <p className="text-xs text-muted-foreground">+20% from yesterday</p>
        </CardContent>
      </Card>
    </div>
  </div>
)

const EquipmentDashboard = () => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold tracking-tight">Equipment Management</h2>
    <p className="text-muted-foreground">Monitor and manage library equipment and computer stations.</p>
  </div>
)

const N8nDashboard = () => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold tracking-tight">n8n Automation</h2>
    <p className="text-muted-foreground">Monitor and control your automated workflows.</p>
  </div>
)

const AnalyticsDashboard = () => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
    <p className="text-muted-foreground">Track library usage patterns and generate insights.</p>
  </div>
)

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">CLMS</h1>
                <p className="text-sm text-muted-foreground">
                  Comprehensive Library Management System
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* System Status */}
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">System Online</span>
              </div>

              {/* Admin Info */}
              <Badge variant="secondary">Sophia - Librarian</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center space-x-2">
              <Monitor className="h-4 w-4" />
              <span>Equipment</span>
            </TabsTrigger>
            <TabsTrigger value="n8n" className="flex items-center space-x-2">
              <Bot className="h-4 w-4" />
              <span>n8n Automation</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardOverview />
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-6">
            <EquipmentDashboard />
          </TabsContent>

          {/* n8n Automation Tab */}
          <TabsContent value="n8n" className="space-y-6">
            <N8nDashboard />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © 2024 Sacred Heart of Jesus Catholic School Library
            </p>
            <p className="text-sm text-muted-foreground">
              CLMS v1.0.0 - Built with React & n8n
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}