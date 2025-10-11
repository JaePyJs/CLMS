import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHealthCheck } from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { toast } from 'sonner';
import {
  Wifi,
  WifiOff,
  LogOut,
  User,
  Search,
  Bell,
  Settings,
  HelpCircle,
  AlertTriangle,
  Shield,
  Database,
  RefreshCw,
  Menu,
  X,
  ChevronDown,
  Globe,
  Clock,
  Activity,
  FileText,
  MessageSquare,
  Calendar,
  Users,
  Monitor,
  BookOpen,
  Zap
} from 'lucide-react';

// Import components (will create these next)
const DashboardOverview = React.lazy(
  () => import('@/components/dashboard/DashboardOverview')
);
const EquipmentDashboard = React.lazy(
  () => import('@/components/dashboard/EquipmentDashboard')
);
const ScanWorkspace = React.lazy(
  () => import('@/components/dashboard/ScanWorkspace')
);
const AutomationDashboard = React.lazy(
  () => import('@/components/dashboard/AutomationDashboard')
);
const AnalyticsDashboard = React.lazy(
  () => import('@/components/dashboard/AnalyticsDashboard')
);
const QRCodeManager = React.lazy(
  () => import('@/components/dashboard/QRCodeManager')
);
const BarcodeManager = React.lazy(
  () => import('@/components/dashboard/BarcodeManager')
);
const StudentManagement = React.lazy(
  () => import('@/components/dashboard/StudentManagement')
);
const ReportsBuilder = React.lazy(
  () => import('@/components/dashboard/ReportsBuilder')
);

// Loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { connectedToBackend } = useAppStore();
  const { user, logout } = useAuth();

  // Enhanced navigation state
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mock notifications
  const [notifications] = useState([
    { id: 1, type: 'info', message: 'System health check completed', time: '2 min ago', read: false },
    { id: 2, type: 'warning', message: '3 sessions are overdue', time: '15 min ago', read: false },
    { id: 3, type: 'success', message: 'Daily backup completed successfully', time: '1 hour ago', read: true },
    { id: 4, type: 'info', message: 'New student registered', time: '2 hours ago', read: true }
  ]);

  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Health check to test backend connection
  const { isLoading: healthLoading } = useHealthCheck();

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      useAppStore.getState().setOnlineStatus(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      useAppStore.getState().setOnlineStatus(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Enhanced navigation handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      toast.info(`Searching for: ${query}`);
      // Implement global search functionality
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate system refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('System refreshed successfully!');
    } catch (error) {
      toast.error('Failed to refresh system');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSystemHealth = () => {
    toast.info('Running comprehensive system health check...');
    // Implement system health check
  };

  const handleBackup = () => {
    toast.info('Starting system backup...');
    // Implement backup functionality
  };

  const handleMaintenance = () => {
    toast.info('Opening maintenance mode controls...');
    // Implement maintenance controls
  };

  const handleEmergencyAlert = () => {
    toast.warning('Emergency alert system activated!');
    // Implement emergency alert
  };

  const handleViewLogs = () => {
    toast.info('Opening system logs...');
    // Implement log viewer
  };

  const handleDatabaseStatus = () => {
    toast.info('Checking database status...');
    // Implement database status check
  };

  const handleMarkNotificationRead = (notificationId: number) => {
    // Mark notification as read
    toast.info('Notification marked as read');
  };

  const handleMarkAllNotificationsRead = () => {
    // Mark all notifications as read
    toast.success('All notifications marked as read');
    setShowNotifications(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowNotifications(false);
      setShowUserMenu(false);
      setShowHelpMenu(false);
      setShowSystemMenu(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Enhanced keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + number keys for quick tab navigation
      if (event.altKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            document.getElementById('tab-dashboard')?.click();
            break;
          case '2':
            event.preventDefault();
            document.getElementById('tab-scan')?.click();
            break;
          case '3':
            event.preventDefault();
            document.getElementById('tab-students')?.click();
            break;
          case '4':
            event.preventDefault();
            document.getElementById('tab-equipment')?.click();
            break;
          case '5':
            event.preventDefault();
            document.getElementById('tab-automation')?.click();
            break;
          case '6':
            event.preventDefault();
            document.getElementById('tab-analytics')?.click();
            break;
          case '7':
            event.preventDefault();
            document.getElementById('tab-reports')?.click();
            break;
          case '8':
            event.preventDefault();
            document.getElementById('tab-qrcodes')?.click();
            break;
          case '9':
            event.preventDefault();
            document.getElementById('tab-barcodes')?.click();
            break;
        }
      }

      // Ctrl/Cmd + K for global search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        document.getElementById('global-search')?.focus();
      }

      // Ctrl/Cmd + / for help
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        setShowHelpMenu(!showHelpMenu);
      }

      // F1 for help
      if (event.key === 'F1') {
        event.preventDefault();
        setShowHelpMenu(!showHelpMenu);
      }

      // F5 for refresh (prevent default and use our refresh)
      if (event.key === 'F5') {
        event.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelpMenu]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background transition-colors duration-300 relative">
      {/* Background Image with Opacity */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-[0.35] dark:opacity-[0.08] pointer-events-none z-0"
        style={{ backgroundImage: `url('/Background.png')` }}
      />

      {/* Enhanced Header */}
      <header className="bg-slate-50 dark:bg-card border-b border-slate-200 dark:border-border sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 relative hover:bg-accent/5 dark:hover:bg-accent/5 transition-colors">
        <div className="px-8 py-4">
          {/* Top Row - Main Navigation */}
          <div className="flex items-center justify-between mb-4">
            {/* Left Side - Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <img
                  src="/src/assets/School_logo.png"
                  alt="Educational Library Management System Logo"
                  className="w-14 h-14 object-contain opacity-100 dark:opacity-90"
                />
              </div>
              <div>
                <h1 className="text-2xl text-black dark:text-foreground">
                  CLMS Library System
                </h1>
                <p className="text-sm text-black dark:text-muted-foreground font-normal">
                  Welcome, {user?.username || 'Administrator'} 👋
                </p>
              </div>
            </div>

            {/* Center - Global Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="global-search"
                  type="text"
                  placeholder="Search students, books, equipment... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-4"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Right Side - System Controls */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* System Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="relative"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </Button>

              {/* Notifications */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadNotifications}
                    </span>
                  )}
                </Button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Notifications</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleMarkAllNotificationsRead}
                        >
                          Mark all read
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.map(notification => (
                        <div
                          key={notification.id}
                          className={`p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                            !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                          onClick={() => handleMarkNotificationRead(notification.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1 ${
                              notification.type === 'info' ? 'bg-blue-500' :
                              notification.type === 'warning' ? 'bg-yellow-500' :
                              notification.type === 'success' ? 'bg-green-500' : 'bg-gray-500'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{notification.message}</p>
                              <p className="text-xs text-muted-foreground">{notification.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* System Menu */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSystemMenu(!showSystemMenu)}
                >
                  <Settings className="h-4 w-4" />
                </Button>

                {/* System Menu Dropdown */}
                {showSystemMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSystemHealth}
                        className="w-full justify-start"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        System Health
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackup}
                        className="w-full justify-start"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Backup Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMaintenance}
                        className="w-full justify-start"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Maintenance
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDatabaseStatus}
                        className="w-full justify-start"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Database Status
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleViewLogs}
                        className="w-full justify-start"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Logs
                      </Button>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEmergencyAlert}
                        className="w-full justify-start text-red-600 hover:bg-red-50"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Emergency Alert
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Help Menu */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHelpMenu(!showHelpMenu)}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>

                {/* Help Menu Dropdown */}
                {showHelpMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Opening keyboard shortcuts guide...')}
                        className="w-full justify-start"
                      >
                        Keyboard Shortcuts
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Opening user guide...')}
                        className="w-full justify-start"
                      >
                        User Guide
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Opening API documentation...')}
                        className="w-full justify-start"
                      >
                        API Documentation
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Opening support...')}
                        className="w-full justify-start"
                      >
                        Get Support
                      </Button>
                    </div>
                  </div>
                )}
              </div>

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

              {/* Backend Status */}
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    healthLoading
                      ? 'bg-yellow-500'
                      : connectedToBackend
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                ></div>
                <span className="text-sm">
                  {healthLoading
                    ? 'Checking...'
                    : connectedToBackend
                    ? 'Backend Connected'
                    : 'Backend Offline'}
                </span>
              </div>

              {/* User Menu */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1"
                >
                  <User className="h-3 w-3" />
                  {user?.username}
                  <ChevronDown className="h-3 w-3" />
                </Button>

                {/* User Menu Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="font-medium">{user?.username}</p>
                      <p className="text-sm text-muted-foreground">{user?.role}</p>
                    </div>
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Opening profile settings...')}
                        className="w-full justify-start"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Profile Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Opening activity logs...')}
                        className="w-full justify-start"
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Activity Logs
                      </Button>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={logout}
                        className="w-full justify-start text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row - System Status Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentTime.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {navigator.language}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                System Performance: Good
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Active Users: 1
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                DB Status: Healthy
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Uptime: {Math.floor(process.uptime() / 3600)}h
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6 max-w-[1920px] mx-auto relative z-10">
        <ProtectedRoute requiredRole="ADMIN">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-slate-50 dark:bg-card border border-slate-200 dark:border-border">
              <TabsTrigger value="dashboard" id="tab-dashboard">📊 Dashboard</TabsTrigger>
              <TabsTrigger value="scan" id="tab-scan">📷 Activity</TabsTrigger>
              <TabsTrigger value="students" id="tab-students">👥 Students</TabsTrigger>
              <TabsTrigger value="equipment" id="tab-equipment">💻 Equipment</TabsTrigger>
              <TabsTrigger value="automation" id="tab-automation">🤖 Automation</TabsTrigger>
              <TabsTrigger value="analytics" id="tab-analytics">📈 Analytics</TabsTrigger>
              <TabsTrigger value="reports" id="tab-reports">📋 Reports</TabsTrigger>
              <TabsTrigger value="qrcodes" id="tab-qrcodes">🔲 QR Codes</TabsTrigger>
              <TabsTrigger value="barcodes" id="tab-barcodes">📊 Barcodes</TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent
              value="dashboard"
              className="space-y-6"
              id="tabpanel-dashboard"
              role="tabpanel"
              aria-labelledby="tab-dashboard"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <DashboardOverview />
              </React.Suspense>
            </TabsContent>

            {/* Scan Tab */}
            <TabsContent
              value="scan"
              className="space-y-6"
              id="tabpanel-scan"
              role="tabpanel"
              aria-labelledby="tab-scan"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <ScanWorkspace />
              </React.Suspense>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent
              value="equipment"
              className="space-y-6"
              id="tabpanel-equipment"
              role="tabpanel"
              aria-labelledby="tab-equipment"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <EquipmentDashboard />
              </React.Suspense>
            </TabsContent>

            {/* Automation Tab */}
            <TabsContent
              value="automation"
              className="space-y-6"
              id="tabpanel-automation"
              role="tabpanel"
              aria-labelledby="tab-automation"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <AutomationDashboard />
              </React.Suspense>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent
              value="analytics"
              className="space-y-6"
              id="tabpanel-analytics"
              role="tabpanel"
              aria-labelledby="tab-analytics"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <AnalyticsDashboard />
              </React.Suspense>
            </TabsContent>

            {/* QR Codes Tab */}
            <TabsContent
              value="qrcodes"
              className="space-y-6"
              id="tabpanel-qrcodes"
              role="tabpanel"
              aria-labelledby="tab-qrcodes"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <QRCodeManager />
              </React.Suspense>
            </TabsContent>

            {/* Students Tab */}
            <TabsContent
              value="students"
              className="space-y-6"
              id="tabpanel-students"
              role="tabpanel"
              aria-labelledby="tab-students"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <StudentManagement />
              </React.Suspense>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent
              value="equipment"
              className="space-y-6"
              id="tabpanel-equipment"
              role="tabpanel"
              aria-labelledby="tab-equipment"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <EquipmentDashboard />
              </React.Suspense>
            </TabsContent>

            {/* Automation Tab */}
            <TabsContent
              value="automation"
              className="space-y-6"
              id="tabpanel-automation"
              role="tabpanel"
              aria-labelledby="tab-automation"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <AutomationDashboard />
              </React.Suspense>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent
              value="analytics"
              className="space-y-6"
              id="tabpanel-analytics"
              role="tabpanel"
              aria-labelledby="tab-analytics"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <AnalyticsDashboard />
              </React.Suspense>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent
              value="reports"
              className="space-y-6"
              id="tabpanel-reports"
              role="tabpanel"
              aria-labelledby="tab-reports"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <ReportsBuilder />
              </React.Suspense>
            </TabsContent>

            {/* QR Codes Tab */}
            <TabsContent
              value="qrcodes"
              className="space-y-6"
              id="tabpanel-qrcodes"
              role="tabpanel"
              aria-labelledby="tab-qrcodes"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <QRCodeManager />
              </React.Suspense>
            </TabsContent>

            {/* Barcodes Tab */}
            <TabsContent
              value="barcodes"
              className="space-y-6"
              id="tabpanel-barcodes"
              role="tabpanel"
              aria-labelledby="tab-barcodes"
              tabIndex={0}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <BarcodeManager />
              </React.Suspense>
            </TabsContent>
          </Tabs>
        </ProtectedRoute>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © 2025 Educational Library Management System
            </p>
            <p className="text-sm text-muted-foreground">
              CLMS v1.0.0 (2025) - Built with React & Google Sheets
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
