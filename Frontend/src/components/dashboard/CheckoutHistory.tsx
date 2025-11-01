import { useState, useEffect } from 'react';
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
import { BookOpen, Calendar, AlertCircle, Clock, CheckCircle, Search, Filter, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

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

export default function CheckoutHistory() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [filteredCheckouts, setFilteredCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState<Stats>({
    activeCheckouts: 0,
    overdueBooks: 0,
    totalFines: 0,
    returnedToday: 0,
  });

  // Fetch checkouts
  const fetchCheckouts = async (status?: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clms_token');
      const params = new URLSearchParams();
      if (status && status !== 'ALL') {
        params.append('status', status ?? '');
      }
      
      const response = await axios.get(
        `${API_BASE_URL}/books/checkouts/all${params.toString() ? `?${params.toString()}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const data = response.data.data.checkouts || [];
        setCheckouts(data);
        setFilteredCheckouts(data);
        calculateStats(data);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch checkouts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch overdue books
  const fetchOverdueBooks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clms_token');
      const response = await axios.get(
        `${API_BASE_URL}/books/checkouts/overdue`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const data = response.data.data.overdueBooks || [];
        setCheckouts(data);
        setFilteredCheckouts(data);
        calculateStats(data);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch overdue books');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (data: Checkout[]) => {
    const active = data.filter(c => c.status === 'ACTIVE').length;
    const overdue = data.filter(c => c.overdueDays > 0 && c.status === 'ACTIVE').length;
    const totalFines = data.reduce((sum, c) => sum + parseFloat(c.fineAmount), 0);
    const today = new Date().toDateString();
    const returnedToday = data.filter(
      c => c.returnDate && new Date(c.returnDate).toDateString() === today
    ).length;

    setStats({
      activeCheckouts: active,
      overdueBooks: overdue,
      totalFines,
      returnedToday,
    });
  };

  // Search and filter
  useEffect(() => {
    let filtered = checkouts;

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(
        c =>
          c.book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    setFilteredCheckouts(filtered);
  }, [searchQuery, statusFilter, checkouts]);

  // Initial load
  useEffect(() => {
    fetchCheckouts();
  }, []);

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
    }
  };

  // Export to CSV
  const handleExport = () => {
    try {
      const csv = [
        ['Book Title', 'Author', 'Student', 'Student ID', 'Checkout Date', 'Due Date', 'Return Date', 'Status', 'Overdue Days', 'Fine'],
        ...filteredCheckouts.map(c => [
          c.book.title,
          c.book.author,
          `${c.student.firstName} ${c.student.lastName}`,
          c.student.studentId,
          new Date(c.checkoutDate).toLocaleDateString(),
          new Date(c.dueDate).toLocaleDateString(),
          c.returnDate ? new Date(c.returnDate).toLocaleDateString() : 'Not Returned',
          c.status,
          c.overdueDays,
          `₱${parseFloat(c.fineAmount).toFixed(2)}`,
        ]),
      ]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkout-history-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export completed!');
    } catch (error) {
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
          <h2 className="text-3xl font-bold tracking-tight">Checkout History</h2>
          <p className="text-muted-foreground">View and manage book checkout records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleTabChange(activeTab)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} disabled={filteredCheckouts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Checkouts</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCheckouts}</div>
            <p className="text-xs text-muted-foreground">Currently borrowed books</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Books</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueBooks}</div>
            <p className="text-xs text-muted-foreground">Books past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fines</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{stats.totalFines.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Outstanding fines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returned Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.returnedToday}</div>
            <p className="text-xs text-muted-foreground">Books returned today</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Checkouts</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
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
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="RETURNED">Returned</SelectItem>
                  </SelectContent>
                </Select>
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
                  <p className="text-muted-foreground">No checkout records found</p>
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
                              <div className="font-medium">{checkout.book.title}</div>
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
                                {checkout.student.firstName} {checkout.student.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {checkout.student.studentId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {checkout.student.gradeLevel} {checkout.student.section}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(checkout.checkoutDate).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(checkout.dueDate).toLocaleDateString()}
                            </div>
                            {checkout.overdueDays > 0 && checkout.status === 'ACTIVE' && (
                              <div className="text-xs text-destructive font-medium mt-1">
                                {checkout.overdueDays} days overdue
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {checkout.returnDate ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {new Date(checkout.returnDate).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(checkout.status)}</TableCell>
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
                  Showing {filteredCheckouts.length} of {checkouts.length} records
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
