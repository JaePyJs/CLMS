import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Sheet, Bot, Database, FileText, Settings } from 'lucide-react';

// Import setting tab components
const SystemSettings = React.lazy(() => import('./SystemSettings'));
const UserManagement = React.lazy(() => import('./UserManagement'));
const GoogleSheetsConfig = React.lazy(() => import('./GoogleSheetsConfig'));
const AutomationSettings = React.lazy(() => import('./AutomationSettings'));
const BackupRestore = React.lazy(() => import('./BackupRestore'));
const SystemLogs = React.lazy(() => import('./SystemLogs'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('system');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage system configuration and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-2">
          <TabsTrigger value="system" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="sheets" className="gap-2">
            <Sheet className="w-4 h-4" />
            <span className="hidden sm:inline">Sheets</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Automation</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <React.Suspense fallback={<LoadingFallback />}>
            <SystemSettings />
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
      </Tabs>
    </div>
  );
}
