// @ts-nocheck
/* cspell:ignore Filipiniana */
import { useEffect, useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';

// Import new Kiosk components
import { ReminderScreen } from '@/components/kiosk/new/ReminderScreen';
import { WelcomeScreen } from '@/components/kiosk/new/WelcomeScreen';
import { ThankYouScreen } from '@/components/kiosk/new/ThankYouScreen';
import { BookActionModal } from '@/components/kiosk/new/BookActionModal';

interface StudentInfo {
  id: string;
  studentId: string;
  name: string;
  gradeLevel: string;
  section: string;
  barcode: string;
}

interface BookInfo {
  id: string;
  title: string;
  accessionNo: string;
  author: string;
  isAvailable: boolean;
}

interface TapInResponse {
  success: boolean;
  message: string;
  student?: StudentInfo;
  book?: BookInfo;
  type?: 'STUDENT' | 'BOOK';
  cooldownRemaining?: number;
  canCheckIn: boolean;
  action?: 'check-in' | 'check-out';
}

export default function Kiosk() {
  const { setTheme } = useTheme();

  // Force dark mode for the kiosk
  useEffect(() => {
    setTheme('dark');
  }, []);

  // State for the current view
  const [view, setView] = useState<'reminder' | 'welcome' | 'thankyou'>(
    'reminder'
  );

  // State for the scanned student to display
  const [scannedStudent, setScannedStudent] = useState<StudentInfo | null>(
    null
  );

  // State for Book Action Modal
  const [scannedBook, setScannedBook] = useState<BookInfo | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);

  // Scanner input buffer
  const [scanBuffer, setScanBuffer] = useState('');
  // const [isProcessing, setIsProcessing] = useState(false);

  // Timeout ref for resetting to reminder screen
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle barcode scanner input (global listener)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (scanBuffer.trim().length > 0) {
          handleScan(scanBuffer.trim());
          setScanBuffer('');
        }
      } else if (e.key.length === 1) {
        setScanBuffer((prev) => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scanBuffer]);

  const resetTimer = () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setView('reminder');
      setScannedStudent(null);
      setScannedBook(null);
      setShowBookModal(false);
    }, 10000); // 10 seconds idle timeout
  };

  const handleScan = async (barcode: string) => {
    // if (isProcessing) return; // Allow interruption
    // setIsProcessing(true);

    // Clear timeout while processing
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    try {
      const response = await apiClient.post<TapInResponse>(
        '/api/kiosk/tap-in',
        {
          scanData: barcode,
        }
      );

      const data = response as any;

      if (data.success) {
        if (data.type === 'BOOK') {
          // Show Book Action Modal
          setScannedBook(data.book);
          setShowBookModal(true);
          // Don't reset timer yet, wait for user action
        } else {
          // Handle Student Scan
          if (data.student) {
            setScannedStudent(data.student);

            if (showBookModal) {
              toast.success(`Student identified: ${data.student.name}`);
              return; // Keep modal open
            }

            // Normal Check-in/out logic
            if (data.canCheckIn) {
              try {
                const confirmResp = await apiClient.post(
                  '/api/kiosk/confirm-check-in',
                  {
                    studentId: data.student.id,
                    purposes: ['library'],
                    scanData: barcode,
                  }
                );
                if ((confirmResp as any).success) setView('welcome');
                else setView('welcome');
              } catch (err) {
                console.error('Auto-confirm failed', err);
                setView('welcome');
              }
            } else {
              if (data.message === 'You are already checked in') {
                try {
                  const checkoutResp = await apiClient.post(
                    '/api/kiosk/checkout',
                    {
                      studentId: data.student.id,
                      reason: 'manual',
                    }
                  );
                  if ((checkoutResp as any).success) setView('thankyou');
                  else setView('thankyou');
                } catch (err) {
                  console.error('Auto-checkout failed', err);
                  setView('thankyou');
                }
              } else {
                toast.error(data.message);
                setView('welcome');
              }
            }
            resetTimer();
          }
        }
      } else {
        toast.error(data.message || 'Item not found');
        resetTimer();
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Error processing scan');
      resetTimer();
    } finally {
      // setIsProcessing(false);
    }
  };

  const handleBorrow = async (dueDate?: string) => {
    if (!scannedStudent || !scannedBook) return;
    try {
      const res = await apiClient.post('/api/kiosk/borrow', {
        studentId: scannedStudent.id,
        barcode: scannedBook.accessionNo,
        dueDate: dueDate, // Pass due date to backend
      });
      if ((res as any).success) {
        toast.success(`Borrowed: ${scannedBook.title}`);
        setShowBookModal(false);
        setScannedBook(null);
        resetTimer();
      } else {
        toast.error((res as any).message);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Borrow failed');
    }
  };

  const handleReturn = async () => {
    if (!scannedBook) return;
    try {
      const res = await apiClient.post('/api/kiosk/return', {
        barcode: scannedBook.accessionNo,
      });
      if ((res as any).success) {
        toast.success(`Returned: ${scannedBook.title}`);
        setShowBookModal(false);
        setScannedBook(null);
        resetTimer();
      } else {
        toast.error((res as any).message);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Return failed');
    }
  };

  const handleRead = async () => {
    if (!scannedStudent || !scannedBook) return;
    try {
      const res = await apiClient.post('/api/kiosk/read', {
        studentId: scannedStudent.id,
        barcode: scannedBook.accessionNo,
      });
      if ((res as any).success) {
        toast.success(`Reading recorded: ${scannedBook.title}`);
        setShowBookModal(false);
        setScannedBook(null);
        resetTimer();
      } else {
        toast.error((res as any).message);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Read record failed');
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950">
      <AnimatePresence mode="wait">
        {view === 'reminder' && (
          <motion.div
            key="reminder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <ReminderScreen onScan={handleScan} />
          </motion.div>
        )}

        {view === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <WelcomeScreen studentName={scannedStudent?.name} />
          </motion.div>
        )}

        {view === 'thankyou' && (
          <motion.div
            key="thankyou"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <ThankYouScreen studentName={scannedStudent?.name} />
          </motion.div>
        )}
      </AnimatePresence>

      <BookActionModal
        isOpen={showBookModal}
        onClose={() => {
          setShowBookModal(false);
          resetTimer();
        }}
        bookTitle={scannedBook?.title || ''}
        bookAuthor={scannedBook?.author}
        accessionNo={scannedBook?.accessionNo}
        studentName={scannedStudent?.name}
        onBorrow={handleBorrow}
        onReturn={handleReturn}
        onRead={handleRead}
      />

      {/* Hidden input for focus management */}
      <input
        type="text"
        className="opacity-0 absolute top-0 left-0 h-0 w-0"
        autoFocus
        onBlur={(e) => e.target.focus()}
      />
    </div>
  );
}
