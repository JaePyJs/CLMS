import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  Scan,
  CheckCircle,
  AlertCircle,
  LogOut,
  Monitor,
  BookOpen,
  Users,
  Gamepad2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { kioskApi, type KioskStudent } from '@/services/kioskApi';
import { getErrorMessage } from '@/utils/errorHandling';
import {
  KioskCheckeredBackground,
  KioskCharacter,
  KioskSchoolHeader,
} from '@/components/kiosk';

// Idle timeout in milliseconds (15 minutes)
const IDLE_TIMEOUT = 15 * 60 * 1000;

type KioskState =
  | 'IDLE'
  | 'IDENTIFIED'
  | 'PURPOSE'
  | 'CONFIRM'
  | 'WELCOME'
  | 'ALREADY_LOGGED_IN'
  | 'CHECKED_OUT';

const PURPOSES = [
  { id: 'avr', label: 'Use of AVR', icon: Monitor },
  { id: 'computer', label: 'Use of Computer', icon: Monitor },
  { id: 'library', label: 'Use of Library Space', icon: Users },
  { id: 'borrowing', label: 'Borrow Materials', icon: BookOpen },
  { id: 'recreation', label: 'Use of Recreational Materials', icon: Gamepad2 },
];

// Helper to get first name from combined name
const getFirstName = (fullName: string): string => {
  return fullName?.split(' ')[0] || 'Student';
};

export default function SelfServiceMode() {
  const [state, setState] = useState<KioskState>('IDLE');
  const [studentId, setStudentId] = useState('');
  const [scanData, setScanData] = useState('');
  const [student, setStudent] = useState<KioskStudent | null>(null);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Idle Timer State
  const [isIdle, setIsIdle] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset idle timer on interaction
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (isIdle) {
      setIsIdle(false);
      // Reset to IDLE state if we were in idle mode
      setState('IDLE');
      setStudentId('');
      setScanData('');
      setStudent(null);
      setSelectedPurposes([]);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      fetchAnnouncements();
    }, IDLE_TIMEOUT);
  }, [isIdle]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer(); // Start timer

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, resetIdleTimer)
      );
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  // Global barcode scanner listener - works even when input not focused or on different tab
  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Only capture when in IDLE state and not loading
      if (state !== 'IDLE' || loading || isIdle) return;

      // Ignore if user is typing in an input (except our barcode input)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target !== inputRef.current) {
        return;
      }

      // Clear existing timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // If Enter key, process the buffer as a barcode
      if (e.key === 'Enter' && barcodeBufferRef.current.length >= 3) {
        e.preventDefault();
        const barcode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';
        if (barcode) {
          handleScan(barcode);
        }
        return;
      }

      // Add alphanumeric characters to buffer
      if (e.key.length === 1 && /[a-zA-Z0-9\-_]/.test(e.key)) {
        barcodeBufferRef.current += e.key;
      }

      // Auto-clear buffer after 100ms of no input (barcode scanners are fast)
      barcodeTimeoutRef.current = setTimeout(() => {
        // If buffer looks like a barcode (6+ chars), process it
        if (barcodeBufferRef.current.length >= 6) {
          const barcode = barcodeBufferRef.current.trim();
          barcodeBufferRef.current = '';
          if (barcode) {
            handleScan(barcode);
          }
        } else {
          barcodeBufferRef.current = '';
        }
      }, 150);
    };

    // Add listener to window for global capture
    window.addEventListener('keydown', handleGlobalKeyPress);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [state, loading, isIdle]);

  // Auto-focus input
  useEffect(() => {
    if (state === 'IDLE' && !isIdle) {
      inputRef.current?.focus();
    }
  }, [state, isIdle]);

  // Fetch announcements when idle
  const fetchAnnouncements = async () => {
    try {
      const data = await kioskApi.getAnnouncements();
      if (Array.isArray(data) && data.length > 0) {
        setAnnouncements(data);
      } else {
        // Fallback announcements
        setAnnouncements([
          {
            title: 'Welcome to the Library',
            content: 'Please scan your ID to enter.',
          },
          {
            title: 'Quiet Please',
            content: 'Maintain silence inside the library.',
          },
        ]);
      }
    } catch {
      // Silent fail - use fallback announcements
    }
  };

  // Rotate announcements
  useEffect(() => {
    if (!isIdle || announcements.length === 0) return;
    const interval = setInterval(() => {
      setCurrentAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isIdle, announcements]);

  const playSound = (success: boolean) => {
    try {
      const audio = new Audio(
        success ? '/sounds/success.mp3' : '/sounds/error.mp3'
      );
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio not available - silently ignore
    }
  };

  const handleScan = async (scannedValue: string) => {
    if (!scannedValue.trim()) return;
    setLoading(true);
    setScanData(scannedValue);

    try {
      // Step 1: Tap In
      const response = await kioskApi.tapIn(scannedValue);

      // Guard against undefined response
      if (!response) {
        setMessage('No response received');
        setState('ALREADY_LOGGED_IN');
        playSound(false);
        setTimeout(() => resetState(), 3000);
        return;
      }

      if (response.success && response.canCheckIn && response.student) {
        setStudent(response.student);
        setState('IDENTIFIED');
        playSound(true);
      } else if (
        !response.success &&
        response.message?.includes('already checked in')
      ) {
        // Already logged in (within 15 mins)
        setMessage(response.message || 'Already checked in');
        setState('ALREADY_LOGGED_IN');
        playSound(false);
        setTimeout(() => resetState(), 3000);
      } else if (!response.success && response.message?.includes('wait')) {
        // Cooldown
        setMessage(response.message || 'Please wait');
        setState('ALREADY_LOGGED_IN'); // Re-use this state for error display
        playSound(false);
        setTimeout(() => resetState(), 3000);
      } else if (!response.success && response.student) {
        if (response.message?.includes('Checked out')) {
          setStudent(response.student);
          setMessage(response.message || 'Checked out');
          setState('CHECKED_OUT');
          playSound(true);
          setTimeout(() => resetState(), 3000);
        } else {
          setMessage(response.message || 'Error');
          setState('ALREADY_LOGGED_IN');
          playSound(false);
          setTimeout(() => resetState(), 3000);
        }
      } else {
        setMessage(response.message || 'Student not found');
        setState('ALREADY_LOGGED_IN'); // Error state
        playSound(false);
        setTimeout(() => resetState(), 3000);
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Scan failed');
      setMessage(msg);
      setState('ALREADY_LOGGED_IN'); // Error state
      playSound(false);
      setTimeout(() => resetState(), 3000);
    } finally {
      setLoading(false);
      setStudentId('');
    }
  };

  const handlePurposeSelect = (purposeId: string) => {
    setSelectedPurposes((prev) => {
      if (prev.includes(purposeId)) {
        return prev.filter((id) => id !== purposeId);
      } else {
        return [...prev, purposeId];
      }
    });
  };

  const handleConfirmCheckIn = async () => {
    if (!student || selectedPurposes.length === 0) {
      toast.error('Please select at least one purpose');
      return;
    }
    setLoading(true);
    try {
      const response = await kioskApi.confirmCheckIn(
        student.id,
        selectedPurposes, // Pass the array
        scanData
      );

      if (!response) {
        toast.error('No response received');
        return;
      }

      if (response.success) {
        setState('WELCOME');
        playSound(true);
        setTimeout(() => resetState(), 3000);
      } else {
        setMessage(response.message || 'Check-in failed');
        setState('ALREADY_LOGGED_IN');
        playSound(false);
        setTimeout(() => resetState(), 3000);
      }
    } catch {
      toast.error('Failed to confirm check-in');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setState('IDLE');
    setStudent(null);
    setScanData('');
    setSelectedPurposes([]);
    setMessage('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Render Idle Screen with beautiful design
  if (isIdle) {
    const currentAnnouncement = announcements[currentAnnouncementIndex];
    return (
      <div className="fixed inset-0 z-50 overflow-hidden cursor-none">
        <KioskCheckeredBackground />

        {/* Characters */}
        <KioskCharacter
          gender="girl"
          side="left"
          showBooks
          animationType="float"
        />
        <KioskCharacter
          gender="boy"
          side="right"
          showBooks
          animationType="bounce"
        />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8">
          <KioskSchoolHeader
            title="SHJCS Library"
            subtitle="Sacred Heart of Jesus Catholic School"
          />

          <motion.div
            className="mt-12 max-w-4xl text-center space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={currentAnnouncementIndex}
          >
            <h2
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-wide"
              style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.5)' }}
            >
              {currentAnnouncement?.title || 'Welcome'}
            </h2>
            <p
              className="text-2xl sm:text-3xl text-white/90"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.4)' }}
            >
              {currentAnnouncement?.content || 'Please scan your ID to enter'}
            </p>
          </motion.div>

          <motion.div
            className="absolute bottom-12 flex items-center gap-3"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Scan className="w-8 h-8 text-white" />
            <p className="text-xl text-white/80">
              Tap screen or scan ID to start
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <KioskCheckeredBackground />

      {/* Characters on sides */}
      <KioskCharacter
        gender="girl"
        side="left"
        showBooks={
          state === 'IDLE' || state === 'WELCOME' || state === 'CHECKED_OUT'
        }
      />
      <KioskCharacter
        gender="boy"
        side="right"
        showBooks={
          state === 'IDLE' || state === 'WELCOME' || state === 'CHECKED_OUT'
        }
      />

      {/* Main Content Area */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Header */}
        <div className="absolute top-4 sm:top-8">
          <KioskSchoolHeader title="SHJCS Library" showLogo />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {state === 'IDLE' && (
            <motion.div
              key="idle"
              className="w-full max-w-lg space-y-8 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {/* Scan Icon */}
              <motion.div
                className="w-32 h-32 sm:w-40 sm:h-40 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto border-4 border-white/30"
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    '0 0 30px rgba(255,255,255,0.3)',
                    '0 0 60px rgba(255,255,255,0.5)',
                    '0 0 30px rgba(255,255,255,0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Scan className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
              </motion.div>

              <div>
                <h2
                  className="text-3xl sm:text-4xl font-bold text-white mb-3"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
                >
                  TAP YOUR ID
                </h2>
                <p className="text-lg sm:text-xl text-white/80">
                  Please scan your student ID to proceed
                </p>
              </div>

              <Input
                ref={inputRef}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScan(studentId);
                  }
                }}
                className="text-center text-2xl py-6 bg-white/90 backdrop-blur-sm border-0 shadow-2xl max-w-md mx-auto"
                placeholder="Scanning..."
                autoFocus
              />
            </motion.div>
          )}

          {state === 'IDENTIFIED' && student && (
            <motion.div
              key="identified"
              className="w-full max-w-2xl space-y-8 text-center"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
            >
              <motion.div
                className="w-28 h-28 sm:w-32 sm:h-32 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
              >
                <UserCheck className="w-14 h-14 sm:w-16 sm:h-16 text-white" />
              </motion.div>

              <div>
                <h2
                  className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-wider"
                  style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.5)' }}
                >
                  HELLO, {getFirstName(student.name).toUpperCase()}!
                </h2>
                <div className="flex justify-center gap-4 mt-4">
                  <Badge className="text-lg px-6 py-2 bg-white/20 text-white border-white/30">
                    {student.gradeLevel}
                  </Badge>
                  <Badge className="text-lg px-6 py-2 bg-white/20 text-white border-white/30">
                    {student.section || 'No Section'}
                  </Badge>
                </div>
              </div>

              <Button
                size="lg"
                className="text-xl px-12 py-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl"
                onClick={() => setState('PURPOSE')}
              >
                Proceed <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
            </motion.div>
          )}

          {state === 'PURPOSE' && (
            <motion.div
              key="purpose"
              className="w-full max-w-4xl space-y-6"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
            >
              <div className="text-center mb-8">
                <h2
                  className="text-3xl sm:text-4xl font-bold text-white"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
                >
                  SELECT PURPOSE OF VISIT
                </h2>
                <p className="text-lg text-white/80 mt-2">
                  You can select multiple activities
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PURPOSES.map((purpose, index) => {
                  const Icon = purpose.icon;
                  const isSelected = selectedPurposes.includes(purpose.id);
                  return (
                    <motion.div
                      key={purpose.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handlePurposeSelect(purpose.id)}
                      className={`
                        cursor-pointer p-6 rounded-2xl border-4 transition-all duration-300 flex items-center gap-4
                        backdrop-blur-sm shadow-xl
                        ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500/30 scale-105'
                            : 'border-white/30 bg-white/10 hover:bg-white/20'
                        }
                      `}
                    >
                      <div
                        className={`p-3 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-white/20'}`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="font-semibold text-lg text-white">
                        {purpose.label}
                      </span>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-emerald-400 ml-auto" />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-6">
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-white hover:bg-white/10"
                  onClick={() => setState('IDLE')}
                >
                  Cancel
                </Button>
                <Button
                  size="lg"
                  className="text-xl px-12 bg-emerald-600 hover:bg-emerald-700"
                  disabled={selectedPurposes.length === 0}
                  onClick={() => setState('CONFIRM')}
                >
                  Confirm Selection
                </Button>
              </div>
            </motion.div>
          )}

          {state === 'CONFIRM' && (
            <motion.div
              key="confirm"
              className="w-full max-w-md space-y-8 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <h2
                className="text-3xl sm:text-4xl font-bold text-white"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
              >
                CONFIRM YOUR VISIT
              </h2>

              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl space-y-4 border border-white/20">
                <p className="text-white/70">Selected Activities:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {selectedPurposes.map((id) => {
                    const p = PURPOSES.find((p) => p.id === id);
                    return (
                      <Badge
                        key={id}
                        className="text-lg px-4 py-2 bg-emerald-500/50 text-white"
                      >
                        {p?.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-32 bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => setState('PURPOSE')}
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  className="w-32 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleConfirmCheckIn}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </Button>
              </div>
            </motion.div>
          )}

          {state === 'WELCOME' && student && (
            <motion.div
              key="welcome"
              className="text-center space-y-6"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              {/* Success icon with glow */}
              <motion.div
                className="w-36 h-36 sm:w-44 sm:h-44 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-2xl"
                animate={{
                  boxShadow: [
                    '0 0 40px rgba(16, 185, 129, 0.5)',
                    '0 0 80px rgba(16, 185, 129, 0.8)',
                    '0 0 40px rgba(16, 185, 129, 0.5)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <CheckCircle className="w-20 h-20 sm:w-24 sm:h-24 text-white" />
              </motion.div>

              <div>
                <motion.h2
                  className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-wider"
                  style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.5)' }}
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                >
                  WELCOME, {getFirstName(student.name).toUpperCase()}!
                </motion.h2>
                <motion.p
                  className="text-2xl sm:text-3xl text-white/90 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  Happy Reading! 📚
                </motion.p>
              </div>

              {/* Sparkles animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${15 + Math.random() * 70}%`,
                      top: `${20 + Math.random() * 60}%`,
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                      y: [0, -40],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  >
                    <Sparkles className="w-6 h-6 text-yellow-300" />
                  </motion.div>
                ))}
              </div>

              <p className="text-white/60 mt-8">Returning to home screen...</p>
            </motion.div>
          )}

          {state === 'CHECKED_OUT' && student && (
            <motion.div
              key="checkout"
              className="text-center space-y-6"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              <motion.div
                className="w-36 h-36 sm:w-44 sm:h-44 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto shadow-2xl"
                animate={{
                  boxShadow: [
                    '0 0 40px rgba(59, 130, 246, 0.5)',
                    '0 0 80px rgba(59, 130, 246, 0.8)',
                    '0 0 40px rgba(59, 130, 246, 0.5)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <LogOut className="w-20 h-20 sm:w-24 sm:h-24 text-white" />
              </motion.div>

              <div>
                <h2
                  className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-wider"
                  style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.5)' }}
                >
                  GOODBYE, {getFirstName(student.name).toUpperCase()}!
                </h2>
                <p
                  className="text-2xl sm:text-3xl text-white/90 mt-4"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.4)' }}
                >
                  See you again soon! 👋
                </p>
                {message && (
                  <p className="text-lg text-blue-300 mt-3">{message}</p>
                )}
              </div>
            </motion.div>
          )}

          {state === 'ALREADY_LOGGED_IN' && (
            <motion.div
              key="error"
              className="text-center space-y-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <motion.div
                className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto shadow-2xl"
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 0.5 }}
              >
                <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
              </motion.div>

              <div>
                <h2
                  className="text-4xl sm:text-5xl font-bold text-white"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
                >
                  NOTICE
                </h2>
                <p
                  className="text-xl sm:text-2xl text-white/90 mt-4 max-w-md mx-auto"
                  style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {message}
                </p>
              </div>

              <Button
                onClick={resetState}
                variant="outline"
                size="lg"
                className="mt-8 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                Close
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
