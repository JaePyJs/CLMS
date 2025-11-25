import { Suspense, lazy } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';

const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));

export default function SettingsAdminPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <SettingsPage />
      </Suspense>
    </div>
  );
}
