import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Search,
  Download,
  Edit,
  Trash2,
  Eye,
  BookMarked,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  MapPin,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  TableSkeleton,
  ButtonLoading,
  EmptyState,
} from '@/components/LoadingStates';
import { apiClient } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

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

interface BookStats {
  total: number;
  available: number;
  checkedOut: number;
  overdue: number;
  categories: number;
}

export function BookCatalog() {
  // Mobile optimization
  const { isMobile } = useMobileOptimization();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalBooks, setTotalBooks] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // State management
  const [books, setBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [stats, setStats] = useState<BookStats>({
    total: 0,
    available: 0,
    checkedOut: 0,
    overdue: 0,
    categories: 0,
  });

  // Debounced search term for API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Dialog states
  const [showAddBook, setShowAddBook] = useState(false);
  const [showEditBook, setShowEditBook] = useState(false);
  const [showBookDetails, setShowBookDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isUpdatingBook, setIsUpdatingBook] = useState(false);
  const [isDeletingBook, setIsDeletingBook] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form state
  const [newBook, setNewBook] = useState({
    isbn: '',
    accessionNo: '',
    title: '',
    author: '',
    publisher: '',
    category: '',
    subcategory: '',
    location: '',
    totalCopies: 1,
  });

  // Categories (would come from backend in production)
  const categories = [
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

  // Fetch books from API with pagination
  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }

      if (filterCategory && filterCategory !== 'all') {
        params.append('category', filterCategory);
      }

      if (filterStatus === 'available') {
        params.append('available', 'true');
      } else if (filterStatus === 'unavailable') {
        params.append('available', 'false');
      }

      const response = await apiClient.get<any>(
        `/api/books?${params.toString()}`
      );

      if (response.success && response.data) {
        const booksData = Array.isArray(response.data) ? response.data : [];
        setBooks(booksData);

        // Update pagination info from response
        if (response.pagination) {
          setTotalBooks(response.pagination.total || 0);
          setTotalPages(response.pagination.pages || 1);
        }

        // Fetch stats separately for accurate totals (not affected by filters)
        fetchStats();
      } else {
        toast.error('Failed to load books');
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      toast.error('Failed to load books. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    debouncedSearchTerm,
    filterCategory,
    filterStatus,
  ]);

  // Fetch book statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.get<any>('/api/books/stats');
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Fetch books when dependencies change
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, filterCategory, filterStatus]);

  const handleAddBook = async () => {
    if (
      !newBook.accessionNo ||
      !newBook.title ||
      !newBook.author ||
      !newBook.category
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsAddingBook(true);
    try {
      const response = await apiClient.post('/api/books', {
        ...newBook,
        availableCopies: newBook.totalCopies,
      });

      if (response.success) {
        toast.success('Book added successfully!');
        setShowAddBook(false);
        setNewBook({
          isbn: '',
          accessionNo: '',
          title: '',
          author: '',
          publisher: '',
          category: '',
          subcategory: '',
          location: '',
          totalCopies: 1,
        });
        fetchBooks();
      } else {
        toast.error('Failed to add book');
      }
    } catch (error) {
      console.error('Error adding book:', error);
      toast.error('Failed to add book. Please try again.');
    } finally {
      setIsAddingBook(false);
    }
  };

  const handleUpdateBook = async () => {
    if (!selectedBook) {
      return;
    }

    setIsUpdatingBook(true);
    try {
      const response = await apiClient.put(
        `/api/books/${selectedBook.id}`,
        selectedBook
      );

      if (response.success) {
        toast.success('Book updated successfully!');
        setShowEditBook(false);
        setSelectedBook(null);
        fetchBooks();
      } else {
        toast.error('Failed to update book');
      }
    } catch (error) {
      console.error('Error updating book:', error);
      toast.error('Failed to update book. Please try again.');
    } finally {
      setIsUpdatingBook(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) {
      return;
    }

    setIsDeletingBook(true);
    try {
      const response = await apiClient.delete(`/api/books/${selectedBook.id}`);

      if (response.success) {
        toast.success('Book deleted successfully!');
        setShowDeleteConfirm(false);
        setSelectedBook(null);
        fetchBooks();
      } else {
        toast.error('Failed to delete book');
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      toast.error('Failed to delete book. Please try again.');
    } finally {
      setIsDeletingBook(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const csvContent = [
        'Accession No,ISBN,Title,Author,Publisher,Category,Location,Total Copies,Available Copies,Status',
        ...books.map(
          (b) =>
            `${b.accessionNo},${b.isbn || ''},${b.title},${b.author},${b.publisher || ''},${b.category},${b.location || ''},${b.totalCopies},${b.availableCopies},${b.isActive ? 'Active' : 'Inactive'}`
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `books-catalog-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Books exported successfully!');
    } catch (error) {
      toast.error('Failed to export books');
    } finally {
      setIsExporting(false);
    }
  };

  const getAvailabilityBadge = (book: Book) => {
    if (book.availableCopies === 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Unavailable
        </Badge>
      );
    } else if (book.availableCopies < book.totalCopies) {
      return (
        <Badge
          variant="default"
          className="flex items-center gap-1 bg-yellow-500"
        >
          <AlertCircle className="h-3 w-3" />
          {book.availableCopies} Available
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="default"
          className="flex items-center gap-1 bg-green-500"
        >
          <CheckCircle className="h-3 w-3" />
          Available
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`${isMobile ? 'space-y-4' : 'flex items-center justify-between'}`}
      >
        <div>
          <h2
            className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold tracking-tight`}
          >
            Book Catalog
          </h2>
          <p className="text-muted-foreground">
            Manage your library's book collection
          </p>
        </div>
        <div
          className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex items-center space-x-2'}`}
        >
          <Button variant="outline" size="sm" onClick={fetchBooks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isMobile ? '' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ButtonLoading text={isMobile ? '...' : 'Exporting...'} />
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {isMobile ? '' : 'Export'}
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowAddBook(true)}
            className={isMobile ? 'col-span-2' : ''}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Book
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Books</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">In collection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.available}
            </div>
            <p className="text-xs text-muted-foreground">Ready to borrow</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
            <BookMarked className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.checkedOut}
            </div>
            <p className="text-xs text-muted-foreground">Currently borrowed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.overdue}
            </div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Award className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.categories}
            </div>
            <p className="text-xs text-muted-foreground">Different types</p>
          </CardContent>
        </Card>
      </div>

      {/* _Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>_Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`${isMobile ? 'space-y-4' : 'grid gap-4 md:grid-cols-4'}`}
          >
            <div className={isMobile ? '' : 'md:col-span-2'}>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    isMobile
                      ? '_Search books...'
                      : '_Search by title, author, ISBN, or accession number...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className={isMobile ? 'grid grid-cols-2 gap-2' : ''}>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={isMobile ? 'Category' : 'All Categories'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={isMobile ? 'Status' : 'All Status'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="checkedOut">Checked Out</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books Table */}
      <Card>
        <CardHeader>
          <CardTitle>Books ({totalBooks})</CardTitle>
          <CardDescription>
            {searchTerm || filterCategory !== 'all' || filterStatus !== 'all'
              ? `Showing ${totalBooks} books (page ${currentPage} of ${totalPages})`
              : `All books in your collection`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} columns={7} />
          ) : books.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No books found"
              description={
                searchTerm || filterCategory !== 'all'
                  ? 'Try adjusting your _search or filters'
                  : 'Start by adding your first book to the catalog'
              }
              action={
                <Button onClick={() => setShowAddBook(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Book
                </Button>
              }
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Accession No</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="font-mono text-sm">
                        {book.accessionNo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {book.title}
                        {book.isbn && (
                          <div className="text-xs text-muted-foreground">
                            ISBN: {book.isbn}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{book.author}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{book.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {book.location || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>{getAvailabilityBadge(book)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBook(book);
                              setShowBookDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBook(book);
                              setShowEditBook(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBook(book);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && books.length > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="flex items-center gap-2">
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                    <SelectItem value="200">200 per page</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, totalBooks)} of {totalBooks}{' '}
                  books
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Book Dialog */}
      <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Book</DialogTitle>
            <DialogDescription>
              Enter the book details to add it to your catalog
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Accession No *</label>
                <Input
                  value={newBook.accessionNo}
                  onChange={(e) =>
                    setNewBook({ ...newBook, accessionNo: e.target.value })
                  }
                  placeholder="e.g., ACC001"
                />
              </div>
              <div>
                <label className="text-sm font-medium">ISBN</label>
                <Input
                  value={newBook.isbn}
                  onChange={(e) =>
                    setNewBook({ ...newBook, isbn: e.target.value })
                  }
                  placeholder="e.g., 978-3-16-148410-0"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={newBook.title}
                onChange={(e) =>
                  setNewBook({ ...newBook, title: e.target.value })
                }
                placeholder="Enter book title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Author *</label>
                <Input
                  value={newBook.author}
                  onChange={(e) =>
                    setNewBook({ ...newBook, author: e.target.value })
                  }
                  placeholder="Enter author name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Publisher</label>
                <Input
                  value={newBook.publisher}
                  onChange={(e) =>
                    setNewBook({ ...newBook, publisher: e.target.value })
                  }
                  placeholder="Enter publisher"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category *</label>
                <Select
                  value={newBook.category}
                  onValueChange={(value) =>
                    setNewBook({ ...newBook, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input
                  value={newBook.location}
                  onChange={(e) =>
                    setNewBook({ ...newBook, location: e.target.value })
                  }
                  placeholder="e.g., Shelf A-5"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Total Copies</label>
              <Input
                type="number"
                min="1"
                value={newBook.totalCopies}
                onChange={(e) =>
                  setNewBook({
                    ...newBook,
                    totalCopies: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBook(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBook} disabled={isAddingBook}>
              {isAddingBook ? <ButtonLoading text="Adding..." /> : 'Add Book'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Book Dialog */}
      <Dialog open={showEditBook} onOpenChange={setShowEditBook}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Book</DialogTitle>
            <DialogDescription>Update the book details</DialogDescription>
          </DialogHeader>
          {selectedBook && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Accession No</label>
                  <Input
                    value={selectedBook.accessionNo}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        accessionNo: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ISBN</label>
                  <Input
                    value={selectedBook.isbn || ''}
                    onChange={(e) =>
                      setSelectedBook({ ...selectedBook, isbn: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={selectedBook.title}
                  onChange={(e) =>
                    setSelectedBook({ ...selectedBook, title: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Author</label>
                  <Input
                    value={selectedBook.author}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        author: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Publisher</label>
                  <Input
                    value={selectedBook.publisher || ''}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        publisher: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={selectedBook.category}
                    onValueChange={(value) =>
                      setSelectedBook({ ...selectedBook, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={selectedBook.location || ''}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Total Copies</label>
                  <Input
                    type="number"
                    min="1"
                    value={selectedBook.totalCopies}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        totalCopies: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Available Copies
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={selectedBook.totalCopies}
                    value={selectedBook.availableCopies}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        availableCopies: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBook(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBook} disabled={isUpdatingBook}>
              {isUpdatingBook ? (
                <ButtonLoading text="Updating..." />
              ) : (
                'Update Book'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Book</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedBook?.title}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBook}
              disabled={isDeletingBook}
            >
              {isDeletingBook ? <ButtonLoading text="Deleting..." /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Details Dialog */}
      <Dialog open={showBookDetails} onOpenChange={setShowBookDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book Details</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Accession Number
                  </label>
                  <p className="font-mono">{selectedBook.accessionNo}</p>
                </div>
                {selectedBook.isbn && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      ISBN
                    </label>
                    <p className="font-mono">{selectedBook.isbn}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Title
                </label>
                <p className="text-lg font-semibold">{selectedBook.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Author
                  </label>
                  <p>{selectedBook.author}</p>
                </div>
                {selectedBook.publisher && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Publisher
                    </label>
                    <p>{selectedBook.publisher}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Category
                  </label>
                  <p>{selectedBook.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Location
                  </label>
                  <p>{selectedBook.location || 'Not specified'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Total Copies
                  </label>
                  <p className="text-2xl font-bold">
                    {selectedBook.totalCopies}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Available
                  </label>
                  <p className="text-2xl font-bold text-green-600">
                    {selectedBook.availableCopies}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Checked Out
                  </label>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedBook.totalCopies - selectedBook.availableCopies}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Added on{' '}
                  {new Date(selectedBook.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowBookDetails(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BookCatalog;
