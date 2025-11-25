import { Suspense, lazy } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';

const ScanWorkspace = lazy(() =>
  import('@/components/dashboard/ScanWorkspace').then((module) => ({
    default: module.ScanWorkspace,
  }))
);

export default function ScanStationPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <ScanWorkspace />
      </Suspense>
    </div>
  );
}
