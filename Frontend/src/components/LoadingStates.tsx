import React from 'react';
import { Loader2 } from 'lucide-react';

// Spinner Loading
export const LoadingSpinner = ({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
    </div>
  );
};

// Full Page Loading
export const LoadingPage = ({ message = 'Loading...' }: { message?: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

// Card Loading Skeleton
export const CardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 animate-pulse">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
    </div>
  );
};

// Table Loading Skeleton
export const TableSkeleton = ({ rows = 5, columns = 4 }: { rows?: number, columns?: number }) => {
  return (
    <div className="w-full animate-pulse">
      {/* Header */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid gap-4 mb-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Dashboard Card Skeleton
export const DashboardCardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
        </div>
        <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
    </div>
  );
};

// List Item Skeleton
export const ListItemSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 animate-pulse">
      <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
      </div>
      <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
    </div>
  );
};

// Grid Skeleton
export const GridSkeleton = ({ items = 6 }: { items?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};

// Loading Overlay (for buttons and forms)
export const LoadingOverlay = ({ message = 'Processing...' }: { message?: string }) => {
  return (
    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

// Button Loading State
export const ButtonLoading = ({ text = 'Loading...' }: { text?: string }) => {
  return (
    <span className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </span>
  );
};

// Empty State (not loading, but useful)
export const EmptyState = ({ 
  title = 'No data found', 
  description = 'There is no data to display at the moment.',
  icon: Icon,
  action
}: { 
  title?: string, 
  description?: string,
  icon?: React.ComponentType<{ className?: string }>,
  action?: React.ReactNode 
}) => {
  const IconComponent = Icon || (() => <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>);
  
  return (
    <div className="text-center py-12">
      <IconComponent className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  );
};
