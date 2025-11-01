/**
 * ErrorBoundaryFallback - Functional fallback component for react-error-boundary
 * React 19 compatible with modern hooks and error handling patterns
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  Wifi, 
  WifiOff, 
  Clock, 
  Send, 
  CheckCircle, 
  XCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  categorizeError,
  generateErrorId,
  reportError,
  checkConnection,
  handleReauthentication,
  refreshPage,
  goHome,
  sendDetailedReport,
  type ErrorType,
  type RecoverySuggestion
} from '@/utils/error-utils';

/**
 * Props for ErrorBoundaryFallback component extending react-error-boundary's FallbackProps
 */
interface ErrorBoundaryFallbackProps extends FallbackProps {
  /** Maximum number of retry attempts before disabling auto-retry */
  maxRetries?: number;
  /** Enable/disable retry functionality */
  enableRetry?: boolean;
  /** Custom error handler callback */
  onError?: (error: Error, errorId: string, errorType: ErrorType) => void;
}

/**
 * Functional ErrorBoundary fallback component with comprehensive error handling
 * Supports automatic recovery, retry logic, and detailed error reporting
 */
export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
  maxRetries = 3,
  enableRetry = true,
  onError
}: ErrorBoundaryFallbackProps) {
  // State management using React hooks
  const [retryCount, setRetryCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoRetry, setAutoRetry] = useState(true);
  // Remove unused lastRetry variable

  // Memoized error categorization and ID generation
  const errorType = useMemo(() => categorizeError(error), [error]);
  const errorId = useMemo(() => generateErrorId(), [error]);

  /**
   * Handle online/offline status changes
   */
  const handleOnlineChange = useCallback(() => {
    const online = navigator.onLine;
    setIsOnline(online);

    // Auto-retry network errors when coming back online
    if (online && errorType === 'NETWORK_ERROR' && autoRetry && retryCount < maxRetries) {
      handleRetry();
    }
  }, [errorType, autoRetry, retryCount, maxRetries]);

  /**
   * Handle retry attempts with exponential backoff
   */
  const handleRetry = useCallback(() => {
    if (retryCount >= maxRetries) {
      setAutoRetry(false);
      return;
    }

    setRetryCount(prev => prev + 1);
    setIsRecovering(true);

    // Exponential backoff: 1s, 2s, 4s, etc.
    const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);

    setTimeout(() => {
      setIsRecovering(false);
      resetErrorBoundary();
    }, delay);
  }, [retryCount, maxRetries, resetErrorBoundary]);

  /**
   * Handle manual reset
   */
  const handleReset = useCallback(() => {
    setRetryCount(0);
    setIsRecovering(false);
    setAutoRetry(true);
    resetErrorBoundary();
  }, [resetErrorBoundary]);

  /**
   * Check connection and retry if successful
   */
  const handleCheckConnection = useCallback(async () => {
    setIsRecovering(true);
    
    try {
      const isConnected = await checkConnection();
      if (isConnected) {
        handleRetry();
      } else {
        alert('Connection test failed. Please check your internet connection.');
        setIsRecovering(false);
      }
    } catch {
      alert('Unable to test connection. Please check your internet connection.');
      setIsRecovering(false);
    }
  }, [handleRetry]);

  /**
   * Send detailed error report via email
   */
  const handleSendReport = useCallback(() => {
    sendDetailedReport(errorId, error, null);
  }, [errorId, error]);

  /**
   * Generate recovery suggestions based on error type
   */
  const recoverySuggestions = useMemo((): RecoverySuggestion[] => {
    const suggestions: RecoverySuggestion[] = [];

    switch (errorType) {
      case 'NETWORK_ERROR':
        suggestions.push({
          id: 'check_connection',
          title: 'Check Internet Connection',
          description: 'Verify your internet connection is working properly',
          action: handleCheckConnection,
          icon: <Wifi className="h-4 w-4" />,
          auto: false,
        });
        suggestions.push({
          id: 'refresh_page',
          title: 'Refresh Page',
          description: 'Reload the page to restore connection',
          action: refreshPage,
          icon: <RefreshCw className="h-4 w-4" />,
          auto: true,
        });
        break;

      case 'AUTHENTICATION_ERROR':
        suggestions.push({
          id: 'relogin',
          title: 'Sign In Again',
          description: 'Your session may have expired. Please sign in again.',
          action: handleReauthentication,
          icon: <CheckCircle className="h-4 w-4" />,
          auto: false,
        });
        break;

      case 'VALIDATION_ERROR':
        suggestions.push({
          id: 'check_input',
          title: 'Check Input Data',
          description: 'Please verify your input and try again',
          action: handleReset,
          icon: <AlertTriangle className="h-4 w-4" />,
          auto: false,
        });
        break;

      case 'TIMEOUT_ERROR':
        suggestions.push({
          id: 'retry_later',
          title: 'Try Again',
          description: 'The operation timed out. Please try again.',
          action: handleRetry,
          icon: <Clock className="h-4 w-4" />,
          auto: true,
        });
        break;

      default:
        suggestions.push({
          id: 'refresh_page',
          title: 'Refresh Page',
          description: 'Reload the page to clear temporary issues',
          action: refreshPage,
          icon: <RefreshCw className="h-4 w-4" />,
          auto: false,
        });
        suggestions.push({
          id: 'report_bug',
          title: 'Report Issue',
          description: 'Send an error report to help us fix this issue',
          action: handleSendReport,
          icon: <Send className="h-4 w-4" />,
          auto: false,
        });
    }

    return suggestions;
  }, [errorType, handleCheckConnection, handleRetry, handleReset, handleSendReport]);

  /**
   * Get appropriate icon for error type
   */
  const getErrorIcon = useCallback(() => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return isOnline ? <Wifi className="h-8 w-8" /> : <WifiOff className="h-8 w-8" />;
      case 'AUTHENTICATION_ERROR':
        return <XCircle className="h-8 w-8" />;
      case 'VALIDATION_ERROR':
        return <AlertTriangle className="h-8 w-8" />;
      case 'TIMEOUT_ERROR':
        return <Clock className="h-8 w-8" />;
      default:
        return <Bug className="h-8 w-8" />;
    }
  }, [errorType, isOnline]);

  /**
   * Get error title based on type
   */
  const getErrorTitle = useCallback(() => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return 'Connection Error';
      case 'AUTHENTICATION_ERROR':
        return 'Authentication Required';
      case 'VALIDATION_ERROR':
        return 'Validation Error';
      case 'TIMEOUT_ERROR':
        return 'Request Timeout';
      default:
        return 'Something Went Wrong';
    }
  }, [errorType]);

  /**
   * Get error description based on type
   */
  const getErrorDescription = useCallback(() => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return 'Unable to connect to the server';
      case 'AUTHENTICATION_ERROR':
        return 'Please sign in to continue';
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again';
      case 'TIMEOUT_ERROR':
        return 'The request took too long to complete';
      default:
        return 'The application encountered an unexpected error';
    }
  }, [errorType]);

  /**
   * Get gradient colors based on error type
   */
  const getGradientColors = useCallback(() => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return 'from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700';
      case 'AUTHENTICATION_ERROR':
        return 'from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700';
      case 'VALIDATION_ERROR':
        return 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700';
      case 'TIMEOUT_ERROR':
        return 'from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700';
      default:
        return 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700';
    }
  }, [errorType]);

  // Effect for setting up event listeners
  useEffect(() => {
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    return () => {
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, [handleOnlineChange]);

  // Effect for error reporting
  useEffect(() => {
    reportError(error, null, errorId, errorType, retryCount);
    
    if (onError) {
      onError(error, errorId, errorType);
    }
  }, [error, errorId, errorType, retryCount, onError]);

  // Effect for automatic retry
  useEffect(() => {
    const autoRecoverySuggestions = recoverySuggestions.filter(s => s.auto);
    
    const suggestion = autoRecoverySuggestions[0];
    if (suggestion && retryCount < maxRetries) {
      const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000); // Progressive delay
      
      const timer = setTimeout(() => {
        console.log(`Auto-recovery attempt ${retryCount + 1}/${maxRetries}: ${suggestion.title}`);
        setIsRecovering(true);
        
        try {
          suggestion.action();
        } catch (recoveryError) {
          console.error('Auto-recovery failed:', recoveryError);
        } finally {
          setIsRecovering(false);
        }
      }, delay);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [recoverySuggestions, autoRetry, retryCount, maxRetries, enableRetry]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="max-w-3xl w-full space-y-6">
        {/* Main Error Card */}
        <Card className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className={`bg-gradient-to-r p-6 ${getGradientColors()}`}>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 text-white">
                {getErrorIcon()}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">
                  {getErrorTitle()}
                </h1>
                <p className="text-white/80 mt-1">
                  {getErrorDescription()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-5 w-5 text-green-400" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-400" />
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Auto-recovery status */}
            {isRecovering && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Attempting Automatic Recovery
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Trying to resolve the issue automatically... (Attempt {retryCount + 1}/{maxRetries})
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Details */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Error Details
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ID: {errorId}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-mono break-all">
                {error.toString()}
              </p>
              {retryCount > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Retry attempts: {retryCount}/{maxRetries}
                </p>
              )}
            </div>

            {/* Recovery Suggestions */}
            {recoverySuggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Suggested Actions
                </h3>
                <div className="grid gap-2">
                  {recoverySuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      onClick={suggestion.action}
                      variant="outline"
                      className="justify-start h-auto p-4 gap-3"
                      disabled={isRecovering}
                    >
                      {suggestion.icon}
                      <div className="text-left">
                        <div className="font-medium">{suggestion.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {suggestion.description}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Development Info */}
            {import.meta.env.DEV && error.stack && (
              <details className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <summary className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer mb-2">
                  Stack Trace (Development Only)
                </summary>
                <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                  {error.stack}
                </pre>
              </details>
            )}

            {/* Main Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                onClick={handleRetry}
                className="flex-1 gap-2"
                variant="default"
                disabled={isRecovering || retryCount >= maxRetries || !enableRetry}
              >
                <RefreshCw className="h-4 w-4" />
                {isRecovering ? 'Recovering...' :
                 retryCount >= maxRetries ? 'Max Retries Reached' : 'Try Again'}
              </Button>
              <Button
                onClick={goHome}
                className="flex-1 gap-2"
                variant="outline"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>

            {/* Help Text */}
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Error ID: {errorId}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If this problem persists, please contact the system administrator
              </p>
            </div>
          </div>
        </Card>

        {/* Auto-retry disabled notice */}
        {!autoRetry && retryCount >= maxRetries && (
          <Card className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Automatic Retry Disabled
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Maximum retry attempts reached. Please try one of the suggested actions above.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}