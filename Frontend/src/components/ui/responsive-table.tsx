import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Responsive table wrapper that:
 * - Enables horizontal scroll on mobile
 * - Maintains table layout on desktop
 * - Adds touch-friendly scrolling
 */
export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn('w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      <div className="inline-block min-w-full align-middle">
        {children}
      </div>
    </div>
  );
}
