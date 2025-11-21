/**
 * Error utilities for categorizing and handling errors in the CLMS application
 * Supports React 19 migration with functional error boundaries
 */

import type { ErrorInfo } from 'react';

/**
 * Categorized error types for better error handling and user experience
 */
export type ErrorType =
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Error report structure for logging and debugging
 */
export interface ErrorReport {
  id: string;
  timestamp: number;
  error: string;
  stack?: string | undefined;
  componentStack?: string | undefined;
  userAgent: string;
  url: string;
  errorType: ErrorType;
  retryCount: number;
  isOnline: boolean;
}

/**
 * Recovery suggestion interface for user-actionable error resolution
 */
export interface RecoverySuggestion {
  id: string;
  title: string;
  description: string;
  action: () => void;
  auto?: boolean;
  icon?: React.ReactNode;
}

/**
 * Categorizes errors based on message content and stack trace
 * @param error - The error object to categorize
 * @returns The categorized error type
 */
export function categorizeError(error: Error): ErrorType {
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

/**
 * Generates a unique error ID for tracking and reporting
 * @returns A unique error identifier
 */
export function generateErrorId(): string {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reports error to local storage and optionally to backend
 * @param error - The error object
 * @param errorInfo - React error info (optional for non-React errors)
 * @param errorId - Unique error identifier
 * @param errorType - Categorized error type
 * @param retryCount - Number of retry attempts
 */
export async function reportApplicationError(
  error: Error,
  errorInfo: ErrorInfo | null,
  errorId: string,
  errorType: ErrorType,
  retryCount: number = 0
): Promise<void> {
  try {
    const report: ErrorReport = {
      id: errorId,
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack || undefined,
      componentStack: errorInfo?.componentStack || undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorType,
      retryCount,
      isOnline: navigator.onLine,
    };

    // Store error in localStorage for debugging
    const existingErrors = JSON.parse(
      localStorage.getItem('clms_error_reports') || '[]'
    );
    existingErrors.push(report);

    // Keep only last 50 errors to prevent storage bloat
    if (existingErrors.length > 50) {
      existingErrors.splice(0, existingErrors.length - 50);
    }

    localStorage.setItem('clms_error_reports', JSON.stringify(existingErrors));

    // Send to backend if online (disabled - endpoint doesn't exist)
    // TODO: Enable when /api/errors/report endpoint is implemented
    // if (navigator.onLine) {
    //   await fetch('/api/errors/report', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(report),
    //   }).catch(() => {
    //     // Ignore errors when reporting errors to avoid infinite loops
    //     console.warn('Failed to send error report to backend');
    //   });
    // }
  } catch (reportingError) {
    console.error('Failed to report error:', reportingError);
  }
}

/**
 * Checks if the browser is online and optionally tests server connectivity
 * @param testEndpoint - Optional endpoint to test connectivity
 * @returns Promise resolving to connection status
 */
export async function checkConnection(
  testEndpoint: string = '/health'
): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const response = await fetch(testEndpoint, {
      method: 'HEAD',
      cache: 'no-cache',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Clears authentication data and redirects to login
 */
export function handleReauthentication(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_data');
  window.location.href = '/login';
}

/**
 * Refreshes the current page
 */
export function refreshPage(): void {
  window.location.reload();
}

/**
 * Navigates to the home/dashboard page
 */
export function goHome(): void {
  window.location.href = '/';
}

/**
 * Creates a detailed error report for email submission
 * @param errorId - Unique error identifier
 * @param error - The error object
 * @param errorInfo - React error info
 * @returns Formatted error report string
 */
export function createDetailedReport(
  errorId: string,
  error: Error | null,
  errorInfo: ErrorInfo | null
): string {
  const report = {
    errorId,
    error: error?.message,
    stack: error?.stack,
    componentStack: errorInfo?.componentStack,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  return `
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
}

/**
 * Opens email client with pre-filled error report
 * @param errorId - Unique error identifier
 * @param error - The error object
 * @param errorInfo - React error info
 */
export function sendDetailedReport(
  errorId: string,
  error: Error | null,
  errorInfo: ErrorInfo | null
): void {
  const emailBody = createDetailedReport(errorId, error, errorInfo);
  const subject = encodeURIComponent(`CLMS Error Report - ${errorId}`);
  const body = encodeURIComponent(emailBody);
  window.open(`mailto:support@clms.com?subject=${subject}&body=${body}`);
}

/**
 * Gets stored error reports from localStorage
 * @returns Array of stored error reports
 */
export function getStoredErrorReports(): ErrorReport[] {
  try {
    return JSON.parse(localStorage.getItem('clms_error_reports') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clears stored error reports from localStorage
 */
export function clearStoredErrorReports(): void {
  localStorage.removeItem('clms_error_reports');
}

/**
 * Converts various error-like payloads to a user-friendly message string
 */
export function toUserMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  const anyErr = err as any;
  if (anyErr?.message && typeof anyErr.message === 'string')
    return anyErr.message;
  if (anyErr?.error) {
    if (typeof anyErr.error === 'string') return anyErr.error;
    if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
  }
  if (anyErr?.response?.data?.error) {
    const e = anyErr.response.data.error;
    if (typeof e === 'string') return e;
    if (typeof e?.message === 'string') return e.message;
  }
  return 'An unexpected error occurred';
}
