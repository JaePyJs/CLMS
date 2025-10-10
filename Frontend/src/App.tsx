import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHealthCheck } from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Wifi, WifiOff, LogOut, User } from 'lucide-react';

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

  // Keyboard navigation handler
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
            document.getElementById('tab-equipment')?.click();
            break;
          case '4':
            event.preventDefault();
            document.getElementById('tab-automation')?.click();
            break;
          case '5':
            event.preventDefault();
            document.getElementById('tab-analytics')?.click();
            break;
          case '6':
            event.preventDefault();
            document.getElementById('tab-qrcodes')?.click();
            break;
          case '7':
            event.preventDefault();
            document.getElementById('tab-barcodes')?.click();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background transition-colors duration-300 relative">
      {/* Background Image with Opacity */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-[0.35] dark:opacity-[0.08] pointer-events-none z-0"
        style={{ backgroundImage: `url('/Background.png')` }}
      />

      {/* Header */}
      <header className="bg-slate-50 dark:bg-card border-b border-slate-200 dark:border-border sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 relative hover:bg-accent/5 dark:hover:bg-accent/5 transition-colors">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <img
                  src="/src/assets/School_logo.png"
                  alt="Sacred Heart of Jesus Catholic School Logo"
                  className="w-14 h-14 object-contain opacity-100 dark:opacity-90"
                />
              </div>
              <div>
                <h1 className="text-2xl text-black dark:text-foreground">
                  Sacred Heart Library
                </h1>
                <p className="text-sm text-black dark:text-muted-foreground font-normal">
                  Welcome, {user?.username || 'Librarian'} 👋
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />

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

              {/* User Info */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {user?.username} - {user?.role}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="flex items-center gap-1"
                >
                  <LogOut className="h-3 w-3" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6 max-w-[1920px] mx-auto relative z-10">
        <ProtectedRoute requiredRole="LIBRARIAN">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-slate-50 dark:bg-card border border-slate-200 dark:border-border">
              <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
              <TabsTrigger value="scan">📷 Scan</TabsTrigger>
              <TabsTrigger value="equipment">💻 Equipment</TabsTrigger>
              <TabsTrigger value="automation">🤖 Automation</TabsTrigger>
              <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
              <TabsTrigger value="qrcodes">🔲 QR Codes</TabsTrigger>
              <TabsTrigger value="barcodes">📊 Barcodes</TabsTrigger>
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
              © 2024 Sacred Heart of Jesus Catholic School Library
            </p>
            <p className="text-sm text-muted-foreground">
              CLMS v1.0.0 - Built with React & Google Sheets
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
