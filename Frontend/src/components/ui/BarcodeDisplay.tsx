import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

export function BarcodeDisplay({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  className = ''
}: BarcodeDisplayProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize: 14,
          margin: 10
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [value, format, width, height, displayValue]);

  if (!value) {
    return (
      <div className={`flex items-center justify-center h-24 bg-gray-100 border border-gray-300 rounded ${className}`}>
        <span className="text-gray-500 text-sm">No barcode data</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg ref={barcodeRef}></svg>
    </div>
  );
}

export default BarcodeDisplay;