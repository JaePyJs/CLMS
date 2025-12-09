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
import { useAppStore } from '@/store/useAppStore';
import { useDebounce } from '@/hooks/useDebounce';

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
  UserCheck,
  Search,
  Loader2,
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

interface SearchStudent {
  id: string;
  studentId: string;
  name: string;
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

// API response interface for student search
interface StudentApiResult {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: number | string;
  section?: string;
}

// API response interface for book search
interface BookApiResult {
  id: string;
  accessionNo?: string;
  accession_no?: string;
  title: string;
  author: string;
  category: string;
  availableCopies?: number;
  available_copies?: number;
  totalCopies?: number;
  total_copies?: number;
}

// Form value interfaces for type-safe access
interface CheckoutFormValues {
  studentBarcode: string;
  bookBarcode: string;
  selectedStudent: Student | null;
  selectedBook: Book | null;
  dueDate: string;
  policyCategory: string;
  checkoutStep: 'student' | 'book' | 'confirm';
}

interface ReturnFormValues {
  returnBarcode: string;
  activeCheckout: Checkout | null;
}

// Type-safe form value accessor
const getCheckoutValues = (
  values: Record<string, unknown>
): CheckoutFormValues => values as unknown as CheckoutFormValues;
const getReturnValues = (values: Record<string, unknown>): ReturnFormValues =>
  values as unknown as ReturnFormValues;

export default function BookCheckout() {
  // Tab management (keeping simple useState for UI state)
  const [activeTab, setActiveTab] = useState('checkout');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  // Get active student from global store (set when student scans in at Scan Station)
  const { activeStudent } = useAppStore();

  // Live search state for student
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<
    SearchStudent[]
  >([]);
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedStudentSearch = useDebounce(studentSearchInput, 150);

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

  // Typed form value access
  const checkoutValues = getCheckoutValues(checkoutForm.values);
  const returnValues = getReturnValues(returnForm.values);

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

  // Auto-fill active student from Scan Station when available
  useEffect(() => {
    if (
      activeStudent &&
      checkoutValues.checkoutStep === 'student' &&
      !checkoutValues.selectedStudent
    ) {
      // Parse name into first/last
      const nameParts = activeStudent.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const student: Student = {
        id: activeStudent.id,
        studentId: activeStudent.barcode || activeStudent.id,
        firstName,
        lastName,
        gradeLevel: activeStudent.gradeLevel || '',
        section: '',
      };

      checkoutFormActions.setValue('selectedStudent', student as unknown);
      checkoutFormActions.setValue('checkoutStep', 'book');
      toast.success(`Active student loaded: ${activeStudent.name}`, {
        description: 'Student was scanned at Scan Station',
        icon: <UserCheck className="h-4 w-4" />,
      });
    }
  }, [activeStudent, checkoutValues.checkoutStep]);

  const computeDueDate = async () => {
    try {
      const category =
        checkoutValues.policyCategory ||
        checkoutValues.selectedBook?.category ||
        'Fiction';
      const resp = await apiClient.post<{ dueDate: string }>(
        '/api/policies/compute-due-date',
        {
          checkoutDate: new Date().toISOString(),
          category,
        }
      );
      const iso =
        (resp?.data as unknown)?.dueDate || (resp as unknown)?.data?.dueDate;
      if (iso && typeof iso === 'string') {
        const dateOnly = iso.split('T')[0];
        checkoutFormActions.setValue('dueDate', dateOnly);
      }
    } catch {
      toast.error('Failed to compute due date');
    }
  };

  useEffect(() => {
    if (
      checkoutValues.checkoutStep === 'confirm' &&
      checkoutValues.policyCategory
    ) {
      void computeDueDate();
    }
  }, [checkoutValues.checkoutStep, checkoutValues.policyCategory]);

  // Live search effect for student input - Google style instant search
  useEffect(() => {
    if (debouncedStudentSearch.length >= 1) {
      setIsSearchingStudent(true);
      apiClient
        .get(
          `/api/manual-lookup/search?q=${encodeURIComponent(debouncedStudentSearch)}`
        )
        .then((response) => {
          if (response.success && Array.isArray(response.data)) {
            setStudentSearchResults(response.data as SearchStudent[]);
          } else {
            setStudentSearchResults([]);
          }
        })
        .catch(() => setStudentSearchResults([]))
        .finally(() => setIsSearchingStudent(false));
    } else {
      setStudentSearchResults([]);
    }
  }, [debouncedStudentSearch]);

  // Click outside handler for student dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        studentDropdownRef.current &&
        !studentDropdownRef.current.contains(event.target as Node)
      ) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle selecting a student from dropdown
  const handleSelectSearchStudent = (student: SearchStudent) => {
    const nameParts = student.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const selectedStudent: Student = {
      id: student.id,
      studentId: student.studentId,
      firstName,
      lastName,
      gradeLevel: student.gradeLevel,
      section: student.section,
    };

    checkoutFormActions.setValue('selectedStudent', selectedStudent as unknown);
    checkoutFormActions.setValue('checkoutStep', 'book');
    setStudentSearchInput('');
    setStudentSearchResults([]);
    setShowStudentDropdown(false);
    toast.success(`Student selected: ${student.name}`);
  };

  // Auto-focus management
  useEffect(() => {
    if (activeTab === 'checkout') {
      if (checkoutValues.checkoutStep === 'student') {
        // Small timeout to ensure element is mounted and ready
        setTimeout(() => studentInputRef.current?.focus(), 50);
      } else if (checkoutValues.checkoutStep === 'book') {
        setTimeout(() => bookInputRef.current?.focus(), 50);
      }
    }
  }, [checkoutValues.checkoutStep, activeTab]);

  // Scan student
  const handleScanStudent = async () => {
    const studentBarcode = checkoutValues.studentBarcode;
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
      const list = (resp?.data as StudentApiResult[]) || [];
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
      checkoutFormActions.setValue('selectedStudent', student as unknown);
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
    const bookBarcode = checkoutValues.bookBarcode;
    if (!bookBarcode.trim()) {
      toast.error('Please enter a book accession number or barcode');
      return;
    }

    loadingActions.scanBook.start();
    try {
      const search = await enhancedLibraryApi.searchBooks(bookBarcode.trim());
      const arr = Array.isArray(search?.data)
        ? (search.data as BookApiResult[])
        : [];
      const b = arr[0] || null;

      if (!b) {
        throw new Error('Book not found');
      }

      // Handle both snake_case (from DB) and camelCase field names
      const book: Book = {
        id: b.id,
        accessionNo: b.accessionNo || b.accession_no || '',
        title: b.title,
        author: b.author,
        category: b.category,
        availableCopies:
          typeof b.availableCopies === 'number'
            ? b.availableCopies
            : typeof b.available_copies === 'number'
              ? b.available_copies
              : 0,
        totalCopies:
          typeof b.totalCopies === 'number'
            ? b.totalCopies
            : typeof b.total_copies === 'number'
              ? b.total_copies
              : 0,
      };

      if (book.availableCopies <= 0) {
        toast.error('No copies available for checkout');
        return;
      }

      checkoutFormActions.setValue('selectedBook', book as unknown);
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
      checkoutValues;

    if (!selectedStudent || !selectedBook || !dueDate) {
      toast.error('Missing required information');
      return;
    }

    // Validate IDs are not empty
    if (!selectedStudent.id || !selectedBook.id) {
      toast.error('Invalid student or book selection');
      return;
    }

    let materialType = policyCategory || selectedBook.category || 'Fiction';
    if (materialType === '(Uncategorized)' || !materialType) {
      materialType = 'General';
    }

    loadingActions.confirmCheckout.start();
    try {
      const r = await enhancedLibraryApi.borrowBooks(
        selectedStudent.id,
        [selectedBook.id],
        materialType
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

        // Clear active student from global store if it matches the checked out student
        if (
          activeStudent &&
          (activeStudent.id === selectedStudent.id ||
            activeStudent.barcode === selectedStudent.studentId)
        ) {
          useAppStore.getState().clearActiveStudent();
        }

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
    const returnBarcode = returnValues.returnBarcode;
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
      const match = (direct?.data as unknown) || null;
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
        student: checkoutValues.selectedStudent || {
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
      returnFormActions.setValue('activeCheckout', checkout as unknown);
      modalActions.returnConfirm.open();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to find checkout'));
    } finally {
      loadingActions.scanReturn.finish();
    }
  };

  // Confirm return
  const handleConfirmReturn = async () => {
    const { activeCheckout } = returnValues;
    if (!activeCheckout) {
      return;
    }

    loadingActions.confirmReturn.start();
    try {
      const r = await enhancedLibraryApi.returnBooks([activeCheckout.id]);
      if (r.success) {
        interface ReturnedItem {
          data?: { fineAmount?: number | string };
          fineAmount?: number | string;
        }
        const items = (r.data as ReturnedItem[]) || [];
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
                  className={`flex items-center gap-2 ${checkoutValues.checkoutStep === 'student' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutValues.checkoutStep === 'student' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    1
                  </div>
                  <span className="font-medium">Student</span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div
                  className={`flex items-center gap-2 ${checkoutValues.checkoutStep === 'book' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutValues.checkoutStep === 'book' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    2
                  </div>
                  <span className="font-medium">Book</span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div
                  className={`flex items-center gap-2 ${checkoutValues.checkoutStep === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutValues.checkoutStep === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    3
                  </div>
                  <span className="font-medium">Confirm</span>
                </div>
              </div>

              {/* Step 1: Scan Student */}
              {checkoutValues.checkoutStep === 'student' && (
                <div className="space-y-4">
                  <Alert>
                    <User className="h-4 w-4" />
                    <AlertTitle>Step 1: Scan Student ID</AlertTitle>
                    <AlertDescription>
                      Enter or scan the student's ID or barcode
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="studentBarcode">
                      Search Student (by name, ID, or scan barcode)
                    </Label>
                    <div ref={studentDropdownRef} className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="studentBarcode"
                          ref={studentInputRef}
                          placeholder="Type name or scan barcode..."
                          value={
                            studentSearchInput || checkoutValues.studentBarcode
                          }
                          onChange={(e) => {
                            setStudentSearchInput(e.target.value);
                            checkoutFormActions.setValue(
                              'studentBarcode',
                              e.target.value
                            );
                            setShowStudentDropdown(true);
                          }}
                          onFocus={() => setShowStudentDropdown(true)}
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Enter' &&
                              studentSearchResults.length === 0
                            ) {
                              handleScanStudent();
                            }
                          }}
                          className="pl-9 pr-8"
                          autoFocus
                        />
                        {isSearchingStudent && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {/* Dropdown results */}
                      {showStudentDropdown &&
                        (studentSearchInput || checkoutValues.studentBarcode)
                          .length >= 2 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {isSearchingStudent ? (
                              <div className="p-3 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                Searching...
                              </div>
                            ) : studentSearchResults.length > 0 ? (
                              studentSearchResults.map((student) => (
                                <button
                                  key={student.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                                  onClick={() =>
                                    handleSelectSearchStudent(student)
                                  }
                                >
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {student.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {student.studentId} • {student.gradeLevel}
                                    </p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-sm text-muted-foreground">
                                No students found. Press Enter to search by
                                barcode.
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={handleScanStudent}
                        disabled={loadingStates.scanStudent.isLoading}
                        variant="outline"
                        size="sm"
                      >
                        {loadingStates.scanStudent.isLoading ? (
                          'Searching...'
                        ) : (
                          <>
                            <Scan className="h-4 w-4 mr-2" />
                            Search by Barcode
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Scan Book */}
              {checkoutValues.checkoutStep === 'book' &&
                checkoutValues.selectedStudent && (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Student Selected</AlertTitle>
                      <AlertDescription>
                        {checkoutValues.selectedStudent.firstName}{' '}
                        {checkoutValues.selectedStudent.lastName} -{' '}
                        {checkoutValues.selectedStudent.gradeLevel}{' '}
                        {checkoutValues.selectedStudent.section}
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
                          value={checkoutValues.bookBarcode}
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
              {checkoutValues.checkoutStep === 'confirm' &&
                checkoutValues.selectedStudent &&
                checkoutValues.selectedBook && (
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
                            {checkoutValues.selectedStudent.firstName}{' '}
                            {checkoutValues.selectedStudent.lastName}
                          </div>
                          <div>
                            <strong>ID:</strong>{' '}
                            {checkoutValues.selectedStudent.studentId}
                          </div>
                          <div>
                            <strong>Grade:</strong>{' '}
                            {checkoutValues.selectedStudent.gradeLevel}{' '}
                            {checkoutValues.selectedStudent.section}
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
                            {checkoutValues.selectedBook.title}
                          </div>
                          <div>
                            <strong>Author:</strong>{' '}
                            {checkoutValues.selectedBook.author}
                          </div>
                          <div>
                            <strong>Accession No:</strong>{' '}
                            {checkoutValues.selectedBook.accessionNo}
                          </div>
                          <div>
                            <Badge
                              variant={
                                checkoutValues.selectedBook.availableCopies > 0
                                  ? 'default'
                                  : 'destructive'
                              }
                            >
                              {checkoutValues.selectedBook.availableCopies} /{' '}
                              {checkoutValues.selectedBook.totalCopies}{' '}
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
                          value={checkoutValues.dueDate}
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
                          value={checkoutValues.policyCategory}
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
                    value={returnValues.returnBarcode}
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
      {modalStates.returnConfirm && returnValues.activeCheckout && (
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

            {returnValues.activeCheckout && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <strong>Book:</strong>{' '}
                    {returnValues.activeCheckout.book.title}
                  </div>
                  <div>
                    <strong>Student:</strong>{' '}
                    {returnValues.activeCheckout.student.firstName}{' '}
                    {returnValues.activeCheckout.student.lastName}
                  </div>
                  <div>
                    <strong>Checkout Date:</strong>{' '}
                    {new Date(
                      returnValues.activeCheckout.checkoutDate
                    ).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Due Date:</strong>{' '}
                    {new Date(
                      returnValues.activeCheckout.dueDate
                    ).toLocaleDateString()}
                  </div>

                  {returnValues.activeCheckout.overdueDays > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Overdue</AlertTitle>
                      <AlertDescription>
                        <div>
                          {returnValues.activeCheckout.overdueDays} day(s)
                          overdue
                        </div>
                        <div className="font-bold">
                          Fine: ₱
                          {parseFloat(
                            returnValues.activeCheckout.fineAmount
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
