import { Suspense, lazy } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';

const PrintingTrackerLazy = lazy(
  () => import('@/components/management/PrintingTracker')
);

export default function PrintingPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <PrintingTrackerLazy />
      </Suspense>
    </div>
  );
}
