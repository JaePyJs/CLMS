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
    icon: BookOpen,
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
  const [lastTapIn, setLastTapIn] = useState<Date | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [usbBuffer, setUsbBuffer] = useState<string>('');
  const [borrowedDue, setBorrowedDue] = useState<
    Array<{
      title: string;
      category: string;
      dueDate: string;
      daysOverdue?: number;
    }>
  >([]);
  const [occupancy, setOccupancy] = useState<{
    AVR: number;
    COMPUTER: number;
    LIBRARY_SPACE: number;
    BORROWING: number;
    RECREATION: number;
  }>({ AVR: 0, COMPUTER: 0, LIBRARY_SPACE: 0, BORROWING: 0, RECREATION: 0 });
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
  const [announcementMessages, setAnnouncementMessages] =
    useState<string[]>(funQuotes);
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
    const interval = setInterval(
      () => {
        setSelectedQuote((prev) => {
          const list =
            announcementMessages.length > 0 ? announcementMessages : funQuotes;
          const idx = list.indexOf(prev);
          const next = list[(idx + 1) % list.length];
          return next || list[0];
        });
      },
      Math.max(10, announcementInterval) * 1000
    );
    return () => clearInterval(interval);
  }, [announcementMessages, announcementInterval]);

  // Process attendance WebSocket events for occupancy and announcement config
  useEffect(() => {
    if (!events || events.length === 0) return;
    const latest = events[events.length - 1] as any;
    if (
      latest?.type === 'attendance_occupancy' &&
      (latest?.data?.counts || latest?.data?.sections)
    ) {
      const src = latest.data.counts || latest.data.sections;
      const counts = src as {
        AVR?: number;
        COMPUTER?: number;
        LIBRARY_SPACE?: number;
        BORROWING?: number;
        RECREATION?: number;
      };
      setOccupancy({
        AVR: Number(counts.AVR || 0),
        COMPUTER: Number(counts.COMPUTER || 0),
        LIBRARY_SPACE: Number(counts.LIBRARY_SPACE || 0),
        BORROWING: Number(counts.BORROWING || 0),
        RECREATION: Number(counts.RECREATION || 0),
      });
    } else if (latest?.type === 'announcement_config' && latest?.data) {
      const d = latest.data as {
        quietMode: boolean;
        intervalSeconds: number;
        messages: string[];
      };
      if (typeof d.quietMode === 'boolean') setQuietMode(d.quietMode);
      if (typeof d.intervalSeconds === 'number')
        setAnnouncementInterval(d.intervalSeconds);
      if (Array.isArray(d.messages)) setAnnouncementMessages(d.messages);
    }
  }, [events]);

  // Seed announcements config from backend on load
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiClient.get('/api/kiosk/announcements/config');
        const data = (resp?.data ?? {}) as {
          quietMode?: boolean;
          intervalSeconds?: number;
          messages?: string[];
        };
        if (typeof data.quietMode === 'boolean') setQuietMode(data.quietMode);
        if (typeof data.intervalSeconds === 'number')
          setAnnouncementInterval(data.intervalSeconds);
        if (Array.isArray(data.messages))
          setAnnouncementMessages(data.messages);
      } catch (_e) {
        void 0;
      }
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
    } catch (_e) {
      void 0;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const resp = await apiClient.get('/api/kiosk/occupancy');
        const data = (resp?.data ?? {}) as {
          counts?: {
            AVR?: number;
            COMPUTER?: number;
            LIBRARY_SPACE?: number;
            BORROWING?: number;
            RECREATION?: number;
          };
        };
        if (data.counts) {
          setOccupancy({
            AVR: Number(data.counts.AVR || 0),
            COMPUTER: Number(data.counts.COMPUTER || 0),
            LIBRARY_SPACE: Number(data.counts.LIBRARY_SPACE || 0),
            BORROWING: Number(data.counts.BORROWING || 0),
            RECREATION: Number(data.counts.RECREATION || 0),
          });
        }
      } catch (_e) {
        void 0;
      }
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

    console.log('handleScanSubmit called with:', scanData);
    setLoading(true);
    try {
      console.log('Calling /api/kiosk/tap-in...');
      const response = await apiClient.post<TapInResponse>(
        '/api/kiosk/tap-in',
        {
          scanData: scanData.trim(),
        }
      );
      console.log('Tap-in response:', response);

      // Fix: The response from apiClient.post IS the data (unwrapped)
      if (response.success) {
        const result = response as any;

        if (result.cooldownRemaining && result.cooldownRemaining > 0) {
          console.log('Cooldown active');
          setCooldownTime(result.cooldownRemaining);
          setCurrentStep('cooldown');
          toast.info(
            `Please wait ${Math.ceil(result.cooldownRemaining / 60)} minutes before checking in again`
          );
        } else if (result.student) {
          console.log('Student found:', result.student);
          setStudentInfo(result.student);
          // Automatically select 'library' and proceed to check-in
          const defaultPurpose = 'library';
          setSelectedPurposes([defaultPurpose]);

          // Auto-confirm check-in
          try {
            console.log('Auto-confirming check-in...');
            const confirmResponse = await apiClient.post(
              '/api/kiosk/confirm-check-in',
              {
                studentId: result.student.id,
                purposes: [defaultPurpose],
                scanData: scanData.trim(),
              }
            );
            console.log('Confirm response:', confirmResponse);

            if (confirmResponse.success) {
              setCurrentStep('welcome');
              setLastTapIn(new Date());

              // Fetch borrowed items for display in welcome screen
              try {
                const due = await apiClient.get('/api/students/borrowed-due', {
                  params: { studentId: result.student.id },
                });
                const dueData = (due?.data ?? {}) as {
                  items?: Array<{
                    title: string;
                    category: string;
                    dueDate: string;
                    daysOverdue?: number;
                  }>;
                };
                setBorrowedDue(
                  Array.isArray(dueData.items) ? dueData.items! : []
                );
              } catch (_e) {
                void 0;
              }

              setTimeout(() => {
                setCurrentStep('idle');
                resetForm();
              }, 3000); // Reduced to 3 seconds for faster flow
            } else {
              console.error('Confirm check-in failed');
              toast.error('Failed to confirm check-in');
            }
          } catch (error) {
            console.error('Confirm check-in error:', error);
            toast.error('Failed to confirm check-in');
          }
        } else {
          console.warn('Student not found or other error:', result);
          toast.error(result.message || 'Student not found');
        }
      } else {
        console.error('Tap-in response success=false:', response);
      }
    } catch (error) {
      console.error('handleScanSubmit error:', error);
      // Suppress kiosk notifications
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const testScan = params.get('testScan');
      if (testScan) {
        setScanData(testScan);
        setTimeout(() => {
          handleScanSubmit();
        }, 0);
      }
    } catch (_e) {
      void 0;
    }
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
      const response = await apiClient.post('/api/kiosk/confirm-check-in', {
        studentId: studentInfo.id,
        purposes: selectedPurposes,
        scanData: scanData,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 animate-in fade-in duration-700">
        <Card className="w-full max-w-4xl bg-slate-900 border-slate-800 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 animate-pulse-soft">
              <BookOpen className="h-12 w-12 text-blue-400" />
            </div>
            <CardTitle className="text-5xl font-bold text-white mb-2 tracking-tight">
              Welcome to the Library
            </CardTitle>
            <p className="text-xl text-slate-400">Ready to scan your ID</p>
          </CardHeader>
          <CardContent className="space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  label: 'Library Space',
                  value: occupancy.LIBRARY_SPACE,
                  color:
                    'bg-purple-500/10 text-purple-400 border-purple-500/20',
                },
                {
                  label: 'Computer',
                  value: occupancy.COMPUTER,
                  color: 'bg-green-500/10 text-green-400 border-green-500/20',
                },
                {
                  label: 'AVR',
                  value: occupancy.AVR,
                  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                },
                {
                  label: 'Recreation',
                  value: occupancy.RECREATION,
                  color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
                },
                {
                  label: 'Borrowing',
                  value: occupancy.BORROWING,
                  color:
                    'bg-orange-500/10 text-orange-400 border-orange-500/20',
                },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-xl p-4 border ${item.color} transition-all hover:scale-105 duration-300`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-2xl font-bold font-mono">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-3 bg-slate-800/50 text-slate-200 px-8 py-4 rounded-full border border-slate-700 animate-bounce">
                <QrCode className="h-6 w-6 text-blue-400" />
                <span className="text-lg font-medium">Waiting for scan...</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-900/20 to-transparent border-l-4 border-amber-500 p-6 rounded-r-xl animate-in slide-in-from-bottom duration-700 fade-in">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <svg
                    className="h-6 w-6 text-amber-400 animate-pulse"
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
                <div>
                  <p className="text-xl text-amber-100 font-serif italic leading-relaxed">
                    "{selectedQuote}"
                  </p>
                  {quietMode && (
                    <p className="text-sm text-amber-200/80 mt-2 font-medium uppercase tracking-wide">
                      Quiet Area — please keep voices down
                    </p>
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
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white mb-2">
              Scan Your ID
            </CardTitle>
            <p className="text-slate-400">
              Please scan your student ID barcode or QR code
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3 mb-2">
              {[
                { label: 'Library', value: occupancy.LIBRARY_SPACE },
                { label: 'Computer', value: occupancy.COMPUTER },
                { label: 'AVR', value: occupancy.AVR },
                { label: 'Recreation', value: occupancy.RECREATION },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
                >
                  <span className="text-slate-400 text-xs uppercase tracking-wider">
                    {item.label}
                  </span>
                  <span className="text-white font-mono font-bold">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative">
                <Input
                  ref={scanInputRef}
                  placeholder="Scan barcode or QR code..."
                  value={scanData}
                  onChange={(e) => setScanData(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="text-lg py-6 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoFocus
                  aria-label="kiosk-scan-input"
                  data-testid="kiosk-scan-input"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Scan className="h-6 w-6 text-blue-400 animate-pulse" />
                </div>
              </div>
            </div>

            <Button
              onClick={handleScanSubmit}
              disabled={loading || !scanData.trim()}
              className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-500 transition-all duration-300 shadow-lg shadow-blue-900/20"
              aria-label="kiosk-continue"
              data-testid="kiosk-continue"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                'Continue'
              )}
            </Button>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="text-center text-slate-500 text-sm mb-4">
                Or use camera to scan QR/barcode
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-black/20">
                <QRScannerComponent
                  enabled={true}
                  showSettings={false}
                  onScanSuccess={(res) => {
                    setScanData(res.text);
                    setTimeout(() => handleScanSubmit(), 0);
                  }}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={() => setCurrentStep('idle')}
              className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
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
        <Card className="w-full max-w-4xl bg-slate-900 border-slate-800 shadow-2xl animate-in slide-in-from-right-10 duration-500">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold text-white">
              Welcome, {studentInfo.name}!
            </CardTitle>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm">
              <User className="h-4 w-4" />
              <span>
                Grade {studentInfo.gradeLevel} - {studentInfo.section}
              </span>
            </div>
            <p className="text-xl text-slate-400 mt-6">
              What is your purpose of visit today?
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {PURPOSES.map((purpose, index) => {
                const Icon = purpose.icon;
                const isSelected = selectedPurposes.includes(purpose.id);
                return (
                  <Button
                    key={purpose.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className={`h-40 flex flex-col items-center justify-center space-y-3 p-4 transition-all duration-300 ${
                      isSelected
                        ? `${purpose.color} scale-105 shadow-lg ring-2 ring-offset-2 ring-offset-slate-900 ring-white/20`
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600 hover:scale-105'
                    } animate-in zoom-in-50 fade-in fill-mode-backwards`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => handlePurposeSelect(purpose.id)}
                  >
                    <div
                      className={`p-3 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-900/50'}`}
                    >
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                      <span className="block text-lg font-bold">
                        {purpose.name}
                      </span>
                      <span
                        className={`text-xs ${isSelected ? 'text-white/90' : 'text-slate-400'}`}
                      >
                        {purpose.description}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <Button
                onClick={handlePurposeContinue}
                disabled={selectedPurposes.length === 0}
                className="flex-1 py-6 text-lg bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
              >
                Continue
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentStep('scan')}
                className="px-8 py-6 text-lg border-slate-700 hover:bg-slate-800 text-slate-300"
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
    const selectedPurposeData = PURPOSES.find(
      (p) => p.id === selectedPurposes[0]
    );
    const Icon = selectedPurposeData?.icon || Users;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Confirm Your Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <User className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-lg text-slate-100">
                    {studentInfo.name}
                  </p>
                  <p className="text-sm text-slate-400">
                    Grade {studentInfo.gradeLevel} - {studentInfo.section}
                  </p>
                </div>
              </div>

              <div className="h-px bg-slate-700/50" />

              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <Icon className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-lg text-slate-100">Purpose</p>
                  <p className="text-sm text-slate-400">
                    {selectedPurposes
                      .map((pid) => PURPOSES.find((p) => p.id === pid)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleConfirmCheckIn}
                disabled={loading}
                className="flex-1 py-6 text-lg bg-green-600 hover:bg-green-500 transition-all shadow-lg shadow-green-900/20"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Confirm Check-in'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentStep('purpose')}
                className="px-8 py-6 border-slate-700 hover:bg-slate-800 text-slate-300"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 animate-in fade-in duration-500">
        <Card className="w-full max-w-3xl bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-sm overflow-hidden relative">
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse-soft"></div>
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse-soft"
            style={{ animationDelay: '1s' }}
          ></div>

          <CardContent className="p-8 space-y-8 relative z-10">
            {/* Header Section */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center ring-4 ring-green-500/10 animate-in zoom-in duration-500">
                <CheckCircle className="h-12 w-12 text-green-500 animate-in scale-in duration-700 delay-200" />
              </div>
              <div className="space-y-2 animate-in slide-in-from-bottom-5 duration-500 delay-100">
                <h2 className="text-4xl font-bold text-white tracking-tight">
                  Welcome, {studentInfo.name.split(' ')[0]}!
                </h2>
                <p className="text-slate-400 text-xl">You are now checked in</p>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Student Details Card */}
              <div className="space-y-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 animate-in slide-in-from-left-5 duration-500 delay-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <User className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Student Details
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400">Full Name</span>
                    <span className="text-white font-medium">
                      {studentInfo.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400">Student ID</span>
                    <span className="text-white font-medium">
                      {studentInfo.studentId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400">Grade & Section</span>
                    <span className="text-white font-medium">
                      {studentInfo.gradeLevel} - {studentInfo.section}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Purpose</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {selectedPurposes.map((pid) => {
                        const purpose = PURPOSES.find((p) => p.id === pid);
                        return (
                          <span
                            key={pid}
                            className={`text-xs px-2 py-1 rounded-full text-white ${purpose?.color || 'bg-slate-600'}`}
                          >
                            {purpose?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Info Card */}
              <div className="space-y-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 animate-in slide-in-from-right-5 duration-500 delay-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Session Info
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-3 rounded-lg text-center border border-slate-700/30">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Time In
                    </p>
                    <p className="text-xl font-mono text-white">
                      {timeInState}
                    </p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg text-center border border-slate-700/30">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Expected Out
                    </p>
                    <p className="text-xl font-mono text-white">
                      {expectedOutState}
                    </p>
                  </div>
                </div>

                {borrowedDue.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <p className="text-sm font-medium text-slate-300 mb-2">
                      Items Due Soon/Overdue:
                    </p>
                    <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                      {borrowedDue.map((b, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center text-sm bg-slate-900/30 p-2 rounded"
                        >
                          <span className="text-slate-300 truncate max-w-[120px]">
                            {b.title}
                          </span>
                          <span
                            className={`${b.daysOverdue ? 'text-red-400 font-bold' : 'text-orange-400'}`}
                          >
                            {b.daysOverdue
                              ? `${b.daysOverdue}d late`
                              : b.dueDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Occupancy Bar */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 animate-in fade-in duration-700 delay-500">
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider text-center">
                Current Library Occupancy
              </h3>
              <div className="flex flex-wrap justify-center gap-4">
                {[
                  { label: 'AVR', key: 'AVR', icon: Monitor },
                  { label: 'Comp Lab', key: 'COMPUTER', icon: Monitor },
                  { label: 'Reading', key: 'LIBRARY_SPACE', icon: BookOpen },
                  { label: 'Borrowing', key: 'BORROWING', icon: BookOpen },
                  { label: 'Recreation', key: 'RECREATION', icon: Gamepad2 },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50"
                  >
                    <item.icon className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-300">{item.label}</span>
                    <span className="text-sm font-bold text-white ml-1">
                      {(occupancy as any)[item.key] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quote */}
            <div className="text-center space-y-2 animate-in fade-in duration-1000 delay-700">
              <p className="text-lg text-slate-300 font-serif italic">
                "{selectedQuote}"
              </p>
              <p className="text-sm text-slate-500">
                Have a productive session!
              </p>
            </div>
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
        <Card className="w-full max-w-md bg-white shadow-2xl animate-in zoom-in duration-300">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-red-500">
              Please Wait
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
              <Clock className="h-10 w-10 text-red-500" />
            </div>

            <div className="space-y-2">
              <p className="text-lg text-slate-600">
                You have recently checked out
              </p>
              <div className="py-4">
                <span className="text-5xl font-bold text-red-500 tracking-tighter">
                  {minutesRemaining}
                </span>
                <span className="text-xl text-red-400 ml-2 font-medium">
                  minute{minutesRemaining !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-slate-500">
                remaining before you can check in again
              </p>
            </div>

            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">
                This cooldown period helps ensure fair library usage for all
                students.
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              onClick={() => setCurrentStep('idle')}
              className="w-full border-slate-200 hover:bg-slate-50 hover:text-slate-900"
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
