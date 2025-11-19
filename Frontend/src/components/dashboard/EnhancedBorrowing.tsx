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
import { Textarea } from '@/components/ui/textarea';
import { Book, Search, User, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { enhancedLibraryApi, studentsApi } from '@/lib/api';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  materialType: 'Filipiniana' | 'Fiction' | 'Easy Books' | 'Reference' | 'Textbook';
  available: boolean;
  location: string;
  dueDate?: string;
}

interface Student {
  id: string;
  studentId: string;
  name: string;
  gradeLevel: string;
  currentLoans: number;
  maxLoans: number;
  canBorrow: boolean;
}


const materialPolicies = {
  Filipiniana: { days: 3, description: '3 days loan period' },
  Fiction: { days: 7, description: '7 days loan period' },
  'Easy Books': { days: 1, description: '1 day (overnight) loan period' },
  Reference: { days: 1, description: '1 day (library use only)' },
  Textbook: { days: 7, description: '7 days loan period' }
};

export function EnhancedBorrowing() {
  const [step, setStep] = useState<'student' | 'books' | 'confirm'>('student');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);
  const [notes, setNotes] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBooksRefreshing, setIsBooksRefreshing] = useState(false);

  const fetchStudents = async () => {
    try {
      const response = await studentsApi.getStudents();
      if (response.success && response.data) {
        const mapped = (response.data as any[]).map((s: any) => ({
          id: s.id || s.student_id || `S-${Date.now()}`,
          studentId: s.student_id || s.id || 'UNKNOWN',
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || 'Unknown',
          gradeLevel:
            typeof s.grade_level === 'number'
              ? `Grade ${s.grade_level}`
              : String(s.grade_level || 'Grade 5'),
          currentLoans: Number(s.current_loans || 0),
          maxLoans: Number(s.max_loans || 3),
          canBorrow: Boolean(s.can_borrow ?? true),
        })) as Student[];
        setStudents(mapped);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      if (!import.meta.env.DEV) {
        toast.error('Error loading students');
      }
    }
  };

  const fetchBooks = async () => {
    setIsBooksRefreshing(true);
    try {
      const response = await enhancedLibraryApi.getAvailableBooks();
      if (response.success && response.data) {
        const raw = response.data as any[];
        const toMaterialType = (v: unknown): Book['materialType'] => {
          const s = String(v || '').trim();
          if (s === 'Filipiniana' || s === 'Fiction' || s === 'Easy Books' || s === 'Reference' || s === 'Textbook') {
            return s as Book['materialType'];
          }
          return 'Fiction';
        };
        const data: Book[] = (raw || []).map((b: any) => ({
          id: String(b.id),
          title: String(b.title || ''),
          author: String(b.author || ''),
          isbn: String(b.isbn || ''),
          materialType: toMaterialType(b.category || b.materialType),
          available: Number(b.available_copies ?? 0) > 0 && Boolean(b.is_active ?? true),
          location: String(b.location || 'General Shelf'),
        }));
        if ((import.meta.env.DEV || String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development')) && (!data || data.length === 0)) {
          setBooks([
            {
              id: 'BOOK-1',
              title: 'Sample Book',
              author: 'John Doe',
              isbn: '9780000000001',
              materialType: 'Fiction',
              available: true,
              location: 'Shelf A1',
            },
            {
              id: 'BOOK-2',
              title: 'Another Sample',
              author: 'Jane Roe',
              isbn: '9780000000002',
              materialType: 'Filipiniana',
              available: true,
              location: 'Shelf B2',
            },
          ]);
        } else {
          setBooks(data);
        }
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      if (!import.meta.env.DEV) {
        toast.error('Error loading books');
      }
    }
    finally {
      setIsBooksRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchBooks();
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      if (students.length === 0) {
        setStudents([
          {
            id: 'STU-1',
            studentId: 'S-0001',
            name: 'Alice Example',
            gradeLevel: 'Grade 5',
            currentLoans: 0,
            maxLoans: 3,
            canBorrow: true,
          },
        ]);
      }
      if (books.length === 0) {
        setBooks([
          {
            id: 'BOOK-1',
            title: 'Sample Book',
            author: 'John Doe',
            isbn: '9780000000001',
            materialType: 'Fiction',
            available: true,
            location: 'Shelf A1',
          },
          {
            id: 'BOOK-2',
            title: 'Another Sample',
            author: 'Jane Roe',
            isbn: '9780000000002',
            materialType: 'Filipiniana',
            available: true,
            location: 'Shelf B2',
          },
        ]);
      }
    }
  }, [students, books]);

  const getStudentDisplayName = (s: any) => {
    const base = typeof s?.name === 'string' && s.name.trim().length > 0 ? s.name : `${s?.firstName ?? ''} ${s?.lastName ?? ''}`.trim();
    return base || '';
  };

  const filteredStudents = students.filter((student) => {
    const name = getStudentDisplayName(student).toLowerCase();
    const sid = String(student?.studentId || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return (name && name.includes(q)) || (sid && sid.includes(q));
  });

  const filteredBooks = books.filter((book) => {
    const title = String(book?.title || '').toLowerCase();
    const author = String(book?.author || '').toLowerCase();
    const isbn = String(book?.isbn || '');
    const q = bookSearchTerm.toLowerCase();
    const matchesSearch = (title && title.includes(q)) || (author && author.includes(q)) || (isbn && isbn.includes(bookSearchTerm));
    const matchesType = selectedMaterialType === 'all' || book.materialType === selectedMaterialType;
    return matchesSearch && matchesType && book.available;
  });

  const handleStudentSelect = (student: Student) => {
    if (!student.canBorrow) {
      toast.error('Student cannot borrow books - maximum loans reached');
      return;
    }
    setSelectedStudent(student);
    setStep('books');
    toast.success(`Selected ${student.name}`);
  };

  const handleBookToggle = (book: Book) => {
    if (!selectedStudent) return;

    const isSelected = selectedBooks.some(b => b.id === book.id);
    const currentCount = selectedBooks.length;
    const maxAllowed = selectedStudent.maxLoans - selectedStudent.currentLoans;

    if (isSelected) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id));
    } else if (currentCount < maxAllowed) {
      setSelectedBooks([...selectedBooks, book]);
    } else {
      toast.error(`Maximum ${maxAllowed} books allowed for this student`);
    }
  };

  const calculateDueDate = (materialType: string) => {
    const policy = materialPolicies[materialType as keyof typeof materialPolicies];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (policy?.days || 7));
    return dueDate.toISOString().split('T')[0];
  };

  const handleConfirmBorrow = async () => {
    if (!selectedStudent || selectedBooks.length === 0) {
      toast.error('Please select books to borrow');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await enhancedLibraryApi.borrowBooks(
        selectedStudent.id,
        selectedBooks.map(book => book.id),
        selectedBooks[0].materialType
      );

      if (response.success) {
        toast.success('Books borrowed successfully!');
        setStep('student');
        setSelectedStudent(null);
        setSelectedBooks([]);
        setNotes('');
        fetchBooks();
        fetchStudents();
      } else {
        if ((import.meta.env.DEV) || String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development')) {
          toast.success('Books borrowed in development (sample)');
          setStep('student');
          setSelectedStudent(null);
          setSelectedBooks([]);
          setNotes('');
        } else {
          const errMsg = typeof (response as any)?.error === 'string' ? (response as any).error : (response as any)?.error?.message || 'Failed to borrow books';
          toast.error(String(errMsg));
        }
      }
    } catch (error) {
      console.error('Error borrowing books:', error);
      if ((import.meta.env.DEV) || String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development')) {
        toast.success('Borrow simulated in development');
        setStep('student');
        setSelectedStudent(null);
        setSelectedBooks([]);
        setNotes('');
      } else {
        const msg = (error as any)?.message || 'Error processing borrowing';
        toast.error(String(msg));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getMaterialTypeColor = (type: string) => {
    const colors = {
      Filipiniana: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      Fiction: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Easy Books': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      Reference: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      Textbook: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (step === 'student') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Student
            </CardTitle>
            <CardDescription>Choose a student to borrow books</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <Card 
                  key={student.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    student.canBorrow ? 'border-green-200' : 'border-red-200 opacity-60'
                  }`}
                  onClick={() => handleStudentSelect(student)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{student.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {student.studentId} • {student.gradeLevel}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {student.currentLoans}/{student.maxLoans} books
                        </div>
                        <Badge 
                          variant={student.canBorrow ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {student.canBorrow ? "Can Borrow" : "Max Reached"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredStudents.length === 0 && (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No students match your search' : 'No students available'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'books') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  Select Books
                </CardTitle>
                <CardDescription>
                  Choose books for {selectedStudent?.name} (max {selectedStudent?.maxLoans - (selectedStudent?.currentLoans || 0)} books)
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setStep('student')}
              >
                Change Student
              </Button>
              <Button
                variant="outline"
                onClick={fetchBooks}
                className="ml-2"
                disabled={isBooksRefreshing}
              >
                {isBooksRefreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh Books'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search books by title, author, or ISBN..."
                value={bookSearchTerm}
                onChange={(e) => setBookSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isBooksRefreshing}
              />
              </div>
              <select
                value={selectedMaterialType}
                onChange={(e) => setSelectedMaterialType(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
                disabled={isBooksRefreshing}
              >
                <option value="all">All Types</option>
                <option value="Filipiniana">Filipiniana (3 days)</option>
                <option value="Fiction">Fiction (7 days)</option>
                <option value="Easy Books">Easy Books (1 day)</option>
                <option value="Reference">Reference (1 day)</option>
                <option value="Textbook">Textbook (7 days)</option>
              </select>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Selected:</strong> {selectedBooks.length} books
                {selectedBooks.length > 0 && (
                  <span className="ml-2">
                    Due: {calculateDueDate(selectedBooks[0].materialType)}
                  </span>
                )}
              </p>
            </div>

            <div className="grid gap-4">
              {filteredBooks.map((book) => {
                const isSelected = selectedBooks.some(b => b.id === book.id);
                return (
                  <Card 
                    key={book.id} 
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'hover:shadow-md'
                    }`}
                    onClick={() => handleBookToggle(book)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : (
                              <Book className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{book.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              by {book.author}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getMaterialTypeColor(book.materialType)}>
                                {book.materialType}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ISBN: {book.isbn}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Location: {book.location}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-green-600">
                            Available
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            Due: {calculateDueDate(book.materialType)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-8">
                <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {bookSearchTerm || selectedMaterialType !== 'all' 
                    ? 'No books match your search criteria' 
                    : 'No books available for borrowing'}
                </p>
              </div>
            )}

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">
                Notes (optional)
              </label>
              <Textarea
                placeholder="Add any special notes about this borrowing..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setStep('student')}
              >
                Back to Students
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={selectedBooks.length === 0}
              >
                Continue to Confirmation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Confirm Borrowing
            </CardTitle>
            <CardDescription>Review and confirm the borrowing details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="font-semibold mb-2">Student Information</h3>
                <p><strong>Name:</strong> {selectedStudent?.name}</p>
                <p><strong>ID:</strong> {selectedStudent?.studentId}</p>
                <p><strong>Grade:</strong> {selectedStudent?.gradeLevel}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Books to Borrow ({selectedBooks.length})</h3>
                <div className="space-y-3">
                  {selectedBooks.map((book) => (
                    <Card key={book.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{book.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            by {book.author}
                          </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getMaterialTypeColor(book.materialType)}>
                                {book.materialType}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Due: {calculateDueDate(book.materialType)}
                              </span>
                            </div>
                          </div>
                          <Book className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {notes && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <h3 className="font-semibold mb-1">Notes</h3>
                  <p className="text-sm">{notes}</p>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep('books')}
                >
                  Back to Books
                </Button>
                <Button
                  onClick={handleConfirmBorrow}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Borrowing
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}