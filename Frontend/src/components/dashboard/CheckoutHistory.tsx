import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  section?: string;
}

interface Book {
  id: string;
  accessionNo: string;
  title: string;
  author: string;
  category: string;
}

interface Checkout {
  id: string;
  bookId: string;
  studentId: string;
  checkoutDate: string;
  dueDate: string;
  returnDate?: string;
  status: string;
  overdueDays: number;
  fineAmount: string;
  book: Book;
  student: Student;
}

interface Stats {
  activeCheckouts: number;
  overdueBooks: number;
  totalFines: number;
  returnedToday: number;
}

// Raw API response type
interface RawCheckoutItem {
  id: string;
  bookId?: string;
  studentId?: string;
  checkoutDate?: string;
  borrowedAt?: string;
  dueDate?: string;
  due_date?: string;
  returnDate?: string;
  returnedAt?: string;
  status?: string;
  overdueDays?: number;
  fineAmount?: string | number;
  material_type?: string;
  book?: {
    id?: string;
    accessionNo?: string;
    accession_no?: string;
    isbn?: string;
    title?: string;
    author?: string;
    category?: string;
  };
  student?: {
    id?: string;
    studentId?: string;
    student_id?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    gradeLevel?: string;
    grade_level?: string;
    section?: string;
    name?: string;
  };
}

export default function CheckoutHistory() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [filteredCheckouts, setFilteredCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState<Stats>({
    activeCheckouts: 0,
    overdueBooks: 0,
    totalFines: 0,
    returnedToday: 0,
  });

  // Calculate statistics
  const calculateStats = useCallback((data: Checkout[]) => {
    const active = (data || []).filter((c) => c?.status === 'ACTIVE').length;
    const overdue = (data || []).filter(
      (c) => Number(c?.overdueDays) > 0 && c?.status === 'ACTIVE'
    ).length;
    const totalFines = (data || []).reduce(
      (sum, c) => sum + parseFloat(String(c?.fineAmount ?? '0')),
      0
    );
    const today = new Date().toDateString();
    const returnedToday = data.filter(
      (c) => c.returnDate && new Date(c.returnDate).toDateString() === today
    ).length;

    setStats({
      activeCheckouts: active,
      overdueBooks: overdue,
      totalFines,
      returnedToday,
    });
  }, []);

  // Fetch checkouts - merges library checkouts with attendance book activities
  const fetchCheckouts = useCallback(
    async (status?: string) => {
      setLoading(true);
      try {
        // Build query params
        const params = new URLSearchParams();
        if (status) params.append('status', status);

        // Fetch both library checkouts and attendance book activities in parallel
        const [libraryResponse, attendanceResponse] = await Promise.all([
          apiClient.get(`/api/enhanced-library/history?${params.toString()}`),
          apiClient.get('/api/attendance-export/book-activities'),
        ]);

        let libraryData: Checkout[] = [];
        let attendanceData: Checkout[] = [];

        // Process library checkouts
        if (libraryResponse.success && Array.isArray(libraryResponse.data)) {
          libraryData = libraryResponse.data.map((item: RawCheckoutItem) => ({
            id: item.id,
            bookId: item.bookId || item.book?.id || '',
            studentId: item.studentId || item.student?.id || '',
            checkoutDate: item.checkoutDate || item.borrowedAt || '',
            dueDate: item.dueDate || '',
            returnDate: item.returnDate || item.returnedAt,
            status: item.status || 'ACTIVE',
            overdueDays: item.overdueDays || 0,
            fineAmount: String(item.fineAmount || '0'),
            book: {
              id: item.book?.id || '',
              accessionNo:
                item.book?.accessionNo || item.book?.accession_no || '',
              title: item.book?.title || 'Unknown Title',
              author: item.book?.author || 'Unknown Author',
              category: item.book?.category || 'General',
            },
            student: {
              id: item.student?.id || '',
              studentId:
                item.student?.studentId || item.student?.student_id || '',
              firstName:
                item.student?.firstName || item.student?.first_name || '',
              lastName: item.student?.lastName || item.student?.last_name || '',
              gradeLevel:
                item.student?.gradeLevel || item.student?.grade_level || '',
              section: item.student?.section || '',
            },
          }));
        }

        // Process attendance book activities
        if (
          attendanceResponse.success &&
          Array.isArray(attendanceResponse.data)
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attendanceData = attendanceResponse.data.map((item: any) => ({
            id: `att-${item.id}`, // Prefix to avoid ID collision
            bookId: '',
            studentId: item.student?.id || '',
            checkoutDate: item.checkoutDate || '',
            dueDate: item.dueDate || '',
            returnDate: item.returnDate || null,
            status: item.returnDate ? 'RETURNED' : 'ACTIVE',
            overdueDays: 0,
            fineAmount: String(item.fineAmount || '0'),
            book: {
              id: '',
              accessionNo: '',
              title: item.bookTitle || 'Unknown Title',
              author: item.bookAuthor || 'Unknown Author',
              category: 'Attendance Import',
            },
            student: {
              id: item.student?.id || '',
              studentId: item.student?.studentId || '',
              firstName: item.student?.firstName || '',
              lastName: item.student?.lastName || '',
              gradeLevel: item.student?.gradeLevel || '',
              section: item.student?.section || '',
            },
          }));
        }

        // Merge and deduplicate by ID, sort by checkout date
        const allData = [...libraryData, ...attendanceData].sort((a, b) => {
          const dateA = new Date(a.checkoutDate).getTime() || 0;
          const dateB = new Date(b.checkoutDate).getTime() || 0;
          return dateB - dateA; // Most recent first
        });

        // Apply status filter if provided
        const filteredData = status
          ? allData.filter((c) => c.status === status)
          : allData;

        setCheckouts(filteredData);
        setFilteredCheckouts(filteredData);
        calculateStats(filteredData);
      } catch (error: unknown) {
        console.error('Failed to fetch checkout history:', error);
        toast.error('Failed to load checkout history');
        setCheckouts([]);
      } finally {
        setLoading(false);
      }
    },
    [calculateStats]
  );

  // Fetch overdue books
  const fetchOverdueBooks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/enhanced-library/overdue');

      // Type assertion for overdue response
      const overdueData = response.data as { items?: unknown[] } | null;
      if (response.success && overdueData && Array.isArray(overdueData.items)) {
        // Transform API data
        const data: Checkout[] = (overdueData.items as RawCheckoutItem[]).map(
          (item: RawCheckoutItem) => ({
            id: item.id,
            bookId: item.book?.id || '',
            studentId: item.student?.id || '',
            checkoutDate: item.borrowedAt || '',
            dueDate: item.due_date || '',
            returnDate: undefined,
            status: 'OVERDUE', // Force status for display
            overdueDays: item.overdueDays || 0,
            fineAmount: String(item.fineAmount || '0'),
            book: {
              id: item.book?.id || '',
              accessionNo: item.book?.accessionNo || item.book?.isbn || '', // Fallback
              title: item.book?.title || '',
              author: item.book?.author || '',
              category: item.material_type || 'General',
            },
            student: {
              id: item.student?.id || '',
              studentId: item.student?.student_id || '',
              firstName: item.student?.name?.split(' ')[0] || '',
              lastName: item.student?.name?.split(' ').slice(1).join(' ') || '',
              gradeLevel: item.student?.grade_level || '',
              section: item.student?.section || '',
            },
          })
        );

        setCheckouts(data);
        setFilteredCheckouts(data);
        calculateStats(data);
      }
    } catch (error: unknown) {
      console.error('Failed to fetch overdue books:', error);
      toast.error('Failed to load overdue books');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // Fetch imported book activities from Google Sheets
  const fetchImportedBooks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        '/api/attendance-export/book-activities'
      );

      if (response.success && Array.isArray(response.data)) {
        // Transform imported data to Checkout interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: Checkout[] = response.data.map((item: any) => ({
          id: item.id,
          bookId: '', // No book ID for imported data
          studentId: item.student?.id || '',
          checkoutDate: item.checkoutDate || '',
          dueDate: '', // Not available in import
          returnDate: item.returnDate,
          status: item.status || 'IMPORTED',
          overdueDays: 0,
          fineAmount: '0',
          book: {
            id: '',
            accessionNo: '',
            title: item.bookTitle || 'Unknown Title',
            author: item.bookAuthor || 'Unknown Author',
            category: 'Imported',
          },
          student: {
            id: item.student?.id || '',
            studentId: item.student?.studentId || '',
            firstName: item.student?.firstName || '',
            lastName: item.student?.lastName || '',
            gradeLevel: item.student?.gradeLevel || '',
            section: item.student?.section || '',
          },
        }));

        setCheckouts(data);
        setFilteredCheckouts(data);
        calculateStats(data);
      } else {
        setCheckouts([]);
        setFilteredCheckouts([]);
        calculateStats([]);
      }
    } catch (error: unknown) {
      console.error('Failed to fetch imported books:', error);
      toast.error('Failed to load imported book activities');
      setCheckouts([]);
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // _Search and filter
  useEffect(() => {
    let filtered = checkouts;

    // Apply _search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const title = String(c?.book?.title || '').toLowerCase();
        const author = String(c?.book?.author || '').toLowerCase();
        const first = String(c?.student?.firstName || '').toLowerCase();
        const last = String(c?.student?.lastName || '').toLowerCase();
        const sid = String(c?.student?.studentId || '').toLowerCase();
        return (
          (title && title.includes(q)) ||
          (author && author.includes(q)) ||
          (first && first.includes(q)) ||
          (last && last.includes(q)) ||
          (sid && sid.includes(q))
        );
      });
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Apply date range filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      filtered = filtered.filter((c) => {
        const d = new Date(c.checkoutDate);
        if (dateFilter === 'TODAY') {
          return d.toDateString() === now.toDateString();
        }
        if (dateFilter === 'THIS_WEEK') {
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          return d >= start && d <= end;
        }
        if (dateFilter === 'LAST_30') {
          const start = new Date(now);
          start.setDate(now.getDate() - 30);
          return d >= start && d <= now;
        }
        return true;
      });
    }

    setFilteredCheckouts(filtered);
    calculateStats(filtered);
  }, [searchQuery, statusFilter, dateFilter, checkouts]);

  // Initial load
  useEffect(() => {
    fetchCheckouts();
  }, [fetchCheckouts]);

  // Tab change handler
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchQuery('');
    setStatusFilter('ALL');

    if (value === 'all') {
      fetchCheckouts();
    } else if (value === 'active') {
      fetchCheckouts('ACTIVE');
    } else if (value === 'overdue') {
      fetchOverdueBooks();
    } else if (value === 'returned') {
      fetchCheckouts('RETURNED');
    } else if (value === 'imported') {
      fetchImportedBooks();
    }
  };

  // Export to CSV
  const handleExport = () => {
    try {
      const csv = [
        [
          'Book Title',
          'Author',
          'Student',
          'Student ID',
          'Checkout Date',
          'Due Date',
          'Return Date',
          'Status',
          'Overdue Days',
          'Fine',
        ],
        ...filteredCheckouts.map((c) => [
          c.book.title,
          c.book.author,
          `${c.student.firstName} ${c.student.lastName}`,
          c.student.studentId,
          new Date(c.checkoutDate).toLocaleDateString(),
          new Date(c.dueDate).toLocaleDateString(),
          c.returnDate
            ? new Date(c.returnDate).toLocaleDateString()
            : 'Not Returned',
          c.status,
          c.overdueDays,
          `₱${parseFloat(c.fineAmount).toFixed(2)}`,
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkout-history-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export completed!');
    } catch {
      toast.error('Failed to export data');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>;
      case 'RETURNED':
        return <Badge variant="secondary">Returned</Badge>;
      case 'OVERDUE':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Checkout History
          </h2>
          <p className="text-muted-foreground">
            View and manage book checkout records
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleTabChange(activeTab)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            disabled={filteredCheckouts.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Checkouts
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCheckouts}</div>
            <p className="text-xs text-muted-foreground">
              Currently borrowed books
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Books</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.overdueBooks}
            </div>
            <p className="text-xs text-muted-foreground">Books past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fines</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₱{stats.totalFines.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding fines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Returned Today
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.returnedToday}</div>
            <p className="text-xs text-muted-foreground">
              Books returned today
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Checkouts</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
          <TabsTrigger value="imported">Imported</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by book title, author, or student..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger
                    className="w-full sm:w-[180px]"
                    disabled={loading}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="RETURNED">Returned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger
                    className="w-full sm:w-[180px]"
                    disabled={loading}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Dates</SelectItem>
                    <SelectItem value="TODAY">Today</SelectItem>
                    <SelectItem value="THIS_WEEK">This Week</SelectItem>
                    <SelectItem value="LAST_30">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setDateFilter('ALL');
                  }}
                  disabled={loading}
                >
                  Clear Filters
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">
                  Quick date:
                </span>
                <Button
                  size="sm"
                  variant={dateFilter === 'TODAY' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('TODAY')}
                  disabled={loading}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'THIS_WEEK' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('THIS_WEEK')}
                  disabled={loading}
                >
                  This Week
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'LAST_30' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('LAST_30')}
                  disabled={loading}
                >
                  Last 30 Days
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCheckouts.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No checkout records found
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Book</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Checkout Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Fine</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCheckouts.map((checkout) => (
                        <TableRow key={checkout.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {checkout.book.title}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {checkout.book.author}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {checkout.book.accessionNo}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {checkout.student.firstName}{' '}
                                {checkout.student.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {checkout.student.studentId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {checkout.student.gradeLevel}{' '}
                                {checkout.student.section}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(
                                checkout.checkoutDate
                              ).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(checkout.dueDate).toLocaleDateString()}
                            </div>
                            {checkout.overdueDays > 0 &&
                              checkout.status === 'ACTIVE' && (
                                <div className="text-xs text-destructive font-medium mt-1">
                                  {checkout.overdueDays} days overdue
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                            {checkout.returnDate ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {new Date(
                                  checkout.returnDate
                                ).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(checkout.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            {parseFloat(checkout.fineAmount) > 0 ? (
                              <span className="font-medium text-destructive">
                                ₱{parseFloat(checkout.fineAmount).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {filteredCheckouts.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Showing {filteredCheckouts.length} of {checkouts.length}{' '}
                  records
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
