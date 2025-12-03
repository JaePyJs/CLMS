// @ts-nocheck
/* cspell:ignore Filipiniana */
import { useEffect, useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';

// Import new Kiosk components
import { ReminderScreen } from '@/components/kiosk/new/ReminderScreen';
import { WelcomeScreen } from '@/components/kiosk/new/WelcomeScreen';
import { ThankYouScreen } from '@/components/kiosk/new/ThankYouScreen';

interface StudentInfo {
  id: string;
  studentId: string;
  name: string;
  gender?: string;
  gradeLevel: string;
  section: string;
  barcode: string;
}

export default function Kiosk() {
  const { setTheme } = useTheme();

  // Debug: log component mount
  useEffect(() => {
    console.info('[Kiosk] Component mounted');
    return () => console.info('[Kiosk] Component unmounted');
  }, []);

  // Force dark mode for the kiosk
  useEffect(() => {
    setTheme('dark');
  }, []);

  // WebSocket for real-time updates from scan station
  const { events: wsEvents, isConnected: wsConnected } =
    useAttendanceWebSocket();

  // Debug: log connection state
  useEffect(() => {
    console.info('[Kiosk] WebSocket connected:', wsConnected);
  }, [wsConnected]);

  // State for the current view
  const [view, setView] = useState<'reminder' | 'welcome' | 'thankyou'>(
    'reminder'
  );

  // State for the scanned student to display
  const [scannedStudent, setScannedStudent] = useState<StudentInfo | null>(
    null
  );

  // State to track last processed event ID (to avoid duplicate processing)
  const lastProcessedEventRef = useRef<string | null>(null);

  // Timeout ref for resetting to reminder screen
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle WebSocket events from scan station
  useEffect(() => {
    // Debug: Log all received events
    if (wsEvents && wsEvents.length > 0) {
      console.info(
        '[Kiosk] WebSocket events received:',
        wsEvents.length,
        'events'
      );
      console.info('[Kiosk] Latest event:', wsEvents[wsEvents.length - 1]);
    }

    if (!wsEvents || wsEvents.length === 0) return;

    const latestEvent = wsEvents[wsEvents.length - 1];
    const eventId = latestEvent?.data?.activityId;

    console.info(
      '[Kiosk] Processing event:',
      latestEvent.type,
      'activityId:',
      eventId
    );

    // Skip if we already processed this event
    if (!eventId || lastProcessedEventRef.current === eventId) {
      console.info('[Kiosk] Skipping - already processed or no eventId');
      return;
    }
    lastProcessedEventRef.current = eventId;

    // Handle both legacy and modern event types
    if (
      latestEvent.type === 'student_checkin' ||
      latestEvent.type === 'attendance:checkin'
    ) {
      console.info(
        '[Kiosk] Showing welcome screen for:',
        latestEvent.data.studentName
      );
      // Show welcome for check-ins
      setScannedStudent({
        id: latestEvent.data.studentId,
        studentId: latestEvent.data.studentId,
        name: latestEvent.data.studentName,
        gender: latestEvent.data.gender,
        gradeLevel: '',
        section: '',
        barcode: '',
      });
      setView('welcome');
      resetTimer();
    } else if (
      latestEvent.type === 'student_checkout' ||
      latestEvent.type === 'attendance:checkout'
    ) {
      console.info(
        '[Kiosk] Showing thank you screen for:',
        latestEvent.data.studentName
      );
      // Show thank you for check-outs
      setScannedStudent({
        id: latestEvent.data.studentId,
        studentId: latestEvent.data.studentId,
        name: latestEvent.data.studentName,
        gender: latestEvent.data.gender,
        gradeLevel: '',
        section: '',
        barcode: '',
      });
      setView('thankyou');
      resetTimer();
    } else {
      console.info('[Kiosk] Unhandled event type:', latestEvent.type);
    }
  }, [wsEvents]);

  const resetTimer = () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setView('reminder');
      setScannedStudent(null);
    }, 10000); // 10 seconds idle timeout
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950 relative">
      {/* WebSocket connection indicator */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2 text-xs">
        <div
          className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}
        />
        <span className="text-slate-400">
          {wsConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {view === 'reminder' && (
          <motion.div
            key="reminder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <ReminderScreen />
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
            <WelcomeScreen
              studentName={scannedStudent?.name}
              gender={scannedStudent?.gender}
            />
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
            <ThankYouScreen
              studentName={scannedStudent?.name}
              gender={scannedStudent?.gender}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
