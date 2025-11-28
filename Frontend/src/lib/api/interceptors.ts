import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'sonner';

import { normalizeApiError, type ApiErrorPayload } from '@/lib/api/errors';

type AccessTokenProvider = () => string | null;
type UnauthorizedHandler = (error: AxiosError) => Promise<void> | void;

let accessTokenProvider: AccessTokenProvider = () =>
  localStorage.getItem('clms_token');
let unauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;

// CSRF token management - DISABLED
let csrfToken: string | null = null;
// let csrfFetchPromise: Promise<void> | null = null;

// async function fetchCsrfToken(): Promise<void> {
//   if (csrfFetchPromise) {
//     return csrfFetchPromise;
//   }

//   csrfFetchPromise = (async () => {
//     try {
//       const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
//       const response = await fetch(`${apiUrl}/api/csrf-token`, {
//         credentials: 'include',
//       });
//       const data = await response.json();
//       csrfToken = data.csrfToken;
//     } catch (error) {
//       console.error('Failed to fetch CSRF token:', error);
//       csrfToken = null;
//     } finally {
//       csrfFetchPromise = null;
//     }
//   })();

//   return csrfFetchPromise;
// }

// Fetch CSRF token on module load
// fetchCsrfToken();

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function setupInterceptors(client: AxiosInstance) {
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = accessTokenProvider?.();

      if (token) {
        if (!config.headers) {
          config.headers = {} as any;
        }
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // Add CSRF token for state-changing requests
      const method = config.method?.toUpperCase();
      if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        // if (!csrfToken) {
        //   await fetchCsrfToken();
        // }
        // if (csrfToken) {
        //   if (!config.headers) {
        //     config.headers = {} as any;
        //   }
        //   (config.headers as any)['X-CSRF-Token'] = csrfToken;
        // }
      }

      // Always send credentials for cookie-based flows
      (config as any).withCredentials = true;

      const existingCid =
        (config.headers as any)?.['x-correlation-id'] ||
        (config.headers as any)?.['x-request-id'];
      if (!existingCid) {
        const cid =
          typeof crypto !== 'undefined' &&
          typeof (crypto as any).randomUUID === 'function'
            ? (crypto as any).randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        (config.headers as any)['x-correlation-id'] = cid;
      }

      return config;
    }
  );

  client.interceptors.response.use(
    (response) => {
      // Treat 304 for auth/me as a success using cached user
      try {
        const url = response?.config?.url || '';
        if (response.status === 304 && url.includes('/api/auth/me')) {
          const cached =
            localStorage.getItem('clms_user') ||
            sessionStorage.getItem('clms_user');
          if (cached) {
            const user = JSON.parse(cached);
            // Normalize to ApiResponse shape expected by callers
            (response as any).data = {
              success: true,
              data: user,
            };
          } else {
            (response as any).data = {
              success: false,
              message: 'Not modified and no cached user',
            };
          }
        }
      } catch (e) {
        // Non-fatal; fall through
      }
      return response;
    },
    async (error: AxiosError) => {
      if (!error.response) {
        toast.error('Network error. Please check your connection.');
        return Promise.reject(error);
      }

      const { status, data } = error.response;
      const url = error.response?.config?.url || '';
      const apiPayload = data as ApiErrorPayload | undefined;
      const normalizedError = normalizeApiError(
        status,
        apiPayload,
        'An unexpected error occurred'
      );

      (error as any).appError = normalizedError;

      const showValidationToast =
        normalizedError.code === 'VALIDATION_ERROR' ||
        normalizedError.validationErrors.length > 0;

      if (status === 401) {
        if (unauthorizedHandler && !isHandlingUnauthorized) {
          isHandlingUnauthorized = true;
          try {
            await unauthorizedHandler(error);
          } finally {
            isHandlingUnauthorized = false;
          }
        } else if (!isHandlingUnauthorized) {
          toast.error(
            normalizedError.message || 'Session expired. Please log in again.'
          );
        }
      } else if (status === 429) {
        toast.error(
          normalizedError.message || 'Too many requests. Please wait.'
        );
      } else if (status === 403) {
        // CSRF token might be invalid - refresh it
        if (
          normalizedError.message?.includes('CSRF') ||
          normalizedError.message?.includes('csrf')
        ) {
          // await fetchCsrfToken();
          toast.error('Security token expired. Please try again.');
        } else {
          toast.error(normalizedError.message || 'Access denied');
        }
      } else if (status === 404) {
        toast.error(normalizedError.message || 'Resource not found');
      } else if (status === 400) {
        // Bad request - log details for debugging
        console.error('🔴 400 Bad Request:', {
          url,
          status,
          message: normalizedError.message,
          data: apiPayload,
        });
        // Don't show generic toast here - let the specific error handler in the hook show it
      } else if (status >= 500) {
        // Suppress noisy toasts for auth/me failures; UI will handle via cache
        if (!url.includes('/api/auth/me')) {
          toast.error(
            normalizedError.message || 'Server error. Please try again later.'
          );
        }
      } else if (showValidationToast) {
        const firstError = normalizedError.validationErrors[0];
        const validationMessage = firstError
          ? `${firstError.field ? `${firstError.field}: ` : ''}${firstError.message}`
          : normalizedError.message;

        toast.error(validationMessage || 'Validation failed');
      } else if (normalizedError.message) {
        toast.error(normalizedError.message);
      }

      return Promise.reject(
        Object.assign(error, { appError: normalizedError })
      );
    }
  );
}
