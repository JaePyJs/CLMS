import { Suspense, lazy, useState } from 'react';
import { TableSkeleton, CardSkeleton } from '@/components/LoadingStates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ArrowLeftRight } from 'lucide-react';

const BookCatalog = lazy(() => import('@/components/dashboard/BookCatalog'));
const BookCheckout = lazy(() => import('@/components/dashboard/BookCheckout'));

export default function BooksPage() {
  // Use local state instead of URL params to avoid conflict with main App's tab param
  const [activeTab, setActiveTab] = useState('catalog');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Book Catalog
          </TabsTrigger>
          <TabsTrigger value="circulation" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Checkout / Return
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
      </Tabs>
    </div>
  );
}
