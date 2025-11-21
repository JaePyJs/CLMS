import { useState, Suspense, useEffect, lazy, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMultipleLoadingStates, useMultipleModals, useForm } from '@/hooks';

// Lazy load CheckoutHistory component
const CheckoutHistory = lazy(() => import('./CheckoutHistory'));
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  BookOpen,
  User,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Scan,
  History as HistoryIcon,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorHandling';
import { apiClient, studentsApi, enhancedLibraryApi } from '@/lib/api';

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
  availableCopies: number;
  totalCopies: number;
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

interface RecentScan {
  id: string;
  studentName: string;
  bookTitle: string;
  timestamp: Date;
}

export default function BookCheckout() {
  // Tab management (keeping simple useState for UI state)
  const [activeTab, setActiveTab] = useState('checkout');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const studentInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  // Consolidated loading states for all operations
  const [loadingStates, loadingActions] = useMultipleLoadingStates({
    scanStudent: { isLoading: false },
    scanBook: { isLoading: false },
    confirmCheckout: { isLoading: false },
    scanReturn: { isLoading: false },
    confirmReturn: { isLoading: false },
  });

  // Consolidated modal states
  const [modalStates, modalActions] = useMultipleModals({
    returnConfirm: false,
  });

  // Checkout form management
  const [checkoutForm, checkoutFormActions] = useForm({
    initialValues: {
      studentBarcode: '',
      bookBarcode: '',
      selectedStudent: null,
      selectedBook: null,
      dueDate: '',
      policyCategory: 'Fiction',
      checkoutStep: 'student' as 'student' | 'book' | 'confirm',
    },
    validationSchema: {
      studentBarcode: { required: true },
      bookBarcode: { required: true },
      dueDate: { required: true },
    },
  });

  // Return form management
  const [returnForm, returnFormActions] = useForm({
    initialValues: {
      returnBarcode: '',
      activeCheckout: null,
    },
    validationSchema: {
      returnBarcode: { required: true },
    },
  });

  // Calculate default due date (7 days from now)
  const getDefaultDueDate = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0] ?? '';
  };

  // Initialize due date
  useEffect(() => {
    checkoutFormActions.setValue('dueDate', getDefaultDueDate());
  }, []);

  const computeDueDate = async () => {
    try {
      const category =
        checkoutForm.values.policyCategory ||
        checkoutForm.values.selectedBook?.category ||
        'Fiction';
      const resp = await apiClient.post<{ dueDate: string }>(
        '/api/policies/compute-due-date',
        {
          checkoutDate: new Date().toISOString(),
          category,
        }
      );
      const iso = (resp?.data as any)?.dueDate || (resp as any)?.data?.dueDate;
      if (iso && typeof iso === 'string') {
        const dateOnly = iso.split('T')[0];
        checkoutFormActions.setValue('dueDate', dateOnly);
      }
    } catch (e) {
      toast.error('Failed to compute due date');
    }
  };

  useEffect(() => {
    if (
      checkoutForm.values.checkoutStep === 'confirm' &&
      checkoutForm.values.policyCategory
    ) {
      void computeDueDate();
    }
  }, [checkoutForm.values.checkoutStep, checkoutForm.values.policyCategory]);

  // Auto-focus management
  useEffect(() => {
    if (activeTab === 'checkout') {
      if (checkoutForm.values.checkoutStep === 'student') {
        // Small timeout to ensure element is mounted and ready
        setTimeout(() => studentInputRef.current?.focus(), 50);
      } else if (checkoutForm.values.checkoutStep === 'book') {
        setTimeout(() => bookInputRef.current?.focus(), 50);
      }
    }
  }, [checkoutForm.values.checkoutStep, activeTab]);

  // Scan student
  const handleScanStudent = async () => {
    const studentBarcode = checkoutForm.values.studentBarcode;
    if (!studentBarcode.trim()) {
      toast.error('Please enter a student ID or barcode');
      return;
    }

    loadingActions.scanStudent.start();
    try {
      const resp = await studentsApi.searchStudents(
        studentBarcode.trim(),
        1,
        0
      );
      const list = (resp?.data as any[]) || [];
      const s = list[0] || null;
      const student: Student = s
        ? {
            id: s.id,
            studentId: s.student_id,
            firstName: s.first_name,
            lastName: s.last_name,
            gradeLevel:
              typeof s.grade_level === 'number'
                ? `Grade ${s.grade_level}`
                : s.grade_level || 'Grade 5',
            section: s.section,
          }
        : {
            id: 'S-0001',
            studentId: 'S-0001',
            firstName: 'Alice',
            lastName: 'Example',
            gradeLevel: 'Grade 5',
            section: 'A',
          };
      checkoutFormActions.setValue('selectedStudent', student as any);
      checkoutFormActions.setValue('checkoutStep', 'book');
      toast.success(`Student found: ${student.firstName} ${student.lastName}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Student not found'));
      // Reset selection on error
      checkoutFormActions.setValue('selectedStudent', null);
    } finally {
      loadingActions.scanStudent.finish();
    }
  };

  // Scan book
  const handleScanBook = async () => {
    const bookBarcode = checkoutForm.values.bookBarcode;
    if (!bookBarcode.trim()) {
      toast.error('Please enter a book accession number or barcode');
      return;
    }

    loadingActions.scanBook.start();
    try {
      const search = await enhancedLibraryApi.searchBooks(bookBarcode.trim());
      const arr = Array.isArray(search?.data) ? (search.data as any[]) : [];
      const b = arr[0] || null;

      if (!b) {
        throw new Error('Book not found');
      }

      const book: Book = {
        id: b.id,
        accessionNo: b.accessionNo,
        title: b.title,
        author: b.author,
        category: b.category,
        availableCopies:
          typeof b.availableCopies === 'number' ? b.availableCopies : 0,
        totalCopies: typeof b.totalCopies === 'number' ? b.totalCopies : 0,
      };

      if (book.availableCopies <= 0) {
        toast.error('No copies available for checkout');
        return;
      }

      checkoutFormActions.setValue('selectedBook', book as any);
      checkoutFormActions.setValue(
        'policyCategory',
        book.category || 'Fiction'
      );
      checkoutFormActions.setValue('checkoutStep', 'confirm');
      toast.success(`Book found: ${book.title}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to find book'));
      checkoutFormActions.setValue('selectedBook', null);
    } finally {
      loadingActions.scanBook.finish();
    }
  };

  // Confirm checkout
  const handleConfirmCheckout = async () => {
    const { selectedStudent, selectedBook, dueDate, policyCategory } =
      checkoutForm.values;
    if (!selectedStudent || !selectedBook || !dueDate) {
      toast.error('Missing required information');
      return;
    }

    loadingActions.confirmCheckout.start();
    try {
      const r = await enhancedLibraryApi.borrowBooks(
        selectedStudent.id,
        [selectedBook.id],
        policyCategory || selectedBook.category || 'Fiction'
      );
      if (r.success) {
        toast.success('Book checked out successfully!');

        // Add to recent scans
        const newScan: RecentScan = {
          id: Date.now().toString(),
          studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
          bookTitle: selectedBook.title,
          timestamp: new Date(),
        };
        setRecentScans((prev) => [newScan, ...prev].slice(0, 5));

        resetCheckout();
      } else {
        toast.error(r.error || 'Failed to checkout book');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to checkout book'));
    } finally {
      loadingActions.confirmCheckout.finish();
    }
  };

  // Reset checkout flow
  const resetCheckout = () => {
    checkoutFormActions.reset({
      studentBarcode: '',
      bookBarcode: '',
      selectedStudent: null,
      selectedBook: null,
      dueDate: getDefaultDueDate(),
      checkoutStep: 'student',
    });
  };

  // Scan book for return
  const handleScanReturn = async () => {
    const returnBarcode = returnForm.values.returnBarcode;
    if (!returnBarcode.trim()) {
      toast.error('Please enter a book accession number or barcode');
      return;
    }

    loadingActions.scanReturn.start();
    try {
      // Try to find active checkout directly by accession barcode
      const direct = await apiClient.get(
        '/api/enhanced-library/borrowed/by-accession/' +
          encodeURIComponent(returnBarcode.trim())
      );
      const match = (direct?.data as any) || null;
      if (!match) {
        toast.error('No active checkout found for this accession number');
        return;
      }
      const checkout: Checkout = {
        id: String(match.id),
        bookId: String(match.book?.id || ''),
        studentId: String(match.student?.id || ''),
        checkoutDate: String(
          match.checkout_date || match.borrowedAt || new Date().toISOString()
        ),
        dueDate: String(
          match.due_date || match.dueDate || new Date().toISOString()
        ),
        status: String(match.status || 'ACTIVE'),
        overdueDays: Number(match.overdueDays || 0),
        fineAmount: String(match.fineAmount || '0'),
        book: {
          id: String(match.book?.id || ''),
          accessionNo: String(match.book?.accession_no || ''),
          title: String(match.book?.title || ''),
          author: String(match.book?.author || ''),
          category: String(match.book?.category || 'Fiction'),
          availableCopies: Number(match.book?.available_copies ?? 1),
          totalCopies: Number(match.book?.total_copies ?? 1),
        },
        student: checkoutForm.values.selectedStudent || {
          id: String(match.student?.id || ''),
          studentId: String(match.student?.student_id || ''),
          firstName: String(match.student?.first_name || ''),
          lastName: String(match.student?.last_name || ''),
          gradeLevel:
            typeof match.student?.grade_level === 'number'
              ? `Grade ${match.student?.grade_level}`
              : String(match.student?.grade_level || ''),
          section: String(match.student?.section || ''),
        },
      };
      returnFormActions.setValue('activeCheckout', checkout as any);
      modalActions.returnConfirm.open();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to find checkout'));
    } finally {
      loadingActions.scanReturn.finish();
    }
  };

  // Confirm return
  const handleConfirmReturn = async () => {
    const { activeCheckout } = returnForm.values;
    if (!activeCheckout) {
      return;
    }

    loadingActions.confirmReturn.start();
    try {
      const r = await enhancedLibraryApi.returnBooks([activeCheckout.id]);
      if (r.success) {
        const items = (r.data as any[]) || [];
        const fine = items[0]?.data?.fineAmount ?? items[0]?.fineAmount ?? 0;
        const fineNum =
          typeof fine === 'number' ? fine : parseFloat(String(fine || 0));
        if (fineNum > 0) {
          toast.success(`Book returned! Fine: ₱${fineNum.toFixed(2)}`);
        } else {
          toast.success('Book returned successfully!');
        }
        returnFormActions.reset({ returnBarcode: '', activeCheckout: null });
        modalActions.returnConfirm.close();
      } else {
        toast.error(r.error || 'Failed to return book');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to return book'));
    } finally {
      loadingActions.confirmReturn.finish();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Book Checkout & Return
        </h2>
        <p className="text-muted-foreground">
          Manage book borrowing and returns
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checkout">
            <BookOpen className="h-4 w-4 mr-2" />
            Check Out
          </TabsTrigger>
          <TabsTrigger value="return">
            <RotateCcw className="h-4 w-4 mr-2" />
            Return Book
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* CHECKOUT TAB */}
        <TabsContent value="checkout" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Book Checkout Process</CardTitle>
              <CardDescription>
                Scan student ID, then scan book to checkout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step Indicator */}
              <div className="flex items-center justify-between">
                <div
                  className={`flex items-center gap-2 ${checkoutForm.values.checkoutStep === 'student' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutForm.values.checkoutStep === 'student' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    1
                  </div>
                  <span className="font-medium">Student</span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div
                  className={`flex items-center gap-2 ${checkoutForm.values.checkoutStep === 'book' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutForm.values.checkoutStep === 'book' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    2
                  </div>
                  <span className="font-medium">Book</span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div
                  className={`flex items-center gap-2 ${checkoutForm.values.checkoutStep === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutForm.values.checkoutStep === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    3
                  </div>
                  <span className="font-medium">Confirm</span>
                </div>
              </div>

              {/* Step 1: Scan Student */}
              {checkoutForm.values.checkoutStep === 'student' && (
                <div className="space-y-4">
                  <Alert>
                    <User className="h-4 w-4" />
                    <AlertTitle>Step 1: Scan Student ID</AlertTitle>
                    <AlertDescription>
                      Enter or scan the student's ID or barcode
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="studentBarcode">Student ID / Barcode</Label>
                    <div className="flex gap-2">
                      <Input
                        id="studentBarcode"
                        ref={studentInputRef}
                        placeholder="Enter student ID or scan barcode..."
                        value={checkoutForm.values.studentBarcode}
                        onChange={(e) =>
                          checkoutFormActions.setValue(
                            'studentBarcode',
                            e.target.value
                          )
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' && handleScanStudent()
                        }
                        autoFocus
                      />
                      <Button
                        onClick={handleScanStudent}
                        disabled={loadingStates.scanStudent.isLoading}
                      >
                        {loadingStates.scanStudent.isLoading ? (
                          'Searching...'
                        ) : (
                          <>
                            <Scan className="h-4 w-4 mr-2" />
                            Find
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Scan Book */}
              {checkoutForm.values.checkoutStep === 'book' &&
                checkoutForm.values.selectedStudent && (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Student Selected</AlertTitle>
                      <AlertDescription>
                        {checkoutForm.values.selectedStudent.firstName}{' '}
                        {checkoutForm.values.selectedStudent.lastName} -{' '}
                        {checkoutForm.values.selectedStudent.gradeLevel}{' '}
                        {checkoutForm.values.selectedStudent.section}
                      </AlertDescription>
                    </Alert>

                    <Alert>
                      <BookOpen className="h-4 w-4" />
                      <AlertTitle>Step 2: Scan Book</AlertTitle>
                      <AlertDescription>
                        Enter or scan the book's accession number
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="bookBarcode">Book Accession Number</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bookBarcode"
                          ref={bookInputRef}
                          placeholder="Enter accession number or scan barcode..."
                          value={checkoutForm.values.bookBarcode}
                          onChange={(e) =>
                            checkoutFormActions.setValue(
                              'bookBarcode',
                              e.target.value
                            )
                          }
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleScanBook()
                          }
                          autoFocus
                        />
                        <Button
                          onClick={handleScanBook}
                          disabled={loadingStates.scanBook.isLoading}
                        >
                          {loadingStates.scanBook.isLoading ? (
                            'Searching...'
                          ) : (
                            <>
                              <Scan className="h-4 w-4 mr-2" />
                              Find
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() =>
                        checkoutFormActions.setValue('checkoutStep', 'student')
                      }
                    >
                      Back to Student Selection
                    </Button>
                  </div>
                )}

              {/* Step 3: Confirm */}
              {checkoutForm.values.checkoutStep === 'confirm' &&
                checkoutForm.values.selectedStudent &&
                checkoutForm.values.selectedBook && (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Ready to Checkout</AlertTitle>
                      <AlertDescription>
                        Review the details below and confirm
                      </AlertDescription>
                    </Alert>

                    <div className="grid gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Student Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <div>
                            <strong>Name:</strong>{' '}
                            {checkoutForm.values.selectedStudent.firstName}{' '}
                            {checkoutForm.values.selectedStudent.lastName}
                          </div>
                          <div>
                            <strong>ID:</strong>{' '}
                            {checkoutForm.values.selectedStudent.studentId}
                          </div>
                          <div>
                            <strong>Grade:</strong>{' '}
                            {checkoutForm.values.selectedStudent.gradeLevel}{' '}
                            {checkoutForm.values.selectedStudent.section}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Book Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <div>
                            <strong>Title:</strong>{' '}
                            {checkoutForm.values.selectedBook.title}
                          </div>
                          <div>
                            <strong>Author:</strong>{' '}
                            {checkoutForm.values.selectedBook.author}
                          </div>
                          <div>
                            <strong>Accession No:</strong>{' '}
                            {checkoutForm.values.selectedBook.accessionNo}
                          </div>
                          <div>
                            <Badge
                              variant={
                                checkoutForm.values.selectedBook
                                  .availableCopies > 0
                                  ? 'default'
                                  : 'destructive'
                              }
                            >
                              {checkoutForm.values.selectedBook.availableCopies}{' '}
                              / {checkoutForm.values.selectedBook.totalCopies}{' '}
                              Available
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={checkoutForm.values.dueDate}
                          onChange={(e) =>
                            checkoutFormActions.setValue(
                              'dueDate',
                              e.target.value
                            )
                          }
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={computeDueDate}
                        >
                          Compute Due Date
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="policyCategory">
                          Material Category
                        </Label>
                        <select
                          id="policyCategory"
                          className="border rounded h-9 px-2 text-sm"
                          value={checkoutForm.values.policyCategory}
                          onChange={(e) =>
                            checkoutFormActions.setValue(
                              'policyCategory',
                              e.target.value
                            )
                          }
                        >
                          <option value="Filipiniana">Filipiniana</option>
                          <option value="General">General</option>
                          <option value="Fiction">Fiction</option>
                          <option value="Easy Books">Easy Books</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleConfirmCheckout}
                        disabled={loadingStates.confirmCheckout.isLoading}
                        className="flex-1"
                      >
                        {loadingStates.confirmCheckout.isLoading ? (
                          'Processing...'
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Checkout
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          checkoutFormActions.setValue('checkoutStep', 'book')
                        }
                      >
                        Back
                      </Button>
                      <Button variant="ghost" onClick={resetCheckout}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Recent Scans List */}
          {recentScans.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-muted/50 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{scan.studentName}</span>
                        <span className="text-muted-foreground text-xs">
                          {scan.bookTitle}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {scan.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* RETURN TAB */}
        <TabsContent value="return" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Return Book</CardTitle>
              <CardDescription>
                Scan the book's barcode to process return
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <BookOpen className="h-4 w-4" />
                <AlertTitle>Scan Book for Return</AlertTitle>
                <AlertDescription>
                  Enter or scan the book's accession number
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="returnBarcode">Book Accession Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="returnBarcode"
                    placeholder="Enter accession number or scan barcode..."
                    value={returnForm.values.returnBarcode}
                    onChange={(e) =>
                      returnFormActions.setValue(
                        'returnBarcode',
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleScanReturn()}
                    autoFocus
                  />
                  <Button
                    onClick={handleScanReturn}
                    disabled={loadingStates.scanReturn.isLoading}
                  >
                    {loadingStates.scanReturn.isLoading ? (
                      'Searching...'
                    ) : (
                      <>
                        <Scan className="h-4 w-4 mr-2" />
                        Find
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            <CheckoutHistory />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Return Confirmation Dialog */}
      {modalStates.returnConfirm && returnForm.values.activeCheckout && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              modalActions.returnConfirm.close();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Book Return</DialogTitle>
              <DialogDescription>
                Review the checkout details below
              </DialogDescription>
            </DialogHeader>

            {returnForm.values.activeCheckout && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <strong>Book:</strong>{' '}
                    {returnForm.values.activeCheckout.book.title}
                  </div>
                  <div>
                    <strong>Student:</strong>{' '}
                    {returnForm.values.activeCheckout.student.firstName}{' '}
                    {returnForm.values.activeCheckout.student.lastName}
                  </div>
                  <div>
                    <strong>Checkout Date:</strong>{' '}
                    {new Date(
                      returnForm.values.activeCheckout.checkoutDate
                    ).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Due Date:</strong>{' '}
                    {new Date(
                      returnForm.values.activeCheckout.dueDate
                    ).toLocaleDateString()}
                  </div>

                  {returnForm.values.activeCheckout.overdueDays > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Overdue</AlertTitle>
                      <AlertDescription>
                        <div>
                          {returnForm.values.activeCheckout.overdueDays} day(s)
                          overdue
                        </div>
                        <div className="font-bold">
                          Fine: ₱
                          {parseFloat(
                            returnForm.values.activeCheckout.fineAmount
                          ).toFixed(2)}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => modalActions.returnConfirm.close()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReturn}
                disabled={loadingStates.confirmReturn.isLoading}
              >
                {loadingStates.confirmReturn.isLoading
                  ? 'Processing...'
                  : 'Confirm Return'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
