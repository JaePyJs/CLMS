/**
 * ErrorBoundaryWrapper - React 19 compatible functional error boundary
 * Replaces the class-based ErrorBoundary with react-error-boundary integration
 */

import React, { useCallback } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { ErrorBoundaryFallback } from './ErrorBoundaryFallback';
import { reportError, categorizeError, generateErrorId } from '@/utils/error-utils';

/**
 * Props for ErrorBoundaryWrapper component
 */
interface ErrorBoundaryWrapperProps {
  /** Child components to wrap with error boundary */
  children: ReactNode;
  /** Maximum number of retry attempts before disabling auto-retry */
  maxRetries?: number;
  /** Enable/disable retry functionality */
  enableRetry?: boolean;
  /** Custom fallback component (defaults to ErrorBoundaryFallback) */
  fallback?: React.ComponentType<FallbackProps>;
  /** Custom error handler callback */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Custom reset handler callback */
  onReset?: (
    details:
      | { reason: 'imperative-api' }
      | { reason: 'keys'; prev: any[] | undefined; next: any[] | undefined }
  ) => void;
  /** Reset keys - when these change, the error boundary resets */
  resetKeys?: any[];
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
  resetOnPropsChange = true,
  isolate = false
}: ErrorBoundaryWrapperProps) {
  
  /**
   * Enhanced error handler that maintains compatibility with the original ErrorBoundary
   */
  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    // Generate error metadata
    const errorId = generateErrorId();
    const errorType = categorizeError(error);
    
    // Report error using the centralized error reporting system
    reportError(error, errorInfo, errorId, errorType, 0);
    
    // Log error details for debugging
    console.group(`🚨 ErrorBoundary: ${errorType}`);
    console.error('Error:', error);
    console.error('Error ID:', errorId);
    console.error('Component Stack:', errorInfo.componentStack || 'No component stack available');
    console.error('Error Type:', errorType);
    console.groupEnd();
    
    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }
  }, [onError]);

  /**
   * Enhanced reset handler
   */
  const handleReset = useCallback((details: { reason: 'imperative-api' } | { reason: 'keys'; prev: any[] | undefined; next: any[] | undefined }) => {
    console.log(`🔄 ErrorBoundary Reset: ${details.reason}`, details);
    
    // Call custom reset handler if provided
    if (onReset) {
      try {
        onReset(details);
      } catch (resetError) {
        console.error('Error in custom reset handler:', resetError);
      }
    }
  }, [onReset]);

  /**
   * Fallback component renderer
   */
  const renderFallback = useCallback((props: FallbackProps) => {
    const FallbackComponent = CustomFallback || ErrorBoundaryFallback;
    
    return (
      <FallbackComponent
        {...props}
        maxRetries={maxRetries}
        enableRetry={enableRetry}
        onError={handleError}
      />
    );
  }, [CustomFallback, maxRetries, enableRetry, handleError]);

  // If isolation is enabled, wrap in an additional error boundary
  if (isolate) {
    return (
      <ErrorBoundary
        FallbackComponent={renderFallback}
        onError={handleError}
        onReset={handleReset}
        resetKeys={resetKeys || undefined}
        // Note: react-error-boundary v6 does not support resetOnPropsChange; kept for wrapper API compatibility
      >
        <ErrorBoundary
          FallbackComponent={renderFallback}
          onError={handleError}
          onReset={handleReset}
          resetKeys={resetKeys || undefined}
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
      resetKeys={resetKeys || undefined}
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
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundaryWrapper {...errorBoundaryProps}>
      <Component {...props} ref={ref} />
    </ErrorBoundaryWrapper>
  ));

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
    resetError
  };
}

// Export the ErrorBoundary from react-error-boundary for convenience
export { ErrorBoundary } from 'react-error-boundary';

// Default export
export default ErrorBoundaryWrapper;