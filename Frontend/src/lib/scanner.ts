import { BrowserMultiFormatReader } from '@zxing/browser';
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

// Types for scanner
export interface ScannerResult {
  text: string;
  format: string;
  timestamp: number;
}

export interface ScannerError {
  message: string;
  type: 'permission' | 'device' | 'decode' | 'unknown';
}

// Hook for camera scanner
export const useCameraScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerError, setScannerError] = useState<ScannerError | null>(null);
  const [lastResult, setLastResult] = useState<ScannerResult | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const setScanning = useAppStore((state) => state.setScanning);
  const setLastScanResult = useAppStore((state) => state.setLastScanResult);

  // Start camera scanning
  const startCamera = useCallback(async () => {
    try {
      setScannerError(null);
      setIsScanning(true);
      setScanning(true);

      // Initialize code reader
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      if (!videoRef.current) {
        throw new Error('Video element not found');
      }

      // Start video stream
      await codeReaderRef.current.decodeFromVideoDevice(
        undefined, // Let browser choose device
        videoRef.current,
        (result, error) => {
          if (result) {
            const scanResult: ScannerResult = {
              text: result.getText(),
              format: result.getBarcodeFormat().toString(),
              timestamp: Date.now(),
            };

            setLastResult(scanResult);
            setLastScanResult(scanResult.text);
            setIsScanning(false);
            setScanning(false);

            // Play success sound
            playScanSound('success');

            toast.success(`Barcode scanned: ${scanResult.text}`);

            // Stop camera after successful scan
            stopCamera();
          }

          if (
            error &&
            error.message.includes('No MultiFormat Readers were able')
          ) {
            // This is expected when no barcode is in view, don't treat as error
            return;
          }
        }
      );

      setIsCameraActive(true);
    } catch (error) {
      setIsScanning(false);
      setScanning(false);

      let errorType: ScannerError['type'] = 'unknown';
      let errorMessage = 'Failed to start camera scanner';

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorType = 'permission';
          errorMessage =
            'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
          errorType = 'device';
          errorMessage = 'No camera found. Please connect a camera.';
        } else if (error.name === 'NotReadableError') {
          errorType = 'device';
          errorMessage = 'Camera is already in use by another application.';
        }
      }

      setScannerError({ message: errorMessage, type: errorType });
      toast.error(errorMessage);
    }
  }, [setScanning, setLastScanResult]);

  // Stop camera scanning
  const stopCamera = useCallback(() => {
    if (codeReaderRef.current) {
      try {
        // Reset the reader
        codeReaderRef.current = null;
      } catch (error) {
        // Ignore stop errors
      }
    }
    setIsCameraActive(false);
    setIsScanning(false);
    setScanning(false);
  }, [setScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    isScanning,
    isCameraActive,
    scannerError,
    lastResult,
    videoRef,
    startCamera,
    stopCamera,
  };
};

// Hook for USB scanner input (IMPROVED - Auto-activates on mount)
export const useUsbScanner = () => {
  const [isListening, setIsListening] = useState(true); // Auto-start listening
  const [currentInput, setCurrentInput] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const inputBufferRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setLastScanResult = useAppStore((state) => state.setLastScanResult);

  // Process input as potential barcode
  const processInput = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();

      // Check if input looks like a barcode (more permissive patterns)
      const isBarcode =
        trimmedInput.length >= 3 && // At least 3 characters
        (/^[A-Z0-9]{3,}$/i.test(trimmedInput) || // Alphanumeric
          /^\d{3,}$/.test(trimmedInput) || // Numeric only
          /^[A-Z]{2,}\d+$/i.test(trimmedInput)); // Letters then numbers

      if (isBarcode) {
        const result: ScannerResult = {
          text: trimmedInput,
          format: 'USB Scanner',
          timestamp: Date.now(),
        };

        setLastScannedCode(trimmedInput);
        setLastScanResult(trimmedInput);
        playScanSound('success');
        toast.success(`✓ Scanned: ${trimmedInput}`, {
          duration: 3000,
          position: 'top-center',
        });
        return result;
      } else if (trimmedInput.length > 0) {
        toast.error(`Invalid barcode format: ${trimmedInput}`, {
          duration: 2000,
        });
        playScanSound('error');
      }

      return null;
    },
    [setLastScanResult]
  );

  // Handle keyboard input
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isListening) return;

      // Ignore if user is typing in an input field (except our scanner input)
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow scanning even in input fields if it's our dedicated scanner input
      const isScannerInput = target.id === 'usb-scanner-input';

      if (isInputField && !isScannerInput) {
        return; // Don't intercept typing in other input fields
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle enter key (most USB scanners send Enter after the barcode)
      if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission
        const input = inputBufferRef.current.trim();
        if (input) {
          processInput(input);
          inputBufferRef.current = '';
          setCurrentInput('');
        }
        return;
      }

      // Handle backspace
      if (event.key === 'Backspace') {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        setCurrentInput(inputBufferRef.current);
        return;
      }

      // Only process printable characters
      if (event.key.length === 1) {
        inputBufferRef.current += event.key;
        setCurrentInput(inputBufferRef.current);
      }

      // Set timeout to clear buffer if no more input (USB scanners type very fast)
      timeoutRef.current = setTimeout(() => {
        inputBufferRef.current = '';
        setCurrentInput('');
      }, 150); // 150ms delay - USB scanners typically complete in <50ms
    },
    [isListening, processInput]
  );

  // Start/stop listening
  const toggleListening = useCallback(() => {
    setIsListening((prev) => {
      const newState = !prev;
      if (newState) {
        toast.success('🔌 USB Scanner ACTIVATED - Ready to scan!', {
          duration: 2000,
          position: 'top-center',
        });
      } else {
        toast.info('USB Scanner deactivated', {
          duration: 2000,
        });
        inputBufferRef.current = '';
        setCurrentInput('');
      }
      return newState;
    });
  }, []);

  // Auto-activate on mount
  useEffect(() => {
    toast.success('🔌 USB Scanner ready - Just scan a barcode!', {
      duration: 3000,
      position: 'top-center',
    });
  }, []);

  // Set up keyboard listener
  useEffect(() => {
    if (isListening) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isListening, handleKeyDown]);

  return {
    isListening,
    currentInput,
    lastScannedCode,
    toggleListening,
  };
};

// Play scan sound effect
const playScanSound = (type: 'success' | 'error' = 'success') => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
      // Success sound: ascending beep
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        1200,
        audioContext.currentTime + 0.1
      );
    } else {
      // Error sound: descending beep
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        200,
        audioContext.currentTime + 0.2
      );
    }

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.2
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    // Silently fail if audio is not supported
  }
};

// Manual barcode entry
export const useManualEntry = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');

  const setLastScanResult = useAppStore((state) => state.setLastScanResult);

  const handleSubmit = useCallback(() => {
    const trimmedInput = input.trim();
    if (trimmedInput.length >= 3) {
      const result: ScannerResult = {
        text: trimmedInput,
        format: 'Manual Entry',
        timestamp: Date.now(),
      };

      setLastScanResult(trimmedInput);
      playScanSound('success');
      toast.success(`Barcode entered: ${trimmedInput}`);
      setIsOpen(false);
      setInput('');
      return result;
    } else {
      toast.error('Please enter at least 3 characters');
      playScanSound('error');
    }
  }, [input, setLastScanResult]);

  return {
    isOpen,
    input,
    setIsOpen,
    setInput,
    handleSubmit,
  };
};

// Barcode validation utilities
export const barcodeValidation = {
  // Check if barcode looks like a student ID
  isStudentBarcode: (barcode: string): boolean => {
    return (
      /^[A-Z]{2,4}\d{3,6}$/.test(barcode) || // Letters + numbers
      (barcode.length >= 6 && barcode.length <= 8)
    ); // 6-8 digits
  },

  // Check if barcode looks like a book ISBN
  isBookBarcode: (barcode: string): boolean => {
    return (
      /^(97[89])?\d{9}(\d|X)$/.test(barcode) || // ISBN format
      /^\d{10,13}$/.test(barcode)
    ); // Generic 10-13 digit
  },

  // Check if barcode looks like equipment ID
  isEquipmentBarcode: (barcode: string): boolean => {
    return (
      /^EQ\d{3,}$/.test(barcode) || // EQ prefix
      /^PC\d{2,}$/.test(barcode) || // PC (computer) prefix
      /^PS\d{2,}$/.test(barcode) || // PS (playstation) prefix
      /^AVR\d{2,}$/.test(barcode)
    ); // AVR prefix
  },

  // Get barcode type
  getBarcodeType: (
    barcode: string
  ): 'student' | 'book' | 'equipment' | 'unknown' => {
    // Check equipment first (most specific)
    if (
      /^EQ\d/.test(barcode) ||
      /^PC\d/.test(barcode) ||
      /^PS\d/.test(barcode) ||
      /^AVR\d/.test(barcode)
    ) {
      return 'equipment';
    }
    // Check books next (ISBN patterns)
    if (/^(97[89])?\d{9}(\d|X)$/.test(barcode) || /^\d{10,13}$/.test(barcode)) {
      return 'book';
    }
    // Check students last (most generic)
    if (/^[A-Z]{2,4}\d{3,6}$/.test(barcode) || barcode.length >= 6) {
      return 'student';
    }
    return 'unknown';
  },
};

// Export scanner utilities
export const scannerUtils = {
  playScanSound,
  barcodeValidation,
};
