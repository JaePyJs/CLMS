import React, { useState, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Lazy load CheckoutHistory component
const CheckoutHistory = React.lazy(() => import('./CheckoutHistory'));
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BookOpen, User, CheckCircle, AlertCircle, RotateCcw, Scan, History } from 'lucide-react';
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
  // Checkout state
  const [checkoutStep, setCheckoutStep] = useState<'student' | 'book' | 'confirm'>('student');
  const [studentBarcode, setStudentBarcode] = useState('');
  const [bookBarcode, setBookBarcode] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Return state
  const [returnBarcode, setReturnBarcode] = useState('');
  const [activeCheckout, setActiveCheckout] = useState<Checkout | null>(null);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('checkout');

  // Calculate default due date (7 days from now)
  const getDefaultDueDate = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0] ?? '';
  };

  // Initialize due date
  React.useEffect(() => {
    setDueDate(getDefaultDueDate());
  }, []);

  // Scan student
  const handleScanStudent = async () => {
    if (!studentBarcode.trim()) {
      toast.error('Please enter a student ID or barcode');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('clms_token');
      const response = await axios.get(
        `${API_BASE_URL}/students?search=${studentBarcode.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.data.students.length > 0) {
        const student = response.data.data.students[0];
        setSelectedStudent(student);
        setCheckoutStep('book');
        toast.success(`Student found: ${student.firstName} ${student.lastName}`);
      } else {
        toast.error('Student not found');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to find student');
    } finally {
      setLoading(false);
    }
  };

  // Scan book
  const handleScanBook = async () => {
    if (!bookBarcode.trim()) {
      toast.error('Please enter a book accession number or barcode');
      return;
    }

    setLoading(true);
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

        setSelectedBook(book);
        setCheckoutStep('confirm');
        toast.success(`Book found: ${book.title}`);
      } else {
        toast.error('Book not found');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to find book');
    } finally {
      setLoading(false);
    }
  };

  // Confirm checkout
  const handleConfirmCheckout = async () => {
    if (!selectedStudent || !selectedBook || !dueDate) {
      toast.error('Missing required information');
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  };

  // Reset checkout flow
  const resetCheckout = () => {
    setCheckoutStep('student');
    setStudentBarcode('');
    setBookBarcode('');
    setSelectedStudent(null);
    setSelectedBook(null);
    setDueDate(getDefaultDueDate());
  };

  // Scan book for return
  const handleScanReturn = async () => {
    if (!returnBarcode.trim()) {
      toast.error('Please enter a book accession number or barcode');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('clms_token');

      // Find active checkout for this book
      const response = await axios.get(
        `${API_BASE_URL}/books/checkouts/all?status=ACTIVE`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const checkouts = response.data.data.checkouts || [];
        const checkout = checkouts.find((c: Checkout) =>
          c.book.accessionNo === returnBarcode.trim()
        );

        if (checkout) {
          setActiveCheckout(checkout);
          setShowReturnConfirm(true);
        } else {
          toast.error('No active checkout found for this book');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to find checkout');
    } finally {
      setLoading(false);
    }
  };

  // Confirm return
  const handleConfirmReturn = async () => {
    if (!activeCheckout) return;

    setLoading(true);
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

        setReturnBarcode('');
        setActiveCheckout(null);
        setShowReturnConfirm(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to return book');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Book Checkout & Return</h2>
        <p className="text-muted-foreground">Manage book borrowing and returns</p>
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
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* CHECKOUT TAB */}
        <TabsContent value="checkout" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Book Checkout Process</CardTitle>
              <CardDescription>Scan student ID, then scan book to checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step Indicator */}
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${checkoutStep === 'student' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutStep === 'student' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    1
                  </div>
                  <span className="font-medium">Student</span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div className={`flex items-center gap-2 ${checkoutStep === 'book' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutStep === 'book' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    2
                  </div>
                  <span className="font-medium">Book</span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div className={`flex items-center gap-2 ${checkoutStep === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checkoutStep === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    3
                  </div>
                  <span className="font-medium">Confirm</span>
                </div>
              </div>

              {/* Step 1: Scan Student */}
              {checkoutStep === 'student' && (
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
                        value={studentBarcode}
                        onChange={(e) => setStudentBarcode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleScanStudent()}
                        autoFocus
                      />
                      <Button onClick={handleScanStudent} disabled={loading}>
                        {loading ? 'Searching...' : <><Scan className="h-4 w-4 mr-2" />Find</>}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Scan Book */}
              {checkoutStep === 'book' && selectedStudent && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Student Selected</AlertTitle>
                    <AlertDescription>
                      {selectedStudent.firstName} {selectedStudent.lastName} - {selectedStudent.gradeLevel} {selectedStudent.section}
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
                        value={bookBarcode}
                        onChange={(e) => setBookBarcode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleScanBook()}
                        autoFocus
                      />
                      <Button onClick={handleScanBook} disabled={loading}>
                        {loading ? 'Searching...' : <><Scan className="h-4 w-4 mr-2" />Find</>}
                      </Button>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => setCheckoutStep('student')}>
                    Back to Student Selection
                  </Button>
                </div>
              )}

              {/* Step 3: Confirm */}
              {checkoutStep === 'confirm' && selectedStudent && selectedBook && (
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
                        <div><strong>Name:</strong> {selectedStudent.firstName} {selectedStudent.lastName}</div>
                        <div><strong>ID:</strong> {selectedStudent.studentId}</div>
                        <div><strong>Grade:</strong> {selectedStudent.gradeLevel} {selectedStudent.section}</div>
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
                        <div><strong>Title:</strong> {selectedBook.title}</div>
                        <div><strong>Author:</strong> {selectedBook.author}</div>
                        <div><strong>Accession No:</strong> {selectedBook.accessionNo}</div>
                        <div>
                          <Badge variant={selectedBook.availableCopies > 0 ? "default" : "destructive"}>
                            {selectedBook.availableCopies} / {selectedBook.totalCopies} Available
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleConfirmCheckout} disabled={loading} className="flex-1">
                      {loading ? 'Processing...' : <><CheckCircle className="h-4 w-4 mr-2" />Confirm Checkout</>}
                    </Button>
                    <Button variant="outline" onClick={() => setCheckoutStep('book')}>
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
              <CardDescription>Scan the book's barcode to process return</CardDescription>
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
                    value={returnBarcode}
                    onChange={(e) => setReturnBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleScanReturn()}
                    autoFocus
                  />
                  <Button onClick={handleScanReturn} disabled={loading}>
                    {loading ? 'Searching...' : <><Scan className="h-4 w-4 mr-2" />Find</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            <CheckoutHistory />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Return Confirmation Dialog */}
      <Dialog open={showReturnConfirm} onOpenChange={setShowReturnConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Book Return</DialogTitle>
            <DialogDescription>Review the checkout details below</DialogDescription>
          </DialogHeader>

          {activeCheckout && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div><strong>Book:</strong> {activeCheckout.book.title}</div>
                <div><strong>Student:</strong> {activeCheckout.student.firstName} {activeCheckout.student.lastName}</div>
                <div><strong>Checkout Date:</strong> {new Date(activeCheckout.checkoutDate).toLocaleDateString()}</div>
                <div><strong>Due Date:</strong> {new Date(activeCheckout.dueDate).toLocaleDateString()}</div>

                {activeCheckout.overdueDays > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Overdue</AlertTitle>
                    <AlertDescription>
                      <div>{activeCheckout.overdueDays} day(s) overdue</div>
                      <div className="font-bold">Fine: ₱{parseFloat(activeCheckout.fineAmount).toFixed(2)}</div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReturn} disabled={loading}>
              {loading ? 'Processing...' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
