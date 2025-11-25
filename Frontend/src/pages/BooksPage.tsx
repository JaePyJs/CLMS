import { Suspense, lazy } from 'react';
import { TableSkeleton } from '@/components/LoadingStates';

const BookCatalog = lazy(() => import('@/components/dashboard/BookCatalog'));

export default function BooksPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
        <BookCatalog />
      </Suspense>
    </div>
  );
}
