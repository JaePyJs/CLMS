import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { kioskApi, type KioskStudent } from '@/services/kioskApi';
import { getErrorMessage } from '@/utils/errorHandling';

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
    const audio = new Audio(
      success ? '/sounds/success.mp3' : '/sounds/error.mp3'
    );
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const handleScan = async (scannedValue: string) => {
    if (!scannedValue.trim()) return;
    setLoading(true);
    setScanData(scannedValue);

    try {
      // Step 1: Tap In
      const response = await kioskApi.tapIn(scannedValue);

      if (response.success && response.canCheckIn && response.student) {
        setStudent(response.student);
        setState('IDENTIFIED');
        playSound(true);
      } else if (
        !response.success &&
        response.message.includes('already checked in')
      ) {
        // Already logged in (within 15 mins)
        setMessage(response.message);
        setState('ALREADY_LOGGED_IN');
        playSound(false);
        setTimeout(() => resetState(), 3000);
      } else if (!response.success && response.message.includes('wait')) {
        // Cooldown
        setMessage(response.message);
        setState('ALREADY_LOGGED_IN'); // Re-use this state for error display
        playSound(false);
        setTimeout(() => resetState(), 3000);
      } else if (!response.success && response.student) {
        if (response.message.includes('Checked out')) {
          setStudent(response.student);
          setMessage(response.message);
          setState('CHECKED_OUT');
          playSound(true);
          setTimeout(() => resetState(), 3000);
        } else {
          setMessage(response.message);
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
    } catch (error: any) {
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

      if (response.success) {
        setState('WELCOME');
        playSound(true);
        setTimeout(() => resetState(), 3000);
      } else {
        setMessage(response.message);
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

  // Render Idle Screen
  if (isIdle) {
    const currentAnnouncement = announcements[currentAnnouncementIndex];
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center p-8 cursor-none">
        <div className="absolute top-8 left-8">
          <h1 className="text-4xl font-bold text-primary">Library Kiosk</h1>
        </div>
        <div className="max-w-4xl text-center space-y-8 animate-in fade-in duration-1000">
          <h2 className="text-6xl font-bold">{currentAnnouncement?.title}</h2>
          <p className="text-3xl text-gray-300">
            {currentAnnouncement?.content}
          </p>
        </div>
        <div className="absolute bottom-8 animate-bounce">
          <p className="text-xl text-gray-400">
            Tap screen or scan ID to start
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-3xl shadow-2xl min-h-[600px] flex flex-col">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-3xl font-bold">
            Library Kiosk System
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
          {state === 'IDLE' && (
            <div className="w-full max-w-md space-y-8 text-center">
              <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Scan className="w-16 h-16 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Tap Your ID</h2>
                <p className="text-muted-foreground">
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
                className="text-center text-2xl py-6"
                placeholder="Scanning..."
                autoFocus
              />
            </div>
          )}

          {state === 'IDENTIFIED' && student && (
            <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-right">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <UserCheck className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold">
                  Hello, {student.firstName}!
                </h2>
                <div className="flex justify-center gap-4">
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {student.gradeLevel}
                  </Badge>
                  <Badge variant="outline" className="text-lg px-4 py-1">
                    {student.section || 'No Section'}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  size="lg"
                  className="text-xl px-12 py-6"
                  onClick={() => setState('PURPOSE')}
                >
                  Proceed <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
              </div>
            </div>
          )}

          {state === 'PURPOSE' && (
            <div className="w-full space-y-6 animate-in fade-in slide-in-from-right">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold">Select Purpose of Visit</h2>
                <p className="text-muted-foreground">
                  You can select multiple activities
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PURPOSES.map((purpose) => {
                  const Icon = purpose.icon;
                  const isSelected = selectedPurposes.includes(purpose.id);
                  return (
                    <div
                      key={purpose.id}
                      onClick={() => handlePurposeSelect(purpose.id)}
                      className={`
                        cursor-pointer p-6 rounded-xl border-2 transition-all duration-200 flex items-center gap-4
                        ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-lg scale-105'
                            : 'border-transparent bg-secondary hover:bg-secondary/80'
                        }
                      `}
                    >
                      <div
                        className={`p-3 rounded-full ${isSelected ? 'bg-primary text-white' : 'bg-background'}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="font-semibold text-lg">
                        {purpose.label}
                      </span>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-primary ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between pt-8">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setState('IDLE')}
                >
                  Cancel
                </Button>
                <Button
                  size="lg"
                  className="text-xl px-12"
                  disabled={selectedPurposes.length === 0}
                  onClick={() => setState('CONFIRM')}
                >
                  Confirm Selection
                </Button>
              </div>
            </div>
          )}

          {state === 'CONFIRM' && (
            <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in">
              <h2 className="text-2xl font-bold">Confirm Your Visit</h2>
              <div className="bg-secondary/50 p-6 rounded-xl space-y-4">
                <p className="text-muted-foreground">Selected Activities:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {selectedPurposes.map((id) => {
                    const p = PURPOSES.find((p) => p.id === id);
                    return (
                      <Badge key={id} className="text-lg px-3 py-1">
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
                  className="w-32"
                  onClick={() => setState('PURPOSE')}
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  className="w-32"
                  onClick={handleConfirmCheckIn}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </Button>
              </div>
            </div>
          )}

          {state === 'WELCOME' && student && (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-20 h-20 text-green-600" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-green-700">
                  Welcome, {student.firstName}!
                </h2>
                <p className="text-xl text-muted-foreground mt-2">
                  You are now logged in.
                </p>
              </div>
              <div className="pt-8">
                <p className="text-sm text-muted-foreground">
                  Returning to home screen...
                </p>
              </div>
            </div>
          )}

          {state === 'CHECKED_OUT' && student && (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <LogOut className="w-20 h-20 text-blue-600" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-blue-700">
                  Goodbye, {student.firstName}!
                </h2>
                <p className="text-xl text-muted-foreground mt-2">
                  You have been checked out.
                </p>
                {message && (
                  <p className="text-md text-blue-600 mt-2">{message}</p>
                )}
              </div>
            </div>
          )}

          {state === 'ALREADY_LOGGED_IN' && (
            <div className="text-center space-y-6 animate-in fade-in zoom-in">
              <div className="w-32 h-32 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-20 h-20 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-yellow-700">Notice</h2>
                <p className="text-xl text-muted-foreground mt-4">{message}</p>
              </div>
              <Button onClick={resetState} variant="outline" className="mt-8">
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
