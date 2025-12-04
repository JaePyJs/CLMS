import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useActivityTimeline, useHealthCheck } from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { CalendarWidget } from './CalendarWidget';
import { RealTimeDashboard } from './RealTimeDashboard';
import { utilitiesApi, studentsApi, apiClient } from '@/lib/api';
import api from '@/services/api';
import { toast } from 'sonner';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';
import {
  Filter,
  CheckCircle,
  Activity,
  Clock,
  TrendingUp,
  AlertTriangle,
  Settings,
  BarChart3,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  Bell,
  Wifi,
  Key,
  Eye,
  Users,
  Monitor,
  Shield,
  AlertCircle,
  ExternalLink,
  Edit,
  FileText,
} from 'lucide-react';

interface DashboardOverviewProps {
  onTabChange?: (_tab: string) => void;
}

export function DashboardOverview({ onTabChange }: DashboardOverviewProps) {
  const { user } = useAuth();
  const { isOnline, connectedToBackend, activities, automationJobs } =
    useAppStore();
  const { isConnected: wsConnected, notifications } = useWebSocketContext();
  const { events: attendanceEvents } = useAttendanceWebSocket();
  const lastAnnouncement = (() => {
    for (let i = attendanceEvents.length - 1; i >= 0; i--) {
      const ev: any = attendanceEvents[i];
      if (
        ev &&
        ev.type === 'announcement' &&
        ev.data &&
        typeof ev.data.message === 'string'
      ) {
        return {
          message: String(ev.data.message),
          at: ev.timestamp ? String(ev.timestamp) : new Date().toISOString(),
          userId: ev.data?.userId ? String(ev.data.userId) : undefined,
          userName: ev.data?.userName ? String(ev.data.userName) : undefined,
        };
      }
    }
    return null;
  })();
  const recentAnnouncements = attendanceEvents
    .filter((ev: any) => ev?.type === 'announcement' && ev?.data?.message)
    .slice(-3)
    .map((ev: any) => ({
      message: String(ev.data.message),
      at: ev.timestamp ? String(ev.timestamp) : new Date().toISOString(),
      userId: ev.data?.userId ? String(ev.data.userId) : undefined,
      userName: ev.data?.userName ? String(ev.data.userName) : undefined,
    }));
  const [attendanceExpanded, setAttendanceExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('clms_attendance_expanded');
    return saved === 'true';
  });
  const [attendanceShowCount, setAttendanceShowCount] = useState<number>(() => {
    const saved = parseInt(
      localStorage.getItem('clms_attendance_show_count') || '10'
    );
    return isNaN(saved) ? 10 : saved;
  });
  const [attendanceAutoScroll, setAttendanceAutoScroll] = useState<boolean>(
    () => {
      const saved = localStorage.getItem('clms_attendance_autoscroll');
      return saved === 'true';
    }
  );
  const [attendanceFilter, setAttendanceFilter] = useState<
    'all' | 'in' | 'out' | 'msg'
  >(() => {
    const saved = localStorage.getItem('clms_attendance_filter') as any;
    return saved && ['all', 'in', 'out', 'msg'].includes(saved) ? saved : 'all';
  });
  useEffect(() => {
    localStorage.setItem(
      'clms_attendance_expanded',
      String(attendanceExpanded)
    );
  }, [attendanceExpanded]);
  useEffect(() => {
    localStorage.setItem(
      'clms_attendance_show_count',
      String(attendanceShowCount)
    );
  }, [attendanceShowCount]);
  useEffect(() => {
    localStorage.setItem(
      'clms_attendance_autoscroll',
      String(attendanceAutoScroll)
    );
  }, [attendanceAutoScroll]);
  useEffect(() => {
    localStorage.setItem('clms_attendance_filter', String(attendanceFilter));
  }, [attendanceFilter]);
  const [showRealTime] = useState(true);
  useEffect(() => {
    if (!attendanceAutoScroll) return;
    try {
      const el = document.getElementById('attendance-scroll');
      if (el) {
        el.scrollTop = 0;
      }
    } catch {
      // Ignore error
    }
  }, [attendanceAutoScroll, attendanceEvents]);
  // Beginner mode removed - unified dashboard view
  const beginnerMode = false;
  const [changeSectionTarget, setChangeSectionTarget] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [changeSections, setChangeSections] = useState<Record<string, boolean>>(
    {
      AVR: false,
      COMPUTER: false,
      LIBRARY_SPACE: false,
      BORROWING: false,
      RECREATION: false,
    }
  );
  const saveSectionChange = async () => {
    if (!changeSectionTarget) return;
    const toSections = Object.entries(changeSections)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (toSections.length === 0) {
      toast.error('Select at least one section');
      return;
    }
    try {
      await api.post('/kiosk/change-section', {
        studentId: changeSectionTarget.studentId,
        toSections,
      });
      toast.success(`Sections updated for ${changeSectionTarget.studentName}`);
    } catch {
      toast.error('Failed to change section');
    } finally {
      setChangeSectionTarget(null);
      setChangeSections({
        AVR: false,
        COMPUTER: false,
        LIBRARY_SPACE: false,
        BORROWING: false,
        RECREATION: false,
      });
    }
  };

  // Real-time clock state (updates every minute for professional appearance)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Quick Actions loading states

  // Quick Actions loading states
  const [isStartingSession] = useState(false);
  const [isViewingReport, setIsViewingReport] = useState(false);
  const [isRunningBackup, setIsRunningBackup] = useState(false);

  // New loading states for enhanced functionality
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update time every minute (professional standard)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every 60 seconds

    return () => clearInterval(timer);
  }, []);

  // Quick Actions handlers
  // handleAddStudent removed as per requirements

  const handleStartSession = async () => {
    // For demo purposes, we'll show a message that this requires student/equipment selection
    toast.info(
      'Start Session requires student and equipment selection. This feature will be enhanced in the Equipment tab.'
    );
  };

  const handleViewReport = async () => {
    try {
      setIsViewingReport(true);
      const response = await utilitiesApi.getQuickReport();

      if (response.success) {
        toast.success('Report generated successfully!');
        // Display report data in a more user-friendly way
        // console.debug('Quick Report:', response.data);

        // Show key metrics in toast
        const report = response.data as {
          summary: {
            totalStudents: number;
            todayActivities: number;
            equipmentUtilization: number;
          };
        };
        if (
          report?.summary &&
          typeof report.summary.totalStudents === 'number'
        ) {
          toast.info(
            `${report.summary.totalStudents} students, ${report.summary.todayActivities} activities today, ${report.summary.equipmentUtilization}% equipment utilization`
          );
        }
      } else {
        const responseError = response as {
          error?: string | { message?: string };
        };
        const errorMessage =
          typeof responseError.error === 'string'
            ? responseError.error
            : responseError.error?.message || 'Failed to generate report';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setIsViewingReport(false);
    }
  };

  const handleRunBackup = async () => {
    try {
      setIsRunningBackup(true);
      const response = await utilitiesApi.quickBackup();

      if (response.success) {
        const data = response.data as { estimatedDuration?: string };
        toast.success(
          `Backup initiated! ${data?.estimatedDuration ?? 'Unknown'} estimated duration.`
        );
      } else {
        const responseError = response as {
          error?: string | { message?: string };
        };
        const errorMessage =
          typeof responseError.error === 'string'
            ? responseError.error
            : responseError.error?.message || 'Failed to initiate backup';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error initiating backup:', error);
      toast.error('Failed to initiate backup. Please try again.');
    } finally {
      setIsRunningBackup(false);
    }
  };

  // Enhanced functionality handlers

  const ConnectionStatusCard = () => (
    <Card className="card-enhanced">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className={wsConnected ? 'text-green-500' : 'text-red-500'} />
          Connection Status
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Backend: {connectedToBackend ? 'Healthy' : 'Unreachable'} • WS:{' '}
          {wsConnected ? 'Connected' : 'Disconnected'} • Time:{' '}
          {currentTime.toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Badge variant="outline">
            Role: {String(user?.role || 'LIBRARIAN')}
          </Badge>
          <Badge variant="outline">Online: {isOnline ? 'Yes' : 'No'}</Badge>
        </div>
      </CardContent>
    </Card>
  );

  const [kioskDeviceName, setKioskDeviceName] = useState('Lobby Display');
  const [kioskToken, setKioskToken] = useState<string>('');
  const [kioskGenerating, setKioskGenerating] = useState(false);
  const [kioskUsers, setKioskUsers] = useState<
    Array<{
      id: string;
      username: string;
      full_name?: string;
      is_active: boolean;
      created_at?: string;
      last_login_at?: string;
    }>
  >([]);
  const [kioskLoading, setKioskLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setKioskLoading(true);
        const resp = await apiClient.get('/api/auth/kiosk-users');
        const data = (resp as any)?.data as any[];
        setKioskUsers(Array.isArray(data) ? data : []);
      } catch {
        // Ignore error
      } finally {
        setKioskLoading(false);
      }
    };
    void load();
  }, []);

  const KioskTokenCard = () => (
    <Card className="card-enhanced">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key />
          Kiosk Display Token
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Generate a token for kiosk display devices to subscribe to attendance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Input
            value={kioskDeviceName}
            onChange={(e) => setKioskDeviceName(e.target.value)}
            placeholder="Device name"
          />
          <Button
            onClick={async () => {
              try {
                setKioskGenerating(true);
                const resp = await apiClient.post('/api/auth/kiosk-token', {
                  deviceName: kioskDeviceName,
                });
                const data = (resp as any)?.data;
                setKioskToken(String(data?.accessToken || ''));
                const list = await apiClient.get('/api/auth/kiosk-users');
                setKioskUsers(((list as any)?.data as any[]) || []);
                toast.success('Kiosk token generated');
              } catch {
                toast.error('Failed to generate kiosk token');
              } finally {
                setKioskGenerating(false);
              }
            }}
            disabled={kioskGenerating}
          >
            {kioskGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
        {kioskToken && (
          <div className="text-xs break-all p-3 rounded-md border bg-muted">
            {kioskToken}
          </div>
        )}
        <div className="mt-4">
          <div className="font-medium mb-2">Registered Kiosk Users</div>
          {kioskLoading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : kioskUsers.length === 0 ? (
            <div className="text-muted-foreground text-sm">No kiosk users</div>
          ) : (
            <div className="space-y-2">
              {kioskUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-2 rounded-md border"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {u.full_name || u.username}
                    </div>
                    <div className="text-muted-foreground">
                      {u.username} • {u.is_active ? 'Active' : 'Revoked'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={!u.is_active}
                      onClick={async () => {
                        try {
                          await apiClient.post('/api/auth/kiosk-revoke', {
                            userId: u.id,
                          });
                          const list = await apiClient.get(
                            '/api/auth/kiosk-users'
                          );
                          setKioskUsers(((list as any)?.data as any[]) || []);
                          toast.success('Kiosk user revoked');
                        } catch {
                          toast.error('Failed to revoke');
                        }
                      }}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
  const handleExport = async () => {
    try {
      setIsExporting(true);
      // Generate CSV export
      const csvContent = `Data Type,Count,Timestamp\nStudents Today,${totalToday},${new Date().toISOString()}\nActive Sessions,${activeSessions},${new Date().toISOString()}\nRunning Jobs,${runningJobs},${new Date().toISOString()}`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Dashboard data exported successfully!');
    } catch {
      toast.error('Failed to export dashboard data');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      setIsPrinting(true);
      window.print();
      toast.success('Print dialog opened');
    } catch {
      toast.error('Failed to open print dialog');
    } finally {
      setIsPrinting(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    toast.info(
      isFullscreen ? 'Exited fullscreen mode' : 'Entered fullscreen mode'
    );
  };

  const handleEmergencyAlert = () => {
    toast.warning(
      'Emergency alert system activated. This would notify administrators of critical system issues.'
    );
  };

  const handleManualSessionEntry = () => {
    toast.info(
      'Manual session entry feature. This would open a form to log missed check-ins.'
    );
  };

  const handleBulkCheckout = () => {
    toast.info(
      'Bulk checkout feature. This would allow ending multiple active sessions at once.'
    );
  };

  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewRecords, setPreviewRecords] = useState<
    Array<{
      rowNumber?: number;
      firstName?: string;
      lastName?: string;
      gradeLevel?: string;
      section?: string;
      email?: string;
      isValid?: boolean;
      errors?: string[];
      warnings?: string[];
    }>
  >([]);
  const [generatedBarcodes, setGeneratedBarcodes] = useState<
    Array<{ row: number; barcode: string }>
  >([]);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importBusy, setImportBusy] = useState<boolean>(false);
  const onTemplateDownload = async () => {
    const response = await studentsApi.downloadTemplate();
    const content = (response?.data as any) ?? '';
    const blob = new Blob(
      [typeof content === 'string' ? content : JSON.stringify(content)],
      { type: 'text/csv' }
    );
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  const onFileSelect = async (file?: File) => {
    if (!file) return;
    setImportFile(file);
    setImportProgress(10);
    try {
      const res = await studentsApi.previewImport(file, 'students', 10);
      const data = res?.data as any;
      const records = Array.isArray(data?.records) ? data.records : [];
      setPreviewRecords(records);
      setImportProgress(40);
      toast.success('Preview ready');
    } catch {
      toast.error('Failed to preview import file');
      setPreviewRecords([]);
      setImportProgress(0);
    }
  };
  const onImportStart = async () => {
    if (!importFile) {
      toast.error('No file selected');
      return;
    }
    if (previewRecords.length > 0) {
      const invalid = previewRecords.filter(
        (r) => r.isValid === false || !r.firstName || !r.lastName
      );
      if (invalid.length > 0) {
        toast.error(`Fix ${invalid.length} invalid rows before import`);
        return;
      }
    }
    setImportBusy(true);
    setImportProgress(60);
    try {
      const res = await studentsApi.importStudents(importFile, [], false);
      const data = res?.data as any;
      const gen = Array.isArray(data?.generated) ? data.generated : [];
      setGeneratedBarcodes(gen);
      setImportProgress(100);
      const imported = data?.importedRecords ?? 0;
      const skipped = data?.skippedRecords ?? 0;
      const errors = data?.errorRecords ?? 0;
      toast.success(
        `Imported ${imported} • Skipped ${skipped} • Errors ${errors}`
      );
    } catch {
      toast.error('Import failed');
      setImportProgress(0);
    } finally {
      setImportBusy(false);
    }
  };
  const onPrintGenerated = () => {
    if (!generatedBarcodes.length) {
      toast.info('No generated barcodes');
      return;
    }
    const w = window.open('', 'print', 'width=800,height=600');
    if (!w) return;
    const rows = generatedBarcodes
      .map(
        (g) =>
          `<tr><td style="padding:8px;border:1px solid #ccc;">${g.row}</td><td style="padding:8px;border:1px solid #ccc;">${g.barcode}</td></tr>`
      )
      .join('');
    w.document.write(
      `<html><head><title>Generated Barcodes</title></head><body><h3>Generated Barcodes</h3><table style="border-collapse:collapse;width:100%"><thead><tr><th style="text-align:left;padding:8px;border:1px solid #ccc;">Row</th><th style="text-align:left;padding:8px;border:1px solid #ccc;">Barcode</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  // Use error boundaries for API calls to prevent crashes
  const { data: timeline, isLoading: timelineLoading } =
    useActivityTimeline(10);
  const { data: healthData } = useHealthCheck();

  // Fetch active sessions with polling and WebSocket-triggered refresh
  const [activeSessionsData, setActiveSessionsData] = useState<{
    count: number;
    sessions: any[];
    lastFetch: number;
  }>({ count: 0, sessions: [], lastFetch: 0 });

  const fetchActiveSessions = async () => {
    try {
      const response = await studentsApi.getActiveSessions();
      const data = (response as any)?.data || response;
      const sessions = Array.isArray(data?.data) ? data.data : [];
      setActiveSessionsData({
        count: data?.count || sessions.length,
        sessions,
        lastFetch: Date.now(),
      });
    } catch (error) {
      console.error('Failed to fetch active sessions:', error);
    }
  };

  // Initial fetch and polling every 30 seconds
  useEffect(() => {
    fetchActiveSessions();
    const intervalId = setInterval(fetchActiveSessions, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Refetch when WebSocket check-in/check-out events occur
  useEffect(() => {
    if (!attendanceEvents || attendanceEvents.length === 0) return;
    const latestEvent = attendanceEvents[attendanceEvents.length - 1];
    if (
      latestEvent?.type === 'student_checkin' ||
      latestEvent?.type === 'student_checkout'
    ) {
      // Small delay to ensure backend has processed
      setTimeout(fetchActiveSessions, 500);
    }
  }, [attendanceEvents]);

  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const frontendVersion =
    (import.meta.env.VITE_APP_VERSION as string) || '2.0.0';
  const [versionCheckedAt, setVersionCheckedAt] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const fetchVersion = async () => {
      try {
        const resp = await apiClient.get('/api/version');
        const data = (resp as any)?.data || resp;
        const ver = String(data?.version ?? '');
        if (mounted) {
          setBackendVersion(ver || null);
          setVersionCheckedAt(Date.now());
        }
      } catch {
        // Ignore error
      }
    };
    void fetchVersion();
    const id = setInterval(fetchVersion, 60000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);
  const exportRecentActivityCsv = () => {
    const arr = Array.isArray(timeline) ? timeline : [];
    if (!arr.length) {
      toast.info('No recent activities to export');
      return;
    }
    const rows = [
      [
        'ID',
        'Type',
        'Status',
        'User/Student',
        'Description',
        'Start Time',
        'End Time',
      ],
      ...arr.map((activity: any) => [
        String(activity.id ?? ''),
        String(activity.activityType ?? activity.type ?? ''),
        String(activity.status ?? ''),
        String(activity.studentName ?? activity.user?.username ?? ''),
        String(activity.description ?? ''),
        String(activity.start_time ?? activity.startTime ?? ''),
        String(activity.end_time ?? activity.endTime ?? ''),
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? '');
            const needsQuotes = /[",\n]/.test(s);
            const escaped = s.replace(/"/g, '""');
            return needsQuotes ? `"${escaped}"` : escaped;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recent-activity-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported recent activity CSV');
  };

  // Calculate real-time metrics - use fetched active sessions data
  const activeSessions = activeSessionsData.count;
  const totalToday = Array.isArray(activities)
    ? activities.filter((a) => {
        const today = new Date();
        const activityDate = new Date(a.startTime);
        return activityDate.toDateString() === today.toDateString();
      }).length
    : 0;

  const runningJobs =
    automationJobs?.filter((job) => job.status === 'running').length || 0;

  // WS status card data
  const [wsStats, setWsStats] = useState<{
    totalConnections: number;
    connectionsByRole: Record<string, number>;
    recentSubscriptionDenials?: Array<{
      socketId: string;
      room: string;
      userId?: string;
      role?: string;
      at: string;
    }>;
    recentRateLimits?: Array<{
      socketId: string;
      kind: 'subscribe' | 'dashboard';
      count: number;
      userId?: string;
      role?: string;
      at: string;
    }>;
  } | null>(null);
  const [wsStatsError, setWsStatsError] = useState<string | null>(null);
  // eslint-disable-next-line no-unused-vars
  const [wsStatsUpdatedAt, setWsStatsUpdatedAt] = useState<number | null>(null);
  const [announcementSettingsOpen, setAnnouncementSettingsOpen] =
    useState(false);
  const [announcementQuiet, setAnnouncementQuiet] = useState(false);
  const [announcementInterval, setAnnouncementInterval] = useState<number>(60);
  const [announcementText, setAnnouncementText] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [announcementLogOpen, setAnnouncementLogOpen] = useState(false);
  const [announcementLog, setAnnouncementLog] = useState<
    Array<{
      id: string;
      title: string;
      content: string;
      start_time: string;
      end_time?: string | null;
      is_active?: boolean;
      priority: string;
      created_at?: string;
      created_by_user_id?: string | null;
      created_by_username?: string | null;
    }>
  >([]);
  const [announcementLogLoading, setAnnouncementLogLoading] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<string>('');
  const [announcementActive, setAnnouncementActive] = useState<string>('');
  const [announcementDateFrom, setAnnouncementDateFrom] = useState<string>('');
  const [announcementDateTo, setAnnouncementDateTo] = useState<string>('');
  const [announcementPage, setAnnouncementPage] = useState<number>(1);
  const [announcementLimit, setAnnouncementLimit] = useState<number>(10);
  const [announcementTotal, setAnnouncementTotal] = useState<number>(0);
  const [announcementPages, setAnnouncementPages] = useState<number>(1);
  const [announcementCooldownUntil, setAnnouncementCooldownUntil] = useState<
    number | null
  >(null);
  const [announcementNowTs, setAnnouncementNowTs] = useState<number>(
    Date.now()
  );
  const exportAnnouncementLogCsv = () => {
    if (!announcementLog.length) {
      toast.info('No announcements to export');
      return;
    }
    const rows = [
      [
        'Title',
        'Content',
        'Priority',
        'Active',
        'Start Time',
        'End Time',
        'Sender Name',
        'Sender ID',
      ],
      ...announcementLog.map((a) => [
        a.title,
        a.content?.replace(/\n/g, ' '),
        a.priority || '',
        a.is_active === false ? 'false' : 'true',
        a.start_time,
        a.end_time || '',
        a.created_by_username || '',
        a.created_by_user_id || '',
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? '');
            const needsQuotes = /[",\n]/.test(s);
            const escaped = s.replace(/"/g, '""');
            return needsQuotes ? `"${escaped}"` : escaped;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `announcements-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported announcements CSV');
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const res = await api.get('/analytics/ws/stats');
        if (mounted) {
          setWsStats(res.data?.data || null);
          setWsStatsError(null);
          setWsStatsUpdatedAt(Date.now());
        }
      } catch {
        if (mounted) setWsStatsError('Unavailable');
      }
      try {
        const cfg = await api.get('/kiosk/announcements/config');
        const data = cfg?.data?.data || {};
        if (mounted) {
          setAnnouncementQuiet(Boolean(data.quietMode));
          setAnnouncementInterval(Number(data.intervalSeconds || 60));
          setAnnouncementCooldownUntil(null);
        }
      } catch {
        // Ignore error
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/analytics/ws/stats');
        setWsStats(res.data?.data || null);
        setWsStatsError(null);
        setWsStatsUpdatedAt(Date.now());
      } catch {
        setWsStatsError('Unavailable');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!announcementCooldownUntil) return;
    const t = setInterval(() => setAnnouncementNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [announcementCooldownUntil]);

  const saveAnnouncementConfig = async () => {
    try {
      await api.put('/kiosk/announcements/config', {
        quietMode: announcementQuiet,
        intervalSeconds: announcementInterval,
      });
      toast.success('Announcement settings updated');
    } catch {
      toast.error('Failed to update announcement settings');
    }
  };

  const sendAnnouncement = async () => {
    if (!announcementText.trim()) {
      toast.error('Enter a message');
      return;
    }
    try {
      setSendingAnnouncement(true);
      await api.post('/kiosk/broadcast', { message: announcementText.trim() });
      toast.success('Announcement sent');
      setAnnouncementText('');
      setAnnouncementCooldownUntil(
        Date.now() + Math.max(10, announcementInterval) * 1000
      );
    } catch (err: any) {
      const waitSeconds = err?.response?.data?.waitSeconds;
      const msg = err?.response?.data?.message || 'Failed to send announcement';
      if (typeof waitSeconds === 'number') {
        toast.error(`${msg} (${waitSeconds}s)`);
        setAnnouncementCooldownUntil(Date.now() + waitSeconds * 1000);
      } else {
        toast.error(msg);
      }
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const fetchAnnouncementLog = async () => {
    try {
      setAnnouncementLogLoading(true);
      const params: Record<string, any> = {
        page: announcementPage,
        limit: announcementLimit,
      };
      if (announcementPriority) params['priority'] = announcementPriority;
      if (announcementActive) params['is_active'] = announcementActive;
      if (announcementDateFrom) params['dateFrom'] = announcementDateFrom;
      if (announcementDateTo) params['dateTo'] = announcementDateTo;
      if (announcementSearch.trim())
        params['search'] = announcementSearch.trim();
      const res = await api.get('/kiosk/announcements/recent', { params });
      const data = res.data?.data;
      const pag = res.data?.pagination;
      setAnnouncementLog(Array.isArray(data) ? data : []);
      setAnnouncementTotal(Number(pag?.total || 0));
      setAnnouncementPages(Number(pag?.pages || 1));
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setAnnouncementLogLoading(false);
    }
  };

  useEffect(() => {
    if (!announcementLogOpen) return;
    void fetchAnnouncementLog();
  }, [
    announcementLogOpen,
    announcementPage,
    announcementLimit,
    announcementPriority,
    announcementActive,
    announcementDateFrom,
    announcementDateTo,
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('clms_announce_filters');
      if (saved) {
        const obj = JSON.parse(saved);
        if (typeof obj.search === 'string') setAnnouncementSearch(obj.search);
        if (typeof obj.priority === 'string')
          setAnnouncementPriority(obj.priority);
        if (typeof obj.active === 'string') setAnnouncementActive(obj.active);
        if (typeof obj.dateFrom === 'string')
          setAnnouncementDateFrom(obj.dateFrom);
        if (typeof obj.dateTo === 'string') setAnnouncementDateTo(obj.dateTo);
        if (typeof obj.limit === 'number') setAnnouncementLimit(obj.limit);
      }
    } catch {
      // Ignore error
    }
  }, []);
  useEffect(() => {
    const obj = {
      search: announcementSearch,
      priority: announcementPriority,
      active: announcementActive,
      dateFrom: announcementDateFrom,
      dateTo: announcementDateTo,
      limit: announcementLimit,
    };
    try {
      localStorage.setItem('clms_announce_filters', JSON.stringify(obj));
    } catch {
      // Ignore error
    }
  }, [
    announcementSearch,
    announcementPriority,
    announcementActive,
    announcementDateFrom,
    announcementDateTo,
    announcementLimit,
  ]);

  // Additional real metrics (initialized to 0)
  const equipmentInUse = 0;
  const availableComputers = 3; // Total computers in library

  return (
    <div
      data-testid="dashboard-root"
      className={`space-y-8 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-6 overflow-auto' : ''}`}
    >
      {/* Enhanced Welcome Header - Clean & Professional */}
      <div className="space-y-4">
        {/* Real-time Dashboard Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Library Dashboard</h3>
            <div className="flex items-center gap-2">
              <Badge
                variant={wsConnected ? 'default' : 'secondary'}
                className="bg-green-500"
              >
                <Wifi className="h-3 w-3 mr-1" />
                {wsConnected ? 'Online • Live updates active' : 'Connecting...'}
              </Badge>
              {notifications.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-600"
                >
                  <Bell className="h-3 w-3 mr-1" />
                  {notifications.length} notifications
                </Badge>
              )}
            </div>
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
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
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
              Good Morning, {user?.username || 'Librarian'}!{' '}
              <span className="opacity-70">🌅</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Your library is ready for another wonderful day
            </p>
            <div className="text-sm text-slate-600 dark:text-slate-400 pt-2">
              <span className="font-medium">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="mx-2">at</span>
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                {currentTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Use{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">
                Ctrl+K
              </kbd>{' '}
              to search anywhere
            </p>
          </div>
        </div>
      </div>

      {/* Conditional Dashboard Rendering */}
      {beginnerMode ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7">
            {/* Attendance Live (embedded) */}
            <Card
              className={`border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm ${attendanceExpanded ? 'xl:col-span-7' : ''}`}
            >
              <CardHeader className="bg-gradient-to-r from-teal-500 to-green-500 text-white p-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-6 w-6" />
                  Attendance Live
                </CardTitle>
                <CardDescription className="text-teal-100">
                  Real-time check-ins and check-outs
                </CardDescription>
                <div className="mt-1 text-xs text-teal-100/90">
                  <span>
                    Quiet: {announcementQuiet ? 'On' : 'Off'} • Interval:{' '}
                    {announcementInterval}s
                  </span>
                  {lastAnnouncement && (
                    <span className="ml-2">
                      Last announcement: {lastAnnouncement.message.slice(0, 24)}{' '}
                      • {new Date(lastAnnouncement.at).toLocaleTimeString()}{' '}
                      {lastAnnouncement.userName
                        ? `• ${lastAnnouncement.userName}`
                        : lastAnnouncement.userId
                          ? `• ${lastAnnouncement.userId}`
                          : ''}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAttendanceExpanded((v) => !v)}
                      aria-label="toggle-expand"
                    >
                      {attendanceExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAttendanceAutoScroll((v) => !v)}
                      aria-label="toggle-autoscroll"
                    >
                      {attendanceAutoScroll
                        ? 'Auto-scroll On'
                        : 'Auto-scroll Off'}
                    </Button>
                    <select
                      className="text-sm bg-card border rounded px-2 py-1"
                      value={attendanceShowCount}
                      onChange={(e) =>
                        setAttendanceShowCount(parseInt(e.target.value))
                      }
                      aria-label="event-count"
                    >
                      <option value={10}>Show 10</option>
                      <option value={25}>Show 25</option>
                      <option value={50}>Show 50</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      className="text-sm bg-card border rounded px-2 py-1"
                      value={attendanceFilter}
                      onChange={(e) =>
                        setAttendanceFilter(e.target.value as any)
                      }
                      aria-label="event-filter"
                    >
                      <option value="all">All</option>
                      <option value="in">IN</option>
                      <option value="out">OUT</option>
                      <option value="msg">Messages</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAnnouncementSettingsOpen((v) => !v)}
                      aria-label="announcement-settings"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      {announcementSettingsOpen ? 'Close' : 'Settings'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAnnouncementLogOpen((v) => !v);
                        if (!announcementLogOpen) void fetchAnnouncementLog();
                      }}
                      aria-label="announcement-log"
                    >
                      View Log
                    </Button>
                  </div>
                </div>
                {announcementSettingsOpen && (
                  <div className="flex items-center gap-3 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAnnouncementQuiet((v) => !v)}
                      aria-label="toggle-quiet"
                    >
                      {announcementQuiet ? 'Quiet Mode: On' : 'Quiet Mode: Off'}
                    </Button>
                    <select
                      className="text-sm bg-card border rounded px-2 py-1"
                      value={announcementInterval}
                      onChange={(e) =>
                        setAnnouncementInterval(parseInt(e.target.value))
                      }
                      aria-label="announcement-interval"
                    >
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                      <option value={90}>90s</option>
                    </select>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={saveAnnouncementConfig}
                      aria-label="save-announcement-settings"
                    >
                      Save
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    placeholder="Announcement message"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    aria-label="announcement-input"
                    className="max-w-md"
                  />
                  <Button
                    size="sm"
                    onClick={sendAnnouncement}
                    disabled={
                      sendingAnnouncement ||
                      announcementQuiet ||
                      (announcementCooldownUntil
                        ? Math.max(
                            0,
                            Math.ceil(
                              (announcementCooldownUntil - announcementNowTs) /
                                1000
                            )
                          )
                        : 0) > 0
                    }
                    aria-label="announcement-send"
                  >
                    {sendingAnnouncement ? 'Sending…' : 'Send'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {announcementQuiet
                      ? 'Quiet Mode on'
                      : `Interval ${announcementInterval}s`}
                    {(() => {
                      const rem = announcementCooldownUntil
                        ? Math.max(
                            0,
                            Math.ceil(
                              (announcementCooldownUntil - announcementNowTs) /
                                1000
                            )
                          )
                        : 0;
                      return rem > 0 ? ` • Next in ${rem}s` : '';
                    })()}
                  </span>
                </div>
                {recentAnnouncements.length > 0 && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    <span className="font-medium">Recent announcements:</span>
                    <ul className="list-disc ml-4">
                      {recentAnnouncements.map((m, i) => (
                        <li key={i}>
                          {m.message.slice(0, 48)} •{' '}
                          {new Date(m.at).toLocaleTimeString()}{' '}
                          {m.userName
                            ? `• ${m.userName}`
                            : m.userId
                              ? `• ${m.userId}`
                              : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {announcementLogOpen && (
                  <Dialog
                    open={announcementLogOpen}
                    onOpenChange={(v) => {
                      setAnnouncementLogOpen(Boolean(v));
                    }}
                  >
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Announcements Log</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            placeholder="Search"
                            value={announcementSearch}
                            onChange={(e) =>
                              setAnnouncementSearch(e.target.value)
                            }
                          />
                          <div className="flex gap-2">
                            <select
                              className="text-sm bg-card border rounded px-2 py-1"
                              value={announcementPriority}
                              onChange={(e) =>
                                setAnnouncementPriority(e.target.value)
                              }
                            >
                              <option value="">Any Priority</option>
                              <option value="NORMAL">Normal</option>
                              <option value="HIGH">High</option>
                              <option value="LOW">Low</option>
                            </select>
                            <select
                              className="text-sm bg-card border rounded px-2 py-1"
                              value={announcementActive}
                              onChange={(e) =>
                                setAnnouncementActive(e.target.value)
                              }
                            >
                              <option value="">Any Status</option>
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={announcementDateFrom}
                              onChange={(e) =>
                                setAnnouncementDateFrom(e.target.value)
                              }
                            />
                            <Input
                              type="date"
                              value={announcementDateTo}
                              onChange={(e) =>
                                setAnnouncementDateTo(e.target.value)
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="text-sm bg-card border rounded px-2 py-1"
                              value={announcementLimit}
                              onChange={(e) =>
                                setAnnouncementLimit(parseInt(e.target.value))
                              }
                            >
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAnnouncementPage(1);
                                fetchAnnouncementLog();
                              }}
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded p-2 max-h-[360px] overflow-auto">
                          {announcementLogLoading ? (
                            <p className="text-muted-foreground">Loading…</p>
                          ) : announcementLog.length === 0 ? (
                            <p className="text-muted-foreground">
                              No announcements found
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {announcementLog.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex justify-between"
                                >
                                  <div>
                                    <div className="font-medium flex items-center gap-2">
                                      {a.title}
                                      <Badge
                                        variant={
                                          a.priority === 'HIGH'
                                            ? 'destructive'
                                            : a.priority === 'NORMAL'
                                              ? 'default'
                                              : 'secondary'
                                        }
                                      >
                                        {(a.priority || 'NORMAL').toLowerCase()}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {a.is_active === false
                                        ? 'Inactive • '
                                        : ''}
                                      {a.created_by_username
                                        ? a.created_by_username
                                        : a.created_by_user_id || ''}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(a.start_time).toLocaleString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Total {announcementTotal}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={announcementPage <= 1}
                              onClick={() => {
                                setAnnouncementPage((p) => Math.max(1, p - 1));
                                fetchAnnouncementLog();
                              }}
                            >
                              Prev
                            </Button>
                            <span className="text-xs">
                              Page {announcementPage} / {announcementPages}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={announcementPage >= announcementPages}
                              onClick={() => {
                                setAnnouncementPage((p) =>
                                  Math.min(announcementPages, p + 1)
                                );
                                fetchAnnouncementLog();
                              }}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          size="sm"
                          onClick={exportAnnouncementLogCsv}
                          className="mr-auto"
                        >
                          Export CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnnouncementLogOpen(false)}
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {attendanceEvents && attendanceEvents.length > 0 ? (
                  <div
                    className="space-y-3 overflow-y-auto max-h-[360px]"
                    id="attendance-scroll"
                  >
                    {attendanceEvents
                      .filter((ev: any) =>
                        attendanceFilter === 'all'
                          ? true
                          : attendanceFilter === 'in'
                            ? ev.type === 'student_checkin'
                            : attendanceFilter === 'out'
                              ? ev.type === 'student_checkout'
                              : ev.type === 'announcement'
                      )
                      .slice(-attendanceShowCount)
                      .reverse()
                      .map((ev: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`${ev.type === 'student_checkin' ? 'text-green-600 border-green-600' : ev.type === 'student_checkout' ? 'text-orange-600 border-orange-600' : 'text-blue-600 border-blue-600'}`}
                            >
                              {ev.type === 'student_checkin'
                                ? 'IN'
                                : ev.type === 'student_checkout'
                                  ? 'OUT'
                                  : 'MSG'}
                            </Badge>
                            <span
                              className="font-medium"
                              title="Student or message"
                            >
                              {ev.data?.studentName ||
                                ev.data?.message ||
                                'Announcement'}
                            </span>
                            {ev.data?.studentId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setChangeSectionTarget({
                                    studentId: ev.data.studentId,
                                    studentName:
                                      ev.data.studentName || 'Student',
                                  });
                                }}
                                aria-label="change-section"
                                className="h-7 px-2"
                                title="Change section"
                              >
                                Change Section
                              </Button>
                            )}
                          </div>
                          <span
                            className="text-xs text-muted-foreground"
                            title="Event time"
                          >
                            {new Date(
                              ev.timestamp ||
                                ev.data?.checkinTime ||
                                ev.data?.checkoutTime ||
                                ev.data?.at ||
                                Date.now()
                            ).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent attendance events
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="xl:col-span-5 space-y-6">
            <ConnectionStatusCard />
            <KioskTokenCard />
            {/* Essential Actions */}
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white p-6">
                <CardTitle className="text-xl">Import Center</CardTitle>
                <CardDescription className="text-indigo-100">
                  Templates, preview, import
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                  <Button size="sm" onClick={onTemplateDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Download Template
                  </Button>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) =>
                      onFileSelect(e.target.files?.[0] || undefined)
                    }
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    onClick={onImportStart}
                    disabled={
                      importBusy ||
                      !importFile ||
                      (previewRecords.length > 0 &&
                        previewRecords.some(
                          (r) =>
                            r.isValid === false || !r.firstName || !r.lastName
                        ))
                    }
                  >
                    {importBusy ? 'Importing…' : 'Import'}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-xs text-muted-foreground">
                    {importProgress}%
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border rounded p-3">
                    <p className="text-sm font-medium mb-2">
                      Preview (first 10)
                    </p>
                    {previewRecords.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No preview
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {previewRecords.map((r, i) => (
                          <div key={i} className="text-xs flex justify-between">
                            <span>
                              {r.firstName} {r.lastName}
                            </span>
                            <span className="text-muted-foreground">
                              {r.gradeLevel} {r.section}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Generated Barcodes</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onPrintGenerated}
                        disabled={!generatedBarcodes.length}
                      >
                        <Printer className="h-4 w-4 mr-1" /> Print
                      </Button>
                    </div>
                    {generatedBarcodes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-auto">
                        {generatedBarcodes.map((g, i) => (
                          <div key={i} className="text-xs flex justify-between">
                            <span>Row {g.row}</span>
                            <span className="font-mono">{g.barcode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
                <CardTitle className="text-xl flex items-center justify-between">
                  Essential Actions
                </CardTitle>
                <CardDescription className="text-orange-100">
                  Beginner-friendly controls
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <Button
                    className="h-16 flex-col bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all"
                    onClick={() => onTabChange?.('checkout')}
                    title="Borrow materials"
                  >
                    <Users className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Borrow</span>
                  </Button>
                  <Button
                    className="h-16 flex-col bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
                    onClick={() => onTabChange?.('checkout')}
                    title="Return materials"
                  >
                    <TrendingUp className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Return</span>
                  </Button>
                  <Button
                    className="h-16 flex-col bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl transition-all"
                    onClick={() => onTabChange?.('overdue-management')}
                    title="Manage fines and overdue"
                  >
                    <AlertTriangle className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Fines & Overdue</span>
                  </Button>
                  <Button
                    className="h-16 flex-col bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all"
                    onClick={() => onTabChange?.('import')}
                    title="Import students/books CSV"
                  >
                    <FileText className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Import</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : showRealTime ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Sidebar - Calendar */}
          <div className="xl:col-span-4 space-y-6">
            <div className="h-[600px]">
              <CalendarWidget />
            </div>
          </div>
          {/* Right Side - Real-time Dashboard */}
          <div className="xl:col-span-8">
            <RealTimeDashboard />
          </div>
        </div>
      ) : (
        <>
          {/* Main Cozy Layout with Calendar as Focal Point */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left Sidebar - Calendar & Quick Stats */}
            <div className="xl:col-span-4 space-y-6">
              {/* Enhanced Calendar Card */}
              {/* Enhanced Calendar Card */}
              <div className="h-[600px]">
                <CalendarWidget />
              </div>

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
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {totalToday}
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Students Today
                      </p>
                      <div className="mt-2 text-xs text-green-500">
                        Click for details
                      </div>
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
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {activeSessions}
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Active Now
                      </p>
                      <div className="mt-2 text-xs text-blue-500">
                        Click to manage
                      </div>
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
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        {runningJobs}
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        Automation
                      </p>
                      <div className="mt-2 text-xs text-purple-500">
                        Click for status
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800 hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => {
                      toast.info(
                        `System Status:\n✅ Backend: ${connectedToBackend ? 'Connected' : 'Disconnected'}\n✅ Internet: ${isOnline ? 'Online' : 'Offline'}\n✅ Database: Healthy\n✅ Google Sheets: Connected`,
                        {
                          duration: 5000,
                        }
                      );
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
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        System
                      </p>
                      <div className="mt-2 text-xs text-amber-500">
                        Click for status
                      </div>
                    </CardContent>
                  </Card>
                </>
              </div>

              {/* Equipment Status Summary */}
              <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20 border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Equipment Status
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.info('View equipment management')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/20">
                      <Monitor className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                      <div className="text-lg font-bold text-blue-700">
                        {availableComputers - equipmentInUse}
                      </div>
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
              <Card
                className={`border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm ${attendanceExpanded ? 'xl:col-span-7' : ''}`}
              >
                <CardHeader className="bg-gradient-to-r from-teal-500 to-green-500 text-white p-6">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Users className="h-6 w-6" />
                    Attendance Live
                  </CardTitle>
                  <CardDescription className="text-teal-100">
                    Real-time check-ins and check-outs
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttendanceExpanded((v) => !v)}
                        aria-label="toggle-expand"
                      >
                        {attendanceExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAttendanceAutoScroll((v) => !v)}
                        aria-label="toggle-autoscroll"
                      >
                        {attendanceAutoScroll
                          ? 'Auto-scroll On'
                          : 'Auto-scroll Off'}
                      </Button>
                      <select
                        className="text-sm bg-card border rounded px-2 py-1"
                        value={attendanceShowCount}
                        onChange={(e) =>
                          setAttendanceShowCount(parseInt(e.target.value))
                        }
                        aria-label="event-count"
                      >
                        <option value={10}>Show 10</option>
                        <option value={25}>Show 25</option>
                        <option value={50}>Show 50</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <select
                        className="text-sm bg-card border rounded px-2 py-1"
                        value={attendanceFilter}
                        onChange={(e) =>
                          setAttendanceFilter(e.target.value as any)
                        }
                        aria-label="event-filter"
                      >
                        <option value="all">All</option>
                        <option value="in">IN</option>
                        <option value="out">OUT</option>
                        <option value="msg">Messages</option>
                      </select>
                    </div>
                  </div>
                  {attendanceEvents && attendanceEvents.length > 0 ? (
                    <div
                      className="space-y-3 overflow-y-auto max-h-[360px]"
                      id="attendance-scroll"
                    >
                      {attendanceEvents
                        .filter((ev: any) =>
                          attendanceFilter === 'all'
                            ? true
                            : attendanceFilter === 'in'
                              ? ev.type === 'student_checkin'
                              : attendanceFilter === 'out'
                                ? ev.type === 'student_checkout'
                                : ev.type === 'announcement'
                        )
                        .slice(-attendanceShowCount)
                        .reverse()
                        .map((ev: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`${ev.type === 'student_checkin' ? 'text-green-600 border-green-600' : ev.type === 'student_checkout' ? 'text-orange-600 border-orange-600' : 'text-blue-600 border-blue-600'}`}
                              >
                                {ev.type === 'student_checkin'
                                  ? 'IN'
                                  : ev.type === 'student_checkout'
                                    ? 'OUT'
                                    : 'MSG'}
                              </Badge>
                              <span className="font-medium">
                                {ev.data?.studentName ||
                                  ev.data?.message ||
                                  'Announcement'}
                              </span>
                              {ev.data?.studentId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setChangeSectionTarget({
                                      studentId: ev.data.studentId,
                                      studentName:
                                        ev.data.studentName || 'Student',
                                    });
                                  }}
                                  aria-label="change-section"
                                  className="h-7 px-2"
                                >
                                  Change Section
                                </Button>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                ev.data?.checkinTime ||
                                  ev.data?.checkoutTime ||
                                  ev.data?.at ||
                                  Date.now()
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent attendance events
                    </div>
                  )}
                </CardContent>
              </Card>
              {changeSectionTarget && (
                <Card className="border border-teal-200 dark:border-teal-800">
                  <CardHeader>
                    <CardTitle>
                      Change Section for {changeSectionTarget.studentName}
                    </CardTitle>
                    <CardDescription>
                      Select one or more sections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      {Object.keys(changeSections).map((k) => (
                        <label
                          key={k}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={!!changeSections[k]}
                            onChange={(e) =>
                              setChangeSections((prev) => ({
                                ...prev,
                                [k]: e.target.checked,
                              }))
                            }
                          />
                          {k.replace('_', ' ')}
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={saveSectionChange}
                        aria-label="save-section-change"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setChangeSectionTarget(null);
                          setChangeSections({
                            AVR: false,
                            COMPUTER: false,
                            LIBRARY_SPACE: false,
                            BORROWING: false,
                            RECREATION: false,
                          });
                        }}
                        aria-label="cancel-section-change"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white p-6">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock className="h-6 w-6" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription className="text-indigo-100">
                    Latest student activities and system events
                  </CardDescription>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={exportRecentActivityCsv}
                      className="text-white hover:bg-white/20"
                    >
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {activeSessionsData.sessions.length > 0 ? (
                    <div className="space-y-4">
                      {activeSessionsData.sessions.map((session: any) => (
                        <div
                          key={session.id || session.activity_id}
                          className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 shadow-sm"
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-3 w-3 rounded-full shadow-sm bg-green-500 shadow-green-500/50"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground dark:text-foreground">
                              <Badge
                                variant="default"
                                className="mr-2 bg-green-600"
                              >
                                Active
                              </Badge>
                              {session.student_name ||
                                `${session.first_name || ''} ${session.last_name || ''}`.trim() ||
                                'Unknown Student'}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {session.grade_level
                                ? `Grade ${session.grade_level}`
                                : ''}
                              {session.section ? ` - ${session.section}` : ''}
                              {' • Library visit'}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-xs text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                            {session.start_time
                              ? new Date(
                                  session.start_time
                                ).toLocaleTimeString()
                              : 'Now'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : timelineLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">
                        Loading recent activities...
                      </p>
                    </div>
                  ) : timeline &&
                    Array.isArray(timeline) &&
                    timeline.length > 0 ? (
                    <div className="space-y-4">
                      {/* @ts-ignore - Activity type is complex */}
                      {timeline.map((activity: any) => (
                        <div
                          key={activity.id}
                          className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 shadow-sm"
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`h-3 w-3 rounded-full shadow-sm ${activity.status === 'active' ? 'bg-green-500 shadow-green-500/50' : activity.status === 'completed' ? 'bg-blue-500 shadow-blue-500/50' : activity.status === 'expired' ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-gray-500 shadow-gray-500/50'}`}
                            ></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground dark:text-foreground">
                              <Badge
                                variant={
                                  activity.status === 'active'
                                    ? 'default'
                                    : activity.status === 'completed'
                                      ? 'secondary'
                                      : 'outline'
                                }
                                className="mr-2"
                              >
                                {String(
                                  activity.status || 'unknown'
                                ).toUpperCase()}
                              </Badge>
                              {activity.studentName}
                            </p>
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground/80">
                              {activity.activityType} •{' '}
                              {activity.equipmentId || 'No equipment'}
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
                      <p className="text-muted-foreground text-lg">
                        No recent activity
                      </p>
                      <p className="text-muted-foreground/60 text-sm mt-2">
                        No active sessions - students will appear here when they
                        check in
                      </p>
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
                      <Badge
                        variant={isOnline ? 'default' : 'destructive'}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        {isOnline ? 'Connected' : 'Offline'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <span className="font-medium">Backend</span>
                      <Badge
                        variant={connectedToBackend ? 'default' : 'destructive'}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        {connectedToBackend ? 'Connected' : 'Offline'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                      <span className="font-medium">Google Sheets</span>
                      <Badge
                        variant="default"
                        className="bg-purple-500 hover:bg-purple-600"
                      >
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800">
                      <span className="font-medium">Backend Version</span>
                      <Badge variant="outline" className="text-xs">
                        {backendVersion || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800">
                      <span className="font-medium">Frontend Version</span>
                      <Badge variant="outline" className="text-xs">
                        {frontendVersion}
                      </Badge>
                    </div>
                  </div>

                  {healthData &&
                    typeof healthData === 'object' &&
                    healthData !== null &&
                    'timestamp' in healthData && (
                      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                        Last check:{' '}
                        {new Date(
                          (versionCheckedAt ||
                            (typeof (healthData as any).timestamp ===
                              'string' ||
                            typeof (healthData as any).timestamp === 'number'
                              ? (healthData as any).timestamp
                              : Date.now())) as number
                        ).toLocaleTimeString()}
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* WebSocket Status */}
              <Card className="border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Wifi className="h-6 w-6" />
                    Real-time Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {wsStats ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <span className="font-medium">Total Connections</span>
                        <Badge variant="outline" className="text-xs">
                          {wsStats.totalConnections}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(wsStats.connectionsByRole).map(
                          ([role, count]) => (
                            <div
                              key={role}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800"
                            >
                              <span className="text-sm">{role}</span>
                              <Badge variant="outline" className="text-xs">
                                {count}
                              </Badge>
                            </div>
                          )
                        )}
                      </div>
                      {(wsStats.recentSubscriptionDenials?.length || 0) > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium">
                            Recent Subscription Denials
                          </p>
                          <div className="space-y-1 max-h-28 overflow-auto">
                            {wsStats
                              .recentSubscriptionDenials!.slice()
                              .reverse()
                              .slice(0, 5)
                              .map((d, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                                >
                                  <span>
                                    {d.role || 'unknown'} → {d.room}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {new Date(d.at).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {(wsStats.recentRateLimits?.length || 0) > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">
                            Recent Rate Limits
                          </p>
                          <div className="space-y-1 max-h-28 overflow-auto">
                            {wsStats
                              .recentRateLimits!.slice()
                              .reverse()
                              .slice(0, 5)
                              .map((d, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                                >
                                  <span>
                                    {d.kind} • {d.count}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {new Date(d.at).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {wsStatsError || 'Loading...'}
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
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Additional Actions
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast.info(
                            'Daily Summary feature - generates end-of-day report'
                          )
                        }
                        className="h-10 flex-col"
                      >
                        <FileText className="h-3 w-3 mb-1" />
                        <span className="text-xs">Daily Summary</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast.info(
                            'System Check feature - runs health diagnostics'
                          )
                        }
                        className="h-10 flex-col"
                      >
                        <Shield className="h-3 w-3 mb-1" />
                        <span className="text-xs">System Check</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast.info(
                            'Maintenance Mode - schedule system maintenance'
                          )
                        }
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
    </div>
  );
}

export default DashboardOverview;
