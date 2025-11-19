import { Component, type ErrorInfo, type ReactNode } from 'react';
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
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRecovering: boolean;
  errorId: string;
  errorType: ErrorType;
  recoverySuggestions: RecoverySuggestion[];
  isOnline: boolean;
  lastRetry: number | null;
  autoRetry: boolean;
}

type ErrorType =
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

interface RecoverySuggestion {
  id: string;
  title: string;
  description: string;
  action: () => void;
  auto?: boolean;
  icon?: ReactNode;
}

interface ErrorReport {
  id: string;
  timestamp: number;
  error: string;
  stack?: string;
  componentStack?: string;
  userAgent: string;
  url: string;
  errorType: ErrorType;
  retryCount: number;
  isOnline: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private autoRetryTimer: NodeJS.Timeout | null = null;
  private maxRetries: number;
  private retryDelay: number = 2000; // 2 seconds

  constructor(props: Props) {
    super(props);
    this.maxRetries = props.maxRetries || 3;
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
      errorId: '',
      errorType: 'UNKNOWN_ERROR',
      recoverySuggestions: [],
      isOnline: navigator.onLine,
      lastRetry: null,
      autoRetry: true,
    };

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnlineChange);
    window.addEventListener('offline', this.handleOnlineChange);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errorType = ErrorBoundary.categorizeError(error);

    return {
      hasError: true,
      error,
      errorId,
      errorType,
      isRecovering: false,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorType = ErrorBoundary.categorizeError(error);
    const recoverySuggestions = this.generateRecoverySuggestions(
      error,
      errorType
    );

    this.setState({
      error,
      errorInfo,
      errorType,
      recoverySuggestions,
    });

    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send error report
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Attempt auto-recovery if enabled
    if (this.props.enableRetry !== false && this.state.autoRetry) {
      this.attemptAutoRecovery(error, errorType);
    }
  }

  public override componentWillUnmount() {
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer);
    }
    window.removeEventListener('online', this.handleOnlineChange);
    window.removeEventListener('offline', this.handleOnlineChange);
  }

  private static categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      stack.includes('fetch')
    ) {
      return 'NETWORK_ERROR';
    }

    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('login') ||
      message.includes('token')
    ) {
      return 'AUTHENTICATION_ERROR';
    }

    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    ) {
      return 'VALIDATION_ERROR';
    }

    if (
      message.includes('timeout') ||
      message.includes('timeout') ||
      stack.includes('timeout')
    ) {
      return 'TIMEOUT_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  private generateRecoverySuggestions(
    _error: Error,
    errorType: ErrorType
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    switch (errorType) {
      case 'NETWORK_ERROR':
        suggestions.push({
          id: 'check_connection',
          title: 'Check Internet Connection',
          description: 'Verify your internet connection is working properly',
          action: this.checkConnection,
          icon: <Wifi className="h-4 w-4" />,
          auto: false,
        });
        suggestions.push({
          id: 'refresh_page',
          title: 'Refresh Page',
          description: 'Reload the page to restore connection',
          action: this.refreshPage,
          icon: <RefreshCw className="h-4 w-4" />,
          auto: true,
        });
        break;

      case 'AUTHENTICATION_ERROR':
        suggestions.push({
          id: 'relogin',
          title: 'Sign In Again',
          description: 'Your session may have expired. Please sign in again.',
          action: this.handleReauthentication,
          icon: <CheckCircle className="h-4 w-4" />,
          auto: false,
        });
        break;

      case 'VALIDATION_ERROR':
        suggestions.push({
          id: 'check_input',
          title: 'Check Input Data',
          description: 'Please verify your input and try again',
          action: this.handleReset,
          icon: <AlertTriangle className="h-4 w-4" />,
          auto: false,
        });
        break;

      case 'TIMEOUT_ERROR':
        suggestions.push({
          id: 'retry_later',
          title: 'Try Again',
          description: 'The operation timed out. Please try again.',
          action: this.handleRetry,
          icon: <Clock className="h-4 w-4" />,
          auto: true,
        });
        break;

      default:
        suggestions.push({
          id: 'refresh_page',
          title: 'Refresh Page',
          description: 'Reload the page to clear temporary issues',
          action: this.refreshPage,
          icon: <RefreshCw className="h-4 w-4" />,
          auto: false,
        });
        suggestions.push({
          id: 'report_bug',
          title: 'Report Issue',
          description: 'Send an error report to help us fix this issue',
          action: this.sendDetailedReport,
          icon: <Send className="h-4 w-4" />,
          auto: false,
        });
    }

    return suggestions;
  }

  private attemptAutoRecovery = (_error: Error, _errorType: ErrorType) => {
    // DISABLED: Auto-recovery causing infinite reloads
    // The automatic page refresh creates a cycle of failures
    // Users should manually click retry instead
    return;
  };

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const report: ErrorReport = {
        id: this.state.errorId,
        timestamp: Date.now(),
        error: error.message,
        ...(error.stack && { stack: error.stack }),
        ...(errorInfo.componentStack && {
          componentStack: errorInfo.componentStack,
        }),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorType: this.state.errorType,
        retryCount: this.state.retryCount,
        isOnline: navigator.onLine,
      };

      // Store error in localStorage for debugging
      const existingErrors = JSON.parse(
        localStorage.getItem('clms_error_reports') || '[]'
      );
      existingErrors.push(report);
      localStorage.setItem(
        'clms_error_reports',
        JSON.stringify(existingErrors.slice(-10))
      ); // Keep last 10 errors

      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }

      localStorage.setItem(
        'clms_error_reports',
        JSON.stringify(existingErrors)
      );

      // Send to backend if online (disabled - endpoint doesn't exist)
      // TODO: Enable when /api/errors/report endpoint is implemented
      // if (navigator.onLine) {
      //   await fetch('/api/errors/report', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(report),
      //   }).catch(() => {
      //     // Ignore errors when reporting errors to avoid infinite loops
      //   });
      // }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleOnlineChange = () => {
    const isOnline = navigator.onLine;
    this.setState({ isOnline });

    // If we came back online and have a network error, try auto-recovery
    if (
      isOnline &&
      this.state.hasError &&
      this.state.errorType === 'NETWORK_ERROR'
    ) {
      this.handleRetry();
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      this.setState({ autoRetry: false });
      return;
    }

    this.setState({
      retryCount: this.state.retryCount + 1,
      lastRetry: Date.now(),
      isRecovering: true,
    });

    // Clear any existing auto-retry timer
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = null;
    }

    // Attempt recovery by resetting error state
    setTimeout(() => {
      this.handleReset();
    }, 1000);
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
      errorId: '',
      errorType: 'UNKNOWN_ERROR',
      recoverySuggestions: [],
      lastRetry: null,
      autoRetry: true,
    });

    // Clear any existing timer
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = null;
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private refreshPage = () => {
    window.location.reload();
  };

  private checkConnection = () => {
    // Simple connection check
    if (!navigator.onLine) {
      alert('You appear to be offline. Please check your internet connection.');
      return;
    }

    // Try to fetch a small resource to test connection
    fetch(`${import.meta.env.VITE_API_URL}/health`, { method: 'HEAD' })
      .then(() => {
        alert('Connection is working. Refreshing the page...');
        this.refreshPage();
      })
      .catch(() => {
        alert('Connection test failed. Please check your internet connection.');
      });
  };

  private handleReauthentication = () => {
    // Clear auth data and redirect to login
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/login';
  };

  private sendDetailedReport = () => {
    const report = {
      errorId: this.state.errorId,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Create email body
    const emailBody = `
Error Report ID: ${report.errorId}
Timestamp: ${report.timestamp}
URL: ${report.url}
Error: ${report.error}

Component Stack:
${report.componentStack || 'Not available'}

Full Stack:
${report.stack || 'Not available'}

User Agent: ${report.userAgent}
    `.trim();

    // Open email client with pre-filled report
    const subject = encodeURIComponent(`CLMS Error Report - ${report.errorId}`);
    const body = encodeURIComponent(emailBody);
    window.open(`mailto:support@clms.com?subject=${subject}&body=${body}`);
  };

  private getErrorIcon = () => {
    switch (this.state.errorType) {
      case 'NETWORK_ERROR':
        return this.state.isOnline ? (
          <Wifi className="h-8 w-8" />
        ) : (
          <WifiOff className="h-8 w-8" />
        );
      case 'AUTHENTICATION_ERROR':
        return <XCircle className="h-8 w-8" />;
      case 'VALIDATION_ERROR':
        return <AlertTriangle className="h-8 w-8" />;
      case 'TIMEOUT_ERROR':
        return <Clock className="h-8 w-8" />;
      default:
        return <Bug className="h-8 w-8" />;
    }
  };

  private getErrorMessage = (): string => {
    if (!this.state.error) {
      return 'Unknown error';
    }

    // If error has a message property (API error object)
    if (typeof this.state.error === 'object' && this.state.error.message) {
      return this.state.error.message;
    }

    // If error is a string
    if (typeof this.state.error === 'string') {
      return this.state.error;
    }

    // Fallback to toString for Error objects
    return this.state.error.toString();
  };

  public override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
          <div className="max-w-3xl w-full space-y-6">
            {/* Main Error Card */}
            <Card className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Header */}
              <div
                className={`bg-gradient-to-r p-6 ${
                  this.state.errorType === 'NETWORK_ERROR'
                    ? 'from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700'
                    : this.state.errorType === 'AUTHENTICATION_ERROR'
                      ? 'from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700'
                      : this.state.errorType === 'VALIDATION_ERROR'
                        ? 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700'
                        : this.state.errorType === 'TIMEOUT_ERROR'
                          ? 'from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700'
                          : 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 text-white">
                    {this.getErrorIcon()}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">
                      {this.state.errorType === 'NETWORK_ERROR' &&
                        'Connection Error'}
                      {this.state.errorType === 'AUTHENTICATION_ERROR' &&
                        'Authentication Required'}
                      {this.state.errorType === 'VALIDATION_ERROR' &&
                        'Validation Error'}
                      {this.state.errorType === 'TIMEOUT_ERROR' &&
                        'Request Timeout'}
                      {this.state.errorType === 'UNKNOWN_ERROR' &&
                        'Something Went Wrong'}
                    </h1>
                    <p className="text-white/80 mt-1">
                      {this.state.errorType === 'NETWORK_ERROR' &&
                        'Unable to connect to the server'}
                      {this.state.errorType === 'AUTHENTICATION_ERROR' &&
                        'Please sign in to continue'}
                      {this.state.errorType === 'VALIDATION_ERROR' &&
                        'Please check your input and try again'}
                      {this.state.errorType === 'TIMEOUT_ERROR' &&
                        'The request took too long to complete'}
                      {this.state.errorType === 'UNKNOWN_ERROR' &&
                        'The application encountered an unexpected error'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {this.state.isOnline ? (
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
                {this.state.isRecovering && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                      <div>
                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                          Attempting Automatic Recovery
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Trying to resolve the issue automatically... (Attempt{' '}
                          {this.state.retryCount + 1}/{this.maxRetries})
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
                      ID: {this.state.errorId}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-mono break-all">
                    {this.getErrorMessage()}
                  </p>
                  {this.state.retryCount > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Retry attempts: {this.state.retryCount}/{this.maxRetries}
                    </p>
                  )}
                </div>

                {/* Recovery Suggestions */}
                {this.state.recoverySuggestions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Suggested Actions
                    </h3>
                    <div className="grid gap-2">
                      {this.state.recoverySuggestions.map((suggestion) => (
                        <Button
                          key={suggestion.id}
                          onClick={suggestion.action}
                          variant="outline"
                          className="justify-start h-auto p-4 gap-3"
                          disabled={this.state.isRecovering}
                        >
                          {suggestion.icon}
                          <div className="text-left">
                            <div className="font-medium">
                              {suggestion.title}
                            </div>
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
                {import.meta.env.DEV && this.state.errorInfo && (
                  <details className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <summary className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer mb-2">
                      Stack Trace (Development Only)
                    </summary>
                    <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}

                {/* Main Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1 gap-2"
                    variant="default"
                    disabled={
                      this.state.isRecovering ||
                      this.state.retryCount >= this.maxRetries
                    }
                  >
                    <RefreshCw className="h-4 w-4" />
                    {this.state.isRecovering
                      ? 'Recovering...'
                      : this.state.retryCount >= this.maxRetries
                        ? 'Max Retries Reached'
                        : 'Try Again'}
                  </Button>
                  <Button
                    onClick={this.handleGoHome}
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
                    Error ID: {this.state.errorId}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    If this problem persists, please contact the system
                    administrator
                  </p>
                </div>
              </div>
            </Card>

            {/* Auto-retry disabled notice */}
            {!this.state.autoRetry &&
              this.state.retryCount >= this.maxRetries && (
                <Card className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                          Automatic Retry Disabled
                        </h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Maximum retry attempts reached. Please try one of the
                          suggested actions above.
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

    return this.props.children;
  }
}

export default ErrorBoundary;
