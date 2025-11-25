import { Suspense, lazy } from 'react';
import { TableSkeleton } from '@/components/LoadingStates';

const StudentManagement = lazy(
  () => import('@/components/dashboard/StudentManagement')
);

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<TableSkeleton rows={10} columns={5} />}>
        <StudentManagement />
      </Suspense>
    </div>
  );
}
