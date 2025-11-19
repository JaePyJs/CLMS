import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  UserX,
  Scan,
  CheckCircle,
  AlertCircle,
  Clock,
  LogIn,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import selfServiceApi from '@/services/selfServiceApi';
import { getErrorMessage } from '@/utils/errorHandling';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  section?: string;
  hasActiveSession?: boolean;
}

interface ScanResult {
  success: boolean;
  action: 'check-in' | 'check-out' | 'duplicate' | 'error';
  student?: Student;
  message: string;
  isDuplicate?: boolean;
  duration?: number;
}

export default function SelfServiceMode() {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount and after each scan
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (showSuccess) {
      const timeout = setTimeout(() => {
        setShowSuccess(false);
        setLastScan(null);
        setStudentId('');
        inputRef.current?.focus();
      }, 3000);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [showSuccess]);

  // Play sound feedback
  const playSound = (success: boolean) => {
    const audio = new Audio(
      success ? '/sounds/success.mp3' : '/sounds/error.mp3'
    );
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Fallback to system beep if sound file not found
      console.debug(success ? '✓ Success' : '✗ Error');
    });
    return undefined;
  };

  const handleScan = async (scannedId: string) => {
    if (!scannedId.trim()) {
      return;
    }

    setLoading(true);
    try {
      // Use the self-service API to process the scan
      const result = await selfServiceApi.processScan(scannedId.trim());

      // Map the API response to our component state interface
      // Handle the interface mismatch between API and component
      let action: 'check-in' | 'check-out' | 'duplicate' | 'error' = 'error';
      let student: Student | undefined;
      let message = result.message;
      let isDuplicate = false;
      let duration: number | undefined;

      if (result.success) {
        // Map student data from API to component interface
        if (result.student) {
          student = {
            id: result.student.id,
            studentId: result.student.studentId,
            firstName: result.student.name?.split(' ')[0] || 'Unknown',
            lastName:
              result.student.name?.split(' ').slice(1).join(' ') || 'Student',
            gradeLevel: result.student.gradeLevel,
            section: result.student.section,
          };
        }

        // Determine action based on API response
        if (result.cooldownRemaining && result.cooldownRemaining > 0) {
          action = 'duplicate';
          isDuplicate = true;
          message = `You already checked in within the last 30 minutes. Please wait before scanning again.`;
        } else if (result.activity && result.activity.checkInTime) {
          action = 'check-out';
          duration = result.activity.timeLimit || 0;
        } else {
          action = 'check-in';
        }
      } else {
        action = 'error';
        if (result.cooldownRemaining && result.cooldownRemaining > 0) {
          action = 'duplicate';
          isDuplicate = true;
        }
      }

      // Map the API response to our component state
      const scanResult: ScanResult = {
        success: result.success,
        action,
        message,
        ...(student && { student }),
        ...(isDuplicate !== undefined && { isDuplicate }),
        ...(duration !== undefined && { duration }),
      };
      setLastScan(scanResult);

      // Play appropriate sound and show feedback
      if (result.success) {
        playSound(true);

        if (action === 'check-in') {
          toast.success('Checked in successfully!');
        } else if (action === 'check-out') {
          toast.success('Checked out successfully!');
        }

        setShowSuccess(true);
      } else {
        playSound(false);

        if (action === 'duplicate') {
          toast.warning('Duplicate scan detected!');
        } else {
          toast.error(message || 'Failed to process scan');
        }
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to process scan');
      setLastScan({
        success: false,
        action: 'error',
        message: errorMessage,
      });
      playSound(false);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScan(studentId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Barcode scanners typically send Enter after scanning
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan(studentId);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Scan className="w-12 h-12 text-primary animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-4xl font-bold mb-2">
            Library Check-In/Out
          </CardTitle>
          <p className="text-xl text-muted-foreground">
            Scan your ID card to check in or out
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Scan Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Scan your ID card or enter Student ID..."
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={loading || showSuccess}
                className="text-2xl py-8 text-center font-mono tracking-wider"
                autoFocus
                autoComplete="off"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <Scan
                  className={`w-8 h-8 ${loading ? 'animate-pulse text-primary' : 'text-muted-foreground'}`}
                />
              </div>
            </div>

            {!showSuccess && (
              <Button
                type="submit"
                disabled={!studentId.trim() || loading}
                className="w-full py-6 text-xl"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Scan className="w-6 h-6 mr-2" />
                    Scan Now
                  </>
                )}
              </Button>
            )}
          </form>

          {/* Success/Error Display */}
          {lastScan && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {lastScan.action === 'check-in' && lastScan.success && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <AlertTitle className="text-2xl text-green-800 dark:text-green-400 mb-2">
                    Welcome!
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-xl font-semibold text-green-700 dark:text-green-300">
                      {lastScan.student?.firstName} {lastScan.student?.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <LogIn className="w-5 h-5" />
                      <span className="text-lg">You are now checked in</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <Badge variant="outline" className="bg-white/50">
                        {lastScan.student?.gradeLevel}
                      </Badge>
                      <Badge variant="outline" className="bg-white/50">
                        {lastScan.student?.studentId}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {lastScan.action === 'check-out' && lastScan.success && (
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                  <AlertTitle className="text-2xl text-blue-800 dark:text-blue-400 mb-2">
                    Goodbye!
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                      {lastScan.student?.firstName} {lastScan.student?.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <LogOut className="w-5 h-5" />
                      <span className="text-lg">You are now checked out</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-blue-600 dark:text-blue-400">
                      <Clock className="w-5 h-5" />
                      <span className="text-lg font-semibold">
                        Time spent: {lastScan.duration} minutes
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {lastScan.action === 'duplicate' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-6 w-6" />
                  <AlertTitle className="text-xl mb-2">
                    Duplicate Scan Detected
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-lg">
                      {lastScan.student?.firstName}, you already checked in
                      recently!
                    </p>
                    <p className="text-sm">
                      Please wait at least 30 minutes before scanning again.
                    </p>
                    <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-400">
                        💡 If you're leaving, wait a bit before checking out.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {lastScan.action === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-6 w-6" />
                  <AlertTitle className="text-xl mb-2">Error</AlertTitle>
                <AlertDescription className="text-lg">
                  {typeof lastScan?.message === 'string' ? lastScan.message : String(lastScan?.message || '')}
                </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Instructions */}
          {!lastScan && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg mb-3">How to use:</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Scan your ID card</p>
                    <p className="text-sm text-muted-foreground">
                      Use the barcode scanner to scan your student ID
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Wait for confirmation</p>
                    <p className="text-sm text-muted-foreground">
                      You'll see a message confirming check-in or check-out
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">You're done!</p>
                    <p className="text-sm text-muted-foreground">
                      The system automatically tracks your library visit
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <UserCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">Check In</p>
              <p className="text-sm text-muted-foreground">When entering</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <UserX className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">Check Out</p>
              <p className="text-sm text-muted-foreground">When leaving</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Exit (Hidden, press Esc to exit) */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground">
        Press ESC for admin mode
      </div>
    </div>
  );
}
