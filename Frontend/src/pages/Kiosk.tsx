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

  // WebSocket for real-time updates from scan station (kiosk mode for unauthenticated access)
  const { events: wsEvents, isConnected: wsConnected } = useAttendanceWebSocket(
    { kioskMode: true }
  );

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

  // Track last display change time to prevent rapid updates (minimum 3 seconds between displays)
  const lastDisplayChangeRef = useRef<number>(0);
  const MIN_DISPLAY_TIME_MS = 3000; // Minimum 3 seconds before allowing another display change

  // Queue for pending events when display is locked
  const pendingEventRef = useRef<(typeof wsEvents)[0] | null>(null);

  // Timeout ref for resetting to reminder screen
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Note: This display page receives WebSocket events from scan stations (SelfServiceMode, ScanWorkspace)
  // It does NOT have a barcode scanner - scanning happens on a separate PC/terminal

  // Handle WebSocket events from scan station
  useEffect(() => {
    // Debug: Log all received events
    if (wsEvents && wsEvents.length > 0) {
      console.info(
        '[Kiosk] WebSocket events received:',
        wsEvents.length,
        'events'
      );
      const latestEvent = wsEvents[wsEvents.length - 1];
      console.info(
        '[Kiosk] Latest event:',
        JSON.stringify(latestEvent, null, 2)
      );
    }

    if (!wsEvents || wsEvents.length === 0) return;

    const latestEvent = wsEvents[wsEvents.length - 1];
    const eventId = latestEvent?.data?.activityId;

    console.info(
      '[Kiosk] Processing event:',
      latestEvent.type,
      'activityId:',
      eventId,
      'studentName:',
      latestEvent?.data?.studentName
    );

    // Skip if we already processed this event
    if (!eventId || lastProcessedEventRef.current === eventId) {
      console.info('[Kiosk] Skipping - already processed or no eventId');
      return;
    }

    // Check if enough time has passed since last display change (prevents spam)
    const now = Date.now();
    const timeSinceLastChange = now - lastDisplayChangeRef.current;

    if (timeSinceLastChange < MIN_DISPLAY_TIME_MS && view !== 'reminder') {
      console.info('[Kiosk] Display locked - saving pending event');
      pendingEventRef.current = latestEvent;
      return;
    }

    lastProcessedEventRef.current = eventId;
    lastDisplayChangeRef.current = now;

    // Helper function to show event
    const showEvent = (event: typeof latestEvent) => {
      if (
        event.type === 'student_checkin' ||
        event.type === 'attendance:checkin'
      ) {
        console.info(
          '[Kiosk] Showing welcome screen for:',
          event.data.studentName
        );
        setScannedStudent({
          id: event.data.studentId,
          studentId: event.data.studentId,
          name: event.data.studentName,
          gender: event.data.gender,
          gradeLevel: '',
          section: '',
          barcode: '',
        });
        setView('welcome');
        resetTimer();
      } else if (
        event.type === 'student_checkout' ||
        event.type === 'attendance:checkout'
      ) {
        console.info(
          '[Kiosk] Showing thank you screen for:',
          event.data.studentName
        );
        setScannedStudent({
          id: event.data.studentId,
          studentId: event.data.studentId,
          name: event.data.studentName,
          gender: event.data.gender,
          gradeLevel: '',
          section: '',
          barcode: '',
        });
        setView('thankyou');
        resetTimer();
      } else {
        console.info('[Kiosk] Unhandled event type:', event.type);
      }
    };

    showEvent(latestEvent);
  }, [wsEvents, view]);

  const resetTimer = () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      // Check for pending events before resetting to reminder
      if (pendingEventRef.current) {
        const pendingEvent = pendingEventRef.current;
        pendingEventRef.current = null;
        lastDisplayChangeRef.current = Date.now();
        lastProcessedEventRef.current = pendingEvent?.data?.activityId || null;

        // Show the pending event
        if (
          pendingEvent.type === 'student_checkin' ||
          pendingEvent.type === 'attendance:checkin'
        ) {
          setScannedStudent({
            id: pendingEvent.data.studentId,
            studentId: pendingEvent.data.studentId,
            name: pendingEvent.data.studentName,
            gender: pendingEvent.data.gender,
            gradeLevel: '',
            section: '',
            barcode: '',
          });
          setView('welcome');
          resetTimer(); // Reset timer for the new display
          return;
        } else if (
          pendingEvent.type === 'student_checkout' ||
          pendingEvent.type === 'attendance:checkout'
        ) {
          setScannedStudent({
            id: pendingEvent.data.studentId,
            studentId: pendingEvent.data.studentId,
            name: pendingEvent.data.studentName,
            gender: pendingEvent.data.gender,
            gradeLevel: '',
            section: '',
            barcode: '',
          });
          setView('thankyou');
          resetTimer(); // Reset timer for the new display
          return;
        }
      }

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
