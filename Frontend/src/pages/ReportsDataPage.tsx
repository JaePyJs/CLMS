import { Suspense, lazy } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';

const ImportExportManager = lazy(
  () => import('@/components/management/ImportExportManager')
);

export default function ReportsDataPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <ImportExportManager />
      </Suspense>
    </div>
  );
}
