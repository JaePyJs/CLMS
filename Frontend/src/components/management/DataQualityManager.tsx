import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle,
  Edit,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';

interface Book {
  id: string;
  accession_no: string;
  title: string;
  author: string;
  category: string;
  isbn?: string;
  publisher?: string;
  needs_review: boolean;
  import_notes?: string;
  created_at: string;
}

export default function DataQualityManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'needs_review' | 'temp_barcode'
  >('needs_review');
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    tempBarcodes: 0,
    complete: 0,
  });

  useEffect(() => {
    loadBooks();
    loadStats();
  }, [filterType]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType === 'needs_review') params.append('needs_review', 'true');
      if (filterType === 'temp_barcode') params.append('temp_barcode', 'true');

      const response = await apiClient.get<Book[]>(
        `/api/books/quality-check?${params.toString()}`
      );
      if (response.success && response.data) {
        setBooks(response.data);
      }
    } catch (error) {
      toast.error('Failed to load books');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get<{
        total: number;
        needsReview: number;
        tempBarcodes: number;
        complete: number;
      }>('/api/books/quality-stats');
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats', error);
    }
  };

  const handleSaveEdit = async (book: Book) => {
    try {
      const response = await apiClient.put(`/api/books/${book.id}`, book);
      if (response.success) {
        toast.success('Book updated successfully');
        setEditingBook(null);
        loadBooks();
        loadStats();
      } else {
        toast.error('Failed to update book');
      }
    } catch (error) {
      toast.error('Error updating book');
      console.error(error);
    }
  };

  const handleMarkAsComplete = async (bookId: string) => {
    try {
      const response = await apiClient.patch(
        `/api/books/${bookId}/mark-reviewed`
      );
      if (response.success) {
        toast.success('Book marked as reviewed');
        loadBooks();
        loadStats();
      }
    } catch (error) {
      toast.error('Failed to mark book as reviewed');
    }
  };

  const handleExportIncomplete = async () => {
    try {
      toast.info('Generating export...');
      window.open('/api/books/export-incomplete?format=csv', '_blank');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.accession_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Data Quality Manager
          </h2>
          <p className="text-muted-foreground">
            Review and fix incomplete book records
          </p>
        </div>
        <Button onClick={handleExportIncomplete} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Incomplete
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Books</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.needsReview}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temp Barcodes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.tempBarcodes}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complete</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.complete}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'needs_review' ? 'default' : 'outline'}
                onClick={() => setFilterType('needs_review')}
              >
                <Filter className="h-4 w-4 mr-2" />
                Needs Review
              </Button>
              <Button
                variant={filterType === 'temp_barcode' ? 'default' : 'outline'}
                onClick={() => setFilterType('temp_barcode')}
              >
                Temp Barcodes
              </Button>
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                All
              </Button>
              <Button variant="ghost" onClick={loadBooks}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredBooks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No books found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBooks.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell className="font-mono text-sm">
                      {book.accession_no.startsWith('TEMP-') ? (
                        <Badge variant="destructive">TEMP</Badge>
                      ) : (
                        book.accession_no
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>{book.category}</TableCell>
                    <TableCell>
                      {book.needs_review ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-700"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Review
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-700"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {book.import_notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingBook(book)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Book Details</DialogTitle>
                              <DialogDescription>
                                Update incomplete or incorrect information
                              </DialogDescription>
                            </DialogHeader>
                            {editingBook && (
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="barcode">
                                    Barcode / Accession Number
                                  </Label>
                                  <Input
                                    id="barcode"
                                    value={editingBook.accession_no}
                                    onChange={(e) =>
                                      setEditingBook({
                                        ...editingBook,
                                        accession_no: e.target.value,
                                      })
                                    }
                                    placeholder="Enter permanent barcode"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="title">Title</Label>
                                  <Input
                                    id="title"
                                    value={editingBook.title}
                                    onChange={(e) =>
                                      setEditingBook({
                                        ...editingBook,
                                        title: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="author">Author</Label>
                                    <Input
                                      id="author"
                                      value={editingBook.author}
                                      onChange={(e) =>
                                        setEditingBook({
                                          ...editingBook,
                                          author: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Input
                                      id="category"
                                      value={editingBook.category}
                                      onChange={(e) =>
                                        setEditingBook({
                                          ...editingBook,
                                          category: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="isbn">ISBN</Label>
                                    <Input
                                      id="isbn"
                                      value={editingBook.isbn || ''}
                                      onChange={(e) =>
                                        setEditingBook({
                                          ...editingBook,
                                          isbn: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="publisher">Publisher</Label>
                                    <Input
                                      id="publisher"
                                      value={editingBook.publisher || ''}
                                      onChange={(e) =>
                                        setEditingBook({
                                          ...editingBook,
                                          publisher: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="notes">Import Notes</Label>
                                  <Textarea
                                    id="notes"
                                    value={editingBook.import_notes || ''}
                                    onChange={(e) =>
                                      setEditingBook({
                                        ...editingBook,
                                        import_notes: e.target.value,
                                      })
                                    }
                                    rows={3}
                                    disabled
                                  />
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setEditingBook(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() =>
                                  editingBook && handleSaveEdit(editingBook)
                                }
                              >
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {book.needs_review && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsComplete(book.id)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
