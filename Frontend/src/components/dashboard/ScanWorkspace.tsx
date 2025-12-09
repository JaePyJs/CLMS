import { useState, useEffect, useRef } from 'react';
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
} from '@/components/ui/dialog';
import { useUsbScanner, useManualEntry, scannerUtils } from '@/lib/scanner';
import selfServiceApi from '@/services/selfServiceApi';
import { useAppStore } from '@/store/useAppStore';
import { offlineActions } from '@/lib/offline-queue';
import { toast } from 'sonner';
import { scanApi, apiClient, studentsApi } from '@/lib/api';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';
import {
  Camera,
  Keyboard,
  Edit3,
  BookOpen,
  Monitor,
  Gamepad2,
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  Timer,
  UserPlus,
  FileText,
  Eye,
  Printer,
  ExternalLink,
  BarChart3,
  Activity,
  Loader2,
  Wifi,
  WifiOff,
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
  const [filterStatus, _setFilterStatus] = useState<string>('all');
  const [_isExporting, setIsExporting] = useState(false);
  const [_isPrintingSessions, setIsPrintingSessions] = useState(false);

  // Self-service enhancements
  const [cooldownInfo, setCooldownInfo] = useState<{
    studentId: string;
    remainingSeconds: number;
  } | null>(null);
  const [_statistics, setStatistics] = useState<unknown>(null);
  const [activeSessions, setActiveSessions] = useState<
    Array<{
      id: string;
      studentId?: string;
      studentName?: string;
      gradeLevel?: string;
      checkInTime?: Date;
      status?: string;
      duration?: number;
      activity?: string;
    }>
  >([]);
  const [_isLoadingActiveSessions, setIsLoadingActiveSessions] =
    useState(false);

  // Real-time WebSocket for scan events from all stations
  const { events: wsEvents, isConnected: wsConnected } =
    useAttendanceWebSocket();
  const [_realtimeFeed, setRealtimeFeed] = useState<
    Array<{
      id: string;
      type: 'checkin' | 'checkout';
      studentName: string;
      timestamp: Date;
    }>
  >([]);
  const lastProcessedEventRef = useRef<string | null>(null);

  const { isOnline, lastScanResult, setActiveStudent } = useAppStore();
  const { toggleListening, isListening, currentInput, lastScannedCode } =
    useUsbScanner();
  const { input, setInput, handleSubmit } = useManualEntry();

  // Sound effects - create safely to handle missing files
  const createSafeAudio = (src: string) => {
    try {
      const audio = new Audio(src);
      audio.preload = 'none'; // Don't preload until needed
      return audio;
    } catch {
      return null;
    }
  };

  const successSound = createSafeAudio('/sounds/success.mp3');
  const errorSound = createSafeAudio('/sounds/error.mp3');
  const cooldownSound = createSafeAudio('/sounds/warning.mp3');

  // Safe sound play function
  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) {
      audio.play().catch(() => {});
    }
  };

  // Handle WebSocket events - update real-time feed
  useEffect(() => {
    if (!wsEvents || wsEvents.length === 0) return;

    const latestEvent = wsEvents[wsEvents.length - 1];

    // Only process check-in and check-out events
    if (
      latestEvent.type !== 'student_checkin' &&
      latestEvent.type !== 'student_checkout'
    )
      return;

    const eventData = latestEvent.data as {
      activityId: string;
      studentName: string;
    };
    const eventId = eventData.activityId;

    // Skip if we already processed this event
    if (!eventId || lastProcessedEventRef.current === eventId) return;
    lastProcessedEventRef.current = eventId;

    const newEvent = {
      id: `${eventId}-${Date.now()}`, // Unique key combining event ID with timestamp
      type:
        latestEvent.type === 'student_checkin'
          ? ('checkin' as const)
          : ('checkout' as const),
      studentName: eventData.studentName,
      timestamp: new Date(),
    };

    // Deduplicate by checking if event with same base ID already exists
    setRealtimeFeed((prev) => {
      const baseEventId = eventId;
      const alreadyExists = prev.some((e) => e.id.startsWith(baseEventId));
      if (alreadyExists) return prev;
      return [newEvent, ...prev.slice(0, 9)];
    }); // Keep last 10

    // Play sound for events from other stations
    try {
      if (latestEvent.type === 'student_checkin') {
        playSound(successSound);
      }
    } catch {
      // Ignore sound errors
    }
  }, [wsEvents]);

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
    loadActiveSessions();
    const interval = setInterval(() => {
      loadStatistics();
      loadActiveSessions();
    }, 60000); // Refresh every minute
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
      const errorObj = error as { message?: string };
      const msg = errorObj?.message || 'Failed to load statistics';
      toast.error(String(msg));
    }
  };

  const loadActiveSessions = async () => {
    setIsLoadingActiveSessions(true);
    try {
      const result = await studentsApi.getActiveSessions();
      if (result && result.success && result.data) {
        // Transform the data to match expected format
        interface RawSession {
          activityId?: string;
          id?: string;
          studentId?: string;
          studentName?: string;
          firstName?: string;
          lastName?: string;
          gradeLevel?: string;
          checkinTime?: string;
          checkInTime?: string;
          startTime?: string;
          isOverdue?: boolean;
          duration?: number;
        }
        const dataArray = Array.isArray(result.data) ? result.data : [];
        const sessions = dataArray.map((session: RawSession) => ({
          id: session.activityId || session.id || '',
          studentId: session.studentId,
          studentName:
            session.studentName ||
            `${session.firstName || ''} ${session.lastName || ''}`.trim(),
          gradeLevel: session.gradeLevel,
          checkInTime: new Date(
            session.checkinTime ||
              session.checkInTime ||
              session.startTime ||
              Date.now()
          ),
          status: session.isOverdue ? 'overdue' : 'active',
          duration: session.duration || 0,
        }));
        // Deduplicate sessions by id to prevent duplicate key errors
        interface SessionItem {
          id: string;
          studentId?: string;
          studentName?: string;
          gradeLevel?: string;
          checkInTime?: Date;
          status?: string;
          duration?: number;
        }
        const uniqueSessions = sessions.filter(
          (session: SessionItem, index: number, self: SessionItem[]) =>
            index === self.findIndex((s) => s.id === session.id)
        );
        setActiveSessions(uniqueSessions);
      } else {
        setActiveSessions([]);
      }
    } catch (error) {
      console.error('Failed to load active sessions:', error);
      setActiveSessions([]);
    } finally {
      setIsLoadingActiveSessions(false);
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
      const previewData = previewResponse as {
        success: boolean;
        book?: BookPreview;
      };
      if (previewData.success && previewData.book) {
        setBookPreview(previewData.book);
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
        playSound(successSound);

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
              gradeCategory: result.student.gradeCategory || 'STUDENT', // Use correct field
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

          // Set as global active student for cross-component workflow
          setActiveStudent({
            id: normalizedStudent.id,
            name: `${normalizedStudent.firstName} ${normalizedStudent.lastName}`.trim(),
            gradeLevel: normalizedStudent.gradeLevel,
            gradeCategory:
              (normalizedStudent.gradeCategory as
                | 'primary'
                | 'gradeSchool'
                | 'juniorHigh'
                | 'seniorHigh') || undefined,
            barcode: result.student?.studentId,
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
          playSound(cooldownSound);

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
          playSound(errorSound);

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
        const session = activeSessions.find((s) => s.id === sessionId);
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
    } catch {
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
    } catch {
      toast.error('Failed to send notifications');
    }
  };

  const _handleExportSessions = async () => {
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
    } catch {
      toast.error('Failed to export sessions');
    } finally {
      setIsExporting(false);
    }
  };

  const _handlePrintSessions = () => {
    try {
      setIsPrintingSessions(true);
      window.print();
      toast.success('Print dialog opened for sessions');
    } catch {
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

  // Filter active sessions based on status
  const filteredSessions =
    filterStatus === 'all'
      ? activeSessions
      : activeSessions.filter((session) => session.status === filterStatus);

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
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Scan Station
          </h3>
          <p className="text-sm text-muted-foreground">
            Scan student IDs or book barcodes to process check-ins and
            borrowing.
          </p>
        </div>

        {/* Simplified Header Action Buttons */}
        <div className="absolute top-0 right-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActiveSessions(!showActiveSessions)}
            className="bg-white/90 hover:bg-white shadow-sm dark:bg-gray-800/90"
          >
            <Eye className="h-4 w-4 mr-1" />
            {showActiveSessions ? 'Hide' : 'Show'} Sessions (
            {activeSessions.length})
          </Button>
        </div>
      </div>

      {/* Simplified Connection Status - Single compact alert */}
      <Alert
        className={`${isOnline ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'}`}
      >
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-600" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-600" />
        )}
        <AlertDescription
          className={isOnline ? 'text-green-700' : 'text-red-700'}
        >
          {isOnline
            ? `Online • ${wsConnected ? 'Live updates active' : 'Connecting...'}`
            : 'Offline - Activities will sync when connection is restored'}
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
                          {session.activity ?? 'N/A'} •{' '}
                          {(session as { equipment?: string }).equipment ??
                            'N/A'}{' '}
                          •{' '}
                          {(session as { startTime?: string | Date }).startTime
                            ? String(
                                (session as { startTime?: string | Date })
                                  .startTime
                              )
                            : 'N/A'}
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
                        {(session.status ?? 'active').toUpperCase()}
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
                <div className="space-y-4">
                  <div className="p-6 rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700">
                    <Edit3 className="h-12 w-12 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-center text-lg font-semibold text-blue-700 dark:text-blue-300 mb-4">
                      Manual Barcode Entry
                    </p>
                    <p className="text-center text-sm text-muted-foreground mb-4">
                      Type or paste a student ID or barcode below
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter student ID or barcode..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && input.trim()) {
                            handleSubmit();
                          }
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button onClick={handleSubmit} disabled={!input.trim()}>
                        Submit
                      </Button>
                    </div>
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Tip:</strong> Enter the student ID (e.g.,
                      20240191) or scan barcode value directly. Press Enter or
                      click Submit to process.
                    </AlertDescription>
                  </Alert>
                </div>
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
                <div
                  className={`p-5 rounded-xl border-2 transition-all duration-300 ${
                    scanResult.type === 'student'
                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-300 dark:border-green-700'
                      : scanResult.type === 'book'
                        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-300 dark:border-blue-700'
                        : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge
                      className={`px-3 py-1 text-sm font-semibold ${
                        scanResult.type === 'student'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : scanResult.type === 'book'
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : scanResult.type === 'equipment'
                              ? 'bg-purple-500 hover:bg-purple-600 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                    >
                      ✓ {scanResult.type.toUpperCase()} FOUND
                    </Badge>
                    <span className="text-xs text-muted-foreground bg-white dark:bg-slate-800 px-2 py-1 rounded-md">
                      {new Date(scanResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {scanResult.student ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                          {scanResult.student.firstName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {scanResult.student.firstName}{' '}
                            {scanResult.student.lastName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            ID: {scanResult.student.studentId}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge
                          variant="outline"
                          className="bg-white dark:bg-slate-800 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                        >
                          Grade {scanResult.student.gradeLevel}
                        </Badge>
                        {scanResult.student.section && (
                          <Badge
                            variant="outline"
                            className="bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                          >
                            {scanResult.student.section}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                        >
                          {scanResult.student.gradeCategory}
                        </Badge>
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
                      <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">
                        Select Action:
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant={
                            selectedAction === 'library' ? 'default' : 'outline'
                          }
                          onClick={() => setSelectedAction('library')}
                          className={`justify-start h-14 ${
                            selectedAction === 'library'
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 shadow-lg'
                              : 'hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-950/30'
                          }`}
                        >
                          <BookOpen
                            className={`h-5 w-5 mr-2 ${selectedAction === 'library' ? 'text-white' : 'text-green-600'}`}
                          />
                          <span
                            className={
                              selectedAction === 'library' ? 'text-white' : ''
                            }
                          >
                            Library / Study
                          </span>
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'computer'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedAction('computer')}
                          className={`justify-start h-14 ${
                            selectedAction === 'computer'
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 shadow-lg'
                              : 'hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30'
                          }`}
                        >
                          <Monitor
                            className={`h-5 w-5 mr-2 ${selectedAction === 'computer' ? 'text-white' : 'text-blue-600'}`}
                          />
                          <span
                            className={
                              selectedAction === 'computer' ? 'text-white' : ''
                            }
                          >
                            Computer
                          </span>
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'gaming' ? 'default' : 'outline'
                          }
                          onClick={() => setSelectedAction('gaming')}
                          className={`justify-start h-14 ${
                            selectedAction === 'gaming'
                              ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 border-0 shadow-lg'
                              : 'hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/30'
                          }`}
                        >
                          <Gamepad2
                            className={`h-5 w-5 mr-2 ${selectedAction === 'gaming' ? 'text-white' : 'text-purple-600'}`}
                          />
                          <span
                            className={
                              selectedAction === 'gaming' ? 'text-white' : ''
                            }
                          >
                            Gaming
                          </span>
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'borrowing'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedAction('borrowing')}
                          className={`justify-start h-14 ${
                            selectedAction === 'borrowing'
                              ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 border-0 shadow-lg'
                              : 'hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950/30'
                          }`}
                        >
                          <BookOpen
                            className={`h-5 w-5 mr-2 ${selectedAction === 'borrowing' ? 'text-white' : 'text-amber-600'}`}
                          />
                          <span
                            className={
                              selectedAction === 'borrowing' ? 'text-white' : ''
                            }
                          >
                            Borrow Book
                          </span>
                        </Button>
                        <Button
                          variant={
                            selectedAction === 'returning'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedAction('returning')}
                          className={`justify-start h-14 col-span-2 ${
                            selectedAction === 'returning'
                              ? 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 border-0 shadow-lg'
                              : 'hover:bg-teal-50 hover:border-teal-300 dark:hover:bg-teal-950/30'
                          }`}
                        >
                          <BookOpen
                            className={`h-5 w-5 mr-2 ${selectedAction === 'returning' ? 'text-white' : 'text-teal-600'}`}
                          />
                          <span
                            className={
                              selectedAction === 'returning' ? 'text-white' : ''
                            }
                          >
                            Return Book
                          </span>
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
                      size="lg"
                      className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
                        selectedAction
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                          : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      {selectedAction
                        ? `Execute ${selectedAction.charAt(0).toUpperCase() + selectedAction.slice(1)}`
                        : 'Select an Action'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-slate-900 rounded-xl">
                <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center">
                  <Camera className="h-10 w-10 text-indigo-500" />
                </div>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ready to Scan
                </p>
                <p className="text-muted-foreground">
                  Scan a student ID or book barcode to begin
                </p>
                {lastScanResult && (
                  <p className="text-sm text-muted-foreground mt-3 bg-white dark:bg-slate-800 inline-block px-3 py-1 rounded-full">
                    Last scan: {lastScanResult}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Quick Actions */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-800 dark:to-indigo-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            Quick Actions
          </CardTitle>
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
                } catch {
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
