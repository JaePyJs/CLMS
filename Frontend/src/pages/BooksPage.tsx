import { Suspense, lazy, useState } from 'react';
import { TableSkeleton, CardSkeleton } from '@/components/LoadingStates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ArrowLeftRight, History } from 'lucide-react';

const BookCatalog = lazy(() => import('@/components/dashboard/BookCatalog'));
const BookCheckout = lazy(() => import('@/components/dashboard/BookCheckout'));
const CheckoutHistory = lazy(
  () => import('@/components/dashboard/CheckoutHistory')
);

export default function BooksPage() {
  // Use local state instead of URL params to avoid conflict with main App's tab param
  const [activeTab, setActiveTab] = useState('catalog');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Books Management</h1>
        <p className="text-muted-foreground">
          Manage book catalog, checkout/return, and borrowing history
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Book Catalog
          </TabsTrigger>
          <TabsTrigger value="circulation" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Checkout / Return
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6">
          <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <BookCatalog />
          </Suspense>
        </TabsContent>

        <TabsContent value="circulation" className="mt-6">
          <Suspense fallback={<CardSkeleton className="h-96" />}>
            <BookCheckout />
          </Suspense>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Suspense fallback={<TableSkeleton rows={10} columns={7} />}>
            <CheckoutHistory />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
