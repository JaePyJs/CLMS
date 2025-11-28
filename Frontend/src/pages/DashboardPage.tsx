import { Suspense } from 'react';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import { CardSkeleton } from '@/components/LoadingStates';

interface DashboardPageProps {
  // eslint-disable-next-line no-unused-vars
  onTabChange?: (_tab: string) => void;
}

export default function DashboardPage({ onTabChange }: DashboardPageProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <DashboardOverview onTabChange={onTabChange} />
      </Suspense>
    </div>
  );
}
