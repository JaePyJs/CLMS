import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { apiClient } from '@/lib/api';
import {
  Monitor,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  MessageSquare,
  Bell,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  Book,
  HelpCircle,
} from 'lucide-react';
import { ActiveStudentsManager } from './ActiveStudentsManager';

interface RealTimeDashboardProps {
  className?: string;
}

export function RealTimeDashboard({ className }: RealTimeDashboardProps) {
  const {
    isConnected,
    isConnecting,
    error,
    recentActivities,
    equipmentStatus,
    notifications,
    dashboardData,
    triggerEmergencyAlert,
    sendChatMessage,
    refreshDashboard,
  } = useWebSocketContext();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [localActivities, setLocalActivities] = useState<any[]>([]);
  const [localEquipment, setLocalEquipment] = useState<Record<string, any>>({});
  const [localOverview, setLocalOverview] = useState<Record<
    string,
    any
  > | null>(null);

  // Fetch data via HTTP API as fallback
  const fetchDataViaApi = async () => {
    try {
      // Fetch dashboard data including recent activities
      const dashboardResp = await apiClient.get('/api/analytics/dashboard');
      if (dashboardResp.success && dashboardResp.data) {
        const data = dashboardResp.data as any;

        // Store overview stats from API
        if (data.overview || data.stats) {
          setLocalOverview(data.overview || data.stats || data);
        } else {
          // If the API returns the stats directly
          setLocalOverview({
            totalStudents: data.totalStudents,
            activeStudents: data.activeStudents,
            totalBooks: data.totalBooks,
            todayActivities: data.todayActivities,
            activeEquipment: data.activeEquipment,
          });
        }

        if (Array.isArray(data.recentActivities)) {
          setLocalActivities(
            data.recentActivities.map((a: any) => ({
              id: a.id,
              studentName: a.student
                ? `${a.student.first_name} ${a.student.last_name}`
                : 'Unknown',
              activityType: a.activity_type,
              timestamp: a.start_time,
              studentId: a.student_id,
            }))
          );
        }
      }

      // Fetch equipment status
      const equipmentResp = await apiClient.get('/api/equipment');
      if (equipmentResp.success && Array.isArray(equipmentResp.data)) {
        const equipmentMap = (equipmentResp.data as any[]).reduce(
          (acc: any, eq: any) => {
            acc[eq.id] = {
              equipmentName: eq.name,
              equipmentType: eq.type,
              status: eq.status,
              userId: eq.current_user_id,
            };
            return acc;
          },
          {}
        );
        setLocalEquipment(equipmentMap);
      }
    } catch (error) {
      console.error('[RealTimeDashboard] Failed to fetch via API:', error);
    }
  };

  // Initial data request when WebSocket connects
  useEffect(() => {
    // Always fetch via API first for initial data
    fetchDataViaApi();

    // Also request via WebSocket if connected (for real-time updates)
    if (isConnected) {
      refreshDashboard('overview');
      refreshDashboard('activities');
      refreshDashboard('equipment');
    }
  }, [isConnected, refreshDashboard]);

  // Auto-refresh dashboard data
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      if (isConnected) {
        refreshDashboard('overview');
        refreshDashboard('activities');
        refreshDashboard('equipment');
      } else {
        fetchDataViaApi();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, autoRefresh, refreshDashboard]);

  // Calculate statistics from real-time data (prefer WebSocket, fallback to API)
  const overview =
    (dashboardData?.overview as Record<string, unknown> | undefined) ||
    localOverview;

  const stats = {
    totalStudents:
      Number(
        overview?.totalStudents ??
          overview?.total_students ??
          overview?.students?.total
      ) || 0,
    activeStudents:
      Number(
        overview?.activeStudents ??
          overview?.active_students ??
          overview?.students?.active
      ) || 0,
    totalBooks:
      Number(
        overview?.totalBooks ?? overview?.total_books ?? overview?.books?.total
      ) || 0,
    todayActivities:
      Number(overview?.todayActivities ?? overview?.today_activities) ||
      recentActivities.length ||
      localActivities.length,
    activeEquipment:
      Number(
        overview?.activeEquipment ??
          overview?.total_equipment ??
          overview?.equipment?.total
      ) ||
      Object.keys(equipmentStatus).length ||
      Object.keys(localEquipment).length,
    activeConnections:
      Number(overview?.activeConnections ?? overview?.active_connections) || 0,
    systemLoad: Number(overview?.systemLoad ?? overview?.system_load) || 0,
    recentNotifications: notifications.length,
    criticalAlerts: notifications.filter(
      (n) => (n as { priority?: string }).priority === 'critical'
    ).length,
  };

  const handleEmergencyAlert = () => {
    const message = prompt('Enter emergency alert message:');
    if (message) {
      triggerEmergencyAlert('system_emergency', message, 'Main Library');
    }
  };

  const handleSendMessage = () => {
    const message = prompt('Enter message to broadcast to all staff:');
    if (message) {
      sendChatMessage(message, 'staff');
    }
  };

  const getActivityIcon = (activity: Record<string, unknown>) => {
    switch (activity.activityType) {
      case 'CHECK_IN':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'CHECK_OUT':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'EQUIPMENT_USE':
        return <Monitor className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEquipmentStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'text-green-500';
      case 'IN_USE':
        return 'text-blue-500';
      case 'MAINTENANCE_REQUIRED':
        return 'text-yellow-500';
      case 'MALFUNCTIONING':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status Bar */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <Wifi className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      Real-time Connection Active
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      WebSocket connected • Live updates enabled
                    </p>
                  </div>
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-300">
                      Connecting to Real-time Updates
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Establishing WebSocket connection...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-300">
                      Real-time Updates Unavailable
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error || 'WebSocket connection failed'}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`}
                />
                Auto-refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshDashboard('overview')}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-help">
                        In Library
                        <HelpCircle className="h-3 w-3" />
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Students currently checked into the library (not yet
                        checked out). This is different from students who have
                        borrowed books.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                  {stats.activeStudents}
                </p>
                <div className="flex items-center mt-2 text-xs text-indigo-500">
                  <Users className="h-3 w-3 mr-1" />
                  {stats.totalStudents} Registered
                </div>
              </div>
              <Users className="h-8 w-8 text-indigo-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Total Books
                </p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {stats.totalBooks}
                </p>
                <div className="flex items-center mt-2 text-xs text-amber-500">
                  <Book className="h-3 w-3 mr-1" />
                  In Library
                </div>
              </div>
              <Book className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Today's Activities
                </p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {stats.todayActivities}
                </p>
                <div className="flex items-center mt-2 text-xs text-blue-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Live from system
                </div>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Active Equipment
                </p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {stats.activeEquipment}
                </p>
                <div className="flex items-center mt-2 text-xs text-green-500">
                  <Monitor className="h-3 w-3 mr-1" />
                  Real-time status
                </div>
              </div>
              <Monitor className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  System Load
                </p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {stats.systemLoad}%
                </p>
                <div className="flex items-center mt-2 text-xs text-purple-500">
                  <Zap className="h-3 w-3 mr-1" />
                  Live monitoring
                </div>
              </div>
              <Activity className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Critical Alerts
                </p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                  {stats.criticalAlerts}
                </p>
                <div className="flex items-center mt-2 text-xs text-red-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Needs attention
                </div>
              </div>
              <Bell className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Live Activity Feed
              </div>
              <Badge variant="outline" className="text-xs">
                Last 24 hours
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(recentActivities.length > 0
                ? recentActivities
                : localActivities
              ).length > 0 ? (
                (recentActivities.length > 0
                  ? recentActivities
                  : localActivities
                )
                  .slice(0, 10)
                  .map((activity, index) => (
                    <div
                      key={
                        activity.id ||
                        `activity-${activity.studentId}-${activity.timestamp}-${index}`
                      }
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      {getActivityIcon(activity)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {String(activity.studentName)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {String(activity.activityType)}
                          {activity.equipmentName &&
                            ` • ${String(activity.equipmentName)}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Equipment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Equipment Status
              </div>
              <Badge variant="outline" className="text-xs">
                Live updates
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(() => {
                const combinedEquipment =
                  Object.keys(equipmentStatus).length > 0
                    ? equipmentStatus
                    : localEquipment;
                return Object.keys(combinedEquipment).length > 0 ? (
                  Object.entries(combinedEquipment).map(
                    ([equipmentId, status]: [string, any]) => (
                      <div
                        key={equipmentId}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <Monitor
                            className={`h-4 w-4 ${getEquipmentStatusColor(status.status)}`}
                          />
                          <div>
                            <p className="font-medium text-sm">
                              {status.equipmentName || equipmentId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {status.equipmentType}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              status.status === 'AVAILABLE'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {status.status?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                          {status.userId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              In use
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="text-center py-8">
                    <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      No equipment data available
                    </p>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Notifications */}
      {notifications.length > 0 && (
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Recent Notifications
              </div>
              <Badge variant="outline" className="text-xs">
                {notifications.length} new
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifications.slice(0, 5).map((notification, index) => (
                <div
                  key={`${notification.id}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <Bell
                    className={`h-4 w-4 mt-0.5 ${
                      notification.priority === 'critical'
                        ? 'text-red-500'
                        : notification.priority === 'high'
                          ? 'text-orange-500'
                          : notification.priority === 'medium'
                            ? 'text-yellow-500'
                            : 'text-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {String(notification.title ?? '')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(notification.message)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Real-time Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={handleSendMessage}
              className="h-16 flex-col"
              disabled={!isConnected}
            >
              <MessageSquare className="h-5 w-5 mb-2" />
              <span className="text-sm">Broadcast Message</span>
              <span className="text-xs text-gray-500">Send to all staff</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleEmergencyAlert}
              className="h-16 flex-col border-red-200 text-red-600 hover:bg-red-50"
              disabled={!isConnected}
            >
              <AlertTriangle className="h-5 w-5 mb-2" />
              <span className="text-sm">Emergency Alert</span>
              <span className="text-xs text-red-500">
                Critical notification
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={() => refreshDashboard('all')}
              className="h-16 flex-col"
              disabled={!isConnected}
            >
              <RefreshCw className="h-5 w-5 mb-2" />
              <span className="text-sm">Force Refresh</span>
              <span className="text-xs text-gray-500">Update all data</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Students Management */}
      <ActiveStudentsManager />
    </div>
  );
}

export default RealTimeDashboard;
