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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  BookOpen,
  Activity,
  RefreshCw,
  Mail,
  Phone,
  GraduationCap,
  Users,
  Hash,
  Clock,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Pencil,
  Save,
  X,
} from 'lucide-react';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel?: string | number;
  section?: string;
  email?: string;
  phone?: string;
  barcode?: string;
  gender?: string;
  parentName?: string;
  parentPhone?: string;
  isActive?: boolean;
  type?: 'STUDENT' | 'PERSONNEL';
}

interface BorrowingRecord {
  id: string;
  bookTitle: string;
  bookAuthor: string;
  checkoutDate: string;
  dueDate?: string;
  returnDate?: string;
  status: string;
  fineAmount?: number;
  finePaid?: boolean;
  overdueDays?: number;
  source?: 'system' | 'import';
}

interface ActivityRecord {
  id: string;
  activityType: string;
  description: string;
  timestamp: string;
  endTime?: string;
  status?: string;
}

interface StudentDetailModalProps {
  student: Student | null;
  open: boolean;
  onClose: () => void;
}

export function StudentDetailModal({
  student,
  open,
  onClose,
}: StudentDetailModalProps) {
  const [borrowingHistory, setBorrowingHistory] = useState<BorrowingRecord[]>(
    []
  );
  const [activityHistory, setActivityHistory] = useState<ActivityRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    dueDate: string;
    returnDate: string;
    fineAmount: string;
  }>({ dueDate: '', returnDate: '', fineAmount: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) {
      fetchStudentData(student.id);
    }
  }, [student]);

  const fetchStudentData = async (studentId: string) => {
    setHistoryLoading(true);
    try {
      // Fetch borrowing history from library system (book_checkouts with fines)
      const borrowResponse = await apiClient.get(
        `/api/enhanced-library/history?studentId=${studentId}`
      );

      // Fetch imported book records from attendance-export
      const importedResponse = await apiClient.get(
        `/api/attendance-export/book-activities?studentId=${studentId}`
      );

      // Merge both sources into borrowing history
      const systemBorrows: BorrowingRecord[] = [];
      const importedBorrows: BorrowingRecord[] = [];

      if (borrowResponse.success && Array.isArray(borrowResponse.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        borrowResponse.data.forEach((item: any) => {
          systemBorrows.push({
            id: item.id,
            bookTitle: item.book?.title || 'Unknown',
            bookAuthor: item.book?.author || 'Unknown',
            checkoutDate: item.checkoutDate || '',
            dueDate: item.dueDate || '',
            returnDate: item.returnDate || '',
            status: item.status || 'UNKNOWN',
            fineAmount: item.fineAmount || 0,
            finePaid: item.finePaid || false,
            overdueDays: item.overdueDays || 0,
            source: 'system',
          });
        });
      }

      if (importedResponse.success && Array.isArray(importedResponse.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        importedResponse.data.forEach((item: any) => {
          // Only include entries that have a book title (these are borrowed books)
          // Exclude librarian notes (bookTitle starting with 'Note:' or '*')
          const isNote =
            item.bookTitle &&
            (item.bookTitle.startsWith('Note:') ||
              item.bookTitle.startsWith('*') ||
              item.bookTitle.toLowerCase().includes('not using library card') ||
              item.bookTitle.toLowerCase().includes('no library card'));
          if (item.bookTitle && !isNote) {
            importedBorrows.push({
              id: item.id,
              bookTitle: item.bookTitle || 'Unknown',
              bookAuthor: item.bookAuthor || 'Unknown',
              checkoutDate: item.checkoutDate || '',
              dueDate: item.dueDate || '',
              returnDate: item.returnDate || '',
              status: 'IMPORTED',
              fineAmount: item.fineAmount || 0,
              finePaid: false,
              overdueDays: 0,
              source: 'import',
            });
          }
        });
      }

      // Combine and sort by checkout date (newest first)
      const allBorrows = [...systemBorrows, ...importedBorrows];
      allBorrows.sort(
        (a, b) =>
          new Date(b.checkoutDate).getTime() -
          new Date(a.checkoutDate).getTime()
      );
      setBorrowingHistory(allBorrows);

      // Fetch activity history (all activities: check-ins, borrows, prints, etc.)
      const activityResponse = await apiClient.get(
        `/api/enhanced-library/student-activities?studentId=${studentId}`
      );
      if (activityResponse.success && Array.isArray(activityResponse.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setActivityHistory(
          activityResponse.data.map((item: any) => ({
            // eslint-disable-line @typescript-eslint/no-explicit-any
            id: item.id,
            activityType: item.activityType || 'ACTIVITY',
            description: item.description || 'Activity',
            timestamp: item.timestamp || '',
            endTime: item.endTime,
            status: item.status,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch student data:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Start editing a borrowing record
  const startEdit = (record: BorrowingRecord) => {
    setEditingId(record.id);
    setEditForm({
      dueDate: record.dueDate || '',
      returnDate: record.returnDate || '',
      fineAmount: record.fineAmount?.toString() || '0',
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ dueDate: '', returnDate: '', fineAmount: '' });
  };

  // Save edit to database
  const saveEdit = async (recordId: string, source: string) => {
    setSaving(true);
    try {
      // For imported records (from student_activities)
      if (source === 'import') {
        await apiClient.patch(`/api/attendance-export/${recordId}`, {
          dueDate: editForm.dueDate || null,
          returnDate: editForm.returnDate || null,
          fineAmount: parseFloat(editForm.fineAmount) || 0,
        });
      } else {
        // For system records (book_checkouts)
        await apiClient.patch(`/api/enhanced-library/checkout/${recordId}`, {
          dueDate: editForm.dueDate || null,
          returnDate: editForm.returnDate || null,
          fineAmount: parseFloat(editForm.fineAmount) || 0,
        });
      }

      // Update local state
      setBorrowingHistory((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? {
                ...r,
                dueDate: editForm.dueDate,
                returnDate: editForm.returnDate,
                fineAmount: parseFloat(editForm.fineAmount) || 0,
              }
            : r
        )
      );

      cancelEdit();
    } catch (error) {
      console.error('Failed to save borrowing record:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get icon for activity type
  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'CHECK_IN':
      case 'SELF_SERVICE_CHECK_IN':
      case 'KIOSK_CHECK_IN':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'CHECK_OUT':
        return <LogOut className="h-4 w-4 text-orange-500" />;
      case 'BOOK_BORROWED':
      case 'ATTENDANCE_IMPORT':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'BOOK_RETURNED':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get color class for activity type
  const getActivityBgClass = (activityType: string) => {
    switch (activityType) {
      case 'CHECK_IN':
      case 'SELF_SERVICE_CHECK_IN':
      case 'KIOSK_CHECK_IN':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'CHECK_OUT':
        return 'bg-orange-100 dark:bg-orange-900/30';
      case 'BOOK_BORROWED':
      case 'ATTENDANCE_IMPORT':
        return 'bg-blue-100 dark:bg-blue-900/30';
      case 'BOOK_RETURNED':
        return 'bg-purple-100 dark:bg-purple-900/30';
      default:
        return 'bg-muted';
    }
  };

  // Calculate total unpaid fines
  const totalUnpaidFines = borrowingHistory
    .filter(
      (b: BorrowingRecord) => b.fineAmount && b.fineAmount > 0 && !b.finePaid
    )
    .reduce((sum: number, b: BorrowingRecord) => sum + (b.fineAmount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogDescription className="sr-only">
          View and edit student details, borrowing history, and activity log
        </DialogDescription>
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-6 py-5 rounded-t-lg">
          <DialogHeader className="mb-0">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xl font-bold">
                {student.firstName?.[0]}
                {student.lastName?.[0]}
              </div>
              <div className="text-white flex-1">
                <DialogTitle className="text-xl font-semibold text-white mb-1">
                  {student.firstName} {student.lastName}
                </DialogTitle>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" />
                    {student.studentId}
                  </span>
                  <Badge
                    variant={student.isActive ? 'secondary' : 'outline'}
                    className={
                      student.isActive
                        ? 'bg-green-500/20 text-green-100 border-green-400/30'
                        : 'bg-red-500/20 text-red-100 border-red-400/30'
                    }
                  >
                    {student.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-white/10 text-white border-white/30"
                  >
                    {student.type || 'STUDENT'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Library Stats Row */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-white/20">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">
                  {borrowingHistory.length}
                </p>
                <p className="text-xs text-white/70">Total Borrowed</p>
              </div>
              <div className="flex-1 text-center border-x border-white/20">
                <p className="text-2xl font-bold text-white">
                  {
                    borrowingHistory.filter(
                      (b) => b.status === 'ACTIVE' || b.status === 'BORROWED'
                    ).length
                  }
                </p>
                <p className="text-xs text-white/70">Currently</p>
              </div>
              <div className="flex-1 text-center border-r border-white/20">
                <p
                  className={`text-2xl font-bold ${borrowingHistory.filter((b) => b.status === 'OVERDUE').length > 0 ? 'text-red-300' : 'text-white'}`}
                >
                  {
                    borrowingHistory.filter((b) => b.status === 'OVERDUE')
                      .length
                  }
                </p>
                <p className="text-xs text-white/70">Overdue</p>
              </div>
              <div className="flex-1 text-center">
                <p
                  className={`text-2xl font-bold ${totalUnpaidFines > 0 ? 'text-amber-300' : 'text-white'}`}
                >
                  ₱{totalUnpaidFines.toFixed(0)}
                </p>
                <p className="text-xs text-white/70">Unpaid Fines</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs content */}
        <Tabs
          defaultValue="details"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-4 border-b">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="details" className="gap-2">
                <User className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="borrowing" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Borrowed
                {borrowingHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {borrowingHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <Activity className="h-4 w-4" />
                Activity
                {activityHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activityHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Details Tab - View Only */}
            <TabsContent value="details" className="mt-0 space-y-4">
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Academic Info Card */}
                <Card className="col-span-2">
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Academic Information
                    </h4>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          First Name
                        </Label>
                        <p className="font-medium">{student.firstName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Last Name
                        </Label>
                        <p className="font-medium">{student.lastName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Gender
                        </Label>
                        <p className="font-medium">{student.gender || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Grade Level
                        </Label>
                        <p className="font-medium">
                          {student.gradeLevel || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Section
                        </Label>
                        <p className="font-medium">
                          {student.section || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {/* Library Barcode Section */}
                    {student.barcode && (
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <Label className="text-xs text-muted-foreground">
                          Library Barcode
                        </Label>
                        <p className="font-mono text-lg font-bold tracking-widest mt-1">
                          {student.barcode}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Card */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact Info
                    </h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Email
                        </Label>
                        <p className="font-medium text-sm">
                          {student.email || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Phone
                        </Label>
                        <p className="font-medium text-sm">
                          {student.phone || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Parent/Guardian Card */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Parent/Guardian
                    </h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Name
                        </Label>
                        <p className="font-medium">
                          {student.parentName || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Phone
                        </Label>
                        <p className="font-medium">
                          {student.parentPhone || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                To edit student details, use the Edit button in the Students
                table
              </p>
            </TabsContent>

            {/* Borrowing History Tab - Comprehensive with Fines */}
            <TabsContent value="borrowing" className="mt-0">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" />
                    Borrowed Books
                  </h3>
                  {totalUnpaidFines > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />₱
                      {totalUnpaidFines.toFixed(2)} unpaid
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => student && fetchStudentData(student.id)}
                  disabled={historyLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-1 ${historyLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : borrowingHistory.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No borrowing records found
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Books borrowed through the library system or imports will
                      appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Book</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Returned</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px] sticky right-0 bg-muted">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {borrowingHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{record.bookTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {record.bookAuthor}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(record.checkoutDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingId === record.id ? (
                              <Input
                                type="date"
                                value={
                                  editForm.dueDate
                                    ? editForm.dueDate.split('T')[0]
                                    : ''
                                }
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    dueDate: e.target.value,
                                  }))
                                }
                                className="h-7 w-[130px] text-xs"
                              />
                            ) : (
                              formatDate(record.dueDate || '')
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingId === record.id ? (
                              <Input
                                type="date"
                                value={
                                  editForm.returnDate
                                    ? editForm.returnDate.split('T')[0]
                                    : ''
                                }
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    returnDate: e.target.value,
                                  }))
                                }
                                className="h-7 w-[130px] text-xs"
                              />
                            ) : (
                              formatDate(record.returnDate || '')
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingId === record.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.fineAmount}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    fineAmount: e.target.value,
                                  }))
                                }
                                className="h-7 w-[80px] text-xs"
                              />
                            ) : record.fineAmount && record.fineAmount > 0 ? (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                <span
                                  className={
                                    record.finePaid
                                      ? 'text-muted-foreground line-through'
                                      : 'text-red-600 font-medium'
                                  }
                                >
                                  ₱{record.fineAmount.toFixed(2)}
                                </span>
                                {record.finePaid && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs ml-1"
                                  >
                                    Paid
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.status === 'RETURNED'
                                  ? 'secondary'
                                  : record.status === 'IMPORTED'
                                    ? 'outline'
                                    : record.status === 'ACTIVE' &&
                                        record.overdueDays &&
                                        record.overdueDays > 0
                                      ? 'destructive'
                                      : record.status === 'LOST'
                                        ? 'destructive'
                                        : 'default'
                              }
                            >
                              {record.status === 'ACTIVE' &&
                              record.overdueDays &&
                              record.overdueDays > 0
                                ? `OVERDUE (${record.overdueDays}d)`
                                : record.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="sticky right-0 bg-background">
                            {editingId === record.id ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    saveEdit(
                                      record.id,
                                      record.source || 'system'
                                    )
                                  }
                                  disabled={saving}
                                >
                                  <Save className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={cancelEdit}
                                >
                                  <X className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startEdit(record)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Activity History Tab - Full Activity Log */}
            <TabsContent value="activity" className="mt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  Activity Log
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => student && fetchStudentData(student.id)}
                  disabled={historyLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-1 ${historyLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activityHistory.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Activity className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No activity records found
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Check-ins, borrows, and other activities will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activityHistory.map((record) => (
                    <Card
                      key={record.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <CardContent className="flex items-center gap-4 py-3 px-4">
                        <div
                          className={`h-10 w-10 rounded-full ${getActivityBgClass(record.activityType)} flex items-center justify-center flex-shrink-0`}
                        >
                          {getActivityIcon(record.activityType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {record.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(record.timestamp)}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0"
                        >
                          {record.activityType.replace(/_/g, ' ')}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default StudentDetailModal;
