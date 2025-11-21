import type {
  ApiResponse,
  ApiRequestConfig,
  ApiError,
  HttpMethod,
  PaginatedResponse,
} from '@/types';

/**
 * Type-safe API client with enhanced error handling and request/response validation
 */
class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor({
    baseURL = '/api',
    timeout = 10000,
    defaultHeaders = {},
  }: {
    baseURL?: string;
    timeout?: number;
    defaultHeaders?: Record<string, string>;
  } = {}) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
  }

  private async request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    const {
      method,
      url,
      data,
      headers,
      params,
      timeout = this.timeout,
    } = config;

    // Build full URL
    const fullUrl = this.buildUrl(url, params);

    // Prepare request headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    // Add body for methods that support it
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      requestOptions.signal = controller.signal;

      const response = await fetch(fullUrl, requestOptions);
      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        return this.handleHttpError(response);
      }

      // Parse response
      const responseData = await this.parseResponse<T>(response);

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  private buildUrl(
    url: string,
    params?: Record<string, string | number>
  ): string {
    const baseUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${searchParams.toString()}`;
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      // Align with app's storage key for access token
      return (
        localStorage.getItem('clms_token') ||
        sessionStorage.getItem('clms_token')
      );
    }
    return null;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    // Handle other content types if needed
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async handleHttpError(
    response: Response
  ): Promise<ApiResponse<never>> {
    let errorData: unknown;

    try {
      errorData = await this.parseResponse(response);
    } catch {
      errorData = null;
    }

    const apiError: ApiError = {
      message:
        typeof errorData === 'object' && errorData && 'message' in errorData
          ? String(errorData.message)
          : `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      code: response.status.toString(),
      ...(typeof errorData === 'object' && errorData
        ? { details: errorData as Record<string, unknown> }
        : {}),
    };

    return {
      success: false,
      error: apiError.message,
    };
  }

  private handleNetworkError(error: unknown): ApiResponse<never> {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout. Please try again.',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'An unexpected error occurred.',
    };
  }

  // HTTP methods with proper typing
  async get<T>(
    url: string,
    params?: Record<string, string | number>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      ...(params ? { params } : {}),
    });
  }

  async post<T>(
    url: string,
    data?: unknown,
    options?: {
      headers?: Record<string, string>;
      params?: Record<string, string | number>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...(options?.headers ? { headers: options.headers } : {}),
      ...(options?.params ? { params: options.params } : {}),
    });
  }

  async put<T>(
    url: string,
    data?: unknown,
    options?: {
      headers?: Record<string, string>;
      params?: Record<string, string | number>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...(options?.headers ? { headers: options.headers } : {}),
      ...(options?.params ? { params: options.params } : {}),
    });
  }

  async patch<T>(
    url: string,
    data?: unknown,
    options?: {
      headers?: Record<string, string>;
      params?: Record<string, string | number>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      ...(options?.headers ? { headers: options.headers } : {}),
      ...(options?.params ? { params: options.params } : {}),
    });
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
    });
  }

  // Paginated request helper
  async getPaginated<T>(
    url: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: Record<string, string | number>
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    const params = {
      page,
      limit: pageSize,
      ...filters,
    };

    return this.get<PaginatedResponse<T>>(url, params);
  }

  // File upload helper
  async uploadFile<T>(
    url: string,
    file: File,
    options?: {
      method?: HttpMethod;
      additionalData?: Record<string, string>;
      onProgress?: (progress: number) => void;
    }
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.additionalData) {
      Object.entries(options.additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const requestHeaders: Record<string, string> = {};
    const token = this.getAuthToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: options?.method || 'POST',
        headers: requestHeaders,
        body: formData,
      });

      if (!response.ok) {
        return this.handleHttpError(response);
      }

      const data = await this.parseResponse<T>(response);

      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  // Download file helper
  async downloadFile(
    url: string,
    filename?: string,
    options?: {
      method?: HttpMethod;
      data?: unknown;
    }
  ): Promise<void> {
    const authToken = this.getAuthToken();
    const response = await fetch(`${this.baseURL}${url}`, {
      method: options?.method || 'GET',
      headers: {
        ...this.defaultHeaders,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      ...(options?.data ? { body: JSON.stringify(options.data) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(downloadUrl);
  }

  // Set default header
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  // Remove default header
  removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  // Set base URL
  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  // Set timeout
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}

// Create singleton instance
export const apiClient = new ApiClient({
  baseURL: '/api',
  timeout: 10000,
});

// Export class for custom instances
export { ApiClient };
export default apiClient;
