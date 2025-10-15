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

interface GetBooksParams {
  category?: string;
  limit?: number;
  searchQuery?: string;
  sortBy?: 'title' | 'author' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  availableOnly?: boolean;
}

interface GetBooksResponse {
  books: Book[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Service for fetching books from the API
 * This service is designed to work with both server and client components
 */
export async function getBooks(params: GetBooksParams = {}): Promise<Book[]> {
  try {
    // Build query string
    const queryParams = new URLSearchParams();

    if (params.category) queryParams.append('category', params.category);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.searchQuery) queryParams.append('search', params.searchQuery);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.availableOnly) queryParams.append('availableOnly', 'true');

    const queryString = queryParams.toString();
    const url = `/api/books${queryString ? `?${queryString}` : ''}`;

    // For server components, we need to use the full URL
    const fullUrl = typeof window === 'undefined'
      ? `http://localhost:3001${url}`
      : url;

    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        // For server components, we might need to handle auth differently
        ...(typeof window !== 'undefined' && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }),
      },
      // Add caching for server components
      ...(typeof window === 'undefined' && {
        next: { revalidate: 60 }, // Cache for 60 seconds
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch books: ${response.statusText}`);
    }

    const data: GetBooksResponse = await response.json();
    return data.books;
  } catch (error) {
    console.error('Error fetching books:', error);
    // Return empty array as fallback
    return [];
  }
}

/**
 * Get a single book by ID
 */
export async function getBookById(id: string): Promise<Book | null> {
  try {
    const url = `/api/books/${id}`;
    const fullUrl = typeof window === 'undefined'
      ? `http://localhost:3001${url}`
      : url;

    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }),
      },
      ...(typeof window === 'undefined' && {
        next: { revalidate: 60 },
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch book: ${response.statusText}`);
    }

    const data = await response.json();
    return data.book;
  } catch (error) {
    console.error('Error fetching book:', error);
    return null;
  }
}

/**
 * Get book categories
 */
export async function getBookCategories(): Promise<string[]> {
  try {
    const url = '/api/books/categories';
    const fullUrl = typeof window === 'undefined'
      ? `http://localhost:3001${url}`
      : url;

    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }),
      },
      ...(typeof window === 'undefined' && {
        next: { revalidate: 300 }, // Cache categories for 5 minutes
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.categories || [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Return default categories as fallback
    return [
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
  }
}

// Type exports
export type { Book, GetBooksParams, GetBooksResponse };