import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMobileOptimization, useTouchOptimization } from '@/hooks/useMobileOptimization';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';
import { Camera, CameraOff, Zap, History, CheckCircle, XCircle, AlertCircle, RotateCcw, Flashlight, FlashlightOff, Keyboard, X, Search } from 'lucide-react';

interface ScanResult {
  id: string;
  code: string;
  type: 'barcode' | 'qr' | 'manual';
  timestamp: number;
  status: 'success' | 'error' | 'pending';
  data?: any;
  error?: string;
}

interface MobileScannerProps {
  onScanSuccess: (code: string, type: string, data?: any) => void;
  onScanError: (error: string) => void;
  placeholder?: string;
  allowedTypes?: ('barcode' | 'qr' | 'manual')[];
}

export const MobileScanner: React.FC<MobileScannerProps> = ({
  onScanSuccess,
  onScanError,
  placeholder = 'Scan barcode or QR code',
  allowedTypes = ['barcode', 'qr', 'manual'],
}) => {
  const { isMobile } = useMobileOptimization();
  const { queueAction } = useOfflineSync();
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [flashlightEnabled, setFlashlightEnabled] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Scanner history
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [currentScan, setCurrentScan] = useState<string>('');

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-focus for manual input on mobile
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Initialize camera
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isMobile ? 'environment' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // @ts-ignore - torch is not in standard MediaTrackConstraints but supported by browsers
          torch: flashlightEnabled,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsScanning(true);

      // Start scanning loop
      requestAnimationFrame(scanFrame);
    } catch (error) {
      console.error('[MobileScanner] Camera access failed:', error);
      toast.error('Failed to access camera');
      setScanMode('manual');
    }
  }, [isMobile, flashlightEnabled]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Toggle flashlight
  const toggleFlashlight = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;
      
      const capabilities = track.getCapabilities() as any;

      if (capabilities.torch) {
        await track.applyConstraints({
          // @ts-ignore - torch is not in standard MediaTrackConstraints but supported by browsers
          advanced: [{ torch: !flashlightEnabled }],
        });
        setFlashlightEnabled(!flashlightEnabled);
      } else {
        toast.error('Flashlight not available');
      }
    } catch (error) {
      console.error('[MobileScanner] Flashlight toggle failed:', error);
      toast.error('Failed to toggle flashlight');
    }
  }, [flashlightEnabled]);

  // Scan frame for barcodes/QR codes
  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== 4) {
      requestAnimationFrame(scanFrame);
      return;
    }

    // Draw video frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // Here you would integrate with a barcode scanning library
    // For now, we'll simulate scanning
    const mockScannedCode = `DEMO-${Date.now().toString(36)}`;

    if (Math.random() < 0.01) { // Simulate successful scan
      handleScanResult(mockScannedCode, 'barcode');
    }

    requestAnimationFrame(scanFrame);
  }, [isScanning]);

  // Handle scan result
  const handleScanResult = useCallback(async (code: string, type: 'barcode' | 'qr' | 'manual', data?: any) => {
    try {
      // Create scan result entry
      const result: ScanResult = {
        id: `scan-${Date.now()}`,
        code,
        type,
        timestamp: Date.now(),
        status: 'success',
        data,
      };

      // Add to history
      setScanHistory(prev => [result, ...prev.slice(0, 9)]); // Keep last 10

      // Provide haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }

      // Call success callback
      onScanSuccess(code, type, data);

      // Queue action if offline
      if (!navigator.onLine) {
        await queueAction({
          type: 'create',
          endpoint: '/api/activities',
          data: {
            action: 'scan',
            code,
            type,
            timestamp: result.timestamp,
            data,
          },
          maxRetries: 5,
        });
      }

      // Clear current scan
      setCurrentScan('');
      if (scanMode === 'manual') {
        setManualInput('');
      }

      toast.success(`Scanned: ${code}`);
    } catch (error) {
      console.error('[MobileScanner] Scan handling failed:', error);
      toast.error('Failed to process scan');
      onScanError?.('Failed to process scan');
    }
  }, [onScanSuccess, onScanError, scanMode, queueAction]);

  // Handle manual input
  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;

    handleScanResult(manualInput.trim(), 'manual');
  }, [manualInput, handleScanResult]);

  // Retry failed scan
  const retryScan = useCallback((result: ScanResult) => {
    handleScanResult(result.code, result.type, result.data);
  }, [handleScanResult]);

  // Clear history
  const clearHistory = useCallback(() => {
    setScanHistory([]);
    toast.success('Scan history cleared');
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    if (scanMode === 'camera' && !isScanning) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [scanMode, startCamera, stopCamera, isScanning]);

  // Auto-focus manual input
  useEffect(() => {
    if (scanMode === 'manual' && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [scanMode]);

  return (
    <div className="space-y-4">
      {/* Scanner Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mobile Scanner</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isScanning ? 'default' : 'secondary'}>
                {isScanning ? 'Active' : 'Inactive'}
              </Badge>
              {scanHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1"
                >
                  <History className="h-4 w-4" />
                  {scanHistory.length}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selection */}
          <div className="flex gap-2">
            {allowedTypes.includes('barcode') && allowedTypes.includes('qr') && (
              <Button
                variant={scanMode === 'camera' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanMode('camera')}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Camera
              </Button>
            )}
            {allowedTypes.includes('manual') && (
              <Button
                variant={scanMode === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanMode('manual')}
                className="flex items-center gap-2"
              >
                <Keyboard className="h-4 w-4" />
                Manual
              </Button>
            )}
          </div>

          {/* Camera Scanner */}
          {scanMode === 'camera' && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scan Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2">
                    <div className="border-2 border-green-400 rounded-lg aspect-square max-w-xs mx-auto animate-pulse" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <p className="text-white text-sm font-medium">Position code within frame</p>
                  </div>
                </div>

                {/* Camera Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  {isMobile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleFlashlight}
                      className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                    >
                      {flashlightEnabled ? (
                        <FlashlightOff className="h-4 w-4" />
                      ) : (
                        <Flashlight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isScanning ? stopCamera : startCamera}
                    className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                  >
                    {isScanning ? (
                      <CameraOff className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Current Scan Display */}
              {currentScan && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Last Scan: {currentScan}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Input */}
          {scanMode === 'manual' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={manualInputRef}
                  type="text"
                  placeholder={placeholder}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                  className="pl-10 pr-12 text-base"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                {manualInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualInput('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
                className="w-full"
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                Submit Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan History */}
      {showHistory && scanHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Scan History</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-red-600 dark:text-red-400"
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scanHistory.map((result) => (
                <div
                  key={result.id}
                  className={`p-3 rounded-lg border ${
                    result.status === 'success'
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : result.status === 'error'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.status === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                      {result.status === 'error' && (
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      {result.status === 'pending' && (
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{result.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {result.type} • {new Date(result.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {result.status === 'error' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryScan(result)}
                        className="text-blue-600 dark:text-blue-400"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileScanner;