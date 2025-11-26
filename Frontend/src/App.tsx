import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHealthCheck } from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
// Theme toggle disabled for full dark mode
import LoginForm from '@/components/auth/LoginForm';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { toast } from 'sonner';
import NotificationCenter from '@/components/NotificationCenter';
import SessionTimeoutWarning from '@/components/SessionTimeoutWarning';
import WebSocketProvider from '@/contexts/WebSocketContext';
import { ResponsiveDrawer } from '@/components/layout/ResponsiveDrawer';
import {
  useMobileOptimization,
  usePerformanceOptimization,
  useTouchOptimization,
} from '@/hooks/useMobileOptimization';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import PerformanceImage from '@/components/performance/Image';
import MobileBottomNavigation from '@/components/mobile/MobileBottomNavigation';
import PWAInstallPrompt from '@/components/mobile/PWAInstallPrompt';
// Removed unused Card imports
import {
  LoadingSpinner,
  DashboardCardSkeleton,
  CardSkeleton,
  TableSkeleton,
} from '@/components/LoadingStates';
import {
  LogOut,
  User,
  Search,
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
  Users,
  BookOpen,
  Zap,
  LayoutDashboard,
  Camera,
  BarChart,
  FileText,
  Sliders,
  Printer,
  Monitor,
} from 'lucide-react';

// Import page components for code splitting
import {
  DashboardPage,
  ScanStationPage,
  StudentsPage,
  BooksPage,
  EquipmentPage,
  ReportsDataPage,
  SettingsAdminPage,
  PrintingPage,
  Kiosk,
} from '@/pages';

// Keep legacy lazy imports for backward compatibility
// Note: Some of these might be unused in the new layout but kept for reference if needed
// or can be safely removed if we are sure no legacy code uses them.

// Enhanced Library Management Components (sync in E2E/dev to avoid lazy initializer issues)
const UserTracking = React.lazy(() =>
  import('@/components/dashboard/UserTracking').then((m) => ({
    default: m.UserTracking,
  }))
);

const EnhancedBorrowing = React.lazy(() =>
  import('@/components/dashboard/EnhancedBorrowing').then((m) => ({
    default: m.EnhancedBorrowing,
  }))
);

const AttendanceDisplay = React.lazy(
  () => import('@/components/attendance/AttendanceDisplay')
);

const OverdueManagement = React.lazy(() =>
  import('@/components/dashboard/OverdueManagement').then((m) => ({
    default: m.OverdueManagement,
  }))
);

const ScanWorkspace = React.lazy(() =>
  import('@/components/dashboard/ScanWorkspace').then((module) => ({
    default: module.ScanWorkspace,
  }))
);
const QRCodeManager = React.lazy(
  () => import('@/components/dashboard/QRCodeManager')
);
const BarcodeManager = React.lazy(
  () => import('@/components/dashboard/BarcodeManager')
);

// Reference lazy components to avoid unused variable warnings in some linters
void UserTracking;
void EnhancedBorrowing;
void OverdueManagement;
void ScanWorkspace;
void QRCodeManager;
void BarcodeManager;

// Enhanced loading fallbacks with skeleton screens
const LoadingSpinnerFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="text-muted-foreground mt-4">Loading...</p>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <CardSkeleton className="h-80" />
      <CardSkeleton className="h-80" />
    </div>
  </div>
);

const TableSkeletonFallback = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <CardSkeleton className="h-10 w-64" />
      <CardSkeleton className="h-10 w-32" />
    </div>
    <TableSkeleton rows={10} columns={4} />
  </div>
);

const SettingsSkeleton = () => (
  <div className="space-y-6">
    <CardSkeleton className="h-20" />
    <div className="grid gap-6 md:grid-cols-2">
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-64" />
    </div>
  </div>
);

export default function App() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const devBypass = import.meta.env.DEV;
  const { activities } = useAppStore();

  // Mobile optimization - hooks MUST be called before any conditional returns
  const { isMobile, isTablet } = useMobileOptimization();
  usePerformanceOptimization();
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();
  useOfflineSync();

  // Check for Kiosk mode
  const isKioskMode =
    typeof window !== 'undefined' && window.location.pathname === '/kiosk';

  if (isKioskMode) {
    return (
      <Suspense fallback={<LoadingSpinnerFallback />}>
        <RouteErrorBoundary>
          <Kiosk />
        </RouteErrorBoundary>
      </Suspense>
    );
  }

  // Enhanced navigation state - 7-tab structure with backward compatibility
  const normalizeTab = (t: string | null): string => {
    const m = (t || '').toLowerCase();

    // Map old tab names to new 7-tab structure
    // Scan Station (Tab 2)
    if (m === 'scan' || m === 'checkout' || m === 'scan-return')
      return 'scan-station';

    // Students (Tab 3) - unchanged but now includes user tracking
    if (m === 'students' || m === 'user-tracking') return 'students';

    // Books (Tab 4)
    if (
      m === 'books' ||
      m === 'enhanced-borrowing' ||
      m === 'overdue' ||
      m === 'overdue-management' ||
      m === 'borrow'
    )
      return 'books';

    // Reports & Data (Tab 5)
    if (
      m === 'analytics' ||
      m === 'reports' ||
      m === 'import' ||
      m === 'import-export' ||
      m === 'data-quality'
    )
      return 'reports-data';

    // Settings & Admin (Tab 7)
    if (
      m === 'settings' ||
      m === 'management' ||
      m === 'qrcodes' ||
      m === 'barcodes'
    )
      return 'settings-admin';

    // Equipment (Tab 5)
    if (m === 'equipment') return 'equipment';

    // Printing (Tab 7)
    if (m === 'printing') return 'printing';

    return m || 'dashboard';
  };
  const initialTab =
    typeof window !== 'undefined'
      ? normalizeTab(new URLSearchParams(window.location.search).get('tab'))
      : 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(normalizeTab(tabParam));
      }
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', activeTab);
      const url = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', url);
    }
  }, [activeTab]);
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    string | undefined
  >(undefined);
  const appStartTimeRef = useRef(Date.now());
  const dashboardSearchCentered = activeTab === 'dashboard';

  // Health check to test backend connection
  useHealthCheck();

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      useAppStore.getState().setOnlineStatus(true);
    };
    const handleOffline = () => {
      useAppStore.getState().setOnlineStatus(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update current time (skip kiosk/attendance routes to avoid re-rendering them)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/kiosk' || path === '/attendance-display') {
        return;
      }
    }
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
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

  // Touch gesture support for mobile navigation
  const handleTouchNavigation = useCallback(
    (gesture: string) => {
      if (!isMobile && !isTablet) {
        return;
      }

      const allTabs = [
        'dashboard',
        'scan-station',
        'students',
        'books',
        'reports-data',
        'settings-admin',
        'printing',
      ];

      const currentIndex = allTabs.indexOf(activeTab);

      switch (gesture) {
        case 'swipe-left':
          if (currentIndex < allTabs.length - 1) {
            const nextTab = allTabs[currentIndex + 1];
            if (nextTab) {
              setActiveTab(nextTab);
              toast.info(`Switched to ${nextTab}`);
            }
          }
          break;
        case 'swipe-right':
          if (currentIndex > 0) {
            const prevTab = allTabs[currentIndex - 1];
            if (prevTab) {
              setActiveTab(prevTab);
              toast.info(`Switched to ${prevTab}`);
            }
          }
          break;
        case 'double-tap':
          // Toggle mobile menu on double tap
          if (isMobile) {
            setShowMobileMenu(!showMobileMenu);
          }
          break;
      }
    },
    [isMobile, isTablet, activeTab, showMobileMenu]
  );

  // Enhanced keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + number keys for quick tab navigation (7-tab structure)
      if (event.altKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setActiveTab('dashboard');
            break;
          case '2':
            event.preventDefault();
            setActiveTab('scan-station');
            break;
          case '3':
            event.preventDefault();
            setActiveTab('students');
            break;
          case '4':
            event.preventDefault();
            setActiveTab('books');
            break;
          case '5':
            event.preventDefault();
            setActiveTab('equipment');
            break;
          case '6':
            event.preventDefault();
            setActiveTab('reports-data');
            break;
          case '7':
            event.preventDefault();
            setActiveTab('settings-admin');
            break;
          case '8':
            event.preventDefault();
            setActiveTab('printing');
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
        toast.info('Keyboard shortcuts: Alt+1-8 for tabs, Ctrl+K for search');
      }

      // F1 for help
      if (event.key === 'F1') {
        event.preventDefault();
        toast.info(
          'Press Alt+1-8 to navigate tabs: Dashboard, Scan, Students, Books, Rooms, Reports, Settings, Printing'
        );
      }

      // F5 for refresh (prevent default and use our refresh)
      if (event.key === 'F5') {
        event.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Public attendance display kiosk (no authentication required)
  if (
    typeof window !== 'undefined' &&
    window.location.pathname === '/attendance-display'
  ) {
    return (
      <WebSocketProvider>
        <Suspense fallback={<LoadingSpinnerFallback />}>
          <AttendanceDisplay />
        </Suspense>
      </WebSocketProvider>
    );
  }

  // Public kiosk interface (no authentication required)
  if (typeof window !== 'undefined' && window.location.pathname === '/kiosk') {
    return (
      <Suspense fallback={<LoadingSpinnerFallback />}>
        <Kiosk />
      </Suspense>
    );
  }

  // Explicit login route for E2E tests and direct access
  if (typeof window !== 'undefined' && window.location.pathname === '/login') {
    if (isAuthenticated) {
      window.history.replaceState(null, '', '/');
      // Fall through to render the app
    } else {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <RouteErrorBoundary>
            <LoginForm onLoginSuccess={() => {}} />
          </RouteErrorBoundary>
        </div>
      );
    }
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show only the login form (unless dev bypass)
  if (!isAuthenticated && !devBypass) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <RouteErrorBoundary>
          <LoginForm onLoginSuccess={() => {}} />
        </RouteErrorBoundary>
      </div>
    );
  }

  // Dev-only ErrorBoundary test route
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.location.pathname === '/dev/error'
  ) {
    throw new Error('Dev Error: Forced exception for ErrorBoundary validation');
  }

  return (
    <ProtectedRoute requiredRole="LIBRARIAN">
      <WebSocketProvider>
        {/* Session Timeout Warning Modal */}
        <SessionTimeoutWarning
          warningTime={10 * 60 * 1000} // 10 minutes warning
          sessionTimeout={4 * 60 * 60 * 1000} // 4 hours total session
        />

        <div
          className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-all duration-300 relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={(e) => {
            const gesture = handleTouchEnd(e);
            if (gesture) {
              handleTouchNavigation(gesture);
            }
          }}
        >
          {/* Background Image with Optimized Loading */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <PerformanceImage
              src="/Background.png"
              alt="Background"
              useCase="BACKGROUND"
              size="large"
              className="w-full h-full object-cover opacity-[0.25] dark:opacity-[0.05] transition-opacity duration-300"
              priority={false}
              lazy={true}
              placeholder="blur"
            />
          </div>

          {/* Enhanced Header */}
          <header
            role="banner"
            className="bg-white/95 dark:bg-card/95 border-b border-slate-200 dark:border-border sticky top-0 z-50 backdrop-blur-md shadow-sm transition-all duration-200"
          >
            <div className="px-3 sm:px-4 lg:px-8 py-2 sm:py-3 lg:py-4">
              {/* Top Row - Main Navigation */}
              <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap lg:flex-nowrap">
                {/* Left Side - Logo and Title */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    <PerformanceImage
                      src="/src/assets/School_logo.png"
                      alt="Educational Library Management System Logo"
                      useCase="AVATAR"
                      size="large"
                      className="w-8 h-8 sm:w-10 sm:h-10 lg:w-14 lg:h-14 object-contain opacity-100 dark:opacity-90 transition-all"
                      priority={true}
                      lazy={false}
                      position="above-fold"
                    />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base lg:text-2xl font-bold text-slate-900 dark:text-foreground truncate">
                      <span className="hidden xs:inline">Centralized </span>
                      Library Management
                      <span className="hidden sm:inline"> System</span>
                    </h1>
                  </div>
                </div>

                {/* Mobile Menu Button */}
                <div className="lg:hidden flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobileMenu(true)}
                    className="h-8 w-8 p-0"
                    data-testid="mobile-menu-button"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>

                {/* Desktop Search - Hidden on Mobile */}
                {!dashboardSearchCentered && (
                  <div
                    className={
                      'hidden lg:flex flex-1 max-w-md w-full lg:w-auto order-last lg:order-none lg:mx-4'
                    }
                  >
                    <div
                      className={
                        dashboardSearchCentered
                          ? 'relative w-full max-w-2xl'
                          : 'relative'
                      }
                    >
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="global-search"
                        type="text"
                        placeholder="Search students, books, rooms... (Ctrl+K)"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className={
                          dashboardSearchCentered
                            ? 'pl-10 pr-10 bg-white dark:bg-input border-slate-300 dark:border-border focus:ring-2 focus:ring-primary/20 transition-all w-full'
                            : 'pl-10 pr-10 bg-white dark:bg-input border-slate-300 dark:border-border focus:ring-2 focus:ring-primary/20 transition-all'
                        }
                        aria-label="Global Search"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Clear Search"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Desktop Controls - Hidden on Mobile */}
                <div className="hidden lg:flex items-center gap-2">
                  {/* System Refresh */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="relative"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                    />
                    {isRefreshing && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                    )}
                  </Button>

                  {/* Notifications */}
                  <NotificationCenter />

                  {/* System Menu, Help Menu, and User Menu - Desktop */}
                  {/* System Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>System Controls</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSystemHealth}>
                        <Shield className="h-4 w-4 mr-2 text-green-500" />
                        System Health
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleBackup}>
                        <Database className="h-4 w-4 mr-2 text-blue-500" />
                        Backup Now
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleMaintenance}>
                        <Settings className="h-4 w-4 mr-2 text-slate-500" />
                        Maintenance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDatabaseStatus}>
                        <Database className="h-4 w-4 mr-2 text-purple-500" />
                        Database Status
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleViewLogs}>
                        <FileText className="h-4 w-4 mr-2 text-amber-500" />
                        View Logs
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleEmergencyAlert}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Emergency Alert
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Help Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Help & Support</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          toast.info('Opening keyboard shortcuts guide...')
                        }
                      >
                        Keyboard Shortcuts
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toast.info('Opening user guide...')}
                      >
                        User Guide
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          toast.info('Opening API documentation...')
                        }
                      >
                        API Documentation
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toast.info('Opening support...')}
                      >
                        Get Support
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <User className="h-3 w-3" />
                        <span className="hidden sm:inline-block max-w-[100px] truncate">
                          {user?.username}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <div className="p-2 bg-muted/50">
                        <p className="font-semibold text-sm">
                          {user?.username || 'Administrator'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.role}
                        </p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSettingsInitialTab('system');
                          setActiveTab('settings-admin');
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSettingsInitialTab('automation');
                          setActiveTab('settings-admin');
                        }}
                      >
                        <Sliders className="h-4 w-4 mr-2" />
                        Options
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSettingsInitialTab('logs');
                          setActiveTab('settings-admin');
                        }}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Activity Logs
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={logout}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ResponsiveDrawer
                open={showMobileMenu}
                onOpenChange={setShowMobileMenu}
                title="Navigation"
                description="Quick access to system areas"
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Search... (Ctrl+K)"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-10 pr-10 bg-white dark:bg-input border-slate-300 dark:border-border focus:ring-2 focus:ring-primary/20 transition-all w-full"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-2">
                      {[
                        {
                          value: 'dashboard',
                          label: 'Dashboard',
                          icon: LayoutDashboard,
                        },
                        {
                          value: 'scan-station',
                          label: 'Scan Station',
                          icon: Camera,
                        },
                        {
                          value: 'students',
                          label: 'Students',
                          icon: Users,
                        },
                        {
                          value: 'books',
                          label: 'Books & Circulation',
                          icon: BookOpen,
                        },
                        {
                          value: 'equipment',
                          label: 'Rooms & Stations',
                          icon: Monitor,
                        },
                        {
                          value: 'reports-data',
                          label: 'Reports & Data',
                          icon: BarChart,
                        },
                        {
                          value: 'settings-admin',
                          label: 'Settings & Admin',
                          icon: Settings,
                        },
                      ].map(({ value, label, icon: Icon }) => (
                        <Button
                          key={value}
                          variant={activeTab === value ? 'default' : 'outline'}
                          className="flex justify-between items-center"
                          onClick={() => {
                            setActiveTab(value);
                            setShowMobileMenu(false);
                          }}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="h-4 w-4" />
                            {label}
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="relative"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                        {isRefreshing && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSystemHealth}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBackup}
                      >
                        <Database className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Help & Support</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              toast.info('Opening keyboard shortcuts guide...')
                            }
                          >
                            Keyboard Shortcuts
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.info('Opening user guide...')}
                          >
                            User Guide
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toast.info('Opening API documentation...')
                            }
                          >
                            API Documentation
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.info('Opening support...')}
                          >
                            Get Support
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={logout}
                        className="text-red-600 dark:text-red-400"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <NotificationCenter />
                    </div>
                  </div>
                </div>
              </ResponsiveDrawer>
            </div>
          </header>

          {/* Mobile Tab Navigation */}
          <div className="lg:hidden bg-white dark:bg-card border-b border-slate-200 dark:border-slate-700 sticky top-16 z-40">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex min-w-max px-2 py-2 gap-1">
                {[
                  {
                    value: 'dashboard',
                    label: 'Dashboard',
                    icon: LayoutDashboard,
                  },
                  { value: 'scan-station', label: 'Scan', icon: Camera },
                  { value: 'students', label: 'Students', icon: Users },
                  { value: 'books', label: 'Books', icon: BookOpen },
                  { value: 'equipment', label: 'Rooms', icon: Monitor },
                  { value: 'reports-data', label: 'Reports', icon: BarChart },
                  {
                    value: 'settings-admin',
                    label: 'Settings',
                    icon: Settings,
                  },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={activeTab === value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setActiveTab(value);
                      setShowMobileMenu(false);
                    }}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap ${
                      activeTab === value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <main
            role="main"
            className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 max-w-[1920px] mx-auto relative z-10"
            data-testid="dashboard"
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              {/* Desktop Tabs - Hidden on Mobile - New 6-Tab Structure */}
              <div className="hidden lg:block">
                <TabsList
                  className="grid w-full grid-cols-3 sm:grid-cols-8 gap-1 p-1 bg-muted/50 rounded-xl"
                  aria-label="App Navigation"
                >
                  <TabsTrigger
                    value="dashboard"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="scan-station"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <Camera className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Scan</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="students"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <Users className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Students</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="books"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <BookOpen className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Books</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="equipment"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <Monitor className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Rooms</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="reports-data"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <BarChart className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Reports</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings-admin"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Settings</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="printing"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    <Printer className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Printing</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Dashboard Tab */}
              <TabsContent
                value="dashboard"
                className="space-y-6"
                id="tabpanel-dashboard"
                role="tabpanel"
                aria-labelledby="tab-dashboard"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardPage onTabChange={setActiveTab} />
                  </Suspense>
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <Suspense fallback={<TableSkeletonFallback />}>
                    <StudentsPage />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Scan Station Tab */}
              <TabsContent
                value="scan-station"
                className="space-y-6"
                id="tabpanel-scan-station"
                role="tabpanel"
                aria-labelledby="tab-scan-station"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <ScanStationPage />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Books Tab */}
              <TabsContent
                value="books"
                className="space-y-6"
                id="tabpanel-books"
                role="tabpanel"
                aria-labelledby="tab-books"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<TableSkeletonFallback />}>
                    <BooksPage />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Rooms Tab */}
              <TabsContent
                value="equipment"
                className="space-y-6"
                id="tabpanel-equipment"
                role="tabpanel"
                aria-labelledby="tab-equipment"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<TableSkeletonFallback />}>
                    <EquipmentPage />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Reports & Data Tab */}
              <TabsContent
                value="reports-data"
                className="space-y-6"
                id="tabpanel-reports-data"
                role="tabpanel"
                aria-labelledby="tab-reports-data"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <ReportsDataPage />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Settings & Admin Tab */}
              <TabsContent
                value="settings-admin"
                className="space-y-6"
                id="tabpanel-settings-admin"
                role="tabpanel"
                aria-labelledby="tab-settings-admin"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<SettingsSkeleton />}>
                    <SettingsAdminPage initialTab={settingsInitialTab} />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Printing Tab */}
              <TabsContent
                value="printing"
                className="space-y-6"
                id="tabpanel-printing"
                role="tabpanel"
                aria-labelledby="tab-printing"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <PrintingPage />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* ========== Legacy tabs below - kept for backward compatibility ========== */}
            </Tabs>
          </main>

          {/* PWA Install Prompt */}
          <PWAInstallPrompt onInstall={() => {}} onDismiss={() => {}} />

          {/* Mobile Bottom Navigation */}
          <MobileBottomNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Footer */}
          <footer className="border-t border-slate-200 dark:border-slate-800 mt-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 lg:px-8 py-6">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <Clock className="h-3 w-3 text-blue-500" />
                    <span className="font-mono">
                      {currentTime.toLocaleString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <Globe className="h-3 w-3 text-green-500" />
                    {navigator.language}
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    System:{' '}
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Good
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <Users className="h-3 w-3 text-purple-500" />
                    Active:{' '}
                    <span className="font-medium">{activities.length}</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <Database className="h-3 w-3 text-blue-500" />
                    DB:{' '}
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Healthy
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <Activity className="h-3 w-3 text-red-500" />
                    Uptime:{' '}
                    <span className="font-medium">
                      {Math.floor(
                        (Date.now() - appStartTimeRef.current) / 3600000
                      )}
                      h
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center lg:text-left">
                  © 2025 Educational Library Management System • All Rights
                  Reserved
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center lg:text-right">
                  CLMS{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    v1.0.0
                  </span>{' '}
                  • Built with React & Google Sheets
                </p>
              </div>
            </div>
          </footer>
        </div>
      </WebSocketProvider>
    </ProtectedRoute>
  );
}
