import { Suspense, lazy } from 'react';
import { TableSkeleton } from '@/components/LoadingStates';

const EquipmentDashboard = lazy(
  () => import('@/components/dashboard/EquipmentDashboard')
);

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
        <EquipmentDashboard />
      </Suspense>
    </div>
  );
}
