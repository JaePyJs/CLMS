/**
 * Type guard to check if an error is an Axios error with response data
 */
export function isAxiosError(error: unknown): error is {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'message' in error)
  );
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'An error occurred'
): string {
  if (isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      fallback
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

/**
 * Type guard for WebSocket message data
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}
