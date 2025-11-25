export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

export interface ApiErrorPayload {
  success?: boolean;
  error?: string | { message: string; [key: string]: any };
  message?: string;
  code?: string;
  timestamp?: string;
  validationErrors?: ValidationErrorDetail[];
  details?: Record<string, unknown>;
}

export interface AppApiError {
  status: number;
  message: string;
  code?: string | undefined;
  timestamp?: string | undefined;
  validationErrors: ValidationErrorDetail[];
  raw?: unknown | undefined;
}

export function normalizeApiError(
  status: number,
  payload: ApiErrorPayload | undefined,
  fallbackMessage: string
): AppApiError {
  const validationErrors = payload?.validationErrors ?? [];

  let message = fallbackMessage;
  let code = payload?.code;
  let timestamp = payload?.timestamp;

  if (payload?.error) {
    if (typeof payload.error === 'string') {
      message = payload.error;
    } else if (typeof payload.error === 'object' && payload.error !== null) {
      // Handle nested error object from backend
      const errObj = payload.error as any;
      if (errObj.message) message = errObj.message;
      if (errObj.code) code = errObj.code;
      if (errObj.timestamp) timestamp = errObj.timestamp;
    }
  } else if (payload?.message) {
    message = payload.message;
  }

  // Ensure message is a string
  if (typeof message !== 'string') {
    console.error('normalizeApiError: message is not a string!', message);
    message = JSON.stringify(message);
  }

  return {
    status,
    message,
    code,
    timestamp,
    validationErrors,
    raw: payload,
  };
}
