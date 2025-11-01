/**
 * ErrorBoundary - React 19 compatible functional error boundary
 * 
 * This file replaces the original class-based ErrorBoundary with a functional
 * implementation using react-error-boundary. It maintains full backward compatibility
 * with the existing API while providing React 19 compatibility and modern hooks.
 * 
 * Migration completed: Class component -> Functional component with react-error-boundary
 * Original class component backed up as: ErrorBoundary.class.tsx
 */

export {
  ErrorBoundaryWrapper as default,
  ErrorBoundaryWrapper as ErrorBoundary,
  withErrorBoundary,
  useErrorBoundary
} from './ErrorBoundaryWrapper';

// Re-export fallback component for direct usage
export { ErrorBoundaryFallback } from './ErrorBoundaryFallback';

// Re-export error utilities for external usage
export {
  categorizeError,
  generateErrorId,
  reportError,
  checkConnection,
  handleReauthentication,
  refreshPage,
  goHome,
  sendDetailedReport,
  type ErrorType,
  type ErrorReport,
  type RecoverySuggestion
} from '@/utils/error-utils';