import { useState, useEffect, useCallback, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { toast } from 'sonner';

interface ScannerConfig {
  enabled: boolean;
  minLength?: number;
  maxLength?: number;
  prefix?: string;
  suffix?: string;
  timeout?: number;
  onScan?: (code: string) => void;
  onError?: (error: Error) => void;
}

interface ScanResult {
  code: string;
  timestamp: Date;
  raw: string;
}

export function useUSBScanner(config: ScannerConfig = { enabled: true }) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [buffer, setBuffer] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferRef = useRef<string>('');

  const {
    enabled = true,
    minLength = 3,
    maxLength = 50,
    prefix = '',
    suffix = '',
    timeout = 100,
    onScan,
    onError,
  } = config;

  const processBuffer = useCallback(
    (finalBuffer: string) => {
      try {
        let code = finalBuffer.trim();

        // Remove prefix if specified
        if (prefix && code.startsWith(prefix)) {
          code = code.substring(prefix.length);
        }

        // Remove suffix if specified
        if (suffix && code.endsWith(suffix)) {
          code = code.substring(0, code.length - suffix.length);
        }

        // Validate length
        if (code.length < minLength || code.length > maxLength) {
          throw new Error(
            `Invalid scan length: ${code.length} (expected ${minLength}-${maxLength})`
          );
        }

        const result: ScanResult = {
          code,
          raw: finalBuffer,
          timestamp: new Date(),
        };

        setLastScan(result);
        onScan?.(code);

        return result;
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('Unknown scan error');
        onError?.(err);
        throw err;
      }
    },
    [prefix, suffix, minLength, maxLength, onScan, onError]
  );

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    setBuffer('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) {
        return;
      }

      // Detect scanner input (typically very fast typing)
      const key = event.key;

      // Start scanning on first character
      if (bufferRef.current === '') {
        setIsScanning(true);
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle Enter key (common scanner suffix)
      if (key === 'Enter') {
        event.preventDefault();

        if (bufferRef.current.length >= minLength) {
          processBuffer(bufferRef.current);
        }

        clearBuffer();
        setIsScanning(false);
        return;
      }

      // Handle Tab key (alternative scanner suffix)
      if (key === 'Tab' && bufferRef.current.length > 0) {
        event.preventDefault();

        if (bufferRef.current.length >= minLength) {
          processBuffer(bufferRef.current);
        }

        clearBuffer();
        setIsScanning(false);
        return;
      }

      // Ignore special keys
      if (key.length > 1 && key !== 'Enter' && key !== 'Tab') {
        return;
      }

      // Add character to buffer
      bufferRef.current += key;
      setBuffer(bufferRef.current);

      // Set timeout to clear buffer if no more input
      timeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          try {
            processBuffer(bufferRef.current);
          } catch (error) {
            console.error('Scanner processing error:', error);
          }
        }
        clearBuffer();
        setIsScanning(false);
      }, timeout);
    },
    [enabled, minLength, timeout, processBuffer, clearBuffer]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keypress', handleKeyPress);
      return () => {
        window.removeEventListener('keypress', handleKeyPress);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
    return undefined;
  }, [enabled, handleKeyPress]);

  const reset = useCallback(() => {
    clearBuffer();
    setLastScan(null);
    setIsScanning(false);
  }, [clearBuffer]);

  return {
    isScanning,
    lastScan,
    buffer,
    reset,
    clearBuffer,
  };
}

// Hook for QR code scanner (using device camera)
export function useQRScanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);

  const startScanning = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      setStream(mediaStream);
      setIsOpen(true);
      scanningRef.current = true;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to access camera');
      setError(error);
      toast.error('Failed to access camera');
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsOpen(false);
    scanningRef.current = false;
  }, [stream]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !scanningRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Extract QR code (you would use a QR code library like jsQR here)
    // Camera-based QR scanning using qr-scanner library

    // Use QrScanner to scan the canvas directly
    QrScanner.scanImage(canvas, { returnDetailedScanResult: true })
      .then((result) => {
        if (result?.data) {
          setResult(result.data);
          stopScanning();
        }
      })
      .catch((error) => {
        console.warn('QR scan failed:', error);
        // Continue to next frame if QR not found
      });

    // Continue scanning
    if (scanningRef.current) {
      requestAnimationFrame(captureFrame);
    }
  }, [stopScanning]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.addEventListener('play', captureFrame);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('play', captureFrame);
      }
    };
  }, [isOpen, captureFrame]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    isOpen,
    result,
    error,
    videoRef,
    canvasRef,
    startScanning,
    stopScanning,
    reset,
  };
}

// Hook for continuous scanner monitoring
export function useScannerMonitor(
  onScan: (code: string, type: 'barcode' | 'qr') => void
) {
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [scanHistory, setScanHistory] = useState<
    Array<{ code: string; timestamp: Date; type: string }>
  >([]);

  const handleUSBScan = useCallback(
    (code: string) => {
      setScanCount((prev) => prev + 1);
      setLastScanTime(new Date());
      setScanHistory((prev) => [
        ...prev.slice(-9),
        { code, timestamp: new Date(), type: 'usb' },
      ]);
      onScan(code, 'barcode');
    },
    [onScan]
  );

  const usbScanner = useUSBScanner({
    enabled: true,
    minLength: 3,
    maxLength: 50,
    timeout: 100,
    onScan: handleUSBScan,
  });

  const clearHistory = useCallback(() => {
    setScanHistory([]);
    setScanCount(0);
  }, []);

  return {
    usbScanner,
    scanCount,
    lastScanTime,
    scanHistory,
    clearHistory,
    isScanning: usbScanner.isScanning,
  };
}

export default useUSBScanner;
