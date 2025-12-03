import { Suspense, lazy, useState } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, DollarSign } from 'lucide-react';

const PrintingTrackerLazy = lazy(
  () => import('@/components/management/PrintingTracker')
);

const PricingConfigurationLazy = lazy(
  () => import('@/components/management/PricingConfiguration')
);

export default function PrintingPage() {
  const [activeTab, setActiveTab] = useState('tracker');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Printing Services</h2>
        <p className="text-muted-foreground">
          Track printing jobs and manage pricing
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="tracker" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Jobs
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracker">
          <Suspense fallback={<CardSkeleton className="h-96" />}>
            <PrintingTrackerLazy />
          </Suspense>
        </TabsContent>

        <TabsContent value="pricing">
          <Suspense fallback={<CardSkeleton className="h-96" />}>
            <PricingConfigurationLazy />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
