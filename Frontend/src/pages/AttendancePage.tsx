import { Suspense, lazy } from 'react';
import { TableSkeleton } from '@/components/LoadingStates';

const AttendanceTracker = lazy(
  () => import('@/components/attendance/AttendanceTracker')
);

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">
            View and export student check-in/check-out records
          </p>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
        <AttendanceTracker />
      </Suspense>
    </div>
  );
}
