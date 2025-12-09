import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Book,
  Search,
  RefreshCw,
  CheckCircle,
  Mail,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { enhancedLibraryApi } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

interface RawOverdueLoan {
  id: string;
  studentId?: string;
  student?: {
    studentId?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
  };
  book?: {
    id?: string;
    title?: string;
  };
  bookTitle?: string;
  bookId?: string;
  materialType?: string;
  borrowedAt?: string;
  borrowedDate?: string;
  dueDate?: string;
  overdueDays?: number;
  fineAmount?: number;
  finePerDay?: number;
}

interface OverdueDataResponse {
  items: RawOverdueLoan[];
}

interface ApiErrorResponse {
  error?: string | { message?: string };
}

interface OverdueLoan {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  bookTitle: string;
  bookId: string;
  materialType: string;
  borrowedDate: string;
  dueDate: string;
  overdueDays: number;
  fineAmount: number;
  finePerDay: number;
  status: 'overdue' | 'returned' | 'paid';
  contactInfo?: {
    email: string;
    phone?: string;
  };
}

interface OverdueStats {
  totalOverdue: number;
  totalFines: number;
  primaryFines: number;
  elementaryFines: number;
  booksOverdue: number;
  studentsWithFines: number;
}

//

export function OverdueManagement() {
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([]);
  const [stats, setStats] = useState<OverdueStats>({
    totalOverdue: 0,
    totalFines: 0,
    primaryFines: 0,
    elementaryFines: 0,
    booksOverdue: 0,
    studentsWithFines: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(
    null
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const devSampleItems: OverdueLoan[] = [
    {
      id: 'LOAN-1',
      studentId: 'S-0001',
      studentName: 'Alice Example',
      gradeLevel: 'Grade 5',
      bookTitle: 'Sample Book',
      bookId: 'BOOK-1',
      materialType: 'Fiction',
      borrowedDate: new Date().toISOString(),
      dueDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      overdueDays: 3,
      fineAmount: 15,
      finePerDay: 5,
      status: 'overdue',
    },
  ];

  const fetchOverdueLoans = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await enhancedLibraryApi.getOverdueLoans({ signal });

      if (response.success && response.data) {
        const dd = (response.data || {}) as OverdueDataResponse;
        const rawItems = dd.items || [];
        const items: OverdueLoan[] = rawItems.map((r) => ({
          id: String(r.id),
          studentId: String(r.student?.studentId || r.studentId || ''),
          studentName: String(
            r.student
              ? `${r.student.name || `${r.student.firstName} ${r.student.lastName}`}`
              : ''
          ),
          gradeLevel: String(r.student?.gradeLevel || ''),
          bookTitle: String(r.book?.title || r.bookTitle || ''),
          bookId: String(r.book?.id || r.bookId || ''),
          materialType: String(r.materialType || ''),
          borrowedDate: String(r.borrowedAt || r.borrowedDate || ''),
          dueDate: String(r.dueDate || ''),
          overdueDays: Number(r.overdueDays || 0),
          fineAmount: Number(r.fineAmount || 0),
          finePerDay: Number(r.finePerDay || 0),
          status: 'overdue',
          contactInfo: undefined,
        }));
        const isDevApp =
          import.meta.env.DEV ||
          String(import.meta.env.VITE_APP_NAME || '')
            .toLowerCase()
            .includes('development');
        const useItems: OverdueLoan[] =
          items.length === 0 && isDevApp ? devSampleItems : items;
        setOverdueLoans(useItems);
        const totalFines = useItems.reduce<number>(
          (sum, i) => sum + Number(i.fineAmount || 0),
          0
        );
        const uniqueStudents = new Set(useItems.map((i) => String(i.studentId)))
          .size;
        setStats({
          totalOverdue: useItems.length,
          totalFines,
          primaryFines: 0,
          elementaryFines: 0,
          booksOverdue: useItems.length,
          studentsWithFines: uniqueStudents,
        });
        setLastRefreshedAt(Date.now());
      } else {
        const isDevApp =
          import.meta.env.DEV ||
          String(import.meta.env.VITE_APP_NAME || '')
            .toLowerCase()
            .includes('development');
        if (!isDevApp) {
          toast.error('Failed to fetch overdue loans');
        }
        if (isDevApp) {
          setOverdueLoans(devSampleItems);
          setStats({
            totalOverdue: devSampleItems.length,
            totalFines: devSampleItems.reduce(
              (s, i) => s + Number(i.fineAmount || 0),
              0
            ),
            primaryFines: 0,
            elementaryFines: 0,
            booksOverdue: devSampleItems.length,
            studentsWithFines: new Set(
              devSampleItems.map((i) => String(i.studentId))
            ).size,
          });
          setLastRefreshedAt(Date.now());
        }
      }
    } catch (error) {
      console.error('Error fetching overdue loans:', error);
      const isDevApp =
        import.meta.env.DEV ||
        String(import.meta.env.VITE_APP_NAME || '')
          .toLowerCase()
          .includes('development');
      if (!isDevApp) {
        toast.error('Error loading overdue data');
      }
      if (isDevApp) {
        setOverdueLoans(devSampleItems);
        setStats({
          totalOverdue: devSampleItems.length,
          totalFines: devSampleItems.reduce(
            (s, i) => s + Number(i.fineAmount || 0),
            0
          ),
          primaryFines: 0,
          elementaryFines: 0,
          booksOverdue: devSampleItems.length,
          studentsWithFines: new Set(
            devSampleItems.map((i) => String(i.studentId))
          ).size,
        });
        setLastRefreshedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const controller = new AbortController();
    const guard = window.setTimeout(() => {
      setIsRefreshing(false);
      setLoading(false);
      toast.error('Overdue refresh timed out');
    }, 6000);
    await fetchOverdueLoans(controller.signal);
    window.clearTimeout(guard);
    setIsRefreshing(false);
    toast.success('Overdue data refreshed');
  };

  const handleReturnBook = async (loanId: string) => {
    try {
      const isDevApp = String(import.meta.env.VITE_APP_NAME || '')
        .toLowerCase()
        .includes('development');
      if (isDevApp) {
        setOverdueLoans((prev) =>
          prev.map((l) => (l.id === loanId ? { ...l, status: 'returned' } : l))
        );
        toast.success('Book returned successfully');
        return;
      }
      const response = await enhancedLibraryApi.returnBooks([loanId]);
      if (response.success) {
        toast.success('Book returned successfully');
        await fetchOverdueLoans();
      } else {
        const errMsg =
          typeof (response as ApiErrorResponse)?.error === 'string'
            ? (response as ApiErrorResponse).error
            : ((response as ApiErrorResponse)?.error as { message?: string })
                ?.message || 'Failed to return book';
        toast.error(String(errMsg));
      }
    } catch (error) {
      console.error('Error returning book:', error);
      toast.error('Error processing return');
    }
  };

  const handlePayFine = async (loanId: string) => {
    setIsProcessingPayment(loanId);
    try {
      const isDevApp = String(import.meta.env.VITE_APP_NAME || '')
        .toLowerCase()
        .includes('development');
      if (isDevApp) {
        setOverdueLoans((prev) =>
          prev.map((l) =>
            l.id === loanId ? { ...l, status: 'paid', fineAmount: 0 } : l
          )
        );
        toast.success('Fine paid successfully');
        return;
      }
      const response = await enhancedLibraryApi.payFine(loanId, 0, 'cash');
      if (response.success) {
        toast.success('Fine paid successfully');
        await fetchOverdueLoans();
      } else {
        const errMsg =
          typeof (response as ApiErrorResponse)?.error === 'string'
            ? (response as ApiErrorResponse).error
            : ((response as ApiErrorResponse)?.error as { message?: string })
                ?.message || 'Failed to process payment';
        toast.error(String(errMsg));
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      const msg = (error as Error)?.message || 'Error processing payment';
      toast.error(String(msg));
    } finally {
      setIsProcessingPayment(null);
    }
  };

  const handleToggle = (loanId: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [loanId]: checked }));
  };

  const selectedIds = Object.entries(selected)
    .filter((entry) => Boolean(entry[1]))
    .map((entry) => entry[0]);

  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    for (const l of filteredLoans) {
      next[l.id] = true;
    }
    setSelected(next);
  };

  const handleClearSelection = () => {
    setSelected({});
  };

  const handleBatchReturn = async () => {
    if (selectedIds.length === 0) return;
    try {
      const isDevApp =
        String(import.meta.env.VITE_APP_NAME || '')
          .toLowerCase()
          .includes('development') || import.meta.env.DEV;
      if (isDevApp) {
        setOverdueLoans((prev) =>
          prev.map((l) =>
            selectedIds.includes(l.id) ? { ...l, status: 'returned' } : l
          )
        );
        toast.success(`Returned ${selectedIds.length} item(s)`);
        setSelected({});
        return;
      }
      const res = await enhancedLibraryApi.returnBooks(selectedIds);
      if (res.success) {
        toast.success(`Returned ${selectedIds.length} item(s)`);
        setSelected({});
        await fetchOverdueLoans();
      } else {
        toast.error(
          (res as ApiErrorResponse)?.error?.toString() || 'Batch return failed'
        );
      }
    } catch {
      toast.error('Batch return failed');
    }
  };

  const handleBatchPay = async () => {
    if (selectedIds.length === 0) return;
    try {
      const isDevApp =
        String(import.meta.env.VITE_APP_NAME || '')
          .toLowerCase()
          .includes('development') || import.meta.env.DEV;
      if (isDevApp) {
        setOverdueLoans((prev) =>
          prev.map((l) =>
            selectedIds.includes(l.id)
              ? { ...l, status: 'paid', fineAmount: 0 }
              : l
          )
        );
        toast.success(`Marked paid ${selectedIds.length} item(s)`);
        setSelected({});
        return;
      }
      for (const id of selectedIds) {
        await enhancedLibraryApi.payFine(id, 0, 'cash');
      }
      toast.success(`Marked paid ${selectedIds.length} item(s)`);
      setSelected({});
      await fetchOverdueLoans();
    } catch {
      toast.error('Batch pay failed');
    }
  };

  const handleBatchRemind = async () => {
    if (selectedIds.length === 0) return;
    try {
      const isDevApp =
        String(import.meta.env.VITE_APP_NAME || '')
          .toLowerCase()
          .includes('development') || import.meta.env.DEV;
      if (isDevApp) {
        const count = selectedIds.length;
        toast.success(`Reminded ${count} student(s)`);
        return;
      }
      const byId = new Map<string, string>();
      for (const l of overdueLoans) {
        if (selectedIds.includes(l.id) && l.studentId) {
          byId.set(l.studentId, l.studentId);
        }
      }
      const uniqueStudentIds = Array.from(byId.values());
      let ok = 0;
      for (const sid of uniqueStudentIds) {
        const r = await enhancedLibraryApi.sendOverdueReminder(sid);
        if (r.success) ok++;
      }
      toast.success(`Reminded ${ok} student(s)`);
    } catch {
      toast.error('Batch remind failed');
    }
  };

  const handleSendReminder = async (loanId: string, studentId?: string) => {
    try {
      const sid =
        studentId || overdueLoans.find((l) => l.id === loanId)?.studentId;
      if (!sid) {
        toast.error('Student not found for reminder');
        return;
      }
      const response = await enhancedLibraryApi.sendOverdueReminder(sid);
      if (response.success) {
        toast.success('Reminder sent successfully');
      } else {
        toast.error(response.error || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Error sending reminder');
    }
  };

  const buildReminderText = (loan: OverdueLoan) => {
    const due = loan.dueDate
      ? new Date(loan.dueDate).toLocaleDateString()
      : 'N/A';
    const fine = `₱${Number(loan.fineAmount || 0).toFixed(2)}`;
    const rate = `₱${Number(loan.finePerDay || 0).toFixed(2)}/day`;
    return `Subject: Library Overdue Notice\n\nDear ${loan.studentName || 'Student'},\n\nOur records indicate the book "${loan.bookTitle}" is overdue since ${due}.\nCurrent fine: ${fine} (rate ${rate}). Please return the book as soon as possible to avoid additional charges.\n\nStudent ID: ${loan.studentId}\nGrade: ${loan.gradeLevel}\n\nThank you,\nLibrary`;
  };

  const handleExportOverdue = async () => {
    try {
      const header = [
        'Loan ID',
        'Student',
        'Student ID',
        'Grade',
        'Book Title',
        'Book ID',
        'Material',
        'Borrowed',
        'Due',
        'Overdue Days',
        'Fine',
        'Status',
      ];
      const rows = filteredLoans.map((l) => [
        l.id,
        l.studentName,
        l.studentId,
        l.gradeLevel,
        l.bookTitle,
        l.bookId,
        l.materialType,
        l.borrowedDate ? new Date(l.borrowedDate).toLocaleDateString() : '',
        l.dueDate ? new Date(l.dueDate).toLocaleDateString() : '',
        String(l.overdueDays || 0),
        `₱${Number(l.fineAmount || 0).toFixed(2)}`,
        l.status,
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((v) => String(v).replace(/,/g, ';')).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overdue-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export completed');
    } catch {
      toast.error('Failed to export overdue');
    }
  };

  const filteredLoans = overdueLoans.filter((loan) => {
    const sName = String(loan.studentName || '');
    const sId = String(loan.studentId || '');
    const bTitle = String(loan.bookTitle || '');
    const matchesSearch =
      sName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || loan.status === statusFilter;
    let matchesGrade = true;
    if (gradeFilter !== 'all') {
      if (gradeFilter.startsWith('G')) {
        const num = parseInt(String(loan.gradeLevel).replace(/[^0-9]/g, ''));
        if (gradeFilter === 'G1-3') matchesGrade = num >= 1 && num <= 3;
        else if (gradeFilter === 'G4-6') matchesGrade = num >= 4 && num <= 6;
        else if (gradeFilter === 'G7-10') matchesGrade = num >= 7 && num <= 10;
        else if (gradeFilter === 'G11-12')
          matchesGrade = num >= 11 && num <= 12;
        else matchesGrade = String(loan.gradeLevel) === gradeFilter;
      } else {
        matchesGrade = String(loan.gradeLevel) === gradeFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesGrade;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'returned':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'paid':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getOverdueSeverity = (days: number) => {
    if (days <= 3) return 'text-yellow-600 dark:text-yellow-400';
    if (days <= 7) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('clms_overdue_filters');
      if (saved) {
        const obj = JSON.parse(saved);
        if (typeof obj.searchTerm === 'string') setSearchTerm(obj.searchTerm);
        if (typeof obj.statusFilter === 'string')
          setStatusFilter(obj.statusFilter);
        if (typeof obj.gradeFilter === 'string')
          setGradeFilter(obj.gradeFilter);
      }
    } catch {
      void 0;
    }
    const controller = new AbortController();
    fetchOverdueLoans(controller.signal);
    const interval = setInterval(
      () => fetchOverdueLoans(controller.signal),
      60000
    );
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const obj = { searchTerm, statusFilter, gradeFilter };
    try {
      localStorage.setItem('clms_overdue_filters', JSON.stringify(obj));
    } catch {
      void 0;
    }
  }, [searchTerm, statusFilter, gradeFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Overdue Management
            </CardTitle>
            <CardDescription>
              Grade-based fine management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200">
              Total Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              {stats.totalOverdue}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              books overdue
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Total Fines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              ₱{stats.totalFines.toLocaleString()}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              outstanding fines
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200">
              Primary Fines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              ₱{stats.primaryFines.toLocaleString()}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Grades 1-3 (₱2/day)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Elementary+ Fines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              ₱{stats.elementaryFines.toLocaleString()}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Grades 4-12 (₱5/day)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fine Rate Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Grade-Based Fine Rates
          </CardTitle>
          <CardDescription>
            Current fine structure based on grade level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                Primary Students (Grades 1-3)
              </h3>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ₱2.00 per day
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Lower fine rate for younger students
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                Elementary & Senior High (Grades 4-12)
              </h3>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                ₱5.00 per day
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Standard fine rate for older students
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Overdue Books ({filteredLoans.length})
              </CardTitle>
              <CardDescription>Manage overdue books and fines</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              {isRefreshing && (
                <span className="text-xs text-muted-foreground">
                  Refreshing...
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setGradeFilter('all');
                }}
              >
                Clear Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={isRefreshing}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchReturn}
                disabled={isRefreshing || selectedIds.length === 0}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Return Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchPay}
                disabled={isRefreshing || selectedIds.length === 0}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Pay Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchRemind}
                disabled={isRefreshing || selectedIds.length === 0}
              >
                <Mail className="h-4 w-4 mr-1" />
                Remind Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportOverdue}
                disabled={isRefreshing}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={isRefreshing || selectedIds.length === 0}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by student name, ID, or book title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isRefreshing}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
              disabled={isRefreshing}
            >
              <option value="all">All Status</option>
              <option value="overdue">Overdue</option>
              <option value="returned">Returned</option>
              <option value="paid">Paid</option>
            </select>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
              disabled={isRefreshing}
            >
              <option value="all">All Grades</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Quick grade:</span>
            <Button
              size="sm"
              variant={gradeFilter === 'G1-3' ? 'default' : 'outline'}
              onClick={() => setGradeFilter('G1-3')}
            >
              G1-3
            </Button>
            <Button
              size="sm"
              variant={gradeFilter === 'G4-6' ? 'default' : 'outline'}
              onClick={() => setGradeFilter('G4-6')}
            >
              G4-6
            </Button>
            <Button
              size="sm"
              variant={gradeFilter === 'G7-10' ? 'default' : 'outline'}
              onClick={() => setGradeFilter('G7-10')}
            >
              G7-10
            </Button>
            <Button
              size="sm"
              variant={gradeFilter === 'G11-12' ? 'default' : 'outline'}
              onClick={() => setGradeFilter('G11-12')}
            >
              G11-12
            </Button>
            <Button
              size="sm"
              variant={gradeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setGradeFilter('all')}
            >
              All
            </Button>
            {lastRefreshedAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                Updated {new Date(lastRefreshedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Overdue Loans List */}
          {filteredLoans.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' || gradeFilter !== 'all'
                  ? 'No overdue books match your filters'
                  : 'No overdue books found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLoans.map((loan) => (
                <Card
                  key={loan.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={Boolean(selected[loan.id])}
                          onCheckedChange={(c) =>
                            handleToggle(loan.id, Boolean(c))
                          }
                        />
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center">
                            <Book className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {loan.studentName || 'Unknown Student'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            ID: {loan.studentId || 'N/A'} •{' '}
                            {loan.gradeLevel || 'N/A'} •{' '}
                            {loan.materialType || 'N/A'}
                          </p>
                          <p className="text-sm font-medium">
                            {loan.bookTitle || 'Untitled Material'}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge className={getStatusColor(loan.status)}>
                              {loan.status.charAt(0).toUpperCase() +
                                loan.status.slice(1)}
                            </Badge>
                            <div
                              className={`flex items-center text-sm font-medium ${getOverdueSeverity(loan.overdueDays)}`}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {loan.overdueDays} days overdue
                            </div>
                            <div className="flex items-center text-sm font-bold text-red-600">
                              <DollarSign className="h-3 w-3 mr-1" />₱
                              {loan.fineAmount.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Borrowed:{' '}
                            {loan.borrowedDate
                              ? new Date(loan.borrowedDate).toLocaleDateString()
                              : 'N/A'}{' '}
                            • Due:{' '}
                            {loan.dueDate
                              ? new Date(loan.dueDate).toLocaleDateString()
                              : 'N/A'}{' '}
                            • Rate: ₱{Number(loan.finePerDay || 0)}/day
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {loan.status === 'overdue' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReturnBook(loan.id)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Return
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePayFine(loan.id)}
                              disabled={isProcessingPayment === loan.id}
                            >
                              {isProcessingPayment === loan.id ? (
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <DollarSign className="h-3 w-3 mr-1" />
                              )}
                              Pay Fine
                            </Button>
                            {loan.contactInfo && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleSendReminder(loan.id, loan.studentId)
                                }
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Remind
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const text = buildReminderText(loan);
                                try {
                                  void navigator.clipboard.writeText(text);
                                  toast.success('Reminder copied');
                                } catch {
                                  try {
                                    const el =
                                      document.createElement('textarea');
                                    el.value = text;
                                    el.style.position = 'fixed';
                                    el.style.left = '-9999px';
                                    document.body.appendChild(el);
                                    el.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(el);
                                    toast.success('Reminder copied');
                                  } catch {
                                    toast.error('Copy failed');
                                  }
                                }
                              }}
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              Copy Reminder
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
