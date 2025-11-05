import { useState, Suspense, useEffect, lazy } from 'react';
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
} from 'lucide-react';
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

export default function BookCheckout() {
  // Tab management (keeping simple useState for UI state)
  const [activeTab, setActiveTab] = useState('checkout');

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

  // Scan student
  const handleScanStudent = async () => {
    const studentBarcode = checkoutForm.values.studentBarcode;
    if (!studentBarcode.trim()) {
      toast.error('Please enter a student ID or barcode');
      return;
    }

    loadingActions.scanStudent.start();
    try {
      const token = localStorage.getItem('clms_token');
      const response = await axios.get(
        `${API_BASE_URL}/students?search=${studentBarcode.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.data.students.length > 0) {
        const student = response.data.data.students[0];
        checkoutFormActions.setValue('selectedStudent', student);
        checkoutFormActions.setValue('checkoutStep', 'book');
        toast.success(
          `Student found: ${student.firstName} ${student.lastName}`
        );
      } else {
        toast.error('Student not found');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to find student');
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
      const token = localStorage.getItem('clms_token');
      const response = await axios.get(
        `${API_BASE_URL}/books?search=${bookBarcode.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.data.books.length > 0) {
        const book = response.data.data.books[0];

        if (book.availableCopies <= 0) {
          toast.error('No copies available for checkout');
          return;
        }

        checkoutFormActions.setValue('selectedBook', book);
        checkoutFormActions.setValue('checkoutStep', 'confirm');
        toast.success(`Book found: ${book.title}`);
      } else {
        toast.error('Book not found');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to find book');
    } finally {
      loadingActions.scanBook.finish();
    }
  };

  // Confirm checkout
  const handleConfirmCheckout = async () => {
    const { selectedStudent, selectedBook, dueDate } = checkoutForm.values;
    if (!selectedStudent || !selectedBook || !dueDate) {
      toast.error('Missing required information');
      return;
    }

    loadingActions.confirmCheckout.start();
    try {
      const token = localStorage.getItem('clms_token');
      const response = await axios.post(
        `${API_BASE_URL}/books/checkout`,
        {
          bookId: selectedBook.id,
          studentId: selectedStudent.id,
          dueDate: new Date(dueDate).toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Book checked out successfully!');
        resetCheckout();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to checkout book');
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
      const token = localStorage.getItem('clms_token');

      // Find active checkout for this book
      const response = await axios.get(
        `${API_BASE_URL}/books/checkouts/all?status=ACTIVE`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const checkouts = response.data.data.checkouts || [];
        const checkout = checkouts.find(
          (c: Checkout) => c.book.accessionNo === returnBarcode.trim()
        );

        if (checkout) {
          returnFormActions.setValue('activeCheckout', checkout);
          modalActions.returnConfirm.open();
        } else {
          toast.error('No active checkout found for this book');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to find checkout');
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
      const token = localStorage.getItem('clms_token');
      const response = await axios.post(
        `${API_BASE_URL}/books/return`,
        { checkoutId: activeCheckout.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const fine = parseFloat(activeCheckout.fineAmount);
        if (fine > 0) {
          toast.success(`Book returned! Fine: ₱${fine.toFixed(2)}`);
        } else {
          toast.success('Book returned successfully!');
        }

        returnFormActions.reset({
          returnBarcode: '',
          activeCheckout: null,
        });
        modalActions.returnConfirm.close();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to return book');
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
                        placeholder="Enter student ID or scan barcode..."
                        value={checkoutForm.values.studentBarcode}
                        onChange={(e) =>
                          checkoutFormActions.setValue(
                            'studentBarcode',
                            e.target.value
                          )
                        }
                        onKeyPress={(e) =>
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
                          placeholder="Enter accession number or scan barcode..."
                          value={checkoutForm.values.bookBarcode}
                          onChange={(e) =>
                            checkoutFormActions.setValue(
                              'bookBarcode',
                              e.target.value
                            )
                          }
                          onKeyPress={(e) =>
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
                    onKeyPress={(e) => e.key === 'Enter' && handleScanReturn()}
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
      <Dialog
        open={!!modalStates.returnConfirm}
        onOpenChange={(open) => modalActions.returnConfirm.setState(open)}
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
    </div>
  );
}
