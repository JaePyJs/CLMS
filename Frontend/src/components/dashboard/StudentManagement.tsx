import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMobileOptimization, useTouchOptimization, useAccessibility, getResponsiveClasses, getOptimalImageSize } from '@/hooks/useMobileOptimization';
import { studentsApi, utilitiesApi } from '@/lib/api';
import { LoadingSpinner, TableSkeleton, ButtonLoading, EmptyState } from '@/components/LoadingStates';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Search,
  Download,
  Printer,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Settings,
  QrCode,
  Award,
  Bell,
  Phone,
  Mail,
  Calendar,
  BookOpen,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Shield,
  FileText,
  Upload,
  UserMinus,
  UserCheck,
  MessageSquare,
  History,
  CreditCard,
  RefreshCw,
  ExternalLink,
  Star,
  TrendingUp,
  Activity,
  UserX,
  X
} from 'lucide-react';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gradeCategory: string;
  section?: string;
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
}

interface MockStudentData {
  students: Student[];
  stats: {
    total: number;
    active: number;
    inactive: number;
    newThisMonth: number;
    averageSessions: number;
    overdueReturns: number;
  };
}

export function StudentManagement() {
  const queryClient = useQueryClient();

  // Mobile optimization
  const { isMobile, isTablet, isDesktop, isLarge, isExtraLarge, orientation } = useMobileOptimization();
  const { handleTouchStart, handleTouchEnd, gesture } = useTouchOptimization();
  const { prefersReducedMotion } = useAccessibility();

  // State management
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch students with TanStack Query
  const { data: studentsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const response = await studentsApi.getStudents();
      return response.data || { students: [], total: 0, pagination: {} };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const students = studentsResponse?.students || [];

  // Dialog states
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showStudentBarcode, setShowStudentBarcode] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form states
  const [newStudent, setNewStudent] = useState({
    firstName: '',
    lastName: '',
    gradeLevel: '',
    section: '',
    email: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    emergencyContact: '',
    address: '',
    notes: ''
  });

  // Loading states
  const [isGeneratingQRCodes, setIsGeneratingQRCodes] = useState(false);
  const [isPrintingIDs, setIsPrintingIDs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Mutations
  const createStudentMutation = useMutation({
    mutationFn: (studentData: any) => studentsApi.createStudent(studentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student added successfully!');
      setShowAddStudent(false);
      setNewStudent({
        firstName: '',
        lastName: '',
        gradeLevel: '',
        section: '',
        email: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        emergencyContact: '',
        address: '',
        notes: ''
      });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to add student');
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      studentsApi.updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated successfully!');
      setShowEditStudent(false);
      setSelectedStudent(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update student');
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (id: string) => studentsApi.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete student');
    },
  });

  const generateQRCodesMutation = useMutation({
    mutationFn: () => utilitiesApi.generateQRCodes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('QR codes generated successfully!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to generate QR codes');
    },
  });

  const generateBarcodesMutation = useMutation({
    mutationFn: () => utilitiesApi.generateBarcodes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Barcodes generated successfully!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to generate barcodes');
    },
  });

  // Mock data
  const mockData: MockStudentData = {
    students: [
      {
        id: '1',
        studentId: 'STU001',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        gradeLevel: 'Grade 5',
        gradeCategory: 'gradeSchool',
        section: 'A',
        isActive: true,
        email: 'juan.delacruz@email.com',
        phone: '+63 912 345 6789',
        address: '123 Main St, City',
        parentName: 'Maria Dela Cruz',
        parentPhone: '+63 912 345 6788',
        parentEmail: 'maria.parent@email.com',
        emergencyContact: '+63 912 345 6787',
        notes: 'Regular visitor, prefers computer sessions',
        joinDate: '2024-01-15',
        lastActivity: '2024-01-20',
        totalSessions: 45,
        specialPrivileges: ['extended_time'],
        disciplinaryFlags: 0,
        qrCodeGenerated: true,
        barcodeGenerated: true,
        libraryCardPrinted: true
      },
      {
        id: '2',
        studentId: 'STU002',
        firstName: 'Maria',
        lastName: 'Santos',
        gradeLevel: 'Grade 8',
        gradeCategory: 'juniorHigh',
        section: 'B',
        isActive: true,
        email: 'maria.santos@email.com',
        phone: '+63 913 456 7890',
        address: '456 Oak Ave, Town',
        parentName: 'Jose Santos',
        parentPhone: '+63 913 456 7891',
        parentEmail: 'jose.parent@email.com',
        emergencyContact: '+63 913 456 7892',
        notes: 'Good student, follows rules',
        joinDate: '2023-09-10',
        lastActivity: '2024-01-19',
        totalSessions: 32,
        specialPrivileges: [],
        disciplinaryFlags: 0,
        qrCodeGenerated: true,
        barcodeGenerated: true,
        libraryCardPrinted: true
      },
      {
        id: '3',
        studentId: 'STU003',
        firstName: 'Jose',
        lastName: 'Reyes',
        gradeLevel: 'Grade 10',
        gradeCategory: 'seniorHigh',
        section: 'C',
        isActive: false,
        email: '',
        phone: '',
        address: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        emergencyContact: '',
        notes: 'Inactive since December 2023',
        joinDate: '2023-08-20',
        lastActivity: '2023-12-15',
        totalSessions: 18,
        specialPrivileges: [],
        disciplinaryFlags: 2,
        qrCodeGenerated: false,
        barcodeGenerated: false,
        libraryCardPrinted: false
      }
    ],
    stats: {
      total: 3,
      active: 2,
      inactive: 1,
      newThisMonth: 0,
      averageSessions: 31.7,
      overdueReturns: 0
    }
  };

  // Filter and search logic
  useEffect(() => {
    if (!students) return;
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(student =>
        filterStatus === 'active' ? student.isActive : !student.isActive
      );
    }

    if (filterGrade !== 'all') {
      filtered = filtered.filter(student => student.gradeCategory === filterGrade);
    }

    setFilteredStudents(filtered);
  }, [students, searchTerm, filterStatus, filterGrade]);

  // Handler functions
  const handleAddStudent = async () => {
    if (!newStudent.firstName || !newStudent.lastName || !newStudent.gradeLevel) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsAddingStudent(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

    const student: Student = {
      id: Date.now().toString(),
      studentId: `STU${Date.now().toString().slice(-3)}`,
      firstName: newStudent.firstName,
      lastName: newStudent.lastName,
      gradeLevel: newStudent.gradeLevel,
      gradeCategory: getGradeCategory(newStudent.gradeLevel),
      section: newStudent.section,
      isActive: true,
      email: newStudent.email,
      phone: newStudent.phone,
      address: newStudent.address,
      parentName: newStudent.parentName,
      parentPhone: newStudent.parentPhone,
      parentEmail: newStudent.parentEmail,
      emergencyContact: newStudent.emergencyContact,
      notes: newStudent.notes,
      joinDate: new Date().toISOString().split('T')[0],
      totalSessions: 0,
      specialPrivileges: [],
      disciplinaryFlags: 0,
      qrCodeGenerated: false,
      barcodeGenerated: false,
      libraryCardPrinted: false
    };

      setStudents([...students, student]);
      toast.success(`Student ${student.firstName} ${student.lastName} added successfully!`);
      setShowAddStudent(false);
      setNewStudent({
        firstName: '',
        lastName: '',
        gradeLevel: '',
        section: '',
        email: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        emergencyContact: '',
        address: '',
        notes: ''
      });
    } catch (error) {
      toast.error('Failed to add student');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleEditStudent = () => {
    if (!selectedStudent) return;

    setStudents(students.map(s => s.id === selectedStudent.id ? selectedStudent : s));
    toast.success('Student updated successfully!');
    setShowEditStudent(false);
    setSelectedStudent(null);
  };

  const handleDeleteStudent = (studentId: string) => {
    if (confirm('Are you sure you want to delete this student?')) {
      setStudents(students.filter(s => s.id !== studentId));
      toast.success('Student deleted successfully!');
    }
  };

  const handleToggleStatus = (studentId: string) => {
    setStudents(students.map(s =>
      s.id === studentId ? { ...s, isActive: !s.isActive } : s
    ));
    toast.success('Student status updated!');
  };

  const handleGenerateQRCodes = async () => {
    setIsGeneratingQRCodes(true);
    try {
      await generateQRCodesMutation.mutateAsync();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsGeneratingQRCodes(false);
    }
  };

  const handlePrintIDCards = async () => {
    setIsPrintingIDs(true);
    try {
      await generateBarcodesMutation.mutateAsync();
      toast.success('ID cards printed successfully!');
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsPrintingIDs(false);
    }
  };

  const handleExportStudents = async () => {
    setIsExporting(true);
    try {
      const csvContent = [
        'Student ID,First Name,Last Name,Grade,Section,Status,Email,Phone,Join Date,Total Sessions',
        ...filteredStudents.map(s =>
          `${s.studentId},${s.firstName},${s.lastName},${s.gradeLevel},${s.section || ''},${s.isActive ? 'Active' : 'Inactive'},${s.email || ''},${s.phone || ''},${s.joinDate},${s.totalSessions}`
        )
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
    } catch (error) {
      toast.error('Failed to export students');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkNotification = async () => {
    setIsSendingNotifications(true);
    try {
      // Simulate sending notifications
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(`Notifications sent to ${selectedStudents.length} parents!`);
      setSelectedStudents([]);
      setShowBulkActions(false);
    } catch (error) {
      toast.error('Failed to send notifications');
    } finally {
      setIsSendingNotifications(false);
    }
  };

  const handleBulkGradeUpdate = async (grade: string) => {
    try {
      // Update each selected student
      await Promise.all(
        selectedStudents.map(id => 
          updateStudentMutation.mutateAsync({
            id,
            data: {
              grade_level: grade,
              grade_category: getGradeCategory(grade)
            }
          })
        )
      );
      toast.success(`Updated ${selectedStudents.length} students`);
      setSelectedStudents([]);
      setShowBulkActions(false);
    } catch (error) {
      // Error handled by mutation
    }
    toast.success(`Grade updated for ${selectedStudents.length} students!`);
    setSelectedStudents([]);
    setShowBulkActions(false);
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive') => {
    try {
      // Update each selected student
      await Promise.all(
        selectedStudents.map(id => 
          updateStudentMutation.mutateAsync({
            id,
            data: { is_active: status === 'active' }
          })
        )
      );
      toast.success(`Status updated for ${selectedStudents.length} students!`);
      setSelectedStudents([]);
      setShowBulkActions(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getGradeCategory = (grade: string): string => {
    if (grade.includes('K') || grade.includes('1') || grade.includes('2') || grade.includes('3')) return 'primary';
    if (grade.includes('4') || grade.includes('5') || grade.includes('6')) return 'gradeSchool';
    if (grade.includes('7') || grade.includes('8') || grade.includes('9')) return 'juniorHigh';
    if (grade.includes('10') || grade.includes('11') || grade.includes('12')) return 'seniorHigh';
    return 'unknown';
  };

  const handleViewStudentHistory = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDetails(true);
    toast.info(`Viewing history for ${student.firstName} ${student.lastName}`);
  };

  const handlePrintSchedule = (student: Student) => {
    toast.info(`Printing schedule for ${student.firstName} ${student.lastName}`);
  };

  const handleSendParentMessage = (student: Student) => {
    toast.info(`Opening message composer for ${student.parentName || 'parent'}`);
  };

  const handleAwardStudent = (student: Student) => {
    toast.info(`Opening awards interface for ${student.firstName} ${student.lastName}`);
  };

  const handleAddNotes = async (student: Student) => {
    const notes = prompt('Add notes for this student:', student.notes || '');
    if (notes !== null) {
      try {
        await updateStudentMutation.mutateAsync({
          id: student.id,
          data: { notes }
        });
        toast.success('Notes updated!');
      } catch (error) {
        // Error handled by mutation
      }
    }
  };

  const handleViewStudentBarcode = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentBarcode(true);
  };

  // Handle swipe gestures for mobile navigation
  useEffect(() => {
    if (isMobile && gesture) {
      if (gesture === 'swipe-left') {
        // Navigate to next tab
        const tabs = ['overview', 'students', 'bulk', 'reports'];
        const currentIndex = tabs.indexOf(activeTab);
        if (currentIndex < tabs.length - 1) {
          setActiveTab(tabs[currentIndex + 1]);
        }
      } else if (gesture === 'swipe-right') {
        // Navigate to previous tab
        const tabs = ['overview', 'students', 'bulk', 'reports'];
        const currentIndex = tabs.indexOf(activeTab);
        if (currentIndex > 0) {
          setActiveTab(tabs[currentIndex - 1]);
        }
      }
    }
  }, [gesture, isMobile, activeTab]);

  return (
    <div
      className={getResponsiveClasses('space-y-6', { isMobile, isTablet, isDesktop, isLarge, isExtraLarge })}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      {/* Enhanced Header */}
      <div className={`relative ${isMobile ? 'mb-4' : ''}`}>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black dark:text-foreground">
            Student Management
          </h2>
          <p className="text-black dark:text-muted-foreground">
            Manage student records, activities, and library services.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className={`${isMobile ? 'relative mt-4 grid grid-cols-2 gap-2' : isTablet ? 'relative mt-4 grid grid-cols-3 gap-2' : 'absolute top-0 right-0 flex gap-2'}`}>
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className={`grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4`}>
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{mockData.stats.total}</div>
                <p className="text-sm text-blue-600 dark:text-blue-400">Total Students</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <UserCheck className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{mockData.stats.active}</div>
                <p className="text-sm text-green-600 dark:text-green-400">Active Students</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4 text-center">
                <UserMinus className="h-8 w-8 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{mockData.stats.inactive}</div>
                <p className="text-sm text-orange-600 dark:text-orange-400">Inactive Students</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{mockData.stats.averageSessions.toFixed(1)}</div>
                <p className="text-sm text-purple-600 dark:text-purple-400">Avg Sessions</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Student Activity
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('students')}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredStudents.slice(0, 3).map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${student.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-medium">{student.firstName} {student.lastName}</div>
                        <div className="text-sm text-muted-foreground">
                          {student.gradeLevel} • {student.totalSessions} sessions
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={student.isActive ? 'default' : 'secondary'}>
                        {student.isActive ? 'Active' : 'Inactive'}
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
        <TabsContent value="students" className="space-y-6">
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
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="gradeSchool">Grade School</SelectItem>
                      <SelectItem value="juniorHigh">Junior High</SelectItem>
                      <SelectItem value="seniorHigh">Senior High</SelectItem>
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
                  <span className="font-medium">{selectedStudents.length} students selected</span>
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
              <CardDescription>Manage student records and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className={`p-4 rounded-lg border ${
                      selectedStudents.includes(student.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="rounded"
                        />
                        <div className={`w-2 h-2 rounded-full ${student.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <div className="font-medium">
                            {student.firstName} {student.lastName}
                            {student.disciplinaryFlags > 0 && (
                              <AlertTriangle className="inline h-3 w-3 ml-2 text-red-500" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {student.studentId} • {student.gradeLevel} {student.section ? `• Section ${student.section}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={student.isActive ? 'default' : 'secondary'}>
                          {student.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewStudentHistory(student)}
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
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Student Info Badges */}
                    <div className="flex items-center gap-2 mb-3 text-xs">
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
                        {student.isActive ? <UserMinus className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk" className="space-y-6">
          {showBulkActions && selectedStudents.length > 0 && (
            <Card className="border-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle>Bulk Actions - {selectedStudents.length} Students Selected</CardTitle>
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
                      {isSendingNotifications ? 'Sending...' : 'Send Notifications'}
                    </Button>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Document Generation</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info('Generate ID cards for selected students')}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        ID Cards
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info('Generate QR codes for selected students')}
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
                <CardDescription>Import multiple students from CSV/Excel file</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowBulkImport(true)} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Students
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Documents</CardTitle>
                <CardDescription>Create ID cards, QR codes, and other documents</CardDescription>
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
                    {isGeneratingQRCodes ? 'Generating...' : 'Generate All QR Codes'}
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
                    <span className="font-medium">{mockData.stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Students:</span>
                    <span className="font-medium">{mockData.stats.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Sessions:</span>
                    <span className="font-medium">{mockData.stats.averageSessions.toFixed(1)}</span>
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
                    onClick={() => toast.info('Generate student activity report')}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter student information to register them in the library system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name *</label>
                <Input
                  value={newStudent.firstName}
                  onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name *</label>
                <Input
                  value={newStudent.lastName}
                  onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Grade Level *</label>
                <Select value={newStudent.gradeLevel} onValueChange={(value) => setNewStudent({ ...newStudent, gradeLevel: value })}>
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
                  value={newStudent.section}
                  onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                  placeholder="Section"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  placeholder="student@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  placeholder="+63 912 345 6789"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Parent Name</label>
                <Input
                  value={newStudent.parentName}
                  onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                  placeholder="Parent/Guardian name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Parent Phone</label>
                <Input
                  value={newStudent.parentPhone}
                  onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                  placeholder="+63 912 345 6788"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={newStudent.address}
                onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
                placeholder="Student address"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={newStudent.notes}
                onChange={(e) => setNewStudent({ ...newStudent, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent}>
              Add Student
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={showEditStudent} onOpenChange={setShowEditStudent}>
        <DialogContent className="max-w-2xl">
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
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    value={selectedStudent.firstName}
                    onChange={(e) => setSelectedStudent({ ...selectedStudent, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    value={selectedStudent.lastName}
                    onChange={(e) => setSelectedStudent({ ...selectedStudent, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Grade Level *</label>
                  <Select value={selectedStudent.gradeLevel} onValueChange={(value) => setSelectedStudent({ ...selectedStudent, gradeLevel: value })}>
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
                    onChange={(e) => setSelectedStudent({ ...selectedStudent, section: e.target.value })}
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
                    onChange={(e) => setSelectedStudent({ ...selectedStudent, email: e.target.value })}
                    placeholder="student@email.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={selectedStudent.phone || ''}
                    onChange={(e) => setSelectedStudent({ ...selectedStudent, phone: e.target.value })}
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={selectedStudent.notes || ''}
                  onChange={(e) => setSelectedStudent({ ...selectedStudent, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditStudent(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStudent}>
              Update Student
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Details Dialog */}
      <Dialog open={showStudentDetails} onOpenChange={setShowStudentDetails}>
        <DialogContent className="max-w-3xl">
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
                      <span className="text-sm text-muted-foreground">Student ID:</span>
                      <span className="font-medium">{selectedStudent.studentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Name:</span>
                      <span className="font-medium">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Grade:</span>
                      <span className="font-medium">{selectedStudent.gradeLevel} {selectedStudent.section && `- Section ${selectedStudent.section}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant={selectedStudent.isActive ? 'default' : 'secondary'}>
                        {selectedStudent.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Join Date:</span>
                      <span className="font-medium">{selectedStudent.joinDate}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email:</span>
                      <span className="font-medium">{selectedStudent.email || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Phone:</span>
                      <span className="font-medium">{selectedStudent.phone || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Parent:</span>
                      <span className="font-medium">{selectedStudent.parentName || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Parent Phone:</span>
                      <span className="font-medium">{selectedStudent.parentPhone || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Emergency Contact:</span>
                      <span className="font-medium">{selectedStudent.emergencyContact || 'Not provided'}</span>
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
                      <div className="text-2xl font-bold text-blue-700">{selectedStudent.totalSessions}</div>
                      <p className="text-sm text-blue-600">Total Sessions</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold text-green-700">Last Active</div>
                      <p className="text-sm text-green-600">{selectedStudent.lastActivity || 'Never'}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <div className="text-2xl font-bold text-purple-700">Regular</div>
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
                    <Button variant="outline" onClick={() => handlePrintSchedule(selectedStudent)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Print Schedule
                    </Button>
                    <Button variant="outline" onClick={() => handleSendParentMessage(selectedStudent)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Contact Parent
                    </Button>
                    <Button variant="outline" onClick={() => handleAwardStudent(selectedStudent)}>
                      <Award className="h-4 w-4 mr-2" />
                      Add Award
                    </Button>
                    <Button variant="outline" onClick={() => handleAddNotes(selectedStudent)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Add Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowStudentDetails(false)}>
              Close
            </Button>
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
    </div>
  );
}

export default StudentManagement;