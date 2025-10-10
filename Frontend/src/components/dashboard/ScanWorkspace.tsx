import React, { useState, useEffect } from 'react';
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
import {
  useCameraScanner,
  useUsbScanner,
  useManualEntry,
  barcodeValidation,
} from '@/lib/scanner';
import { useStudentActivity } from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { offlineActions } from '@/lib/offline-queue';
import {
  Camera,
  CameraOff,
  Keyboard,
  Edit3,
  Users,
  BookOpen,
  Monitor,
  Gamepad2,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Square,
  RefreshCw,
} from 'lucide-react';

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

export function ScanWorkspace() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState(false);

  const { isOnline, lastScanResult } = useAppStore();
  const {
    isScanning,
    isCameraActive,
    scannerError,
    lastResult,
    videoRef,
    startCamera,
    stopCamera,
  } = useCameraScanner();
  const { isListening, currentInput, lastScannedCode, toggleListening } =
    useUsbScanner();
  const { isOpen, input, setIsOpen, setInput, handleSubmit } = useManualEntry();
  const { mutate: logActivity } = useStudentActivity();

  // Mock student lookup for now (replace with real API call)
  const lookupStudent = async (barcode: string): Promise<Student | null> => {
    // This would normally call the API
    const mockStudents: Student[] = [
      {
        id: '1',
        studentId: 'STU001',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        gradeLevel: 'Grade 5',
        gradeCategory: 'gradeSchool',
        section: 'A',
      },
      {
        id: '2',
        studentId: 'STU002',
        firstName: 'Maria',
        lastName: 'Santos',
        gradeLevel: 'Grade 8',
        gradeCategory: 'juniorHigh',
        section: 'B',
      },
    ];

    return mockStudents.find((s) => s.studentId === barcode) || null;
  };

  // Process scanned barcode
  useEffect(() => {
    if (lastScanResult && lastScanResult !== scanResult?.barcode) {
      processBarcode(lastScanResult);
    }
  }, [lastScanResult]);

  const processBarcode = async (barcode: string) => {
    setIsProcessing(true);

    try {
      const barcodeType = barcodeValidation.getBarcodeType(barcode);
      let student: Student | null = null;

      if (barcodeType === 'student') {
        student = await lookupStudent(barcode);
      }

      const result: ScanResult = {
        student: student || undefined,
        barcode,
        type: barcodeType,
        timestamp: Date.now(),
      };

      setScanResult(result);

      // Auto-select action based on barcode type
      if (barcodeType === 'student' && student) {
        setSelectedAction('computer');
      } else if (barcodeType === 'book') {
        setSelectedAction('borrowing');
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle action execution
  const executeAction = async () => {
    if (!scanResult || !selectedAction) return;

    const activityData = {
      studentId: scanResult.student?.id || scanResult.barcode,
      studentName: scanResult.student
        ? `${scanResult.student.firstName} ${scanResult.student.lastName}`
        : `Unknown (${scanResult.barcode})`,
      gradeLevel: scanResult.student?.gradeLevel || 'Unknown',
      gradeCategory: scanResult.student?.gradeCategory || 'unknown',
      activityType: selectedAction,
      timeLimitMinutes: ['computer', 'gaming', 'avr'].includes(selectedAction)
        ? timeLimit
        : undefined,
      equipmentId: ['computer', 'gaming', 'avr'].includes(selectedAction)
        ? 'auto-assign'
        : undefined,
      startTime: new Date().toISOString(),
      status: 'active',
    };

    if (isOnline) {
      // Online: use API
      logActivity(activityData);
    } else {
      // Offline: queue for later
      await offlineActions.logActivity(activityData);
    }

    // Reset for next scan
    setScanResult(null);
    setSelectedAction('');
    setTimeLimit(30);
  };

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
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-black dark:text-foreground">
          Scan Workspace
        </h2>
        <p className="text-black dark:text-muted-foreground">
          Scan student IDs, books, or equipment for library activities.
        </p>
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks without scanning</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-16 flex-col">
              <Users className="h-6 w-6 mb-2" />
              <span>Register New Student</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <Clock className="h-6 w-6 mb-2" />
              <span>View Active Sessions</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <RefreshCw className="h-6 w-6 mb-2" />
              <span>Sync Offline Data</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ScanWorkspace;
