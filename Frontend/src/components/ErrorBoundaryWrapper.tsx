/**
 * ErrorBoundaryWrapper - React 19 compatible functional error boundary
 * Replaces the class-based ErrorBoundary with react-error-boundary integration
 */

import React, { useCallback, type ReactNode, type ErrorInfo } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { ErrorBoundaryFallback } from './ErrorBoundaryFallback';
import {
  reportApplicationError,
  categorizeError,
  generateErrorId,
  type ErrorType,
} from '@/utils/error-utils';

/**
 * Props for ErrorBoundaryWrapper component
 */
interface ErrorBoundaryWrapperProps {
  /** Child components to wrap with error boundary */
  children?: ReactNode;
  /** Maximum number of retry attempts before disabling auto-retry */
  maxRetries?: number;
  /** Enable/disable retry functionality */
  enableRetry?: boolean;
  /** Custom fallback component (defaults to ErrorBoundaryFallback) */
  fallback?: React.ComponentType<FallbackProps>;
  /** Custom error handler callback */
  onError?: (_error: Error, _errorInfo: React.ErrorInfo) => void;
  /** Custom reset handler callback */
  onReset?: (
    _details:
      | { reason: 'imperative-api' }
      | {
          reason: 'keys';
          prev: unknown[] | undefined;
          next: unknown[] | undefined;
        }
  ) => void;
  /** Reset keys - when these change, the error boundary resets */
  resetKeys?: unknown[];
  /** Reset on props change */
  resetOnPropsChange?: boolean;
  /** Isolate error boundary (double-wrap for extra protection) */
  isolate?: boolean;
}

/**
 * Enhanced ErrorBoundary wrapper with comprehensive error handling
 * Provides a functional interface over react-error-boundary with enhanced features
 */
export function ErrorBoundaryWrapper({
  children,
  maxRetries = 3,
  enableRetry = true,
  fallback: CustomFallback,
  onError,
  onReset,
  resetKeys,
  resetOnPropsChange: _resetOnPropsChange = true,
  isolate = false,
}: ErrorBoundaryWrapperProps) {
  /**
   * Enhanced error handler that maintains compatibility with react-error-boundary
   */
  const handleError = useCallback(
    (error: Error, info: ErrorInfo) => {
      // Generate error metadata
      const errorId = generateErrorId();
      const errorType = categorizeError(error);

      // Report error using the centralized error reporting system
      reportApplicationError(error, info, errorId, errorType, 0);

      // Log error details for debugging
      console.info(`🚨 ErrorBoundary: ${errorType}`);
      console.error('Error:', error);
      console.error('Error ID:', errorId);
      console.error(
        'Component Stack:',
        info.componentStack || 'No component stack available'
      );
      console.error('Error Type:', errorType);
      console.info(`🔄 Error details - ID: ${errorId}, Type: ${errorType}`);

      // Call custom error handler if provided
      if (onError) {
        try {
          onError(error, info);
        } catch (handlerError) {
          console.error('Error in custom error handler:', handlerError);
        }
      }
    },
    [onError]
  );

  /**
   * Enhanced reset handler
   */
  const handleReset = useCallback(
    (
      details:
        | { reason: 'imperative-api'; args: unknown[] }
        | {
            reason: 'keys';
            prev: unknown[] | undefined;
            next: unknown[] | undefined;
          }
    ) => {
      console.info(`🔄 ErrorBoundary Reset: ${details.reason}`, details);

      // Call custom reset handler if provided
      if (onReset) {
        try {
          // Convert the details to match our interface
          const convertedDetails =
            details.reason === 'imperative-api'
              ? { reason: 'imperative-api' as const }
              : {
                  reason: 'keys' as const,
                  prev: details.prev,
                  next: details.next,
                };
          onReset(convertedDetails);
        } catch (resetError) {
          console.error('Error in custom reset handler:', resetError);
        }
      }
    },
    [onReset]
  );

  /**
   * Fallback component renderer
   */
  const renderFallback = useCallback(
    (props: FallbackProps) => {
      const FallbackComponent = CustomFallback || ErrorBoundaryFallback;

      // Create a wrapper for the onError prop to match ErrorBoundaryFallback's expected signature
      const fallbackOnError = (
        _error: Error,
        _errorId: string,
        _errorType: ErrorType
      ) => {
        // We don't need to do anything here as the error is already handled by handleError
        // This is just to satisfy the ErrorBoundaryFallback component's interface
      };

      return (
        <FallbackComponent
          {...props}
          maxRetries={maxRetries}
          enableRetry={enableRetry}
          onError={fallbackOnError}
        />
      );
    },
    [CustomFallback, maxRetries, enableRetry]
  );

  // If isolation is enabled, wrap in an additional error boundary
  if (isolate) {
    return (
      <ErrorBoundary
        FallbackComponent={renderFallback}
        onError={handleError}
        onReset={handleReset}
        resetKeys={resetKeys || []}
        // Note: react-error-boundary v6 does not support resetOnPropsChange; kept for wrapper API compatibility
      >
        <ErrorBoundary
          FallbackComponent={renderFallback}
          onError={handleError}
          onReset={handleReset}
          resetKeys={resetKeys || []}
        >
          {children}
        </ErrorBoundary>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={renderFallback}
      onError={handleError}
      onReset={handleReset}
      resetKeys={resetKeys || []}
      // Note: react-error-boundary v6 does not support resetOnPropsChange; kept for wrapper API compatibility
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Higher-order component version for class component compatibility
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryWrapperProps, 'children'>
) {
  const WrappedComponent = React.forwardRef<unknown, P>((props, ref) => {
    const componentProps = { ...props } as P & { ref?: unknown };
    if (ref) {
      componentProps.ref = ref;
    }

    return (
      <ErrorBoundaryWrapper {...(errorBoundaryProps || {})}>
        <Component {...componentProps} />
      </ErrorBoundaryWrapper>
    );
  });

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for manual error boundary triggering
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    captureError,
    resetError,
  };
}

// Export the ErrorBoundary from react-error-boundary for convenience
export { ErrorBoundary } from 'react-error-boundary';

// Default export
export default ErrorBoundaryWrapper;
