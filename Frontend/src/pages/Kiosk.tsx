/* cspell:ignore Filipiniana */
import { useEffect, useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';
import {
  Clock,
  Users,
  BookOpen,
  Monitor,
  Gamepad2,
  CheckCircle,
  User,
  QrCode,
  Scan,
} from 'lucide-react';
import QRScannerComponent from '@/components/dashboard/QRScannerComponent';

interface PurposeOption {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

interface StudentInfo {
  id: string;
  studentId: string;
  name: string;
  gradeLevel: string;
  section: string;
  barcode: string;
}

interface TapInResponse {
  success: boolean;
  message: string;
  student?: StudentInfo;
  cooldownRemaining?: number;
  canCheckIn: boolean;
}

const PURPOSES: PurposeOption[] = [
  {
    id: 'avr',
    name: 'AVR',
    icon: Monitor,
    description: 'Audio Visual Room',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    id: 'computer',
    name: 'Computer',
    icon: Monitor,
    description: 'Computer Laboratory',
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    id: 'library',
    name: 'Library Space',
    icon: BookOpen,
    description: 'Reading and Study Area',
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    id: 'borrowing',
    name: 'Borrowing',
    icon: BookOpen,
    description: 'Borrow Books',
    color: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    id: 'recreation',
    name: 'Recreation',
    icon: Gamepad2,
    description: 'Games and Activities',
    color: 'bg-pink-500 hover:bg-pink-600',
  },
];

export default function Kiosk() {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme('dark');
  }, []);
  const { events } = useAttendanceWebSocket();
  const [currentStep, setCurrentStep] = useState<
    'idle' | 'scan' | 'purpose' | 'confirm' | 'welcome' | 'cooldown'
  >('scan');
  const [scanData, setScanData] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [simulateMode, setSimulateMode] = useState<string | null>(null);
  const [simulateCooldown, setSimulateCooldown] = useState<number>(0);
  const [lastTapIn, setLastTapIn] = useState<Date | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [usbBuffer, setUsbBuffer] = useState<string>('');
  const [borrowedDue, setBorrowedDue] = useState<Array<{ title: string; category: string; dueDate: string; daysOverdue?: number }>>([]);
  const [occupancy, setOccupancy] = useState<{ AVR: number; COMPUTER: number; LIBRARY_SPACE: number; BORROWING: number; RECREATION: number }>({ AVR: 0, COMPUTER: 0, LIBRARY_SPACE: 0, BORROWING: 0, RECREATION: 0 });
  const funQuotes = [
    'Reading is dreaming with open eyes.',
    'A book a day keeps boredom away.',
    'Today a reader, tomorrow a leader.',
    'Dive into a good book!',
  ];
  const [selectedQuote, setSelectedQuote] = useState<string>(funQuotes[0]);
  const [timeInState, setTimeInState] = useState<string>('');
  const [expectedOutState, setExpectedOutState] = useState<string>('');
  
  const [quietMode, setQuietMode] = useState<boolean>(false);
  const [announcementMessages, setAnnouncementMessages] = useState<string[]>(funQuotes);
  const [announcementInterval, setAnnouncementInterval] = useState<number>(60);

  // Check for 15-minute idle timeout
  useEffect(() => {
    const checkIdleTime = () => {
      if (lastTapIn) {
        const now = new Date();
        const minutesSinceLastTap = Math.floor(
          (now.getTime() - lastTapIn.getTime()) / (1000 * 60)
        );
        if (minutesSinceLastTap >= 15 && currentStep !== 'idle') {
          setCurrentStep('idle');
          resetForm();
        }
      }
    };

    const interval = setInterval(checkIdleTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastTapIn, currentStep]);

  // Auto-focus input when in scan mode
  useEffect(() => {
    if (currentStep === 'scan') {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [currentStep]);

  // USB scanner input capture: scanners type fast and end with Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentStep !== 'scan') return;
      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Enter') {
        if (usbBuffer.length > 0) {
          setScanData(usbBuffer);
          setUsbBuffer('');
          setTimeout(() => handleScanSubmit(), 0);
        } else {
          handleScanSubmit();
        }
      } else if (e.key.length === 1) {
        setUsbBuffer((prev) => (prev + e.key).slice(0, 256));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep]);

  // Rotate quotes slowly
  useEffect(() => {
    const interval = setInterval(() => {
      setSelectedQuote((prev) => {
        const list = announcementMessages.length > 0 ? announcementMessages : funQuotes;
        const idx = list.indexOf(prev);
        const next = list[(idx + 1) % list.length];
        return next || list[0];
      });
    }, Math.max(10, announcementInterval) * 1000);
    return () => clearInterval(interval);
  }, [announcementMessages, announcementInterval]);

  // Process attendance WebSocket events for occupancy and announcement config
  useEffect(() => {
    if (!events || events.length === 0) return;
    const latest = events[events.length - 1] as any;
    if (latest?.type === 'attendance_occupancy' && (latest?.data?.counts || latest?.data?.sections)) {
      const src = latest.data.counts || latest.data.sections;
      const counts = src as { AVR?: number; COMPUTER?: number; LIBRARY_SPACE?: number; BORROWING?: number; RECREATION?: number };
      setOccupancy({
        AVR: Number(counts.AVR || 0),
        COMPUTER: Number(counts.COMPUTER || 0),
        LIBRARY_SPACE: Number(counts.LIBRARY_SPACE || 0),
        BORROWING: Number(counts.BORROWING || 0),
        RECREATION: Number(counts.RECREATION || 0),
      });
    } else if (latest?.type === 'announcement_config' && latest?.data) {
      const d = latest.data as { quietMode: boolean; intervalSeconds: number; messages: string[] };
      if (typeof d.quietMode === 'boolean') setQuietMode(d.quietMode);
      if (typeof d.intervalSeconds === 'number') setAnnouncementInterval(d.intervalSeconds);
      if (Array.isArray(d.messages)) setAnnouncementMessages(d.messages);
    }
  }, [events]);

  // Seed announcements config from backend on load
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiClient.get('/api/kiosk/announcements/config');
        const data = (resp?.data ?? {}) as { quietMode?: boolean; intervalSeconds?: number; messages?: string[] };
        if (typeof data.quietMode === 'boolean') setQuietMode(data.quietMode);
        if (typeof data.intervalSeconds === 'number') setAnnouncementInterval(data.intervalSeconds);
        if (Array.isArray(data.messages)) setAnnouncementMessages(data.messages);
      } catch (_e) { void 0; }
    })();
  }, []);

  // Subscribe to attendance occupancy updates via WebSocket
  useEffect(() => {
    try {
      const ws = (window as any).__attendanceSocket as any;
      if (ws && ws.on) {
        ws.on('message', (message: any) => {
          if (message?.type === 'attendance_occupancy') {
            const counts = message?.data?.counts || message?.data?.sections;
            if (counts && typeof counts === 'object') {
              setOccupancy({
                AVR: Number(counts.AVR || 0),
                COMPUTER: Number(counts.COMPUTER || 0),
                LIBRARY_SPACE: Number(counts.LIBRARY_SPACE || 0),
                BORROWING: Number(counts.BORROWING || 0),
                RECREATION: Number(counts.RECREATION || 0),
              });
            }
          }
        });
      }
    } catch (_e) { void 0; }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const resp = await apiClient.get('/api/kiosk/occupancy');
        const data = (resp?.data ?? {}) as { counts?: { AVR?: number; COMPUTER?: number; LIBRARY_SPACE?: number; BORROWING?: number; RECREATION?: number } };
        if (data.counts) {
          setOccupancy({
            AVR: Number(data.counts.AVR || 0),
            COMPUTER: Number(data.counts.COMPUTER || 0),
            LIBRARY_SPACE: Number(data.counts.LIBRARY_SPACE || 0),
            BORROWING: Number(data.counts.BORROWING || 0),
            RECREATION: Number(data.counts.RECREATION || 0),
          });
        }
      } catch (_e) { void 0; }
    })();
  }, []);

  const resetForm = () => {
    setScanData('');
    setSelectedPurposes([]);
    setStudentInfo(null);
    setCooldownTime(0);
    setLoading(false);
  };

  // Removed unused handlers

  const handleScanSubmit = async () => {
    if (!scanData.trim()) {
      return;
    }

    setLoading(true);
    try {
      // Dev-only simulation overrides
      const params = new URLSearchParams(window.location.search);
      const sim = params.get('simulate') || simulateMode;
      const simPurpose = params.get('purpose') || 'library';
      const simCooldown = Number(params.get('cooldown') || simulateCooldown || 0);
      if (import.meta.env.DEV && sim) {
        if (sim === 'welcome') {
          setStudentInfo({
            id: 'demo-student',
            studentId: scanData.trim(),
            name: 'Demo Student',
            gradeLevel: '10',
            section: 'A',
            barcode: scanData.trim(),
          });
          setSelectedPurposes([simPurpose]);
          setCurrentStep('purpose');
        } else if (sim === 'cooldown') {
          setCooldownTime(simCooldown > 0 ? simCooldown : 180);
          setCurrentStep('cooldown');
        } else if (sim === 'notfound') {
          setCurrentStep('scan');
        } else if (sim === 'error') {
          setCurrentStep('scan');
        }
        return;
      }

      // Development fallback: simulate a successful welcome when backend is unavailable
      if (import.meta.env.DEV && !sim) {
        setStudentInfo({
          id: 'demo-student',
          studentId: scanData.trim(),
          name: 'Demo Student',
          gradeLevel: '10',
          section: 'A',
          barcode: scanData.trim(),
        });
        setSelectedPurposes([simPurpose]);
        const now = new Date();
        setTimeInState(now.toLocaleTimeString());
        const expected = new Date(now.getTime() + 15 * 60000);
        setExpectedOutState(expected.toLocaleTimeString());
        setBorrowedDue([
          { title: 'Sample Book', category: 'Fiction', dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] },
          { title: 'Heritage', category: 'Filipiniana', dueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], daysOverdue: 2 },
        ]);
        setCurrentStep('purpose');
        setLoading(false);
        return;
      }

      const response = await apiClient.post<TapInResponse>(
        '/api/kiosk/tap-in',
        {
          scanData: scanData.trim(),
        }
      );

      if (response.success && response.data) {
        const result = response.data;

        if (result.cooldownRemaining && result.cooldownRemaining > 0) {
          setCooldownTime(result.cooldownRemaining);
          setCurrentStep('cooldown');
          toast.info(
            `Please wait ${Math.ceil(result.cooldownRemaining / 60)} minutes before checking in again`
          );
        } else if (result.student) {
          setStudentInfo(result.student);
          setSelectedPurposes(['library']);
          try {
            const due = await apiClient.get('/api/students/borrowed-due', { params: { studentId: result.student.id } });
            const dueData = (due?.data ?? {}) as { items?: Array<{ title: string; category: string; dueDate: string; daysOverdue?: number }> };
            setBorrowedDue(Array.isArray(dueData.items) ? dueData.items! : []);
          } catch (_e) { void 0 }
          const now = new Date();
          setTimeInState(now.toLocaleTimeString());
          const expected = new Date(now.getTime() + 15 * 60000);
          setExpectedOutState(expected.toLocaleTimeString());
          setCurrentStep('purpose');
        } else {
          toast.error(result.message || 'Student not found');
        }
      }
    } catch (error) {
      // Suppress kiosk notifications
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const testScan = params.get('testScan');
      const sim = params.get('simulate');
      const simCd = Number(params.get('cooldown') || 0);
      if (sim) {
        setSimulateMode(sim);
      }
      if (simCd > 0) {
        setSimulateCooldown(simCd);
      }
      if (testScan) {
        setScanData(testScan);
        setTimeout(() => {
          handleScanSubmit();
        }, 0);
      }
    } catch (_e) { void 0 }
  }, []);

  const handlePurposeSelect = (purposeId: string) => {
    setSelectedPurposes((prev) => {
      const exists = prev.includes(purposeId);
      if (exists) return prev.filter((p) => p !== purposeId);
      return [...prev, purposeId];
    });
  };

  const handlePurposeContinue = () => {
    if (selectedPurposes.length === 0) {
      toast.warning('Please select your purpose of visit');
      return;
    }
    setCurrentStep('confirm');
  };

  const handleConfirmCheckIn = async () => {
    if (!studentInfo || selectedPurposes.length === 0) return;

    setLoading(true);
    try {
      const sectionMap: Record<string, string> = {
        library: 'LIBRARY_SPACE',
        computer: 'COMPUTER',
        avr: 'AVR',
        recreation: 'RECREATION',
        borrowing: 'BORROWING',
      };
      const sectionCodes = selectedPurposes.map((p) => sectionMap[p]).filter(Boolean);
      const response = await apiClient.post('/api/self-service/check-in-with-sections', {
        scanData: scanData,
        sectionCodes,
      });

      if (response.success) {
        setCurrentStep('welcome');
        setLastTapIn(new Date());

        setTimeout(() => {
          setCurrentStep('idle');
          resetForm();
        }, 5000);
      } else {
        toast.error('Failed to confirm check-in');
      }
    } catch (error) {
      toast.error('Failed to confirm check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (currentStep === 'scan') {
        handleScanSubmit();
      }
    }
  };

  // Idle Screen with Announcements
  if (currentStep === 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl bg-slate-900">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold text-white mb-2">
              Welcome to the Library
            </CardTitle>
            <p className="text-lg text-muted-foreground">Ready to scan your ID</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center justify-between bg-slate-800 rounded p-3">
                <span className="text-slate-200">Library Space</span>
                <span className="text-white font-mono">{occupancy.LIBRARY_SPACE}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-3">
                <span className="text-slate-200">Computer</span>
                <span className="text-white font-mono">{occupancy.COMPUTER}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-3">
                <span className="text-slate-200">AVR</span>
                <span className="text-white font-mono">{occupancy.AVR}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-3">
                <span className="text-slate-200">Recreation</span>
                <span className="text-white font-mono">{occupancy.RECREATION}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-3">
                <span className="text-slate-200">Borrowing</span>
                <span className="text-white font-mono">{occupancy.BORROWING}</span>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 px-6 py-3 rounded-full">
                <QrCode className="h-6 w-6" />
                Waiting for scan...
              </div>
            </div>

            <div className="bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-amber-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-100">
                    {selectedQuote}
                  </p>
                  {quietMode && (
                    <p className="text-xs text-amber-200 mt-1">Quiet Area — please keep voices down</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Scan Screen
  if (currentStep === 'scan') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Scan Your ID
            </CardTitle>
            <p className="text-slate-300">
              Please scan your student ID barcode or QR code
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="flex items-center justify-between bg-slate-800 rounded p-2 text-xs">
                <span className="text-slate-200">Library</span>
                <span className="text-white font-mono">{occupancy.LIBRARY_SPACE}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-2 text-xs">
                <span className="text-slate-200">Computer</span>
                <span className="text-white font-mono">{occupancy.COMPUTER}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-2 text-xs">
                <span className="text-slate-200">AVR</span>
                <span className="text-white font-mono">{occupancy.AVR}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800 rounded p-2 text-xs">
                <span className="text-slate-200">Recreation</span>
                <span className="text-white font-mono">{occupancy.RECREATION}</span>
              </div>
            </div>
            <div className="relative">
              <Input
                ref={scanInputRef}
                placeholder="Scan barcode or QR code..."
                value={scanData}
                onChange={(e) => setScanData(e.target.value)}
                onKeyDown={handleKeyPress}
                className="text-lg py-6 bg-slate-800 text-slate-100 placeholder:text-slate-400"
                autoFocus
                aria-label="kiosk-scan-input"
                data-testid="kiosk-scan-input"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Scan className="h-6 w-6 text-slate-400" />
              </div>
            </div>

            <Button
              onClick={handleScanSubmit}
              disabled={loading || !scanData.trim()}
              className="w-full py-6 text-lg"
              aria-label="kiosk-continue"
              data-testid="kiosk-continue"
            >
              {loading ? 'Processing...' : 'Continue'}
            </Button>

            <div className="mt-4">
              <div className="text-center text-muted-foreground mb-2">Or use camera to scan QR/barcode</div>
              <QRScannerComponent
                enabled={true}
                showSettings={false}
                onScanSuccess={(res) => {
                  setScanData(res.text);
                  setTimeout(() => handleScanSubmit(), 0);
                }}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentStep('idle')}
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Purpose Selection Screen
  if (currentStep === 'purpose' && studentInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl bg-slate-900">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Welcome, {studentInfo.name}!
            </CardTitle>
            <p className="text-muted-foreground">
              Grade {studentInfo.gradeLevel} - {studentInfo.section}
            </p>
            <p className="text-lg text-muted-foreground mt-4">
              What is your purpose of visit today?
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {PURPOSES.map((purpose) => {
                const Icon = purpose.icon;
                return (
                  <Button
                    key={purpose.id}
                    variant={selectedPurposes.includes(purpose.id) ? 'default' : 'outline'}
                    className={`h-32 flex flex-col items-center justify-center space-y-2 p-4 ${
                      selectedPurposes.includes(purpose.id)
                        ? purpose.color
                        : 'hover:bg-slate-800'
                    }`}
                    onClick={() => handlePurposeSelect(purpose.id)}
                  >
                    <Icon className="h-8 w-8" />
                    <span className="font-semibold">{purpose.name}</span>
                    <span className="text-xs opacity-75">
                      {purpose.description}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handlePurposeContinue}
                disabled={selectedPurposes.length === 0}
                className="flex-1 py-6 text-lg"
              >
                Continue
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentStep('scan')}
                className="px-8"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation Screen
  if (currentStep === 'confirm' && studentInfo && selectedPurposes.length > 0) {
    const selectedPurposeData = PURPOSES.find((p) => p.id === selectedPurposes[0]);
    const Icon = selectedPurposeData?.icon || Users;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Confirm Your Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <User className="h-6 w-6 text-blue-400" />
                <div>
                  <p className="font-semibold text-slate-100">{studentInfo.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Grade {studentInfo.gradeLevel} - {studentInfo.section}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon className="h-6 w-6 text-green-400" />
                <div>
                  <p className="font-semibold text-slate-100">Purpose</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPurposes.map((pid) => PURPOSES.find((p) => p.id === pid)?.name).filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleConfirmCheckIn}
                disabled={loading}
                className="flex-1 py-6 text-lg"
              >
                {loading ? 'Processing...' : 'Confirm Check-in'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentStep('purpose')}
                className="px-8"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Welcome Screen
  if (currentStep === 'welcome' && studentInfo) {

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-slate-900">
          <CardContent className="space-y-6 py-8">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">{studentInfo.name}</h2>
                <p className="text-muted-foreground">ID: {studentInfo.studentId}</p>
                <p className="text-muted-foreground">Grade {studentInfo.gradeLevel} • {studentInfo.section}</p>
                <p className="text-muted-foreground">Status: Checked-in for {(selectedPurposes.map((pid) => PURPOSES.find((p) => p.id === pid)?.name).filter(Boolean).join(', ')) || 'Visit'}</p>
                <div className="mt-4 p-3 bg-slate-800 rounded">
                  <p className="text-sm text-slate-200"><strong>Time In:</strong> {timeInState}</p>
                  <p className="text-sm text-slate-200"><strong>Expected Out:</strong> {expectedOutState}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Borrowed Items</h3>
                {borrowedDue.length === 0 ? (
                  <p className="text-muted-foreground">No borrowed items due.</p>
                ) : (
                  borrowedDue.map((b, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-800 rounded">
                      <div>
                        <p className="text-slate-200 font-medium">{b.title}</p>
                        <p className="text-xs text-slate-400">{b.category}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm ${b.daysOverdue ? 'text-red-400' : 'text-slate-200'}`}>{b.daysOverdue ? `${b.daysOverdue} days overdue` : `Due: ${b.dueDate}`}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-2">Current Section Occupancy</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'AVR', key: 'AVR' },
                  { label: 'Computer', key: 'COMPUTER' },
                  { label: 'Library Space', key: 'LIBRARY_SPACE' },
                  { label: 'Borrowing', key: 'BORROWING' },
                  { label: 'Recreation', key: 'RECREATION' },
                ].map((item) => (
                  <div key={item.key} className="p-3 bg-slate-800 rounded flex items-center justify-between">
                    <span className="text-slate-200 text-sm">{item.label}</span>
                    <span className="text-white font-semibold">{(occupancy as any)[item.key]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-200 italic">{selectedQuote}</p>
            </div>

            <p className="text-sm text-slate-400 text-center">Please proceed. Thank you for visiting!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cooldown Screen
  if (currentStep === 'cooldown') {
    const minutesRemaining = Math.ceil(cooldownTime / 60);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-red-500">
              Please Wait
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-white" />
            </div>

            <div>
              <p className="text-lg text-muted-foreground mb-2">
                You have recently checked out
              </p>
              <p className="text-3xl font-bold text-red-500">
                {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''}
              </p>
              <p className="text-muted-foreground">
                remaining before you can check in again
              </p>
            </div>

            <Alert>
              <AlertDescription>
                This cooldown period helps ensure fair library usage for all
                students.
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              onClick={() => setCurrentStep('idle')}
              className="w-full"
            >
              Return to Welcome Screen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}