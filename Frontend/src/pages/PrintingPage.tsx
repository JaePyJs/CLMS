import { Suspense, lazy } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';

const PrintingTrackerLazy = lazy(
  () => import('@/components/management/PrintingTracker')
);

export default function PrintingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Print Jobs</h2>
        <p className="text-muted-foreground">
          Track and manage printing, photocopy, and lamination jobs
        </p>
      </div>

      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <PrintingTrackerLazy />
      </Suspense>
    </div>
  );
}
