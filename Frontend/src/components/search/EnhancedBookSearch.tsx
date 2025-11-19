import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  BookOpen,
  Filter,
  X,
  TrendingUp,
  Star,
  ChevronDown,
  Eye,
  Users,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface Book {
  id: string;
  accession_no: string;
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  total_copies: number;
  available_copies: number;
  is_active: boolean;
  coverUrl?: string;
  popularityScore?: number;
  isAvailable?: boolean;
  created_at?: string;
  updated_at?: string;
  book_checkouts?: Array<Record<string, unknown>>;
}

interface EnhancedBookSearchProps {
  onNavigateToDetails?: (bookId: string) => void;
}

interface SearchFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  author?: string;
  publisher?: string;
  location?: string;
  availableOnly?: boolean;
  readingLevel?: string;
  sortBy?:
    | 'title'
    | 'author'
    | 'category'
    | 'popularity'
    | 'newest'
    | 'available';
  sortOrder?: 'asc' | 'desc';
  includeCovers?: boolean;
}

interface SearchResponse {
  books: Book[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: SearchFilters;
  sortBy: string;
  sortOrder: string;
}

interface SearchSuggestion {
  titles: string[];
  authors: string[];
  categories: string[];
}

interface Recommendation {
  id: string;
  title: string;
  author: string;
  category: string;
  coverUrl?: string;
  popularityScore?: number;
  isAvailable?: boolean;
  recommendationReason?: string;
}

interface PopularBooks {
  books: Book[];
}

export default function EnhancedBookSearch({
  onNavigateToDetails,
}: EnhancedBookSearchProps = {}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion>({
    titles: [],
    authors: [],
    categories: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(
    null
  );
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [newBooks, setNewBooks] = useState<Book[]>([]);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'title',
    sortOrder: 'asc',
    includeCovers: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Fetch popular books
  const fetchPopularBooks = useCallback(async () => {
    try {
      const response = await apiClient.get<PopularBooks>(
        '/api/_search/popular',
        { limit: 8 }
      );

      if (response.success && response.data) {
        setPopularBooks(response.data.books);
      }
    } catch (error) {
      console.error('Failed to fetch popular books:', error);
    }
  }, []);

  // Fetch new books
  const fetchNewBooks = useCallback(async () => {
    try {
      const response = await apiClient.get<PopularBooks>('/api/_search/new', {
        limit: 8,
      });

      if (response.success && response.data) {
        setNewBooks(response.data.books);
      }
    } catch (error) {
      console.error('Failed to fetch new books:', error);
    }
  }, []);

  // Fetch available books
  const fetchAvailableBooks = useCallback(async () => {
    try {
      const response = await apiClient.get<PopularBooks>(
        '/api/_search/available',
        { limit: 8 }
      );

      if (response.success && response.data) {
        setAvailableBooks(response.data.books);
      }
    } catch (error) {
      console.error('Failed to fetch available books:', error);
    }
  }, []);

  // Fetch popular books on mount
  useEffect(() => {
    fetchPopularBooks();
    fetchNewBooks();
    fetchAvailableBooks();
  }, [fetchPopularBooks, fetchNewBooks, fetchAvailableBooks]);

  // Fetch suggestions with debouncing
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions({ titles: [], authors: [], categories: [] });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<SearchSuggestion>(
        '/api/_search/suggestions',
        {
          query: searchQuery,
          limit: 5,
          type: 'all',
        }
      );

      if (response.success && response.data) {
        setSuggestions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      // Don't show error toast for suggestions
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced _search input handler
  const handleSearchInput = (value: string) => {
    setQuery(value);
    setCurrentPage(1);

    // Clear existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // Set new timeout for suggestions
    suggestionTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    if (value.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Enhanced _search function
  const performSearch = async (page = 1, resetPagination = true) => {
    if (
      !query.trim() &&
      !Object.keys(filters).some((key) => filters[key as keyof SearchFilters])
    ) {
      return;
    }

    setLoading(true);
    try {
      // Build query params
      const searchParams: Record<string, unknown> = {
        page,
        limit: 20,
        includeCovers: filters.includeCovers,
      };

      // Add filters to _search params
      if (query) {
        searchParams.query = query;
      }
      if (filters.category) {
        searchParams.category = filters.category;
      }
      if (filters.subcategory) {
        searchParams.subcategory = filters.subcategory;
      }
      if (filters.author) {
        searchParams.author = filters.author;
      }
      if (filters.publisher) {
        searchParams.publisher = filters.publisher;
      }
      if (filters.location) {
        searchParams.location = filters.location;
      }
      if (filters.availableOnly) {
        searchParams.availableOnly = filters.availableOnly;
      }
      if (filters.readingLevel) {
        searchParams.readingLevel = filters.readingLevel;
      }
      if (filters.sortBy) {
        searchParams.sortBy = filters.sortBy;
      }
      if (filters.sortOrder) {
        searchParams.sortOrder = filters.sortOrder;
      }

      const response = await apiClient.get<SearchResponse>(
        '/api/_search/books',
        searchParams
      );

      if (response.success && response.data) {
        if (resetPagination) {
          setSearchResults(response.data);
        } else {
          // Append results for pagination
          setSearchResults((prev) => {
            if (!prev || !response.data) {
              return prev;
            }
            return {
              ...response.data,
              books: [...prev.books, ...response.data.books],
            };
          });
        }
        setCurrentPage(page);

        // Fetch recommendations based on first book in results
        if (response.data.books.length > 0 && !recommendations.length) {
          fetchRecommendations(response.data.books[0]);
        }
      }
    } catch (error) {
      console.error('_Search error:', error);
      toast.error('Failed to perform _search');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recommendations
  const fetchRecommendations = async (book?: Book) => {
    if (!book) {
      return;
    }

    try {
      const params: Record<string, unknown> = { limit: 8 };
      if (book.category) {
        params.category = book.category;
      }
      if (book.author) {
        params.author = book.author;
      }

      const response = await apiClient.get<Recommendation[]>(
        '/api/_search/recommendations',
        params
      );

      if (response.success && response.data) {
        setRecommendations(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    }
  };

  // Load more results (pagination)
  const loadMore = () => {
    if (searchResults && currentPage < searchResults.pagination.pages) {
      performSearch(currentPage + 1, false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      sortBy: 'title',
      sortOrder: 'asc',
      includeCovers: true,
    });
    setQuery('');
    setCurrentPage(1);
    setSearchResults(null);
    setRecommendations([]);
    setShowSuggestions(false);
  };

  // Apply saved _search
  const applySuggestion = (
    type: 'title' | 'author' | 'category',
    value: string
  ) => {
    setQuery(value);
    setShowSuggestions(false);

    // Update filters based on suggestion type
    if (type === 'author') {
      setFilters((prev) => ({ ...prev, author: value }));
    } else if (type === 'category') {
      setFilters((prev) => ({ ...prev, category: value }));
    }

    setCurrentPage(1);
    performSearch();
  };

  // Book availability badge
  const getAvailabilityBadge = (book: Book | Recommendation) => {
    // For recommendations, use isAvailable property
    if ('isAvailable' in book && typeof book.isAvailable === 'boolean') {
      return book.isAvailable ? (
        <Badge variant="default">Available</Badge>
      ) : (
        <Badge variant="destructive">Not Available</Badge>
      );
    }

    // For full Book objects
    if ('is_active' in book && 'available_copies' in book) {
      if (!book.is_active) {
        return <Badge variant="secondary">Inactive</Badge>;
      }
      if (book.available_copies === 0) {
        return <Badge variant="destructive">All Checked Out</Badge>;
      }
      if (book.available_copies === 1) {
        return <Badge variant="outline">Last Copy</Badge>;
      }
      return <Badge variant="default">{book.available_copies} Available</Badge>;
    }

    // Fallback
    return <Badge variant="outline">Unknown</Badge>;
  };

  // Popularity score display
  const getPopularityDisplay = (score?: number) => {
    if (!score) {
      return null;
    }
    if (score >= 80) {
      return (
        <Badge variant="default">
          <TrendingUp className="w-3 h-3 mr-1" />
          Very Popular
        </Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge variant="secondary">
          <Star className="w-3 h-3 mr-1" />
          Popular
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* _Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Enhanced Book _Search
          </CardTitle>
          <CardDescription>
            Discover books with advanced filtering, recommendations, and cover
            images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* _Search Bar with Suggestions */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="_Search by title, author, ISBN, or keyword..."
                  value={query}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      performSearch();
                    }
                  }}
                  className="pl-10"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions &&
                  (suggestions.titles.length > 0 ||
                    suggestions.authors.length > 0 ||
                    suggestions.categories.length > 0) && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
                      <div className="p-2 space-y-2">
                        {suggestions.titles.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              Titles
                            </div>
                            {suggestions.titles.map((title, index) => (
                              <div
                                key={`title-${index}`}
                                className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                                onClick={() => applySuggestion('title', title)}
                              >
                                <BookOpen className="w-3 h-3 mr-2 inline" />
                                {title}
                              </div>
                            ))}
                          </div>
                        )}

                        {suggestions.authors.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              Authors
                            </div>
                            {suggestions.authors.map((author, index) => (
                              <div
                                key={`author-${index}`}
                                className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                                onClick={() =>
                                  applySuggestion('author', author)
                                }
                              >
                                <Users className="w-3 h-3 mr-2 inline" />
                                {author}
                              </div>
                            ))}
                          </div>
                        )}

                        {suggestions.categories.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              Categories
                            </div>
                            {suggestions.categories.map((category, index) => (
                              <div
                                key={`category-${index}`}
                                className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                                onClick={() =>
                                  applySuggestion('category', category)
                                }
                              >
                                <Filter className="w-3 h-3 mr-2 inline" />
                                {category}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <Button onClick={() => performSearch()} disabled={loading}>
                {loading ? 'Searching...' : '_Search'}
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(filters.category ||
                  filters.author ||
                  filters.availableOnly) && (
                  <ChevronDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filters.availableOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilters({
                    ...filters,
                    availableOnly: !filters.availableOnly,
                  });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <Eye className="w-3 h-3 mr-1" />
                Available Only
              </Button>

              <Select
                value={filters.sortBy ?? 'title'}
                onValueChange={(value: string) => {
                  setFilters({
                    ...filters,
                    sortBy: value as SearchFilters['sortBy'],
                  });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="author">Author</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="popularity">Popular</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.sortOrder ?? 'asc'}
                onValueChange={(value: string) => {
                  setFilters({
                    ...filters,
                    sortOrder: value as SearchFilters['sortOrder'],
                  });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">A-Z</SelectItem>
                  <SelectItem value="desc">Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={filters.category || ''}
                    onValueChange={(value: string) => {
                      setFilters({ ...filters, category: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      {/* Categories will be populated from API */}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Author</label>
                  <Input
                    placeholder="Filter by author..."
                    value={filters.author || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, author: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Publisher</label>
                  <Input
                    placeholder="Filter by publisher..."
                    value={filters.publisher || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, publisher: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    placeholder="Filter by location..."
                    value={filters.location || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, location: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Reading Level</label>
                  <Select
                    value={filters.readingLevel || ''}
                    onValueChange={(value: string) => {
                      setFilters({ ...filters, readingLevel: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Levels</SelectItem>
                      <SelectItem value="Elementary">Elementary</SelectItem>
                      <SelectItem value="Middle School">
                        Middle School
                      </SelectItem>
                      <SelectItem value="High School">High School</SelectItem>
                      <SelectItem value="Young Adult">Young Adult</SelectItem>
                      <SelectItem value="Adult">Adult</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Actions</label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Quick Access Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Popular Books */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Popular
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3">
              {popularBooks.slice(0, 4).map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => {
                    setQuery(book.title);
                    setFilters({ ...filters, category: book.category });
                    performSearch();
                  }}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-10 h-14 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).style.background =
                          '#f3f4f6';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {book.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {book.author}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getAvailabilityBadge(book)}
                      {getPopularityDisplay(book.popularityScore)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* New Books */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              New Arrivals
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3">
              {newBooks.slice(0, 4).map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => {
                    setQuery(book.title);
                    setFilters({ ...filters, category: book.category });
                    performSearch();
                  }}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-10 h-14 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).style.background =
                          '#f3f4f6';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {book.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {book.author}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getAvailabilityBadge(book)}
                      <Badge variant="outline" className="text-xs">
                        New
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Available Now */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Available Now
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3">
              {availableBooks.slice(0, 4).map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => {
                    setQuery(book.title);
                    setFilters({ ...filters, category: book.category });
                    performSearch();
                  }}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-10 h-14 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).style.background =
                          '#f3f4f6';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {book.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {book.author}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getAvailabilityBadge(book)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Popular Books
              </span>
              <span className="font-semibold">{popularBooks.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                New Arrivals
              </span>
              <span className="font-semibold">{newBooks.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available</span>
              <span className="font-semibold text-green-600">
                {availableBooks.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* _Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>_Search Results</CardTitle>
                <CardDescription>
                  Found {searchResults.pagination.total} books
                  {query && ` for "${query}"`}
                  {filters.category && ` in ${filters.category}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {searchResults.pagination.total > 20 && (
                  <Badge variant="outline">
                    Page {searchResults.pagination.page} of{' '}
                    {searchResults.pagination.pages}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {searchResults.books.map((book) => (
                <Card
                  key={book.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => {
                    // Navigate to book details
                    if (onNavigateToDetails) {
                      onNavigateToDetails(book.id);
                    } else {
                      // Fallback to hash navigation for simple routing
                      window.location.hash = `book/${book.id}`;
                    }
                    console.debug('Navigate to book details:', book.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Book Cover */}
                      <div className="relative mx-auto w-24 h-32">
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                              (e.target as HTMLImageElement).style.background =
                                '#f3f4f6';
                              (e.target as HTMLImageElement).innerHTML =
                                '<BookOpen className="w-8 h-8 text-muted-foreground m-auto" />';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}

                        {/* Availability Badge */}
                        <div className="absolute top-2 right-2">
                          {getAvailabilityBadge(book)}
                        </div>
                      </div>

                      {/* Book Info */}
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          by {book.author}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {book.category}
                          </Badge>
                          {book.subcategory && (
                            <Badge variant="outline" className="text-xs">
                              {book.subcategory}
                            </Badge>
                          )}
                          {getPopularityDisplay(book.popularityScore)}
                        </div>

                        {/* Copies Info */}
                        <div className="text-xs text-muted-foreground">
                          {book.available_copies} of {book.total_copies} copies
                          available
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More Button */}
            {searchResults.pagination.page < searchResults.pagination.pages && (
              <div className="flex justify-center mt-6">
                <Button onClick={loadMore} disabled={loading} variant="outline">
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Recommended for You
            </CardTitle>
            <CardDescription>
              Based on your _search and library popularity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {recommendations.map((book) => (
                <Card
                  key={book.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => {
                    // Navigate to book details
                    if (onNavigateToDetails) {
                      onNavigateToDetails(book.id);
                    } else {
                      // Fallback to hash navigation for simple routing
                      window.location.hash = `book/${book.id}`;
                    }
                    console.debug('Navigate to recommended book:', book.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Book Cover */}
                      <div className="relative mx-auto w-20 h-28">
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                              (e.target as HTMLImageElement).style.background =
                                '#f3f4f6';
                              (e.target as HTMLImageElement).innerHTML =
                                '<BookOpen className="w-6 h-6 text-muted-foreground m-auto" />';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        {/* Reason Badge */}
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="text-xs">
                            {book.recommendationReason}
                          </Badge>
                        </div>
                      </div>

                      {/* Book Info */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm line-clamp-2">
                          {book.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {book.author}
                        </p>

                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {book.category}
                          </Badge>
                          {getAvailabilityBadge(book)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
