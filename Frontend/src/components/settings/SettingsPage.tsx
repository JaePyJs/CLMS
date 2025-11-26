import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Sheet,
  Bot,
  Database,
  FileText,
  Settings,
  Clock,
  RotateCcw,
} from 'lucide-react';

// Import setting tab components
const SystemSettings = React.lazy(() => import('./SystemSettings'));
const UserManagement = React.lazy(() => import('./UserManagement'));
const GoogleSheetsConfig = React.lazy(() => import('./GoogleSheetsConfig'));
const AutomationSettings = React.lazy(() => import('./AutomationSettings'));
const BackupRestore = React.lazy(() => import('./BackupRestore'));
const SystemLogs = React.lazy(() => import('./SystemLogs'));
const AttendanceSettings = React.lazy(() => import('./AttendanceSettings'));
const DataManagement = React.lazy(() => import('./DataManagement'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

interface SettingsPageProps {
  initialTab?: string;
}

export default function SettingsPage({ initialTab }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState(initialTab || 'system');

  // Update tab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage system configuration and preferences
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 p-1 bg-muted/50 rounded-lg">
          <TabsTrigger
            value="system"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger
            value="sheets"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <Sheet className="w-4 h-4" />
            <span className="hidden sm:inline">Sheets</span>
          </TabsTrigger>
          <TabsTrigger
            value="automation"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Automation</span>
          </TabsTrigger>
          <TabsTrigger
            value="backup"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
          <TabsTrigger
            value="reset"
            className="gap-2 transition-all duration-300 ease-in-out data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/50 dark:hover:bg-background/30"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <React.Suspense fallback={<LoadingFallback />}>
            <SystemSettings />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="attendance">
          <React.Suspense fallback={<LoadingFallback />}>
            <AttendanceSettings />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="users">
          <React.Suspense fallback={<LoadingFallback />}>
            <UserManagement />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="sheets">
          <React.Suspense fallback={<LoadingFallback />}>
            <GoogleSheetsConfig />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="automation">
          <React.Suspense fallback={<LoadingFallback />}>
            <AutomationSettings />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="backup">
          <React.Suspense fallback={<LoadingFallback />}>
            <BackupRestore />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="logs">
          <React.Suspense fallback={<LoadingFallback />}>
            <SystemLogs />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="reset">
          <React.Suspense fallback={<LoadingFallback />}>
            <DataManagement />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
