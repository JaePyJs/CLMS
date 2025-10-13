import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'

import { normalizeApiError, type ApiErrorPayload } from '@/lib/api/errors'

type AccessTokenProvider = () => string | null
type UnauthorizedHandler = (error: AxiosError) => Promise<void> | void

let accessTokenProvider: AccessTokenProvider = () => localStorage.getItem('clms_token')
let unauthorizedHandler: UnauthorizedHandler | null = null
let isHandlingUnauthorized = false

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

export function setupInterceptors(client: AxiosInstance) {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = accessTokenProvider?.()

    if (token) {
      config.headers = config.headers ?? {}
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (!error.response) {
        toast.error('Network error. Please check your connection.')
        return Promise.reject(error)
      }

      const { status, data } = error.response
      const apiPayload = (data as ApiErrorPayload | undefined)
      const normalizedError = normalizeApiError(
        status,
        apiPayload,
        'An unexpected error occurred',
      )

      ;(error as any).appError = normalizedError

      const showValidationToast =
        normalizedError.code === 'VALIDATION_ERROR' ||
        normalizedError.validationErrors.length > 0

      if (status === 401) {
        if (unauthorizedHandler && !isHandlingUnauthorized) {
          isHandlingUnauthorized = true
          try {
            await unauthorizedHandler(error)
          } finally {
            isHandlingUnauthorized = false
          }
        } else if (!isHandlingUnauthorized) {
          toast.error(normalizedError.message || 'Session expired. Please log in again.')
        }
      } else if (status === 403) {
        toast.error(normalizedError.message || 'Access denied')
      } else if (status === 404) {
        toast.error(normalizedError.message || 'Resource not found')
      } else if (status >= 500) {
        toast.error(normalizedError.message || 'Server error. Please try again later.')
      } else if (showValidationToast) {
        const firstError = normalizedError.validationErrors[0]
        const validationMessage = firstError
          ? `${firstError.field ? `${firstError.field}: ` : ''}${firstError.message}`
          : normalizedError.message

        toast.error(validationMessage || 'Validation failed')
      } else if (normalizedError.message) {
        toast.error(normalizedError.message)
      }

      return Promise.reject(Object.assign(error, { appError: normalizedError }))
    },
  )
}
