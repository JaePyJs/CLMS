import { BookCard } from '@/components/ui/BookCard';
import { getBooks } from '@/services/bookService';

// Server Component - for static data fetching
interface BookCatalogProps {
  category?: string;
  limit?: number;
  searchQuery?: string;
  sortBy?: 'title' | 'author' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  availableOnly?: boolean;
}

export default async function BookCatalogServer({
  category,
  limit = 20,
  searchQuery,
  sortBy = 'title',
  sortOrder = 'asc',
  availableOnly = false,
}: BookCatalogProps) {
  // Server-side data fetching with caching
  const params: Record<string, unknown> = {
    limit,
    sortBy,
    sortOrder,
    availableOnly,
  };

  if (category) {
    params.category = category;
  }

  if (searchQuery) {
    params.searchQuery = searchQuery;
  }

  const books = await getBooks(params);

  // Server component - no client-side state
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books.length === 0 ? (
        <div className="col-span-full text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-foreground mb-2">
            No books found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            {searchQuery
              ? `No books matching "${searchQuery}"`
              : availableOnly
                ? 'No available books found'
                : 'No books in this category'}
          </p>
        </div>
      ) : (
        books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onCheckout={() => {
              // This will be handled by the client component
              console.debug('Checkout clicked for book:', book.id);
            }}
          />
        ))
      )}
    </div>
  );
}

// Export type for client-side usage
export type BookCatalogServerProps = typeof BookCatalogServer;
