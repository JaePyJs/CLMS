import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  QrCode,
  Scan,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Barcode,
  Zap,
  Smartphone,
  Monitor,
  Settings
} from 'lucide-react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';

interface QRScanResult {
  text: string;
  format: string;
  timestamp: Date;
  raw: string;
}

interface ScanStatistics {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  averageScanTime: number;
  lastScanTime: Date | null;
}

interface QRScannerProps {
  onScanSuccess?: (result: QRScanResult) => void;
  onScanError?: (error: string) => void;
  enabled?: boolean;
  showSettings?: boolean;
  className?: string;
}

export default function QRScannerComponent({
  onScanSuccess,
  onScanError,
  enabled = true,
  showSettings = true,
  className = ""
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [lastResult, setLastResult] = useState<QRScanResult | null>(null);
  const [statistics, setStatistics] = useState<ScanStatistics>({
    totalScans: 0,
    successfulScans: 0,
    failedScans: 0,
    averageScanTime: 0,
    lastScanTime: null,
  });
  const [settings, setSettings] = useState({
    autoStart: false,
    continuous: false,
    beepOnScan: true,
    vibrateOnScan: true,
    showOverlay: true,
    torchEnabled: false,
    scanDelay: 1000,
    maxResolutions: true,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  // Initialize QR code reader
  useEffect(() => {
    if (enabled) {
      initializeQRReader();
      checkCameraAvailability();
    }

    return () => {
      cleanup();
    };
  }, [enabled]);

  // Auto-start if enabled
  useEffect(() => {
    if (settings.autoStart && hasCamera && !isScanning) {
      startScanning();
    }
  }, [settings.autoStart, hasCamera]);

  const initializeQRReader = () => {
    try {
      codeReaderRef.current = new BrowserMultiFormatReader();

      // Configure reader
      codeReaderRef.current.hints.setResultPointCallback, (point) => {
        // Custom result point callback for visualization
        if (settings.showOverlay) {
          // This would be used for drawing scan overlay
        }
      };

      // Set up event listeners
      codeReaderRef.current.addEventListener('result', handleQRResult);
    } catch (error) {
      console.error('Failed to initialize QR reader:', error);
      toast.error('Failed to initialize QR scanner');
    }
  };

  const checkCameraAvailability = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      setCameras(videoDevices);
      setHasCamera(videoDevices.length > 0);

      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to check camera availability:', error);
      setHasCamera(false);
    }
  };

  const startScanning = async () => {
    if (!codeReaderRef.current || !selectedCamera) {
      toast.error('No camera selected or scanner not initialized');
      return;
    }

    try {
      setIsScanning(true);

      // Start video stream
      const constraints = {
        video: {
          deviceId: selectedCamera,
          width: settings.maxResolutions ? { ideal: 1920 } : { ideal: 640 },
          height: settings.maxResolutions ? { ideal: 1080 } : { ideal: 480 },
          facingMode: 'environment',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start continuous scanning
      if (settings.continuous) {
        startContinuousScanning();
      } else {
        // Single scan mode
        codeReaderRef.current.decodeOnceFromVideoDevice(selectedCamera, 'video')
          .then(handleQRResult)
          .catch(handleQRScanError);
      }

      toast.success('Camera started successfully');
    } catch (error) {
      console.error('Failed to start scanning:', error);
      handleQRScanError(error);
    }
  };

  const stopScanning = () => {
    try {
      setIsScanning(false);

      // Stop video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clear video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Clear scan timeout
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      toast.info('Camera stopped');
    } catch (error) {
      console.error('Failed to stop scanning:', error);
    }
  };

  const startContinuousScanning = () => {
    if (!codeReaderRef.current || !isScanning) return;

    const scan = async () => {
      if (!isScanning) return;

      try {
        // Check if enough time has passed since last scan
        const now = Date.now();
        if (now - lastScanTimeRef.current < settings.scanDelay) {
          scanTimeoutRef.current = setTimeout(scan, 100);
          return;
        }

        if (videoRef.current && codeReaderRef.current) {
          const result = await codeReaderRef.current.decodeOnceFromVideoDevice(selectedCamera, 'video');
          if (result) {
            handleQRResult(result);
          }
        }
      } catch (error) {
        // Ignore scan errors in continuous mode
      }

      // Schedule next scan
      if (settings.continuous && isScanning) {
        scanTimeoutRef.current = setTimeout(scan, 100);
      }
    };

    scan();
  };

  const handleQRResult = (result: Result) => {
    try {
      const now = Date.now();
      lastScanTimeRef.current = now;

      const scanResult: QRScanResult = {
        text: result.getText(),
        format: result.getBarcodeFormat().toString(),
        timestamp: new Date(),
        raw: result.getRawBytes().toString(),
      };

      setLastResult(scanResult);

      // Update statistics
      const scanTime = now - (statistics.lastScanTime?.getTime() || now);
      setStatistics(prev => ({
        totalScans: prev.totalScans + 1,
        successfulScans: prev.successfulScans + 1,
        failedScans: prev.failedScans,
        averageScanTime: (prev.averageScanTime * prev.totalScans + scanTime) / (prev.totalScans + 1),
        lastScanTime: new Date(),
      }));

      // Provide feedback
      if (settings.beepOnScan) {
        playBeep();
      }

      if (settings.vibrateOnScan && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }

      // Call success callback
      onScanSuccess?.(scanResult);

      // Show success toast
      toast.success(`QR Code scanned: ${scanResult.text}`);

      // Stop scanning if not in continuous mode
      if (!settings.continuous) {
        stopScanning();
      }
    } catch (error) {
      console.error('Error handling QR result:', error);
      handleQRScanError(error);
    }
  };

  const handleQRScanError = (error: any) => {
    console.error('QR scan error:', error);

    setStatistics(prev => ({
      ...prev,
      totalScans: prev.totalScans + 1,
      failedScans: prev.failedScans + 1,
    }));

    const errorMessage = error?.message || 'Failed to scan QR code';
    onScanError?.(errorMessage);

    // Don't show error toast for continuous scanning errors
    if (!settings.continuous) {
      toast.error(errorMessage);
    }
  };

  const playBeep = () => {
    try {
      // Create audio context for beep
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 1000; // 1kHz beep
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Failed to play beep:', error);
    }
  };

  const toggleTorch = async () => {
    try {
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        if (track.getCapabilities().torch) {
          await track.applyConstraints({
            advanced: [{ torch: !settings.torchEnabled }]
          } as MediaTrackConstraints);
          setSettings(prev => ({ ...prev, torchEnabled: !prev.torchEnabled }));
        } else {
          toast.error('Torch not supported on this device');
        }
      }
    } catch (error) {
      console.error('Failed to toggle torch:', error);
      toast.error('Failed to toggle flashlight');
    }
  };

  const cleanup = () => {
    stopScanning();
    if (codeReaderRef.current) {
      codeReaderRef.current.removeEventListener('result', handleQRResult);
      codeReaderRef.current.reset();
    }
  };

  const resetStatistics = () => {
    setStatistics({
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      averageScanTime: 0,
      lastScanTime: null,
    });
    setLastResult(null);
  };

  const switchCamera = async (deviceId: string) => {
    if (isScanning) {
      stopScanning();
      setSelectedCamera(deviceId);
      setTimeout(() => startScanning(), 500);
    } else {
      setSelectedCamera(deviceId);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <QrCode className="h-5 w-5 mr-2" />
            QR Code Scanner
          </CardTitle>
          <CardDescription>
            Scan QR codes and barcodes using your device camera
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Selection */}
          {cameras.length > 1 && (
            <div className="flex items-center space-x-4">
              <Label htmlFor="camera-select">Camera:</Label>
              <Select value={selectedCamera} onValueChange={switchCamera}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((camera) => (
                    <SelectItem key={camera.deviceId} value={camera.deviceId}>
                      <div className="flex items-center">
                        <Camera className="h-4 w-4 mr-2" />
                        {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Video Preview */}
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-64 bg-black rounded-lg object-cover"
              playsInline
              muted
            />

            {/* Scanner Overlay */}
            {isScanning && settings.showOverlay && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-green-500 rounded-lg">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-1 bg-green-500 animate-pulse"></div>
                </div>
              </div>
            )}

            {/* Status Indicator */}
            <div className="absolute top-2 right-2">
              <Badge variant={isScanning ? "default" : "secondary"}>
                {isScanning ? "Scanning" : "Ready"}
              </Badge>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center space-x-4">
            <Button
              onClick={isScanning ? stopScanning : startScanning}
              disabled={!hasCamera || !selectedCamera}
              size="lg"
            >
              {isScanning ? (
                <>
                  <CameraOff className="h-4 w-4 mr-2" />
                  Stop Scanning
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Start Scanning
                </>
              )}
            </Button>

            {hasCamera && (
              <Button
                variant="outline"
                onClick={toggleTorch}
                disabled={!streamRef.current}
              >
                <Zap className="h-4 w-4 mr-2" />
                {settings.torchEnabled ? "Torch Off" : "Torch On"}
              </Button>
            )}
          </div>

          {!hasCamera && (
            <div className="text-center py-8">
              <CameraOff className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No camera detected</p>
              <p className="text-sm text-gray-500">
                Please ensure you have a camera connected and have granted camera permissions
              </p>
            </div>
          )}

          {/* Last Scan Result */}
          {lastResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Last Scan Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Content:</span>
                    <span className="font-mono text-sm">{lastResult.text}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Format:</span>
                    <Badge variant="outline">{lastResult.format}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Timestamp:</span>
                    <span className="text-sm">{lastResult.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Settings Panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Scanner Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-start">Auto-start</Label>
              <Switch
                id="auto-start"
                checked={settings.autoStart}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoStart: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="continuous">Continuous Scanning</Label>
              <Switch
                id="continuous"
                checked={settings.continuous}
                onCheckedChange={(checked) => {
                  setSettings(prev => ({ ...prev, continuous: checked }));
                  if (checked && isScanning) {
                    startContinuousScanning();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="beep-on-scan">Beep on Scan</Label>
              <Switch
                id="beep-on-scan"
                checked={settings.beepOnScan}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, beepOnScan: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="vibrate-on-scan">Vibrate on Scan</Label>
              <Switch
                id="vibrate-on-scan"
                checked={settings.vibrateOnScan}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, vibrateOnScan: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-overlay">Show Scan Overlay</Label>
              <Switch
                id="show-overlay"
                checked={settings.showOverlay}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showOverlay: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="max-resolution">Maximum Resolution</Label>
              <Switch
                id="max-resolution"
                checked={settings.maxResolutions}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, maxResolutions: checked }))}
              />
            </div>

            <div>
              <Label htmlFor="scan-delay">Scan Delay (ms)</Label>
              <Input
                id="scan-delay"
                type="number"
                value={settings.scanDelay}
                onChange={(e) => setSettings(prev => ({ ...prev, scanDelay: parseInt(e.target.value) || 1000 }))}
                min="100"
                max="5000"
                step="100"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Scan Statistics
            </span>
            <Button variant="outline" size="sm" onClick={resetStatistics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{statistics.totalScans}</div>
              <p className="text-sm text-gray-600">Total Scans</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statistics.successfulScans}</div>
              <p className="text-sm text-gray-600">Successful</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{statistics.failedScans}</div>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{statistics.averageScanTime.toFixed(0)}ms</div>
              <p className="text-sm text-gray-600">Avg Time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}