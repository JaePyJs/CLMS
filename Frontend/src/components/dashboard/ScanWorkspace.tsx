import { useState, useEffect } from 'react';
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
import { useUsbScanner, useManualEntry, scannerUtils } from '@/lib/scanner';
import selfServiceApi from '@/services/selfServiceApi';
import { useAppStore } from '@/store/useAppStore';
import { offlineActions } from '@/lib/offline-queue';
import { toast } from 'sonner';
import { scanApi, apiClient } from '@/lib/api';
import {
  Camera,
  Keyboard,
  Edit3,
  Users,
  BookOpen,
  Monitor,
  Gamepad2,
  Clock,
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  Plus,
  Timer,
  UserPlus,
  FileText,
  Settings,
  Eye,
  AlertTriangle,
  Filter,
  Printer,
  ExternalLink,
  Calendar,
  BarChart3,
  Activity,
  Shield,
  Download,
  Loader2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { StudentSearchDropdown } from '@/components/management/StudentSearchDropdown';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gradeCategory: string;
  section?: string;
}

interface ScanResult {
  student?: Student;
  barcode: string;
  type: 'student' | 'book' | 'equipment' | 'unknown';
  timestamp: number;
}

interface BookPreview {
  id: string;
  title: string;
  accession_no: string;
  isbn?: string | null;
  available_copies?: number | null;
}

const formatDateInput = (date: Date) => date.toISOString().slice(0, 16);

const defaultBorrowDueDate = () => {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  return formatDateInput(due);
};

export function ScanWorkspace() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastStudentContext, setLastStudentContext] = useState<{
    id: string;
    display: string;
  } | null>(null);
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false);
  const [pendingBookBarcode, setPendingBookBarcode] = useState<string | null>(
    null
  );
  const [bookPreview, setBookPreview] = useState<BookPreview | null>(null);
  const [isBookPreviewLoading, setIsBookPreviewLoading] = useState(false);
  const [bookIntent, setBookIntent] = useState<'BORROW' | 'READ' | 'RETURN'>(
    'BORROW'
  );
  const [bookActionStudentId, setBookActionStudentId] = useState('');
  const [bookActionStudentName, setBookActionStudentName] = useState('');
  const [bookDueDate, setBookDueDate] = useState(defaultBorrowDueDate);
  const [bookNotes, setBookNotes] = useState('');
  const [isSubmittingBookAction, setIsSubmittingBookAction] = useState(false);

  // Enhanced state for activity management
  const [showActiveSessions, setShowActiveSessions] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintingSessions, setIsPrintingSessions] = useState(false);

  // Self-service enhancements
  const [cooldownInfo, setCooldownInfo] = useState<{
    studentId: string;
    remainingSeconds: number;
  } | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  const { isOnline, lastScanResult } = useAppStore();
  const { toggleListening, isListening, currentInput, lastScannedCode } =
    useUsbScanner();
  const { isOpen, input, setIsOpen, setInput, handleSubmit } = useManualEntry();

  // Sound effects
  const successSound = new Audio('/sounds/success.mp3');
  const errorSound = new Audio('/sounds/error.mp3');
  const cooldownSound = new Audio('/sounds/warning.mp3');

  // Process scanned barcode
  useEffect(() => {
    if (lastScanResult && lastScanResult !== scanResult?.barcode) {
      processBarcode(lastScanResult);
    }
  }, [lastScanResult]);

  // Cooldown timer effect
  useEffect(() => {
    if (!cooldownInfo) {
      return;
    }

    const interval = setInterval(() => {
      setCooldownInfo((prev) => {
        if (!prev || prev.remainingSeconds <= 1) {
          return null;
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownInfo]);

  // Load statistics on mount
  useEffect(() => {
    loadStatistics();
    const interval = setInterval(loadStatistics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadStatistics = async () => {
    try {
      const result = await selfServiceApi.getStatistics(
        new Date(new Date().setHours(0, 0, 0, 0)), // Today start
        new Date() // Now
      );
      if (result && result.success && result.data) {
        setStatistics(result.data);
      } else {
        setStatistics(null);
        toast.error('Failed to load statistics');
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
      setStatistics(null);
      const msg = (error as any)?.message || 'Failed to load statistics';
      toast.error(String(msg));
    }
  };

  const handleBookBarcode = async (barcode: string) => {
    setPendingBookBarcode(barcode);
    setIsBookDialogOpen(true);
    setBookIntent('BORROW');
    setBookPreview(null);
    setBookNotes('');
    setBookDueDate(defaultBorrowDueDate());
    setBookActionStudentId(lastStudentContext?.id || '');
    setBookActionStudentName(lastStudentContext?.display || '');
    setIsBookPreviewLoading(true);

    try {
      const previewResponse = await scanApi.detect(barcode);
      if (previewResponse.success && (previewResponse as any).book) {
        setBookPreview((previewResponse as any).book as BookPreview);
      } else {
        toast.warning(previewResponse.message || 'Book not found for scan');
      }
    } catch (error) {
      console.error('Book preview failed', error);
      toast.error('Failed to load book details');
      setIsBookDialogOpen(false);
    } finally {
      setIsBookPreviewLoading(false);
    }
  };

  const submitBookAction = async () => {
    if (!pendingBookBarcode) {
      toast.error('No book scan detected');
      return;
    }

    if (bookIntent !== 'RETURN' && !bookActionStudentId) {
      toast.error('Select a student before continuing');
      return;
    }

    setIsSubmittingBookAction(true);

    try {
      const payload: {
        barcode: string;
        intent: 'BORROW' | 'READ' | 'RETURN';
        studentId?: string;
        dueDate?: string;
        notes?: string;
      } = {
        barcode: pendingBookBarcode,
        intent: bookIntent,
      };

      if (bookIntent !== 'RETURN') {
        payload.studentId = bookActionStudentId;
      }

      if (bookIntent === 'BORROW' && bookDueDate) {
        payload.dueDate = new Date(bookDueDate).toISOString();
      }

      if (bookNotes.trim().length > 0) {
        payload.notes = bookNotes.trim();
      }

      const response = await scanApi.process(payload);
      if (response.success) {
        toast.success(response.message || 'Book action processed');
        handleBookDialogChange(false);
      } else {
        toast.error(response.message || 'Failed to process book action');
      }
    } catch (error) {
      console.error('Book action failed', error);
      toast.error('Failed to process book action');
    } finally {
      setIsSubmittingBookAction(false);
    }
  };

  const handleBookDialogChange = (open: boolean) => {
    setIsBookDialogOpen(open);
    if (!open) {
      setPendingBookBarcode(null);
      setBookPreview(null);
      setBookActionStudentId('');
      setBookActionStudentName('');
      setBookNotes('');
    }
  };

  const processBarcode = async (barcode: string) => {
    const type = scannerUtils.barcodeValidation.getBarcodeType(barcode);

    if (type === 'book') {
      await handleBookBarcode(barcode);
      return;
    }

    setIsProcessing(true);

    try {
      const result = await selfServiceApi.processScan(barcode);

      if (result.success) {
        // Play success sound
        try {
          successSound
            .play()
            .catch((e) => console.debug('Audio play failed:', e));
        } catch (e) {
          console.debug('Audio not available:', e);
        }

        toast.success(result.message, {
          description: result.student
            ? `${result.student.name} - ${result.student.gradeLevel}`
            : undefined,
        });

        const normalizedStudent = result.student
          ? ({
              id: result.student.id,
              studentId: result.student.studentId,
              firstName: result.student.name?.split(' ')[0] || '',
              lastName:
                result.student.name?.split(' ').slice(1).join(' ') ||
                result.student.name ||
                '',
              gradeLevel: result.student.gradeLevel,
              gradeCategory: result.student.gradeLevel || '', // Use gradeLevel as gradeCategory
              section: result.student.section || '',
            } as Student)
          : undefined;

        setScanResult({
          student: normalizedStudent,
          barcode,
          type: 'student' as const,
          timestamp: Date.now(),
        } as ScanResult);

        if (normalizedStudent) {
          setLastStudentContext({
            id: normalizedStudent.id,
            display:
              `${normalizedStudent.firstName} ${normalizedStudent.lastName}`.trim(),
          });
          // Default to library check-in
          setSelectedAction('library');
        }

        if (result.activity) {
          setTimeLimit(result.activity.timeLimit);
        }
      } else {
        if (result.cooldownRemaining && result.cooldownRemaining > 0) {
          // Play cooldown warning sound
          try {
            cooldownSound
              .play()
              .catch((e) => console.debug('Audio play failed:', e));
          } catch (e) {
            console.debug('Audio not available:', e);
          }

          const minutes = Math.ceil(result.cooldownRemaining / 60);
          toast.warning(result.message, {
            description: `Please wait ${minutes} more minute(s)`,
            duration: 5000,
          });

          // Set cooldown timer display
          setCooldownInfo({
            studentId: barcode,
            remainingSeconds: result.cooldownRemaining,
          });
        } else {
          // Play error sound
          try {
            errorSound
              .play()
              .catch((e) => console.debug('Audio play failed:', e));
          } catch (e) {
            console.debug('Audio not available:', e);
          }

          toast.error(result.message);
        }
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      toast.error('Failed to process scan');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle action execution
  const executeAction = async () => {
    if (!scanResult || !selectedAction) {
      return;
    }

    const studentId = scanResult.student?.id || scanResult.barcode;
    const purposes = [selectedAction]; // e.g., ['computer', 'reading', 'gaming']

    try {
      if (isOnline) {
        // Use kiosk check-in endpoint for real-time WebSocket updates
        await apiClient.post('/api/kiosk/confirm-check-in', {
          studentId,
          purposes,
          scanData: scanResult.barcode,
        });
        toast.success(`Activity started: ${selectedAction}`);
      } else {
        // Offline: queue for later
        await offlineActions.logActivity({
          studentId,
          activityType: selectedAction,
          timeLimitMinutes: ['computer', 'gaming', 'avr'].includes(
            selectedAction
          )
            ? timeLimit
            : undefined,
        });
        toast.info('Queued for sync when online');
      }
    } catch (error) {
      console.error('Failed to log activity:', error);
      toast.error('Failed to start activity session');
    }

    // Reset for next scan
    setScanResult(null);
    setSelectedAction('');
    setTimeLimit(30);
  };

  // Enhanced Activity Management Handlers
  const handleBulkCheckout = async () => {
    if (
      !confirm(
        `Are you sure you want to end ${selectedSessions.length} sessions?`
      )
    ) {
      return;
    }

    try {
      // Process all selected sessions
      const promises = selectedSessions.map((sessionId) => {
        // Find session details to log correct activity end
        const session = mockActiveSessions.find((s) => s.id === sessionId);
        if (!session) return Promise.resolve();

        // End session via kiosk checkout endpoint
        if (isOnline) {
          return apiClient.post('/api/kiosk/checkout', {
            studentId: session.studentId || 'unknown',
            scanData: session.studentId || 'unknown',
          });
        } else {
          return offlineActions.logActivity({
            studentId: session.studentId || 'unknown',
            activityType: session.activity,
            endTime: new Date().toISOString(),
            status: 'completed',
          });
        }
      });

      await Promise.all(promises);

      toast.success(`Successfully ended ${selectedSessions.length} sessions`);
      setSelectedSessions([]);
      setShowBulkActions(false);
    } catch (error) {
      console.error('Bulk checkout error:', error);
      toast.error('Failed to end some sessions');
    }
  };

  const handleBulkExtendTime = async (additionalMinutes: number) => {
    try {
      // Mock bulk time extension
      toast.success(
        `Extended time by ${additionalMinutes} minutes for ${selectedSessions.length} sessions`
      );
      setSelectedSessions([]);
      setShowBulkActions(false);
    } catch (error) {
      toast.error('Failed to extend session times');
    }
  };

  const handleBulkNotify = async () => {
    try {
      // Mock bulk notification
      toast.success(
        `Notifications sent to ${selectedSessions.length} students`
      );
      setSelectedSessions([]);
      setShowBulkActions(false);
    } catch (error) {
      toast.error('Failed to send notifications');
    }
  };

  const handleExportSessions = async () => {
    try {
      setIsExporting(true);
      // Mock export functionality
      const csvContent = `Session ID,Student Name,Activity,Start Time,Status\n${selectedSessions
        .map((id) => `${id},Student Name,Activity,Time,Active`)
        .join('\n')}`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sessions-export-${
        new Date().toISOString().split('T')[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Sessions exported successfully!');
    } catch (error) {
      toast.error('Failed to export sessions');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintSessions = () => {
    try {
      setIsPrintingSessions(true);
      window.print();
      toast.success('Print dialog opened for sessions');
    } catch (error) {
      toast.error('Failed to open print dialog');
    } finally {
      setIsPrintingSessions(false);
    }
  };

  const handleTransferEquipment = (sessionId: string) => {
    toast.info(
      `Equipment transfer for session ${sessionId} - would open transfer dialog`
    );
  };

  const handleAddSessionNotes = (sessionId: string) => {
    toast.info(`Add notes for session ${sessionId} - would open notes dialog`);
  };

  const handleViewStudentHistory = (studentId: string) => {
    toast.info(
      `View history for student ${studentId} - would open history dialog`
    );
  };

  const handlePrintHallPass = (sessionId: string) => {
    toast.info(
      `Print hall pass for session ${sessionId} - would generate pass`
    );
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  // Mock active sessions data - Empty for now as per requirements
  const mockActiveSessions: any[] = [];

  const filteredSessions =
    filterStatus === 'all'
      ? mockActiveSessions
      : mockActiveSessions.filter((session) => session.status === filterStatus);

  // Get time limit based on grade category
  const getDefaultTimeLimit = (gradeCategory?: string) => {
    switch (gradeCategory) {
      case 'primary':
        return 15;
      case 'gradeSchool':
        return 30;
      case 'juniorHigh':
        return 45;
      case 'seniorHigh':
        return 60;
      default:
        return 30;
    }
  };

  useEffect(() => {
    if (scanResult?.student) {
      setTimeLimit(getDefaultTimeLimit(scanResult.student.gradeCategory));
    }
  }, [scanResult]);

  return (
    <div className="space-y-6">
      <Dialog open={isBookDialogOpen} onOpenChange={handleBookDialogChange}>
        <DialogContent className="sm:max-w-lg space-y-4">
          <DialogHeader>
            <DialogTitle>Process Book Scan</DialogTitle>
            <DialogDescription>
              Choose how to handle the scanned material
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs uppercase text-muted-foreground">Barcode</p>
            <p className="font-mono text-lg font-semibold">
              {pendingBookBarcode || '—'}
            </p>
            {isBookPreviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading book details…
              </div>
            ) : bookPreview ? (
              <div className="mt-2 text-sm">
                <p className="font-semibold">{bookPreview.title}</p>
                <p className="text-muted-foreground">
                  Accession #{bookPreview.accession_no}
                </p>
                <p className="text-muted-foreground">
                  Available copies: {bookPreview.available_copies ?? '—'}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-destructive">
                Book details unavailable. You can still continue.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Select Action</p>
            <div className="flex gap-2">
              {(['BORROW', 'READ', 'RETURN'] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={bookIntent === option ? 'default' : 'outline'}
                  onClick={() => setBookIntent(option)}
                >
                  {option === 'BORROW' && <BookOpen className="h-4 w-4 mr-1" />}
                  {option === 'READ' && <Eye className="h-4 w-4 mr-1" />}
                  {option === 'RETURN' && (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {option === 'BORROW'
                    ? 'Borrow'
                    : option === 'READ'
                      ? 'Reading'
                      : 'Return'}
                </Button>
              ))}
            </div>
          </div>

          {bookIntent !== 'RETURN' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Student</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={!lastStudentContext}
                  onClick={() => {
                    if (!lastStudentContext) return;
                    setBookActionStudentId(lastStudentContext.id);
                    setBookActionStudentName(lastStudentContext.display);
                    toast.success(`Using ${lastStudentContext.display}`);
                  }}
                >
                  Use last scan
                </Button>
              </div>
              <StudentSearchDropdown
                onSelect={(student) => {
                  setBookActionStudentId(student.id);
                  setBookActionStudentName(student.name);
                  setLastStudentContext({
                    id: student.id,
                    display: student.name,
                  });
                }}
                selectedStudentId={bookActionStudentId}
              />
              <p className="text-xs text-muted-foreground">
                Selected: {bookActionStudentName || 'None'}
              </p>
            </div>
          )}

          {bookIntent === 'BORROW' && (
            <div className="space-y-2">
              <label htmlFor="book-due-date" className="text-sm font-medium">
                Due Date
              </label>
              <Input
                id="book-due-date"
                type="datetime-local"
                value={bookDueDate}
                onChange={(e) => setBookDueDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="book-notes" className="text-sm font-medium">
              Notes (optional)
            </label>
            <Textarea
              id="book-notes"
              value={bookNotes}
              onChange={(e) => setBookNotes(e.target.value)}
              placeholder="Remarks for this transaction"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleBookDialogChange(false)}
              disabled={isSubmittingBookAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitBookAction}
              disabled={
                isSubmittingBookAction ||
                (bookIntent !== 'RETURN' && !bookActionStudentId)
              }
            >
              {isSubmittingBookAction && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Enhanced Header with Action Buttons */}
      <div className="relative">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black dark:text-foreground">
            Activity Management
          </h2>
          <p className="text-black dark:text-muted-foreground">
            Scan student IDs, books, or equipment for library activities.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="absolute top-0 right-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActiveSessions(!showActiveSessions)}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Eye className="h-4 w-4 mr-1" />
            {showActiveSessions ? 'Hide' : 'Show'} Sessions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkActions(!showBulkActions)}
            disabled={selectedSessions.length === 0}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Users className="h-4 w-4 mr-1" />
            Bulk Actions ({selectedSessions.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSessions}
            disabled={isExporting || selectedSessions.length === 0}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSessions}
            disabled={isPrintingSessions}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {isOnline
            ? 'Online mode - All activities will be synced to the server immediately.'
            : 'Offline mode - Activities will be queued and synced when connection is restored.'}
        </AlertDescription>
      </Alert>

      {/* Visual Cooldown Timer */}
      {cooldownInfo && (
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>Cooldown Active:</strong> Please wait before checking in
              again
            </span>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: `${((30 * 60 - cooldownInfo.remainingSeconds) / (30 * 60)) * 100}%`,
                  }}
                />
              </div>
              <span className="font-mono text-sm font-semibold">
                {Math.floor(cooldownInfo.remainingSeconds / 60)}:
                {(cooldownInfo.remainingSeconds % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Self-Service Statistics Dashboard */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Check-ins Today
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {statistics.totalCheckIns}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Unique Students
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {statistics.uniqueStudents}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Avg Time
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {statistics.averageTimeSpent} min
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enhanced Filter Buttons */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter Sessions:</span>
          <div className="flex gap-1">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All ({mockActiveSessions.length})
            </Button>
            <Button
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('active')}
            >
              Active (
              {mockActiveSessions.filter((s) => s.status === 'active').length})
            </Button>
            <Button
              variant={filterStatus === 'overdue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('overdue')}
            >
              Overdue (
              {mockActiveSessions.filter((s) => s.status === 'overdue').length})
            </Button>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info('Manual session entry - would open entry form')
            }
            aria-label="manual-entry"
            data-testid="manual-entry"
          >
            <Plus className="h-3 w-3 mr-1" />
            Manual Entry
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info('End all active sessions - would confirm action')
            }
            aria-label="end-all-sessions"
            data-testid="end-all-sessions"
          >
            <Square className="h-3 w-3 mr-1" />
            End All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await fetch('/api/kiosk/broadcast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: 'Please keep noise to a minimum. Thank you!',
                  }),
                });
                toast.success('Announcement broadcasted');
              } catch {
                toast.error('Failed to broadcast announcement');
              }
            }}
            aria-label="broadcast-announcement"
            data-testid="broadcast-announcement"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Broadcast
          </Button>
        </div>
      </div>

      {/* Bulk Actions Panel */}
      {showBulkActions && selectedSessions.length > 0 && (
        <Card className="border-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>
                Bulk Actions - {selectedSessions.length} Sessions Selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowBulkActions(false);
                  setSelectedSessions([]);
                }}
              >
                ×
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Time Extension Actions */}
              <div>
                <p className="text-sm font-medium mb-2">Extend Time:</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkExtendTime(15)}
                  >
                    <Timer className="h-3 w-3 mr-1" />
                    +15 min
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkExtendTime(30)}
                  >
                    <Timer className="h-3 w-3 mr-1" />
                    +30 min
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkExtendTime(60)}
                  >
                    <Timer className="h-3 w-3 mr-1" />
                    +60 min
                  </Button>
                </div>
              </div>

              {/* Other Bulk Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkCheckout}
                >
                  <Square className="h-3 w-3 mr-1" />
                  End Sessions
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkNotify}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Send Notices
                </Button>
              </div>

              {/* Selected Sessions Summary */}
              <div className="text-xs text-muted-foreground bg-white/50 dark:bg-gray-800/50 p-2 rounded">
                Selected Sessions: {selectedSessions.join(', ')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions Panel */}
      {showActiveSessions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Active Sessions ({filteredSessions.length})</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActiveSessions(false)}
              >
                ×
              </Button>
            </CardTitle>
            <CardDescription>
              Manage current library sessions and student activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 rounded-lg border ${
                    session.status === 'overdue'
                      ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                      : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(session.id)}
                        onChange={() => toggleSessionSelection(session.id)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium">{session.studentName}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.activity} • {session.equipment} •{' '}
                          {session.startTime}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          session.status === 'overdue'
                            ? 'destructive'
                            : 'default'
                        }
                        className="text-xs"
                      >
                        {session.status.toUpperCase()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewStudentHistory(session.id)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransferEquipment(session.id)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddSessionNotes(session.id)}
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintHallPass(session.id)}
                      >
                        <Printer className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Session Action Buttons */}
                  <div className="flex gap-1 mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkExtendTime(15)}
                    >
                      <Timer className="h-3 w-3 mr-1" />
                      +15
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkExtendTime(30)}
                    >
                      <Timer className="h-3 w-3 mr-1" />
                      +30
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkExtendTime(60)}
                    >
                      <Timer className="h-3 w-3 mr-1" />
                      +60
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleBulkCheckout()}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      End
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle>Barcode Scanner</CardTitle>
            <CardDescription>
              Choose your preferred scanning method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="usb" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="usb"
                  className="flex items-center space-x-2"
                >
                  <Keyboard className="h-4 w-4" />
                  <span>USB Scanner</span>
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="flex items-center space-x-2"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Manual Entry</span>
                </TabsTrigger>
              </TabsList>

              {/* USB Scanner */}
              <TabsContent value="usb" className="space-y-4">
                <div className="space-y-4">
                  <div
                    className={`
                    p-8 rounded-lg border-2 text-center transition-all
                    ${
                      isListening
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                        : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                    }
                  `}
                  >
                    <Keyboard
                      className={`h-16 w-16 mx-auto mb-4 ${
                        isListening
                          ? 'text-green-600 dark:text-green-400 animate-pulse'
                          : 'text-muted-foreground'
                      }`}
                    />

                    {isListening ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                          <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                            USB Scanner ACTIVE
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Scan any barcode or QR code with your USB scanner
                        </p>
                        {currentInput && (
                          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-green-300 dark:border-green-700">
                            <p className="text-xs text-muted-foreground mb-1">
                              Reading:
                            </p>
                            <p className="font-mono text-lg font-bold text-green-600 dark:text-green-400">
                              {currentInput}_
                            </p>
                          </div>
                        )}
                        {lastScannedCode && (
                          <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded">
                            <p className="text-xs text-muted-foreground mb-1">
                              Last scanned:
                            </p>
                            <p className="font-mono text-sm font-semibold text-green-700 dark:text-green-300">
                              {lastScannedCode}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-muted-foreground mb-4">
                          USB Scanner is deactivated
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={toggleListening}
                      variant={isListening ? 'destructive' : 'default'}
                      className="mt-4"
                    >
                      {isListening ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Deactivate Scanner
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Activate Scanner
                        </>
                      )}
                    </Button>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>How to use:</strong> Make sure this window is
                      focused, then scan any barcode with your USB scanner. The
                      scanner will automatically detect and process the barcode.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>

              {/* Manual Entry */}
              <TabsContent value="manual" className="space-y-4">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Edit3 className="h-4 w-4 mr-2" />
                      Manual Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Manual Barcode Entry</DialogTitle>
                      <DialogDescription>
                        Enter barcode manually when scanning is not available.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        placeholder="Enter barcode..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      />
                      <Button onClick={handleSubmit} className="w-full">
                        Submit
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Result & Action Section */}
        <Card>
          <CardHeader>
            <CardTitle>Scan Result & Actions</CardTitle>
            <CardDescription>
              Review scan result and select appropriate action
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">Processing barcode...</p>
              </div>
            ) : scanResult ? (
              <div className="space-y-4">
                {/* Scan Result Display */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      variant={
                        scanResult.type === 'student'
                          ? 'default'
                          : scanResult.type === 'book'
                            ? 'secondary'
                            : scanResult.type === 'equipment'
                              ? 'outline'
                              : 'destructive'
                      }
                    >
                      {scanResult.type.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(scanResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {scanResult.student ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">
                          {scanResult.student.firstName}{' '}
                          {scanResult.student.lastName}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>ID: {scanResult.student.studentId}</div>
                        <div>
                          Grade: {scanResult.student.gradeLevel} -{' '}
                          {scanResult.student.section}
                        </div>
                        <div>Category: {scanResult.student.gradeCategory}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="font-medium">
                        Barcode: {scanResult.barcode}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {scanResult.type === 'unknown'
                          ? 'Unrecognized barcode format'
                          : `No data found for this ${scanResult.type}`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Selection */}
                {scanResult.student && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Select Action:</h4>
                      <div className="grid gap-2">
                        <Button
                          variant={
                            selectedAction === 'library' ? 'default' : 'outline'
                          }
                          onClick={() => setSelectedAction('library')}
                          className="justify-start"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Library / Study
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'computer'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedAction('computer')}
                          className="justify-start"
                        >
                          <Monitor className="h-4 w-4 mr-2" />
                          Computer Session
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'gaming' ? 'default' : 'outline'
                          }
                          onClick={() => setSelectedAction('gaming')}
                          className="justify-start"
                        >
                          <Gamepad2 className="h-4 w-4 mr-2" />
                          Gaming Session
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'borrowing'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedAction('borrowing')}
                          className="justify-start"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Book Borrowing
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'returning'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedAction('returning')}
                          className="justify-start"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Book Return
                        </Button>
                      </div>
                    </div>

                    {/* Time Limit Selection */}
                    {['computer', 'gaming'].includes(selectedAction) && (
                      <div>
                        <h4 className="font-medium mb-2">
                          Time Limit (minutes):
                        </h4>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            min="5"
                            max="120"
                            value={timeLimit}
                            onChange={(e) =>
                              setTimeLimit(parseInt(e.target.value) || 30)
                            }
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            Default for {scanResult.student.gradeCategory}:{' '}
                            {getDefaultTimeLimit(
                              scanResult.student.gradeCategory
                            )}
                            min
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Execute Action */}
                    <Button
                      onClick={executeAction}
                      disabled={!selectedAction}
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Execute {selectedAction || 'Action'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-12 w-12 mx-auto mb-4 text-muted-foreground">
                  <Camera />
                </div>
                <p className="text-muted-foreground">
                  Scan a barcode to see results and available actions
                </p>
                {lastScanResult && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Last scan: {lastScanResult}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks without scanning</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button
              variant="outline"
              className="h-16 flex-col hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => {
                // Navigate to student management or open dialog
                // For now, just show a toast as we don't have navigation context here easily
                toast.info(
                  'Please go to Student Management tab to register new students'
                );
              }}
            >
              <UserPlus className="h-6 w-6 mb-2 text-blue-600" />
              <span className="text-sm">Register Student</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col hover:bg-green-50 hover:border-green-300 transition-colors"
              onClick={() => setShowActiveSessions(!showActiveSessions)}
            >
              <Activity className="h-6 w-6 mb-2 text-green-600" />
              <span className="text-sm">Active Sessions</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col hover:bg-purple-50 hover:border-purple-300 transition-colors"
              onClick={() => {
                toast.info('Please go to Reports tab');
              }}
            >
              <BarChart3 className="h-6 w-6 mb-2 text-purple-600" />
              <span className="text-sm">Reports</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col hover:bg-orange-50 hover:border-orange-300 transition-colors"
              onClick={async () => {
                try {
                  await offlineActions.sync();
                  toast.success('Offline data synced successfully');
                } catch (error) {
                  toast.error('Failed to sync offline data');
                }
              }}
            >
              <RefreshCw className="h-6 w-6 mb-2 text-orange-600" />
              <span className="text-sm">Sync Data</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ScanWorkspace;
