import { useEffect, useRef, useState } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  timeThreshold?: number;
}

export const useBarcodeScanner = ({
  onScan,
  minLength = 3,
  timeThreshold = 100, // Scanner usually types very fast (<50ms per char)
}: UseBarcodeScannerOptions) => {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;

      // If time difference is too large, reset buffer (it was likely manual typing or a pause)
      // But we allow the first character to start a new sequence
      if (buffer.current.length > 0 && timeDiff > timeThreshold) {
        buffer.current = '';
      }

      lastKeyTime.current = currentTime;

      // Handle Enter key - end of scan
      if (event.key === 'Enter') {
        if (buffer.current.length >= minLength) {
          // It's a valid scan
          const scannedCode = buffer.current;
          buffer.current = ''; // Clear buffer
          setIsScanning(true);

          // Small delay to reset scanning state
          setTimeout(() => setIsScanning(false), 500);

          onScan(scannedCode);
        } else {
          buffer.current = '';
        }
        return;
      }

      // Ignore non-character keys (Shift, Ctrl, etc.)
      if (event.key.length !== 1) {
        return;
      }

      // Append to buffer
      buffer.current += event.key;
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, minLength, timeThreshold]);

  return { isScanning };
};
