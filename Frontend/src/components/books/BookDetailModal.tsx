import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BookOpen,
  Calendar,
  User,
  RefreshCw,
  Building2,
  ScanLine,
  Layers,
  FileText,
  DollarSign,
  Copy,
} from 'lucide-react';

interface Book {
  id: string;
  accessionNo?: string;
  isbn?: string;
  title: string;
  author: string;
  category?: string;
  publisher?: string;
  publication?: string; // City of publication
  yearPublished?: number;
  edition?: string;
  pages?: string;
  costPrice?: number;
  remarks?: string;
  location?: string; // Call number
  totalCopies?: number;
  availableCopies?: number;
  status?: string;
}

interface CheckoutRecord {
  id: string;
  studentName: string;
  studentId: string;
  checkoutDate: string;
  dueDate: string;
  returnDate?: string;
  status: string;
}

interface BookDetailModalProps {
  book: Book | null;
  open: boolean;
  onClose: () => void;
}

export function BookDetailModal({ book, open, onClose }: BookDetailModalProps) {
  const [checkoutHistory, setCheckoutHistory] = useState<CheckoutRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (book) {
      fetchCheckoutHistory(book.id);
    }
  }, [book]);

  const fetchCheckoutHistory = async (bookId: string) => {
    setHistoryLoading(true);
    try {
      const response = await apiClient.get(
        `/api/enhanced-library/history?bookId=${bookId}`
      );
      if (response.success && Array.isArray(response.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCheckoutHistory(
          response.data.map((item: any) => ({
            id: item.id,
            studentName:
              `${item.student?.firstName || item.student?.first_name || ''} ${item.student?.lastName || item.student?.last_name || ''}`.trim(),
            studentId:
              item.student?.studentId || item.student?.student_id || '',
            checkoutDate: item.checkoutDate || item.borrowedAt || '',
            dueDate: item.dueDate || '',
            returnDate: item.returnDate || item.returnedAt,
            status: item.status || 'UNKNOWN',
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch checkout history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Book Details
          </DialogTitle>
          <DialogDescription>
            View book information and checkout history
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">
              Checkout History
              {checkoutHistory.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {checkoutHistory.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab - Enhanced View */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Header Section - Title & Key Info */}
            <div className="border rounded-lg p-4 bg-gradient-to-r from-primary/5 to-transparent">
              <h2 className="text-xl font-bold leading-tight">{book.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {book.author || 'Unknown Author'}
                </span>
                {book.yearPublished && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {book.yearPublished}
                    </span>
                  </>
                )}
                {book.category && (
                  <Badge variant="secondary" className="ml-2">
                    {book.category}
                  </Badge>
                )}
              </div>
            </div>

            {/* Publication & Library Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Publication Info Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Publication Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Publisher
                    </Label>
                    <p
                      className="font-medium truncate"
                      title={book.publisher || 'N/A'}
                    >
                      {book.publisher || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Publication City
                    </Label>
                    <p className="font-medium">{book.publication || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Edition
                    </Label>
                    <p className="font-medium">{book.edition || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      ISBN
                    </Label>
                    <p className="font-medium font-mono text-xs">
                      {book.isbn || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Library Info Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ScanLine className="h-4 w-4 text-primary" />
                    Library Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Accession No
                    </Label>
                    <p className="font-medium font-mono">
                      {book.accessionNo || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Call Number
                    </Label>
                    <p className="font-medium font-mono">
                      {book.location || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Copies
                    </Label>
                    <p className="font-medium flex items-center gap-1">
                      <Copy className="h-3.5 w-3.5" />
                      {book.availableCopies ?? 0} / {book.totalCopies ?? 0}{' '}
                      available
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Badge
                      variant={
                        book.status === 'AVAILABLE' ? 'default' : 'secondary'
                      }
                      className={
                        book.status === 'AVAILABLE' ? 'bg-green-500/90' : ''
                      }
                    >
                      {book.status || 'Unknown'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Info Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Pages
                  </Label>
                  <p className="font-medium">{book.pages || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Price
                  </Label>
                  <p className="font-medium">
                    {book.costPrice !== undefined && book.costPrice !== null
                      ? `₱${book.costPrice.toLocaleString()}`
                      : 'N/A'}
                  </p>
                </div>
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">
                    Remarks
                  </Label>
                  <p className="font-medium text-muted-foreground">
                    {book.remarks || 'No remarks'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              To edit book details, use the Edit button in the Books table
            </p>
          </TabsContent>

          {/* Checkout History Tab */}
          <TabsContent value="history" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium">Recent Checkouts</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => book && fetchCheckoutHistory(book.id)}
                disabled={historyLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${historyLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : checkoutHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2" />
                <p>No checkout history found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Checkout Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Return Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkoutHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {record.studentName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {record.studentId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.checkoutDate
                            ? new Date(record.checkoutDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {record.dueDate
                            ? new Date(record.dueDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {record.returnDate
                            ? new Date(record.returnDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === 'RETURNED'
                                ? 'secondary'
                                : record.status === 'OVERDUE'
                                  ? 'destructive'
                                  : 'default'
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default BookDetailModal;
