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
import { apiClient } from '@/lib/api';
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
import { FooterStats } from '@/components/layout/FooterStats';
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
  Activity,
  Users,
  BookOpen,
  LayoutDashboard,
  Camera,
  FileText,
  Sliders,
  Printer,
  Monitor,
  Trophy,
  ClipboardList,
  History,
} from 'lucide-react';

// Import page components for code splitting
import {
  DashboardPage,
  ScanStationPage,
  StudentsPage,
  BooksPage,
  EquipmentPage,
  SettingsAdminPage,
  PrintingPage,
  Kiosk,
  AttendancePage,
} from '@/pages';

const LeaderboardDashboard = React.lazy(
  () => import('@/components/dashboard/LeaderboardDashboard')
);

const ActivityHistory = React.lazy(
  () => import('@/components/dashboard/ActivityHistory')
);

const AttendanceDisplay = React.lazy(
  () => import('@/components/attendance/AttendanceDisplay')
);

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
  const { activeStudent, clearActiveStudent } = useAppStore();

  // Mobile optimization - hooks MUST be called before any conditional returns
  const { isMobile, isTablet } = useMobileOptimization();
  usePerformanceOptimization();
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();
  useOfflineSync();

  // Check for Kiosk mode - wrap with WebSocketProvider for real-time updates
  const isKioskMode =
    typeof window !== 'undefined' && window.location.pathname === '/kiosk';

  if (isKioskMode) {
    return (
      <WebSocketProvider>
        <Suspense fallback={<LoadingSpinnerFallback />}>
          <RouteErrorBoundary>
            <Kiosk />
          </RouteErrorBoundary>
        </Suspense>
      </WebSocketProvider>
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

    // Settings & Admin (Tab 7)
    if (
      m === 'settings' ||
      m === 'management' ||
      m === 'qrcodes' ||
      m === 'barcodes' ||
      m === 'analytics' ||
      m === 'reports' ||
      m === 'import' ||
      m === 'import-export' ||
      m === 'data-quality'
    )
      return 'settings-admin';

    // Equipment (Tab 5)
    if (m === 'equipment') return 'equipment';

    // Printing (Tab 7)
    if (m === 'printing') return 'printing';

    // Leaderboard (Tab 8)
    if (m === 'leaderboard') return 'leaderboard';

    // Activity History (Tab 9)
    if (m === 'activity-history' || m === 'history') return 'activity-history';

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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    string | undefined
  >(undefined);
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

  // Enhanced navigation handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length > 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await apiClient.get(
            `/api/search?q=${encodeURIComponent(query)}`
          );
          // apiClient.get returns the response data directly: {success: true, data: [...]}
          if (response && (response as any).success) {
            setSearchResults((response as any).data || []);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error('Search failed', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Do actual browser refresh
    window.location.reload();
  };

  const handleSystemHealth = async () => {
    toast.info('Running system health check...');
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (data.status === 'healthy') {
        toast.success(
          `System healthy! DB: ${data.database?.responseTime || 0}ms, Uptime: ${Math.floor(data.uptime / 60)}min`
        );
      } else {
        toast.warning(`System degraded: ${data.status}`);
      }
    } catch {
      toast.error('Failed to check system health');
    }
  };

  const handleBackup = () => {
    toast.info('Starting system backup...');
    // Backup is handled in dashboard Quick Actions
  };

  const handleMaintenance = () => {
    toast.info('Maintenance mode not implemented');
  };

  const handleEmergencyAlert = () => {
    toast.warning('Emergency alert system not implemented');
  };

  const handleViewLogs = () => {
    toast.info('System logs available at /logs endpoint');
  };

  const handleDatabaseStatus = async () => {
    toast.info('Checking database...');
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (data.database?.connected) {
        toast.success(`Database connected (${data.database.responseTime}ms)`);
      } else {
        toast.error('Database disconnected!');
      }
    } catch {
      toast.error('Failed to check database');
    }
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
        'equipment',
        'printing',
        'settings-admin',
        'leaderboard',
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
            setActiveTab('printing');
            break;
          case '7':
            event.preventDefault();
            setActiveTab('settings-admin');
            break;
          case '8':
            event.preventDefault();
            setActiveTab('leaderboard');
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
        toast.info(
          'Keyboard shortcuts: Alt+1-9 for tabs, Ctrl+K for search, Ctrl+Shift+C to clear active student'
        );
      }

      // F1 for help
      if (event.key === 'F1') {
        event.preventDefault();
        toast.info(
          'Press Alt+1-9 to navigate tabs: Dashboard, Scan, Students, Books, Rooms, Reports, Settings, Printing, Leaderboard'
        );
      }

      // F5 for refresh (prevent default and use our refresh)
      if (event.key === 'F5') {
        event.preventDefault();
        handleRefresh();
      }

      // Ctrl+Shift+C to clear active student
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        if (activeStudent) {
          clearActiveStudent();
          toast.success('Active student cleared');
        }
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
      <WebSocketProvider>
        <Suspense fallback={<LoadingSpinnerFallback />}>
          <Kiosk />
        </Suspense>
      </WebSocketProvider>
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
                      src="/School_logo.png"
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
                <div
                  className={
                    'flex flex-1 max-w-md w-full lg:w-auto order-last lg:order-none lg:mx-4'
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
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Clear Search"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}

                    {/* Search Results Dropdown */}
                    {searchQuery.length > 2 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
                        {isSearching ? (
                          <div className="p-4 text-center text-muted-foreground">
                            <LoadingSpinner
                              size="sm"
                              className="inline-block mr-2"
                            />
                            Searching...
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div className="py-2">
                            {searchResults.map((result: any) => (
                              <button
                                key={`${result.type}-${result.id}`}
                                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                                onClick={() => {
                                  if (result.type === 'student')
                                    setActiveTab('students');
                                  if (result.type === 'book')
                                    setActiveTab('books');
                                  if (result.type === 'equipment')
                                    setActiveTab('equipment');
                                  setSearchQuery('');
                                  setSearchResults([]);
                                  toast.success(
                                    `Navigating to ${result.type}: ${result.title}`
                                  );
                                }}
                              >
                                <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                  {result.type === 'student' && (
                                    <User className="h-4 w-4" />
                                  )}
                                  {result.type === 'book' && (
                                    <BookOpen className="h-4 w-4" />
                                  )}
                                  {result.type === 'equipment' && (
                                    <Monitor className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">
                                    {result.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {result.subtitle} • {result.status}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-muted-foreground">
                            No results found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

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
                          value: 'leaderboard',
                          label: 'Leaderboard',
                          icon: Trophy,
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
                          value: 'printing',
                          label: 'Printing',
                          icon: Printer,
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
                  { value: 'leaderboard', label: 'Leaderboard', icon: Trophy },
                  { value: 'books', label: 'Books', icon: BookOpen },
                  { value: 'equipment', label: 'Rooms', icon: Monitor },
                  { value: 'printing', label: 'Printing', icon: Printer },
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
              {/* Desktop Tabs - Scrollable horizontal nav for better responsiveness */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto scrollbar-hide">
                  <TabsList
                    className="inline-flex w-fit gap-1 p-1 bg-muted/50 rounded-xl"
                    aria-label="App Navigation"
                  >
                    <TabsTrigger
                      value="dashboard"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <LayoutDashboard className="h-4 w-4 mr-1.5" />
                      <span>Dashboard</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="scan-station"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <Camera className="h-4 w-4 mr-1.5" />
                      <span>Scan</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="students"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <Users className="h-4 w-4 mr-1.5" />
                      <span>Students</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="attendance"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <ClipboardList className="h-4 w-4 mr-1.5" />
                      <span>Attendance</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="books"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <BookOpen className="h-4 w-4 mr-1.5" />
                      <span>Books</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="printing"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <Printer className="h-4 w-4 mr-1.5" />
                      <span>Printing</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="equipment"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <Monitor className="h-4 w-4 mr-1.5" />
                      <span>Rooms</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="leaderboard"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <Trophy className="h-4 w-4 mr-1.5" />
                      <span>Leaderboard</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="activity-history"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <History className="h-4 w-4 mr-1.5" />
                      <span>History</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings-admin"
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all duration-200 px-3"
                    >
                      <Settings className="h-4 w-4 mr-1.5" />
                      <span>Settings</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
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

              {/* Attendance Tab */}
              <TabsContent
                value="attendance"
                className="space-y-6"
                id="tabpanel-attendance"
                role="tabpanel"
                aria-labelledby="tab-attendance"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<TableSkeletonFallback />}>
                    <AttendancePage />
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

              {/* Leaderboard Tab */}
              <TabsContent
                value="leaderboard"
                className="space-y-6"
                id="tabpanel-leaderboard"
                role="tabpanel"
                aria-labelledby="tab-leaderboard"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <LeaderboardDashboard />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Activity History Tab */}
              <TabsContent
                value="activity-history"
                className="space-y-6"
                id="tabpanel-activity-history"
                role="tabpanel"
                aria-labelledby="tab-activity-history"
                tabIndex={0}
              >
                <RouteErrorBoundary>
                  <Suspense fallback={<TableSkeletonFallback />}>
                    <ActivityHistory />
                  </Suspense>
                </RouteErrorBoundary>
              </TabsContent>

              {/* Settings Tab - available to all authenticated users */}
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
          <FooterStats />
        </div>
      </WebSocketProvider>
    </ProtectedRoute>
  );
}
