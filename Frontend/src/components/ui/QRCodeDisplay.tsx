import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  className?: string;
}

export function QRCodeDisplay({
  value,
  size = 150,
  margin = 1,
  color = { dark: '#000000', light: '#FFFFFF' },
  className = '',
}: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (value) {
      generateQRCode();
    } else {
      setQrCodeUrl('');
      setError('');
    }
  }, [value, size, margin, color]);

  const generateQRCode = async () => {
    try {
      const url = await QRCode.toDataURL(value, {
        width: size,
        margin,
        color: {
          dark: color.dark || '#000000',
          light: color.light || '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });
      setQrCodeUrl(url);
      setError('');
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code');
      setQrCodeUrl('');
    }
  };

  if (!value) {
    return (
      <div
        className={`flex items-center justify-center h-36 w-36 bg-gray-100 border border-gray-300 rounded ${className}`}
      >
        <span className="text-gray-500 text-xs text-center">No QR data</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center h-36 w-36 bg-red-50 border border-red-200 rounded ${className}`}
      >
        <span className="text-red-500 text-xs text-center">{error}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src={qrCodeUrl}
        alt="QR Code"
        className="border border-gray-200 rounded"
        style={{ width: size, height: size }}
      />
      {value && (
        <span className="text-xs text-gray-600 mt-2 text-center max-w-[150px] truncate">
          {value}
        </span>
      )}
    </div>
  );
}

export default QRCodeDisplay;
