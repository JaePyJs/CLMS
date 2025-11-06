import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  message?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
  xl: 'h-16 w-16 border-4',
};

/**
 * LoadingSpinner - Reusable spinner component for loading states
 *
 * @param size - Size of the spinner (sm, md, lg, xl)
 * @param className - Additional CSS classes
 * @param message - Optional loading message to display below spinner
 *
 * @example
 * <LoadingSpinner size="md" message="Loading data..." />
 *
 * HMR Test #1 - Stability Testing
 */
export function LoadingSpinner({
  size = 'md',
  className = '',
  message,
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div
        className={`animate-spin rounded-full border-blue-600 border-t-transparent ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}

/**
 * FullPageSpinner - Loading spinner that covers the entire viewport
 */
export function FullPageSpinner({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
      <LoadingSpinner size="xl" message={message} />
    </div>
  );
}

/**
 * InlineSpinner - Small spinner for inline loading states
 */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return <LoadingSpinner size="sm" className={className} />;
}

export default LoadingSpinner;
