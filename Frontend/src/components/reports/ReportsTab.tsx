import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  TrendingUp,
  BarChart3,
  FileText,
} from 'lucide-react';

// Import report components
const DailyReport = React.lazy(() => import('./DailyReport'));
const WeeklyReport = React.lazy(() => import('./WeeklyReport'));
const MonthlyReport = React.lazy(() => import('./MonthlyReport'));
const CustomReport = React.lazy(() => import('./CustomReport'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export default function ReportsTab() {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Generate and export various library activity reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily">
            <Calendar className="w-4 h-4 mr-2" />
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <TrendingUp className="w-4 h-4 mr-2" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly">
            <BarChart3 className="w-4 h-4 mr-2" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="custom">
            <FileText className="w-4 h-4 mr-2" />
            Custom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <React.Suspense fallback={<LoadingFallback />}>
            <DailyReport />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="weekly">
          <React.Suspense fallback={<LoadingFallback />}>
            <WeeklyReport />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="monthly">
          <React.Suspense fallback={<LoadingFallback />}>
            <MonthlyReport />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="custom">
          <React.Suspense fallback={<LoadingFallback />}>
            <CustomReport />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
