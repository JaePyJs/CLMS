import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';

interface MobileCardListProps<T> {
  data: T[];
  renderCard: (item: T, isMobile: boolean) => React.ReactNode;
  renderTable?: (data: T[]) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function MobileCardList<T>({
  data,
  renderCard,
  renderTable,
  emptyMessage = 'No items found',
  className = ''
}: MobileCardListProps<T>) {
  const { isMobile, isTablet } = useMobileOptimization();

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  // Mobile view: card-based list
  if (isMobile || isTablet) {
    return (
      <div className={`space-y-3 ${className}`}>
        {data.map((item, index) => (
          <div key={index}>{renderCard(item, true)}</div>
        ))}
      </div>
    );
  }

  // Desktop view: table or custom renderer
  if (renderTable) {
    return <div className={className}>{renderTable(data)}</div>;
  }

  // Fallback to card view for desktop
  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {data.map((item, index) => (
        <div key={index}>{renderCard(item, false)}</div>
      ))}
    </div>
  );
}

interface MobileTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  mobileHeaders?: string[];
  className?: string;
}

export function MobileTable({ headers, rows, mobileHeaders, className = '' }: MobileTableProps) {
  const { isMobile, isTablet } = useMobileOptimization();

  if (isMobile || isTablet) {
    // Mobile: Stacked card view
    const displayHeaders = mobileHeaders || headers;
    return (
      <div className={`space-y-3 ${className}`}>
        {rows.map((row, rowIndex) => (
          <Card key={rowIndex}>
            <CardContent className="p-4">
              <div className="space-y-2">
                {row.map((cell, cellIndex) => (
                  <div key={cellIndex} className="flex justify-between items-start gap-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      {displayHeaders[cellIndex]}:
                    </span>
                    <span className="text-sm text-right">{cell}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: Traditional table
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            {headers.map((header, index) => (
              <th key={index} className="text-left p-3 font-medium text-sm">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b hover:bg-muted/50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="p-3 text-sm">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
