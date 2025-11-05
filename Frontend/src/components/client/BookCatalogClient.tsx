'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BookCard } from '@/components/ui/BookCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Search,
  RefreshCw,
  ArrowUpDown,
  Grid3X3,
  List,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface Book {
  id: string;
  isbn?: string;
  accessionNo: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  totalCopies: number;
  availableCopies: number;
  isActive: boolean;
  barcodeImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookCatalogClientProps {
  initialBooks?: Book[];
  categories?: string[];
}

const DEFAULT_CATEGORIES = [
  'Fiction',
  'Non-Fiction',
  'Reference',
  'Science',
  'Mathematics',
  'History',
  'Literature',
  'Technology',
  'Arts',
  'Biography',
  'Children',
  'Young Adult',
];

export function BookCatalogClient({
  initialBooks = [],
  categories = DEFAULT_CATEGORIES,
}: BookCatalogClientProps) {
  // Modern hooks for state management
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>(initialBooks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'created_at'>(
    'title'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [availableOnly, setAvailableOnly] = useState(false);

  // UI state with localStorage persistence
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>(
    'book-view-mode',
    'grid'
  );
  const [booksPerPage] = useLocalStorage('books-per-page', 20);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Memoized filter and sort logic
  const filteredAndSortedBooks = useMemo(() => {
    let filtered = books;

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query) ||
          book.isbn?.toLowerCase().includes(query) ||
          book.accessionNo.toLowerCase().includes(query) ||
          book.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((book) => book.category === selectedCategory);
    }

    // Apply availability filter
    if (availableOnly) {
      filtered = filtered.filter((book) => book.availableCopies > 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'author':
          aValue = a.author.toLowerCase();
          bValue = b.author.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'title':
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
      }

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [
    books,
    debouncedSearchQuery,
    selectedCategory,
    sortBy,
    sortOrder,
    availableOnly,
  ]);

  // Update filtered books when memoized result changes
  useEffect(() => {
    setFilteredBooks(filteredAndSortedBooks);
  }, [filteredAndSortedBooks]);

  // Fetch books from API
  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/books', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch books');
      }

      const data = await response.json();
      if (data.success) {
        setBooks(data.data.books || []);
      } else {
        setError(data.error || 'Failed to load books');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error('Failed to load books. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle book checkout
  const handleCheckout = useCallback(async (bookId: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to checkout book');
      }

      const data = await response.json();
      if (data.success) {
        // Update local state to reflect checkout
        setBooks((prev) =>
          prev.map((book) =>
            book.id === bookId
              ? { ...book, availableCopies: book.availableCopies - 1 }
              : book
          )
        );
      } else {
        throw new Error(data.error || 'Checkout failed');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Checkout failed';
      throw new Error(errorMessage);
    }
  }, []);

  // Handle view details
  const handleViewDetails = useCallback((book: Book) => {
    // This would typically open a dialog or navigate to a detail page
    toast.info(`Viewing details for "${book.title}"`);
    console.log('Book details:', book);
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSortBy('title');
    setSortOrder('asc');
    setAvailableOnly(false);
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = books.length;
    const available = books.filter((book) => book.availableCopies > 0).length;
    const checkedOut = books.reduce(
      (sum, book) => sum + (book.totalCopies - book.availableCopies),
      0
    );
    const uniqueCategories = new Set(books.map((book) => book.category)).size;

    return { total, available, checkedOut, categories: uniqueCategories };
  }, [books]);

  // Pagination
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const paginatedBooks = useMemo(() => {
    const startIndex = 0; // Could add page state later
    return filteredBooks.slice(startIndex, startIndex + booksPerPage);
  }, [filteredBooks, booksPerPage]);

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Book Catalog</h2>
          <p className="text-muted-foreground">
            Browse and manage your library collection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBooks}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Books
              </p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Available
              </p>
              <p className="text-2xl font-bold text-green-600">
                {stats.available}
              </p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-green-500 rounded-full" />
            </div>
          </div>
        </div>

        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Checked Out
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.checkedOut}
              </p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-blue-500 rounded-full" />
            </div>
          </div>
        </div>

        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Categories
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.categories}
              </p>
            </div>
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-purple-500 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-background border rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value: any) => setSortBy(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="author">Author</SelectItem>
                <SelectItem value="created_at">Date Added</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>

            <Button
              variant={availableOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAvailableOnly(!availableOnly)}
            >
              Available Only
            </Button>

            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>

        {/* View controls */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredBooks.length} of {books.length} books
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading books...</span>
        </div>
      )}

      {/* Books display */}
      {!isLoading && paginatedBooks.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No books found</h3>
          <p className="text-muted-foreground">
            {debouncedSearchQuery || selectedCategory !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No books available in the catalog'}
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }
        >
          {paginatedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onCheckout={handleCheckout}
              onViewDetails={handleViewDetails}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page 1 of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={totalPages <= 1}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookCatalogClient;
