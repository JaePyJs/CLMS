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
  Bot,
  BarChart,
  FileText,
  QrCode,
  List,
  Laptop,
  Upload,
  Library,
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
import StudentManagementSync from '@/components/dashboard/StudentManagement';
const StudentManagementLazy = React.lazy(
  () => import('@/components/dashboard/StudentManagement')
);
const StudentManagement =
  (typeof navigator !== 'undefined' && (navigator as any).webdriver) ||
  (import.meta as any).env?.VITE_E2E === 'true'
    ? StudentManagementSync
    : StudentManagementLazy;
const ReportsBuilder = React.lazy(
  () => import('@/components/dashboard/ReportsBuilder')
);
const BookCatalog = React.lazy(
  () => import('@/components/dashboard/BookCatalog')
);
const ImportData = React.lazy(() => import('@/components/ImportData'));
const BookCheckout = React.lazy(
  () => import('@/components/dashboard/BookCheckout')
);
const SettingsPage = React.lazy(
  () => import('@/components/settings/SettingsPage')
);
const LibraryManagementHub = React.lazy(
  () => import('@/components/management/LibraryManagementHub')
);

// Attendance Display for self-monitoring
const AttendanceDisplay = React.lazy(
  () => import('@/components/attendance/AttendanceDisplay')
);

// Kiosk interface for patron tap-in
const Kiosk = React.lazy(
  () => import('@/pages/Kiosk')
);

// Enhanced Library Management Components (sync in E2E/dev to avoid lazy initializer issues)
import { UserTracking as UserTrackingSync } from '@/components/dashboard/UserTracking';
const UserTrackingLazy = React.lazy(
  () => import('@/components/dashboard/UserTracking').then((m) => ({ default: m.UserTracking }))
);
import { OptimizedLazyLoad } from '@/components/OptimizedLazyLoad';
const UserTracking =
  (typeof navigator !== 'undefined' && (navigator as any).webdriver) ||
  (import.meta as any).env?.VITE_E2E === 'true'
    ? UserTrackingSync
    : UserTrackingLazy;

import { EnhancedBorrowing as EnhancedBorrowingSync } from '@/components/dashboard/EnhancedBorrowing';
const EnhancedBorrowingLazy = React.lazy(
  () => import('@/components/dashboard/EnhancedBorrowing').then((m) => ({ default: m.EnhancedBorrowing }))
);
const EnhancedBorrowing =
  (typeof navigator !== 'undefined' && (navigator as any).webdriver) ||
  (import.meta as any).env?.VITE_E2E === 'true'
    ? EnhancedBorrowingSync
    : EnhancedBorrowingLazy;

import { OverdueManagement as OverdueManagementSync } from '@/components/dashboard/OverdueManagement';
const OverdueManagementLazy = React.lazy(
  () => import('@/components/dashboard/OverdueManagement').then((m) => ({ default: m.OverdueManagement }))
);
const OverdueManagement =
  (typeof navigator !== 'undefined' && (navigator as any).webdriver) ||
  (import.meta as any).env?.VITE_E2E === 'true'
    ? OverdueManagementSync
    : OverdueManagementLazy;

const PrintingTrackerLazy = React.lazy(
  () => import('@/components/management/PrintingTracker')
);


// Reference lazy components to avoid unused variable warnings in some linters
void AutomationDashboard; void AnalyticsDashboard;

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

  // Mobile optimization - hooks MUST be called before any conditional returns
  const { isMobile, isTablet } = useMobileOptimization();
  usePerformanceOptimization();
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();
  useOfflineSync();

  // Enhanced navigation state
  const normalizeTab = (t: string | null): string => {
    const m = (t || '').toLowerCase();
    if (m === 'overdue') return 'overdue-management';
    if (m === 'borrow') return 'checkout';
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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
        'scan',
        'students',
        'books',
        'checkout',
        'equipment',
        'automation',
        'analytics',
        'reports',
        'import',
        'qrcodes',
        'barcodes',
        'settings',
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
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
            setActiveTab('dashboard');
            break;
          case '2':
            event.preventDefault();
            setActiveTab('scan');
            break;
          case '3':
            event.preventDefault();
            setActiveTab('students');
            break;
          case '4':
            event.preventDefault();
            setActiveTab('equipment');
            break;
          case '5':
            event.preventDefault();
            setActiveTab('automation');
            break;
          case '6':
            event.preventDefault();
            setActiveTab('analytics');
            break;
          case '7':
            event.preventDefault();
            setActiveTab('reports');
            break;
          case '8':
            event.preventDefault();
            setActiveTab('qrcodes');
            break;
          case '9':
            event.preventDefault();
            setActiveTab('barcodes');
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

  // Public attendance display kiosk (no authentication required)
  if (
    typeof window !== 'undefined' &&
    window.location.pathname === '/attendance-display'
  ) {
    return (
      <Suspense fallback={<LoadingSpinnerFallback />}>
        <AttendanceDisplay />
      </Suspense>
    );
  }

  // Public kiosk interface (no authentication required)
  if (
    typeof window !== 'undefined' &&
    window.location.pathname === '/kiosk'
  ) {
    return (
      <Suspense fallback={<LoadingSpinnerFallback />}>
        <Kiosk />
      </Suspense>
    );
  }

  // Explicit login route for E2E tests and direct access
  if (
    typeof window !== 'undefined' &&
    window.location.pathname === '/login'
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <RouteErrorBoundary>
          <LoginForm onLoginSuccess={() => {}} />
        </RouteErrorBoundary>
      </div>
    );
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
          warningTime={5 * 60 * 1000} // 5 minutes warning
          sessionTimeout={60 * 60 * 1000} // 60 minutes total session
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
                <div className={'hidden lg:flex flex-1 max-w-md w-full lg:w-auto order-last lg:order-none lg:mx-4'}>
                  <div className={dashboardSearchCentered ? 'relative w-full max-w-2xl' : 'relative'}>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="global-search"
                      type="text"
                      placeholder="Search students, books, equipment... (Ctrl+K)"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className={dashboardSearchCentered ? 'pl-10 pr-10 bg-white dark:bg-input border-slate-300 dark:border-border focus:ring-2 focus:ring-primary/20 transition-all w-full' : 'pl-10 pr-10 bg-white dark:bg-input border-slate-300 dark:border-border focus:ring-2 focus:ring-primary/20 transition-all'}
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
                      <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[100] animate-slide-down overflow-hidden">
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSystemHealth}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Shield className="h-4 w-4 mr-3 text-green-500" />
                            System Health
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBackup}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Database className="h-4 w-4 mr-3 text-blue-500" />
                            Backup Now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMaintenance}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Settings className="h-4 w-4 mr-3 text-slate-500" />
                            Maintenance
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDatabaseStatus}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Database className="h-4 w-4 mr-3 text-purple-500" />
                            Database Status
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleViewLogs}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <FileText className="h-4 w-4 mr-3 text-amber-500" />
                            View Logs
                          </Button>
                          <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEmergencyAlert}
                            className="w-full justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <AlertTriangle className="h-4 w-4 mr-3" />
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
                      <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[100] animate-slide-down overflow-hidden">
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info('Opening keyboard shortcuts guide...')
                            }
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            Keyboard Shortcuts
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toast.info('Opening user guide...')}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            User Guide
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info('Opening API documentation...')
                            }
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            API Documentation
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toast.info('Opening support...')}
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            Get Support
                          </Button>
                        </div>
                      </div>
                    )}
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
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[100] animate-slide-down overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            Welcome, {user?.username || 'Administrator'}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {user?.role}
                          </p>
                        </div>
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info('Opening profile settings...')
                            }
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Settings className="h-4 w-4 mr-3 text-slate-500" />
                            Profile Settings
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info('Opening activity logs...')
                            }
                            className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Activity className="h-4 w-4 mr-3 text-blue-500" />
                            Activity Logs
                          </Button>
                          <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={logout}
                            className="w-full justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <LogOut className="h-4 w-4 mr-3" />
                            Logout
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
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
                          label: 'Dashboard Overview',
                          icon: LayoutDashboard,
                        },
                        { value: 'scan', label: 'Activity Hub', icon: Camera },
                        {
                          value: 'students',
                          label: 'Student Management',
                          icon: Users,
                        },
                        {
                          value: 'books',
                          label: 'Book Catalog',
                          icon: BookOpen,
                        },
                        {
                          value: 'checkout',
                          label: 'Checkout Desk',
                          icon: Library,
                        },
                        {
                          value: 'equipment',
                          label: 'Equipment',
                          icon: Laptop,
                        },
                        { value: 'automation', label: 'Automation', icon: Bot },
                        {
                          value: 'analytics',
                          label: 'Analytics',
                          icon: BarChart,
                        },
                        { value: 'reports', label: 'Reports', icon: FileText },
                        { value: 'import', label: 'Data Import', icon: Upload },
                        { value: 'qrcodes', label: 'QR Codes', icon: QrCode },
                        { value: 'barcodes', label: 'Barcodes', icon: List },
                        {
                          value: 'settings',
                          label: 'Settings',
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHelpMenu(!showHelpMenu)}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
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
                  { value: 'scan', label: 'Activity', icon: Camera },
                  { value: 'students', label: 'Students', icon: Users },
                  { value: 'books', label: 'Books', icon: BookOpen },
                  { value: 'checkout', label: 'Checkout', icon: Library },
                  { value: 'equipment', label: 'Equipment', icon: Laptop },
                  { value: 'automation', label: 'Automation', icon: Bot },
                  { value: 'analytics', label: 'Analytics', icon: BarChart },
                  { value: 'reports', label: 'Reports', icon: FileText },
                  { value: 'import', label: 'Import', icon: Upload },
                  { value: 'qrcodes', label: 'QR Codes', icon: QrCode },
                  { value: 'barcodes', label: 'Barcodes', icon: List },
                  { value: 'settings', label: 'Settings', icon: Settings },
                  // Enhanced Library Management Mobile Tabs
                  { value: 'user-tracking', label: 'Users', icon: Users },
                  { value: 'enhanced-borrowing', label: 'Borrow', icon: BookOpen },
                  { value: 'overdue-management', label: 'Overdue', icon: AlertTriangle },
                  { value: 'library-analytics', label: 'Analytics', icon: BarChart },
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
              {/* Desktop Tabs - Hidden on Mobile */}
              <div className="hidden lg:block">
                <TabsList className="w-full lg:w-auto flex-wrap lg:flex-nowrap items-center gap-1">
                  <TabsTrigger value="dashboard" id="tab-dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="scan" id="tab-scan">
                    <Camera className="w-4 h-4 mr-2" /> Activity
                  </TabsTrigger>
                  <TabsTrigger
                    value="students"
                    id="tab-students"
                    data-testid="top-students-tab"
                    onClick={() => setActiveTab('students')}
                  >
                    <Users className="w-4 h-4 mr-2" /> Students
                  </TabsTrigger>
                  <TabsTrigger value="books" id="tab-books" onClick={() => setActiveTab('books')}>
                    <BookOpen className="w-4 h-4 mr-2" /> Books
                  </TabsTrigger>
                  <TabsTrigger value="checkout" id="tab-checkout" onClick={() => setActiveTab('checkout')}>
                    <Library className="w-4 h-4 mr-2" /> Checkout
                  </TabsTrigger>
                  <TabsTrigger value="printing" id="tab-printing" onClick={() => setActiveTab('printing')}>
                    <FileText className="w-4 h-4 mr-2" /> Printing
                  </TabsTrigger>
                  <TabsTrigger value="equipment" id="tab-equipment" onClick={() => setActiveTab('equipment')}>
                    <Laptop className="w-4 h-4 mr-2" /> Equipment
                  </TabsTrigger>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-1">
                        More <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Management</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setActiveTab('management')}>
                        <Settings className="h-4 w-4 mr-2" /> Management
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('settings')}>
                        <Settings className="h-4 w-4 mr-2" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Analytics</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setActiveTab('analytics')}>
                        <BarChart className="h-4 w-4 mr-2" /> Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('reports')}>
                        <FileText className="h-4 w-4 mr-2" /> Reports
                      </DropdownMenuItem>
                      {/* Library Analytics consolidated into Analytics tab */}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Data</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setActiveTab('import')}>
                        <Upload className="h-4 w-4 mr-2" /> Import
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('qrcodes')}>
                        <QrCode className="h-4 w-4 mr-2" /> QR Codes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('barcodes')}>
                        <List className="h-4 w-4 mr-2" /> Barcodes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Users</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setActiveTab('user-tracking')}>
                        <Users className="h-4 w-4 mr-2" /> User Tracking
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('enhanced-borrowing')}>
                        <BookOpen className="h-4 w-4 mr-2" /> Enhanced Borrowing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('overdue-management')}>
                        <AlertTriangle className="h-4 w-4 mr-2" /> Overdue Management
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    <DashboardOverview onTabChange={setActiveTab} />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent
                value="scan"
                className="space-y-6"
                id="tabpanel-scan"
                role="tabpanel"
                aria-labelledby="tab-scan"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<LoadingSpinnerFallback />}>
                    <ScanWorkspace />
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
                    <StudentManagement />
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
                    <BookCatalog />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Checkout Tab */}
              <TabsContent
                value="checkout"
                className="space-y-6"
                id="tabpanel-checkout"
                role="tabpanel"
                aria-labelledby="tab-checkout"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <BookCheckout />
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
                    <PrintingTrackerLazy />
                  </Suspense>
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <Suspense fallback={<TableSkeletonFallback />}>
                    <EquipmentDashboard />
                  </Suspense>
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <OptimizedLazyLoad
                    loader={() =>
                      import('@/components/dashboard/AutomationDashboard').then(
                        (m) => ({ default: m.default || m.AutomationDashboard })
                      )
                    }
                    fallback={<DashboardSkeleton />}
                    error="Failed to load Automation"
                  />
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AnalyticsDashboard />
                  </Suspense>
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <ReportsBuilder />
                  </Suspense>
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <QRCodeManager />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Import Tab */}
              <TabsContent
                value="import"
                className="space-y-6"
                id="tabpanel-import"
                role="tabpanel"
                aria-labelledby="tab-import"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <ImportData />
                  </Suspense>
                </RouteErrorBoundary>
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
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <BarcodeManager />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent
                value="settings"
                className="space-y-6"
                id="tabpanel-settings"
                role="tabpanel"
                aria-labelledby="tab-settings"
                tabIndex={0}
              >
                <Suspense fallback={<SettingsSkeleton />}>
                  <SettingsPage />
                </Suspense>
              </TabsContent>

              {/* Management Tab */}
              <TabsContent
                value="management"
                className="space-y-6"
                id="tabpanel-management"
                role="tabpanel"
                aria-labelledby="tab-management"
                tabIndex={0}
              >
                {import.meta.env.DEV ? (
                  <CardSkeleton className="h-20" />
                ) : null}
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}> 
                    {import.meta.env.DEV ? (
                      <div className="space-y-6">
                        <div className="text-sm text-muted-foreground">Management (Dev simplified)</div>
                        <PrintingTrackerLazy />
                      </div>
                    ) : (
                      <LibraryManagementHub />
                    )}
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Enhanced Library Management Tabs */}
              <TabsContent
                value="user-tracking"
                className="space-y-6"
                id="tabpanel-user-tracking"
                role="tabpanel"
                aria-labelledby="tab-user-tracking"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <UserTracking />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              <TabsContent
                value="enhanced-borrowing"
                className="space-y-6"
                id="tabpanel-enhanced-borrowing"
                role="tabpanel"
                aria-labelledby="tab-enhanced-borrowing"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <EnhancedBorrowing />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              <TabsContent
                value="overdue-management"
                className="space-y-6"
                id="tabpanel-overdue-management"
                role="tabpanel"
                aria-labelledby="tab-overdue-management"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<CardSkeleton className="h-96" />}>
                    <OverdueManagement />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Library Analytics consolidated into Analytics tab */}
            </Tabs>
          </main>

          {/* PWA Install Prompt */}
          <PWAInstallPrompt
            onInstall={() => {
            }}
            onDismiss={() => {
            }}
          />

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
                    Active: <span className="font-medium">1</span>
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
