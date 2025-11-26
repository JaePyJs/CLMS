import { Suspense, lazy } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';

const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));

interface SettingsAdminPageProps {
  initialTab?: string;
}

export default function SettingsAdminPage({
  initialTab,
}: SettingsAdminPageProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <SettingsPage initialTab={initialTab} />
      </Suspense>
    </div>
  );
}
