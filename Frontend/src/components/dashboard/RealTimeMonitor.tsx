import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useScannerMonitor } from '@/hooks/useUSBScanner';
import { toast } from 'sonner';
import { Activity, Users, Monitor, Wifi, WifiOff, AlertCircle, CheckCircle, TrendingUp, Zap, RefreshCw, Bell, Camera, Radio } from 'lucide-react';

interface RealTimeMonitorProps {
  showScanner?: boolean;
  showActivities?: boolean;
  showEquipment?: boolean;
  compact?: boolean;
}

export function RealTimeMonitor({
  showScanner = true,
  showActivities = true,
  showEquipment = true,
  compact = false
}: RealTimeMonitorProps) {
  const { isMobile, isTablet } = useMobileOptimization();
  const {
    isConnected,
    recentActivities,
    equipmentStatus,
    notifications,
    dashboardData,
    refreshDashboard,
    clearNotifications
  } = useWebSocketContext();

  const [stats, setStats] = useState({
    activeStudents: 0,
    availableEquipment: 0,
    activeSessions: 0,
    todayVisits: 0
  });

  const [recentScans, setRecentScans] = useState<Array<{ code: string; type: string; timestamp: Date }>>([]);

  // Scanner monitoring
  const handleScan = (code: string, type: 'barcode' | 'qr') => {
    setRecentScans(prev => [
      { code, type, timestamp: new Date() },
      ...prev.slice(0, 9)
    ]);
    toast.success(`Scanned: ${code}`);
  };

  const scanner = useScannerMonitor(handleScan);

  // Update stats from dashboard data
  useEffect(() => {
    if (dashboardData.overview) {
      setStats({
        activeStudents: dashboardData.overview.activeStudents || 0,
        availableEquipment: dashboardData.overview.availableEquipment || 0,
        activeSessions: dashboardData.overview.activeSessions || 0,
        todayVisits: dashboardData.overview.todayVisits || 0
      });
    }
  }, [dashboardData]);

  // Auto-refresh data
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        refreshDashboard('overview');
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isConnected, refreshDashboard]);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CHECK_IN':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'CHECK_OUT':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className={`space-y-${isMobile ? '3' : '4'}`}>
      {/* Connection Status */}
      <Card className={isConnected ? 'border-green-500 bg-green-50/30 dark:bg-green-950/10' : 'border-red-500 bg-red-50/30 dark:bg-red-950/10'}>
        <CardContent className={`p-${isMobile ? '3' : '4'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Real-time Connected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Live updates active
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Disconnected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attempting to reconnect...
                    </p>
                  </div>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshDashboard('overview')}
              disabled={!isConnected}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
          <CardContent className={`p-${isMobile ? '3' : '4'} text-center`}>
            <Users className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.activeStudents}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">Active Students</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardContent className={`p-${isMobile ? '3' : '4'} text-center`}>
            <Monitor className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {stats.availableEquipment}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">Available</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <CardContent className={`p-${isMobile ? '3' : '4'} text-center`}>
            <Zap className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {stats.activeSessions}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">Active Sessions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <CardContent className={`p-${isMobile ? '3' : '4'} text-center`}>
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {stats.todayVisits}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">Today's Visits</p>
          </CardContent>
        </Card>
      </div>

      {/* Scanner Monitor */}
      {showScanner && (
        <Card>
          <CardHeader className={isMobile ? 'p-3' : 'p-4'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                <CardTitle className="text-lg">Scanner Activity</CardTitle>
              </div>
              {scanner.isScanning && (
                <Badge variant="default" className="animate-pulse">
                  Scanning...
                </Badge>
              )}
            </div>
            <CardDescription>
              {scanner.scanCount} scans detected • USB Scanner ready
            </CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3' : 'p-4'}>
            {recentScans.length > 0 ? (
              <div className="space-y-2">
                {recentScans.slice(0, 5).map((scan, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {scan.type}
                      </Badge>
                      <code className="text-sm font-mono">{scan.code}</code>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(scan.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Waiting for scanner input...</p>
                <p className="text-xs mt-1">Scan a barcode or QR code to begin</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      {showActivities && (
        <Card>
          <CardHeader className={isMobile ? 'p-3' : 'p-4'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle className="text-lg">Live Activities</CardTitle>
              </div>
              <Badge variant="outline">{recentActivities.length}</Badge>
            </div>
            <CardDescription>Real-time student activity updates</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3' : 'p-4'}>
            {recentActivities.length > 0 ? (
              <div className="space-y-2">
                {recentActivities.slice(0, 10).map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getActivityIcon(activity.activityType)}
                      <div>
                        <p className="font-medium text-sm">
                          {activity.studentName || 'Unknown Student'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.activityType}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {formatTime(activity.checkInTime || activity.timestamp)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activities</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Equipment Status */}
      {showEquipment && Object.keys(equipmentStatus).length > 0 && (
        <Card>
          <CardHeader className={isMobile ? 'p-3' : 'p-4'}>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <CardTitle className="text-lg">Equipment Status</CardTitle>
            </div>
            <CardDescription>Live equipment monitoring</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3' : 'p-4'}>
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
              {Object.values(equipmentStatus).slice(0, 6).map((equipment: any, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{equipment.name}</span>
                    <Badge
                      variant={equipment.status === 'AVAILABLE' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {equipment.status}
                    </Badge>
                  </div>
                  {equipment.currentSession && (
                    <div className="text-xs text-muted-foreground">
                      <div className="flex justify-between mb-1">
                        <span>In use by: {equipment.currentSession.studentName}</span>
                        <span>{equipment.currentSession.remainingMinutes}m left</span>
                      </div>
                      <Progress
                        value={(equipment.currentSession.elapsedMinutes / equipment.currentSession.timeLimitMinutes) * 100}
                        className="h-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card className="border-orange-500 bg-orange-50/30 dark:bg-orange-950/10">
          <CardHeader className={isMobile ? 'p-3' : 'p-4'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Active Notifications</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className={isMobile ? 'p-3' : 'p-4'}>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification, index) => (
                <Alert key={index} className="p-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between">
                      <span>{notification.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RealTimeMonitor;
