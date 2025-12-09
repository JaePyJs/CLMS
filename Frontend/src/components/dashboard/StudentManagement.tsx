import { useCallback, useMemo, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useMobileOptimization,
  useTouchOptimization,
  getResponsiveClasses,
} from '@/hooks/useMobileOptimization';
import { useMultipleLoadingStates } from '@/hooks/useLoadingState';
import { useMultipleModals } from '@/hooks/useModalState';
import { useForm } from '@/hooks/useFormState';
import { useDataRefresh } from '@/hooks/useDataRefresh';
import { studentsApi, utilitiesApi } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StudentBarcodeDialog } from './StudentBarcodeDialog';
import { StudentImportDialog } from './StudentImportDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorHandling';
import {
  Users,
  UserPlus,
  Search,
  Download,
  Eye,
  Edit,
  Trash2,
  Settings,
  QrCode,
  Award,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  FileText,
  Upload,
  UserMinus,
  UserCheck,
  MessageSquare,
  CreditCard,
  ExternalLink,
  TrendingUp,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Student {
  id: string;
  studentId: string;
  barcode?: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gradeCategory: string;
  section?: string;
  gender?: string;
  isActive: boolean;
  email?: string;
  phone?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  emergencyContact?: string;
  notes?: string;
  joinDate: string;
  lastActivity?: string;
  totalSessions: number;
  specialPrivileges: string[];
  disciplinaryFlags: number;
  qrCodeGenerated: boolean;
  barcodeGenerated: boolean;
  libraryCardPrinted: boolean;
  type: 'STUDENT' | 'PERSONNEL'; // Add type field
}

// Define the API response type
interface StudentsApiResponse {
  students: Student[];
  total: number;
  pagination: {
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

// Backend student data structure (snake_case from API)
interface BackendStudent {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: number;
  grade_category: string;
  section?: string;
  gender?: string;
  is_active: boolean;
  type?: 'STUDENT' | 'PERSONNEL'; // Add type field
  email?: string;
  phone?: string;
  address?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  emergency_contact?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  barcode?: string;
}

import { useWebSocketContext } from '@/contexts/WebSocketContext';

// Interface for active session data
interface ActiveSession {
  student_id: string;
  studentId?: string;
  [key: string]: unknown;
}

export function StudentManagement() {
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocketContext();

  // Mobile optimization
  const mobileState = useMobileOptimization();
  const { isMobile, isTablet } = mobileState;
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();

  // Data refresh with query
  const [studentsRefreshState, studentsRefreshActions] = useDataRefresh(
    async (): Promise<StudentsApiResponse> => {
      const [studentsResponse, activeSessionsResponse] = await Promise.all([
        studentsApi.getAll(),
        studentsApi.getActiveSessions(),
      ]);

      const studentsData = (studentsResponse?.data || []) as BackendStudent[];
      const activeSessions = (activeSessionsResponse?.data ||
        []) as ActiveSession[];
      const activeStudentIds = new Set(
        activeSessions.map((s) => s.student_id || s.studentId)
      );

      const transformedData: StudentsApiResponse = {
        students: studentsData.map((student) => {
          // Determine type - check if type field exists, or infer from student_id prefix
          const isPersonnel =
            student.type === 'PERSONNEL' ||
            student.student_id?.startsWith('PN');

          // Format grade level - show "Staff" for personnel, handle grade 0 for kindergarten
          let gradeDisplay = '';
          if (isPersonnel) {
            gradeDisplay = 'Staff';
          } else if (student.grade_level === 0) {
            gradeDisplay = 'Pre-School';
          } else {
            gradeDisplay = `Grade ${student.grade_level}`;
          }

          return {
            id: student.id,
            studentId: student.student_id,
            barcode: student.barcode,
            firstName: student.first_name,
            lastName: student.last_name,
            gradeLevel: gradeDisplay,
            gradeCategory: student.grade_category,
            section: student.section,
            gender: student.gender,
            isActive: activeStudentIds.has(student.id), // Use real-time presence status
            type: isPersonnel ? 'PERSONNEL' : 'STUDENT',
            email: student.email,
            phone: student.phone,
            address: student.address,
            parentName: student.parent_name,
            parentPhone: student.parent_phone,
            parentEmail: student.parent_email,
            emergencyContact: student.emergency_contact,
            notes: student.notes,
            joinDate: student.created_at,
            lastActivity: student.updated_at,
            totalSessions: 0,
            specialPrivileges: [],
            disciplinaryFlags: 0,
            qrCodeGenerated: !!student.barcode,
            barcodeGenerated: !!student.barcode,
            libraryCardPrinted: false,
          };
        }),
        total:
          (studentsResponse?.data as unknown as { count?: number })?.count ||
          studentsData.length,
        pagination: {},
      };
      return transformedData;
    },
    {
      interval: 5 * 60 * 1000, // Refresh every 5 minutes
    }
  );

  // Real-time updates from WebSocket
  useEffect(() => {
    if (lastMessage) {
      const type = lastMessage.type;
      if (
        type === 'student_checkin' ||
        type === 'student_checkout' ||
        type === 'attendance:checkin' ||
        type === 'attendance:checkout'
      ) {
        // Refresh student list to update status
        studentsRefreshActions.refresh();
      }
    }
  }, [lastMessage, studentsRefreshActions]);

  const students = studentsRefreshState.data?.students || [];
  const [isStudentsRefreshing, setIsStudentsRefreshing] = useState(false);

  // Local search and filter state - declared early so useMemo can use them
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Calculate real stats from students data
  const realStats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.isActive).length;
    const inactive = total - active;
    const newThisMonth = students.filter((s) => {
      const joinDate = new Date(s.joinDate);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return joinDate >= monthStart;
    }).length;
    const averageSessions =
      total > 0
        ? students.reduce((sum, s) => sum + s.totalSessions, 0) / total
        : 0;
    const overdueReturns = 0; // TODO: Calculate from checkouts

    return {
      total,
      active,
      inactive,
      newThisMonth,
      averageSessions,
      overdueReturns,
    };
  }, [students]);

  // Manual filtering based on local search state
  const filteredStudents = useMemo(() => {
    let filtered = students;

    // Apply search term (using local searchTerm state)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (student: Student) =>
          student.firstName.toLowerCase().includes(term) ||
          student.lastName.toLowerCase().includes(term) ||
          student.studentId.toLowerCase().includes(term)
      );
    }

    // Apply status filter (using local filterStatus state)
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter((student: Student) =>
        filterStatus === 'active' ? student.isActive : !student.isActive
      );
    }

    // Apply grade filter (using local filterGrade state)
    if (filterGrade && filterGrade !== 'all') {
      filtered = filtered.filter(
        (student: Student) => student.gradeCategory === filterGrade
      );
    }

    // Apply type filter (Students vs Personnel)
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter((student: Student) =>
        filterType === 'students'
          ? student.type === 'STUDENT'
          : student.type === 'PERSONNEL'
      );
    }

    return filtered;
  }, [students, searchTerm, filterStatus, filterGrade, filterType]);

  // Modal states
  const [, modalActions] = useMultipleModals({
    addStudent: false,
    editStudent: false,
    studentDetails: false,
    bulkImport: false,
    studentBarcode: false,
  });

  // Form state for new student
  const [formState, formActions] = useForm({
    initialValues: {
      studentId: '',
      barcode: '',
      firstName: '',
      lastName: '',
      gradeLevel: '',
      section: '',
      gender: '',
      email: '',
      phone: '',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      emergencyContact: '',
      address: '',
      notes: '',
    },
    validationSchema: {
      studentId: { required: true, minLength: 1 },
      firstName: { required: true, minLength: 1 },
      lastName: { required: true, minLength: 1 },
      gradeLevel: { required: true },
    },
  });

  // Type-safe accessor for form values
  interface StudentFormValues {
    studentId: string;
    barcode: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    section: string;
    gender: string;
    email: string;
    phone: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    emergencyContact: string;
    address: string;
    notes: string;
  }
  const newStudent = formState.values as unknown as StudentFormValues;

  // Loading states for different operations
  const [, loadingActions] = useMultipleLoadingStates({
    generatingQRCodes: {},
    printingIDs: {},
    exporting: {},
    sendingNotifications: {},
  });

  // Component state
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [activeTab, setActiveTab] = useState('students');

  // Missing state variables
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [showStudentBarcode, setShowStudentBarcode] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isGeneratingQRCodes] = useState(false);
  const [isPrintingIDs] = useState(false);
  const [isExporting] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterGrade]);

  // Mutations
  const createStudentMutation = useMutation({
    mutationFn: (studentData: Partial<Student>) =>
      studentsApi.createStudent(studentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student added successfully!');
      modalActions.addStudent.close();
      formActions.resetForm();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to add student'));
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) => {
      const payload: Record<string, unknown> = {};
      if (data.firstName !== undefined) payload.first_name = data.firstName;
      if (data.lastName !== undefined) payload.last_name = data.lastName;
      if (data.gradeLevel !== undefined) {
        payload.grade_level = Number(data.gradeLevel.match(/\d+/)?.[0] || 0);
        payload.grade_category = getGradeCategory(data.gradeLevel);
      }
      if (data.section !== undefined) payload.section = data.section;
      if (data.isActive !== undefined) payload.is_active = data.isActive;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.email !== undefined) payload.email = data.email;
      if (data.phone !== undefined) payload.phone = data.phone;
      // Allow updating barcode and student_id
      if (data.barcode !== undefined) payload.barcode = data.barcode;
      if (data.studentId !== undefined) payload.student_id = data.studentId;
      return studentsApi.updateStudent(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated successfully!');
      modalActions.editStudent.close();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to update student'));
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (id: string) => studentsApi.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student deleted successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to delete student'));
    },
  });

  const generateQRCodesMutation = useMutation({
    mutationFn: () => utilitiesApi.generateQRCodes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('QR codes generated successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to generate QR codes'));
    },
  });

  const generateBarcodesMutation = useMutation({
    mutationFn: () => utilitiesApi.generateBarcodes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Barcodes generated successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to generate barcodes'));
    },
  });

  // Mock data

  // Handler functions
  const handleAddStudent = async () => {
    if (
      !newStudent.studentId ||
      !newStudent.firstName ||
      !newStudent.lastName ||
      !newStudent.gradeLevel
    ) {
      toast.error(
        'Please fill in required fields (Student ID, First Name, Last Name, Grade)'
      );
      return;
    }

    const apiPayload: Record<string, unknown> = {
      student_id: newStudent.studentId,
      barcode: newStudent.barcode || newStudent.studentId, // Use barcode if provided, otherwise use student ID
      first_name: newStudent.firstName,
      last_name: newStudent.lastName,
      grade_level: Number(newStudent.gradeLevel.match(/\d+/)?.[0] || 0),
      grade_category: getGradeCategory(newStudent.gradeLevel),
      section: newStudent.section || undefined,
      gender: newStudent.gender || undefined,
      email: newStudent.email || undefined,
      phone: newStudent.phone || undefined,
      parent_name: newStudent.parentName || undefined,
      parent_phone: newStudent.parentPhone || undefined,
      parent_email: newStudent.parentEmail || undefined,
      emergency_contact: newStudent.emergencyContact || undefined,
      address: newStudent.address || undefined,
      notes: newStudent.notes || undefined,
    };

    createStudentMutation.mutate(apiPayload);
  };

  const handleEditStudent = () => {
    if (!selectedStudent) {
      return;
    }

    updateStudentMutation.mutate({
      id: selectedStudent.id,
      data: selectedStudent,
    });
  };

  const handleDeleteStudent = (studentId: string) => {
    const student = students.find((s: Student) => s.id === studentId);
    if (student) {
      setStudentToDelete(student);
      setDeleteConfirmOpen(true);
    }
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate(studentToDelete.id);
      setStudentToDelete(null);
    }
  };

  const handleToggleStatus = (studentId: string) => {
    const student = students.find((s: Student) => s.id === studentId);
    if (student) {
      updateStudentMutation.mutate({
        id: studentId,
        data: { ...student, isActive: !student.isActive },
      });
    }
  };

  const handleGenerateQRCodes = async () => {
    loadingActions.generatingQRCodes.start();
    try {
      await generateQRCodesMutation.mutateAsync();
    } catch {
      // Error handled by mutation
    } finally {
      loadingActions.generatingQRCodes.finish();
    }
  };

  const handlePrintIDCards = async () => {
    loadingActions.printingIDs.start();
    try {
      await generateBarcodesMutation.mutateAsync();
      toast.success('ID cards printed successfully!');
    } catch {
      // Error handled by mutation
    } finally {
      loadingActions.printingIDs.finish();
    }
  };

  const handleExportStudents = async () => {
    loadingActions.exporting.start();
    try {
      const csvContent = [
        'Student ID,First Name,Last Name,Grade,Section,Status,Email,Phone,Join Date,Total Sessions',
        ...filteredStudents.map(
          (s: Student) =>
            `${s.studentId},${s.firstName},${s.lastName},${s.gradeLevel},${s.section || ''},${s.isActive ? 'Active' : 'Inactive'},${s.email || ''},${s.phone || ''},${s.joinDate},${s.totalSessions}`
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Students exported successfully!');
    } catch {
      toast.error('Failed to export students');
    } finally {
      loadingActions.exporting.finish();
    }
  };

  const handleBulkNotification = async () => {
    setIsSendingNotifications(true);
    try {
      // Simulate sending notifications
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(
        `Notifications sent to ${selectedStudents.length} parents!`
      );
      setSelectedStudents([]);
      setShowBulkActions(false);
    } catch {
      toast.error('Failed to send notifications');
    } finally {
      setIsSendingNotifications(false);
    }
  };

  const handleBulkGradeUpdate = async (grade: string) => {
    try {
      // Update each selected student
      await Promise.all(
        selectedStudents.map((id) =>
          updateStudentMutation.mutateAsync({
            id,
            data: {
              gradeLevel: grade,
              gradeCategory: getGradeCategory(grade),
            },
          })
        )
      );
      toast.success(`Grade updated for ${selectedStudents.length} students!`);
      setSelectedStudents([]);
      setShowBulkActions(false);
    } catch {
      // Error handled by mutation
      toast.error('Failed to update some students');
    }
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive') => {
    try {
      // Update each selected student
      await Promise.all(
        selectedStudents.map((id) =>
          updateStudentMutation.mutateAsync({
            id,
            data: { isActive: status === 'active' },
          })
        )
      );
      toast.success(`Status updated for ${selectedStudents.length} students!`);
      setSelectedStudents([]);
      setShowBulkActions(false);
    } catch {
      // Error handled by mutation
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getGradeCategory = (grade: string): string => {
    const gradeLower = grade.toLowerCase();
    if (gradeLower.includes('pre-school') || gradeLower.includes('preschool')) {
      return 'preschool';
    }
    if (
      gradeLower.includes('kindergarten') ||
      gradeLower.includes('k') ||
      grade.includes('1') ||
      grade.includes('2') ||
      grade.includes('3')
    ) {
      return 'primary';
    }
    if (grade.includes('4') || grade.includes('5') || grade.includes('6')) {
      return 'gradeSchool';
    }
    if (grade.includes('7') || grade.includes('8') || grade.includes('9')) {
      return 'juniorHigh';
    }
    if (grade.includes('10') || grade.includes('11') || grade.includes('12')) {
      return 'seniorHigh';
    }
    return 'unknown';
  };

  const handleViewStudentHistory = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDetails(true);
    toast.info(`Viewing history for ${student.firstName} ${student.lastName}`);
  };

  const handlePrintSchedule = (student: Student) => {
    toast.info(
      `Printing schedule for ${student.firstName} ${student.lastName}`
    );
  };

  const handleSendParentMessage = (student: Student) => {
    // Open email or phone contact based on available info
    if (student.parentEmail) {
      const subject = encodeURIComponent(
        `Regarding ${student.firstName} ${student.lastName}`
      );
      const body = encodeURIComponent(
        `Dear ${student.parentName || 'Parent/Guardian'},\n\nThis is a message from the school library regarding your child, ${student.firstName} ${student.lastName}.\n\n`
      );
      window.open(
        `mailto:${student.parentEmail}?subject=${subject}&body=${body}`,
        '_blank'
      );
      toast.success('Opening email composer...');
    } else if (student.parentPhone) {
      // Copy phone to clipboard for easy calling
      navigator.clipboard.writeText(student.parentPhone);
      toast.success(`Phone number copied: ${student.parentPhone}`);
    } else {
      toast.error("No contact information available for this student's parent");
    }
  };

  const handleAwardStudent = (student: Student) => {
    // Simple award system - add recognition note
    const awardTypes = [
      'Top Reader of the Month',
      'Most Books Read',
      'Perfect Attendance',
      'Library Helper',
      'Reading Champion',
    ];

    const selectedAward = prompt(
      `Select award for ${student.firstName} ${student.lastName}:\n\n` +
        awardTypes.map((a, i) => `${i + 1}. ${a}`).join('\n') +
        '\n\nEnter number (1-5) or custom award text:'
    );

    if (selectedAward) {
      const awardText = /^[1-5]$/.test(selectedAward.trim())
        ? awardTypes[parseInt(selectedAward.trim()) - 1]
        : selectedAward;

      const currentNotes = student.notes || '';
      const timestamp = new Date().toLocaleDateString();
      const newNotes =
        `${currentNotes}\n[AWARD ${timestamp}] ${awardText}`.trim();

      updateStudentMutation.mutate({
        id: student.id,
        data: { notes: newNotes },
      });
      toast.success(
        `Award "${awardText}" added to ${student.firstName}'s record!`
      );
    }
  };

  const handleAddNotes = async (student: Student) => {
    const notes = prompt('Add notes for this student:', student.notes || '');
    if (notes !== null) {
      try {
        await updateStudentMutation.mutateAsync({
          id: student.id,
          data: { notes },
        });
        toast.success('Notes updated!');
      } catch {
        // Error handled by mutation
      }
    }
  };

  const handleViewStudentBarcode = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentBarcode(true);
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle swipe gestures for mobile navigation
  const handleTouchEndWithGesture = useCallback(
    (e: React.TouchEvent) => {
      if (isMobile) {
        const gesture = handleTouchEnd(e);
        if (gesture) {
          if (gesture === 'swipe-left') {
            // Navigate to next tab
            const tabs = ['overview', 'students', 'bulk', 'reports'];
            const currentIndex = tabs.indexOf(activeTab);
            if (currentIndex < tabs.length - 1) {
              const nextTab = tabs[currentIndex + 1];
              if (nextTab) {
                setActiveTab(nextTab);
              }
            }
          } else if (gesture === 'swipe-right') {
            // Navigate to previous tab
            const tabs = ['overview', 'students', 'bulk', 'reports'];
            const currentIndex = tabs.indexOf(activeTab);
            if (currentIndex > 0) {
              const previousTab = tabs[currentIndex - 1];
              if (previousTab) {
                setActiveTab(previousTab);
              }
            }
          }
        }
      }
    },
    [handleTouchEnd, isMobile, activeTab]
  );

  return (
    <div
      className={getResponsiveClasses('space-y-6', mobileState)}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEndWithGesture : undefined}
    >
      {/* Enhanced Header */}
      <div className={`relative ${isMobile ? 'mb-4' : ''}`}>
        <div>
          <h2
            className="text-3xl font-bold tracking-tight text-black dark:text-foreground"
            data-testid="student-management-title"
          >
            Student Management
          </h2>
          <p className="text-black dark:text-muted-foreground">
            Manage student records, activities, and library services.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div
          className={`${isMobile ? 'relative mt-4 grid grid-cols-2 gap-2' : isTablet ? 'relative mt-4 grid grid-cols-3 gap-2' : 'absolute top-0 right-0 flex gap-2'}`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddStudent(true)}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add Student
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateQRCodes}
            disabled={isGeneratingQRCodes}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <QrCode className="h-4 w-4 mr-1" />
            {isGeneratingQRCodes ? 'Generating...' : 'Generate QR'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setIsStudentsRefreshing(true);
              try {
                await studentsRefreshActions.refresh();
              } finally {
                setIsStudentsRefreshing(false);
              }
            }}
            className="bg-white/90 hover:bg-white shadow-sm"
            disabled={isStudentsRefreshing}
          >
            {isStudentsRefreshing ? (
              <>
                <Search className="h-4 w-4 mr-1 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-1" />
                Refresh
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintIDCards}
            disabled={isPrintingIDs}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <CreditCard className="h-4 w-4 mr-1" />
            {isPrintingIDs ? 'Printing...' : 'Print IDs'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStudents}
            disabled={isExporting}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkImport(true)}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4 sm:space-y-6"
      >
        <TabsList
          className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2"
          data-testid="tab-list"
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students" data-testid="inner-students-tab">
            Students
          </TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div
            className={`grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4`}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div
                  className="text-2xl font-bold text-blue-700 dark:text-blue-300"
                  data-testid="total-students"
                >
                  {realStats.total}
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Total Students
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <UserCheck className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {realStats.active}
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Active Accounts
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4 text-center">
                <UserMinus className="h-8 w-8 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {realStats.inactive}
                </div>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Inactive Students
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {realStats.averageSessions.toFixed(1)}
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Avg Sessions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Student Activity
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('students')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredStudents.slice(0, 3).map((student: Student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${student.isActive ? 'bg-green-500' : 'bg-red-500'}`}
                      />
                      <div>
                        <div className="font-medium">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.gradeLevel} • {student.totalSessions}{' '}
                          sessions
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={student.isActive ? 'default' : 'secondary'}
                      >
                        {student.isActive
                          ? 'Account Active'
                          : 'Account Inactive'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewStudentHistory(student)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent
          value="students"
          className="space-y-6"
          data-testid="students-tabpanel"
        >
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                    aria-label="Search students"
                    disabled={isStudentsRefreshing}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger
                      className="w-[120px]"
                      data-testid="status-filter"
                      disabled={isStudentsRefreshing}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="status-all">
                        All Status
                      </SelectItem>
                      <SelectItem value="active" data-testid="status-active">
                        Active
                      </SelectItem>
                      <SelectItem
                        value="inactive"
                        data-testid="status-inactive"
                      >
                        Inactive
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger
                      className="w-[120px]"
                      data-testid="grade-filter"
                      disabled={isStudentsRefreshing}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="grade-all">
                        All Grades
                      </SelectItem>
                      <SelectItem value="primary" data-testid="grade-primary">
                        Primary
                      </SelectItem>
                      <SelectItem
                        value="gradeSchool"
                        data-testid="grade-gradeSchool"
                      >
                        Grade School
                      </SelectItem>
                      <SelectItem
                        value="juniorHigh"
                        data-testid="grade-juniorHigh"
                      >
                        Junior High
                      </SelectItem>
                      <SelectItem
                        value="seniorHigh"
                        data-testid="grade-seniorHigh"
                      >
                        Senior High
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger
                      className="w-[130px]"
                      data-testid="type-filter"
                      disabled={isStudentsRefreshing}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="type-all">
                        All Types
                      </SelectItem>
                      <SelectItem value="students" data-testid="type-students">
                        Students Only
                      </SelectItem>
                      <SelectItem
                        value="personnel"
                        data-testid="type-personnel"
                      >
                        Personnel Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions Toggle */}
          {selectedStudents.length > 0 && (
            <Card className="border-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selectedStudents.length} students selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkActions(!showBulkActions)}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Bulk Actions
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStudents([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Students List */}
          <Card>
            <CardHeader>
              <CardTitle>Students ({filteredStudents.length})</CardTitle>
              <CardDescription>
                Manage student records and activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredStudents.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    data-testid="student-empty-state"
                  >
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No students found
                    </h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                      {searchTerm || filterStatus || filterGrade
                        ? "Try adjusting your search or filters to find what you're looking for."
                        : 'Get started by adding your first student to the system.'}
                    </p>
                    {!searchTerm && !filterStatus && !filterGrade && (
                      <Button onClick={() => setShowAddStudent(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Student
                      </Button>
                    )}
                  </div>
                )}
                {paginatedStudents.map((student: Student) => (
                  <div
                    key={student.id}
                    className={`p-4 rounded-lg border ${
                      selectedStudents.includes(student.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    data-testid="student-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="rounded"
                          data-testid="student-checkbox"
                        />
                        <div
                          className={`w-2 h-2 rounded-full ${student.isActive ? 'bg-green-500' : 'bg-red-500'}`}
                        />
                        <div>
                          <div
                            className="font-medium"
                            data-testid="student-name"
                          >
                            {student.firstName} {student.lastName}
                            {student.gender && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({student.gender})
                              </span>
                            )}
                            {student.disciplinaryFlags > 0 && (
                              <AlertTriangle className="inline h-3 w-3 ml-2 text-red-500" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span
                              data-testid="student-id"
                              className="font-mono"
                            >
                              {student.studentId}
                            </span>
                            {student.barcode &&
                              student.barcode !== student.studentId && (
                                <span className="hidden sm:inline">
                                  {' '}
                                  • Barcode:{' '}
                                  <span className="font-mono">
                                    {student.barcode}
                                  </span>
                                </span>
                              )}{' '}
                            • {student.gradeLevel}{' '}
                            {student.section
                              ? `• Section ${student.section}`
                              : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={student.isActive ? 'default' : 'secondary'}
                        >
                          {student.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewStudentHistory(student)}
                          data-testid="view-student-button"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowEditStudent(true);
                          }}
                          data-testid="edit-student-button"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hidden sm:inline-flex"
                          onClick={() => handleDeleteStudent(student.id)}
                          data-testid="delete-student-button"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Student Info Badges - Responsive */}
                    <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
                      {student.email && (
                        <Badge variant="outline" className="text-blue-600">
                          <Mail className="h-3 w-3 mr-1" />
                          {student.email}
                        </Badge>
                      )}
                      {student.phone && (
                        <Badge variant="outline" className="text-green-600">
                          <Phone className="h-3 w-3 mr-1" />
                          {student.phone}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-purple-600">
                        <Activity className="h-3 w-3 mr-1" />
                        {student.totalSessions} sessions
                      </Badge>
                      {student.qrCodeGenerated && (
                        <Badge variant="outline" className="text-orange-600">
                          <QrCode className="h-3 w-3 mr-1" />
                          QR
                        </Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(student.id)}
                      >
                        {student.isActive ? (
                          <UserMinus className="h-3 w-3 mr-1" />
                        ) : (
                          <UserCheck className="h-3 w-3 mr-1" />
                        )}
                        {student.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintSchedule(student)}
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        Schedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendParentMessage(student)}
                        disabled={!student.parentPhone && !student.parentEmail}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Contact
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAwardStudent(student)}
                      >
                        <Award className="h-3 w-3 mr-1" />
                        Awards
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddNotes(student)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Notes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStudentBarcode(student)}
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        Barcode/QR
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {filteredStudents.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredStudents.length
                    )}{' '}
                    of {filteredStudents.length} students
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                      <span className="text-sm text-muted-foreground">
                        Rows per page:
                      </span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk" className="space-y-6">
          {showBulkActions && selectedStudents.length > 0 && (
            <Card className="border-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle>
                  Bulk Actions - {selectedStudents.length} Students Selected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Grade Updates</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkGradeUpdate('Grade 5')}
                      >
                        Grade 5
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkGradeUpdate('Grade 8')}
                      >
                        Grade 8
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkGradeUpdate('Grade 10')}
                      >
                        Grade 10
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkGradeUpdate('Grade 12')}
                      >
                        Grade 12
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Status Updates</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusUpdate('active')}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        Activate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusUpdate('inactive')}
                      >
                        <UserMinus className="h-3 w-3 mr-1" />
                        Deactivate
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Parent Notifications</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkNotification}
                      disabled={isSendingNotifications}
                      className="w-full"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {isSendingNotifications
                        ? 'Sending...'
                        : 'Send Notifications'}
                    </Button>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Document Generation</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast.info('Generate ID cards for selected students')
                        }
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        ID Cards
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast.info('Generate QR codes for selected students')
                        }
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        QR Codes
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Import Students</CardTitle>
                <CardDescription>
                  Import multiple students from CSV/Excel file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowBulkImport(true)}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Students
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Documents</CardTitle>
                <CardDescription>
                  Create ID cards, QR codes, and other documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateQRCodes}
                    disabled={isGeneratingQRCodes}
                    className="w-full"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {isGeneratingQRCodes
                      ? 'Generating...'
                      : 'Generate All QR Codes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePrintIDCards}
                    disabled={isPrintingIDs}
                    className="w-full"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {isPrintingIDs ? 'Printing...' : 'Print All ID Cards'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Student Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Students:</span>
                    <span className="font-medium">{realStats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Students:</span>
                    <span className="font-medium">{realStats.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Sessions:</span>
                    <span className="font-medium">
                      {realStats.averageSessions.toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.info('Generate student activity report')
                    }
                    className="w-full"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Activity Report
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast.info('Generate disciplinary report')}
                    className="w-full"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Disciplinary Report
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast.info('Generate attendance report')}
                    className="w-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Attendance Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter student information to register them in the library system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Student ID / Enrollment Number *
                </label>
                <Input
                  value={newStudent.studentId}
                  onChange={(e) =>
                    formActions.setValue('studentId', e.target.value)
                  }
                  placeholder="e.g., 20141203"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Barcode / Library Card No.
                </label>
                <Input
                  value={newStudent.barcode}
                  onChange={(e) =>
                    formActions.setValue('barcode', e.target.value)
                  }
                  placeholder="Leave empty to use Student ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. If empty, Student ID will be used as barcode.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name *</label>
                <Input
                  value={newStudent.firstName}
                  onChange={(e) =>
                    formActions.setValue('firstName', e.target.value)
                  }
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name *</label>
                <Input
                  value={newStudent.lastName}
                  onChange={(e) =>
                    formActions.setValue('lastName', e.target.value)
                  }
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Grade Level *</label>
                <Select
                  value={newStudent.gradeLevel}
                  onValueChange={(value) =>
                    formActions.setValue('gradeLevel', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pre-School">Pre-School</SelectItem>
                    <SelectItem value="Kindergarten">Kindergarten</SelectItem>
                    <SelectItem value="Grade 1">Grade 1</SelectItem>
                    <SelectItem value="Grade 2">Grade 2</SelectItem>
                    <SelectItem value="Grade 3">Grade 3</SelectItem>
                    <SelectItem value="Grade 4">Grade 4</SelectItem>
                    <SelectItem value="Grade 5">Grade 5</SelectItem>
                    <SelectItem value="Grade 6">Grade 6</SelectItem>
                    <SelectItem value="Grade 7">Grade 7</SelectItem>
                    <SelectItem value="Grade 8">Grade 8</SelectItem>
                    <SelectItem value="Grade 9">Grade 9</SelectItem>
                    <SelectItem value="Grade 10">Grade 10</SelectItem>
                    <SelectItem value="Grade 11">Grade 11</SelectItem>
                    <SelectItem value="Grade 12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Section</label>
                <Input
                  value={newStudent.section}
                  onChange={(e) =>
                    formActions.setValue('section', e.target.value)
                  }
                  placeholder="Section"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Gender</label>
                <Select
                  value={newStudent.gender}
                  onValueChange={(value) =>
                    formActions.setValue('gender', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={newStudent.email}
                  onChange={(e) =>
                    formActions.setValue('email', e.target.value)
                  }
                  placeholder="student@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={newStudent.phone}
                  onChange={(e) =>
                    formActions.setValue('phone', e.target.value)
                  }
                  placeholder="+63 912 345 6789"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Parent Name</label>
                <Input
                  value={newStudent.parentName}
                  onChange={(e) =>
                    formActions.setValue('parentName', e.target.value)
                  }
                  placeholder="Parent/Guardian name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Parent Phone</label>
                <Input
                  value={newStudent.parentPhone}
                  onChange={(e) =>
                    formActions.setValue('parentPhone', e.target.value)
                  }
                  placeholder="+63 912 345 6788"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={newStudent.address}
                onChange={(e) =>
                  formActions.setValue('address', e.target.value)
                }
                placeholder="Student address"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={newStudent.notes}
                onChange={(e) => formActions.setValue('notes', e.target.value)}
                placeholder="Additional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent}>Add Student</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={showEditStudent} onOpenChange={setShowEditStudent}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information in the library system.
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Student ID *</label>
                  <Input
                    value={selectedStudent.studentId}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        studentId: e.target.value,
                      })
                    }
                    placeholder="Student ID"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Barcode</label>
                  <Input
                    value={selectedStudent.barcode || ''}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        barcode: e.target.value,
                      })
                    }
                    placeholder="Barcode (auto-generated if empty)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use Student ID as barcode
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    value={selectedStudent.firstName}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        firstName: e.target.value,
                      })
                    }
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    value={selectedStudent.lastName}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        lastName: e.target.value,
                      })
                    }
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Grade Level *</label>
                  <Select
                    value={selectedStudent?.gradeLevel ?? ''}
                    onValueChange={(value) =>
                      selectedStudent &&
                      setSelectedStudent({
                        ...selectedStudent,
                        gradeLevel: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grade 1">Grade 1</SelectItem>
                      <SelectItem value="Grade 2">Grade 2</SelectItem>
                      <SelectItem value="Grade 3">Grade 3</SelectItem>
                      <SelectItem value="Grade 4">Grade 4</SelectItem>
                      <SelectItem value="Grade 5">Grade 5</SelectItem>
                      <SelectItem value="Grade 6">Grade 6</SelectItem>
                      <SelectItem value="Grade 7">Grade 7</SelectItem>
                      <SelectItem value="Grade 8">Grade 8</SelectItem>
                      <SelectItem value="Grade 9">Grade 9</SelectItem>
                      <SelectItem value="Grade 10">Grade 10</SelectItem>
                      <SelectItem value="Grade 11">Grade 11</SelectItem>
                      <SelectItem value="Grade 12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Section</label>
                  <Input
                    value={selectedStudent.section || ''}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        section: e.target.value,
                      })
                    }
                    placeholder="Section"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={selectedStudent.email || ''}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        email: e.target.value,
                      })
                    }
                    placeholder="student@email.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={selectedStudent.phone || ''}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={selectedStudent.notes || ''}
                  onChange={(e) =>
                    setSelectedStudent({
                      ...selectedStudent,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Additional notes"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditStudent(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStudent}>Update Student</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Details Dialog */}
      <Dialog open={showStudentDetails} onOpenChange={setShowStudentDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Complete information and activity history for this student.
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Student ID:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.studentId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Name:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Grade:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.gradeLevel}{' '}
                        {selectedStudent.section &&
                          `- Section ${selectedStudent.section}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Status:
                      </span>
                      <Badge
                        variant={
                          selectedStudent.isActive ? 'default' : 'secondary'
                        }
                      >
                        {selectedStudent.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Join Date:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.joinDate}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Email:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.email || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Phone:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.phone || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Parent:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.parentName || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Parent Phone:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.parentPhone || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Emergency Contact:
                      </span>
                      <span className="font-medium">
                        {selectedStudent.emergencyContact || 'Not provided'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <Activity className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <div className="text-2xl font-bold text-blue-700">
                        {selectedStudent.totalSessions}
                      </div>
                      <p className="text-sm text-blue-600">Total Sessions</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold text-green-700">
                        Last Active
                      </div>
                      <p className="text-sm text-green-600">
                        {selectedStudent.lastActivity || 'Never'}
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <div className="text-2xl font-bold text-purple-700">
                        Regular
                      </div>
                      <p className="text-sm text-purple-600">Usage Pattern</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Button
                      variant="outline"
                      onClick={() => handlePrintSchedule(selectedStudent)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Print Schedule
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSendParentMessage(selectedStudent)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Contact Parent
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAwardStudent(selectedStudent)}
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Add Award
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAddNotes(selectedStudent)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Add Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowStudentDetails(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Import Dialog */}
      <StudentImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
      />

      {/* Student Barcode Dialog */}
      <StudentBarcodeDialog
        open={showStudentBarcode}
        onOpenChange={setShowStudentBarcode}
        student={selectedStudent}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDeleteStudent}
        title="Delete Student?"
        description={`Are you sure you want to delete ${studentToDelete?.firstName} ${studentToDelete?.lastName}?\n\nThis action cannot be undone.`}
        confirmText="Delete"
        destructive={true}
      />
    </div>
  );
}

export default StudentManagement;
