export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

export interface ApiErrorPayload {
  success?: boolean;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
  validationErrors?: ValidationErrorDetail[];
  details?: Record<string, unknown>;
}

export interface AppApiError {
  status: number;
  message: string;
  code?: string;
  timestamp?: string;
  validationErrors: ValidationErrorDetail[];
  raw?: unknown;
}

export function normalizeApiError(
  status: number,
  payload: ApiErrorPayload | undefined,
  fallbackMessage: string,
): AppApiError {
  const validationErrors = payload?.validationErrors ?? [];

  return {
    status,
    message: payload?.error || payload?.message || fallbackMessage,
    code: payload?.code,
    timestamp: payload?.timestamp,
    validationErrors,
    raw: payload,
  };
}
