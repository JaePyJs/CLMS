import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

interface RouteErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function RouteErrorFallback({
  error,
  resetErrorBoundary,
}: RouteErrorFallbackProps) {
  const handleReload = () => {
    resetErrorBoundary();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Page Error
        </h1>

        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Something went wrong while loading this page.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-left dark:bg-red-900/20">
            <p className="mb-2 text-sm font-semibold text-red-800 dark:text-red-400">
              Error Details:
            </p>
            <pre className="overflow-auto text-xs text-red-700 dark:text-red-300">
              {error.message}
            </pre>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={resetErrorBoundary}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>

          <button
            onClick={handleReload}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Error boundary specifically for route-level errors.
 * Provides user-friendly error UI with recovery options.
 *
 * Usage:
 * <RouteErrorBoundary>
 *   <YourRouteComponent />
 * </RouteErrorBoundary>
 */
export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={RouteErrorFallback}
      onReset={() => {
        // Reset any route-specific state if needed
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
