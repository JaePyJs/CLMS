import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ApiError, HttpMethod } from '@/types';

interface UseTypedApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
  retryCount?: number;
  retryDelay?: number;
  transform?: (data: unknown) => T;
  validate?: (data: T) => boolean;
}

interface TypedApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  lastFetched: Date | null;
  retryCount: number;
}

/**
 * Type-safe API hook with comprehensive error handling and retry logic
 */
export function useTypedApi<T>(
  config: {
    method: HttpMethod;
    url: string;
    data?: unknown;
    params?: Record<string, string | number>;
  },
  options: UseTypedApiOptions<T> = {}
) {
  const {
    immediate = true,
    onSuccess,
    onError,
    retryCount = 3,
    retryDelay = 1000,
    transform,
    validate,
  } = options;

  const [state, setState] = useState<TypedApiState<T>>({
    data: null,
    loading: immediate,
    error: null,
    lastFetched: null,
    retryCount: 0,
  });

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    async (customConfig?: typeof config) => {
      if (!mountedRef.current) {
        return;
      }

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const finalConfig = { ...config, ...customConfig };
        let response: any;

        // Use the appropriate public method based on HTTP method
        switch (finalConfig.method) {
          case 'GET':
            response = await apiClient.get<unknown>(
              finalConfig.url,
              finalConfig.params
            );
            break;
          case 'POST':
            response = await apiClient.post<unknown>(
              finalConfig.url,
              finalConfig.data,
              finalConfig.params ? { params: finalConfig.params } : {}
            );
            break;
          case 'PUT':
            response = await apiClient.put<unknown>(
              finalConfig.url,
              finalConfig.data,
              finalConfig.params ? { params: finalConfig.params } : {}
            );
            break;
          case 'PATCH':
            response = await apiClient.patch<unknown>(
              finalConfig.url,
              finalConfig.data,
              finalConfig.params ? { params: finalConfig.params } : {}
            );
            break;
          case 'DELETE':
            response = await apiClient.delete<unknown>(finalConfig.url);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${finalConfig.method}`);
        }

        if (!mountedRef.current) {
          return;
        }

        if (!response.success) {
          throw new Error(response.error || 'Request failed');
        }

        // Transform data if transformer provided
        let transformedData: T;
        if (transform) {
          transformedData = transform(response.data);
        } else {
          transformedData = response.data as T;
        }

        // Validate data if validator provided
        if (validate && !validate(transformedData)) {
          throw new Error('Data validation failed');
        }

        setState({
          data: transformedData,
          loading: false,
          error: null,
          lastFetched: new Date(),
          retryCount: 0,
        });

        onSuccess?.(transformedData);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        const apiError: ApiError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'REQUEST_FAILED',
          status: 500,
        };

        // Retry logic
        if (state.retryCount < retryCount) {
          setState((prev) => ({ ...prev, retryCount: prev.retryCount + 1 }));

          setTimeout(
            () => {
              if (mountedRef.current) {
                execute(customConfig);
              }
            },
            retryDelay * Math.pow(2, state.retryCount)
          ); // Exponential backoff
          return;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: apiError,
        }));

        onError?.(apiError);
      }
    },
    [
      config,
      transform,
      validate,
      onSuccess,
      onError,
      retryCount,
      retryDelay,
      state.retryCount,
    ]
  );

  // Immediate execution
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, retryCount: 0 }));
    execute();
  }, [execute]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetched: null,
      retryCount: 0,
    });
  }, []);

  return {
    ...state,
    execute,
    refetch,
    reset,
    canRetry: state.retryCount < retryCount,
  };
}

/**
 * Hook for paginated API calls with type safety
 */
export function useTypedPaginatedApi<T>(
  config: {
    url: string;
    method?: HttpMethod;
  },
  initialPage: number = 1,
  initialPageSize: number = 20
) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const paginatedConfig = {
    ...config,
    method: config.method || 'GET',
    params: {
      page,
      limit: pageSize,
    },
  };

  const result = useTypedApi<{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
  }>(paginatedConfig);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const nextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const changePageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page
  }, []);

  const totalPages = result.data?.totalPages || 0;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    ...result,
    page,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,
    data: result.data?.data || [],
    total: result.data?.total || 0,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
  };
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 */
export function useTypedMutation<TRequest, TResponse>(
  config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
  },
  options: {
    onSuccess?: (data: TResponse) => void;
    onError?: (error: ApiError) => void;
    onMutate?: (data: TRequest) => void;
    optimisticUpdate?: (data: TRequest) => void;
    rollbackOnError?: () => void;
  } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<TResponse | null>(null);

  const { onSuccess, onError, onMutate, optimisticUpdate, rollbackOnError } =
    options;

  const mutate = useCallback(
    async (requestData: TRequest) => {
      setLoading(true);
      setError(null);

      try {
        onMutate?.(requestData);

        // Apply optimistic update if provided
        if (optimisticUpdate) {
          optimisticUpdate(requestData);
        }

        let response: any;

        // Use the appropriate public method based on HTTP method
        switch (config.method) {
          case 'GET':
            response = await apiClient.get<TResponse>(config.url);
            break;
          case 'POST':
            response = await apiClient.post<TResponse>(config.url, requestData);
            break;
          case 'PUT':
            response = await apiClient.put<TResponse>(config.url, requestData);
            break;
          case 'PATCH':
            response = await apiClient.patch<TResponse>(
              config.url,
              requestData
            );
            break;
          case 'DELETE':
            response = await apiClient.delete<TResponse>(config.url);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${config.method}`);
        }

        if (!response.success) {
          throw new Error(response.error || 'Mutation failed');
        }

        setData(response.data ?? null);
        onSuccess?.(response.data!);
        return response.data!;
      } catch (err) {
        const apiError: ApiError = {
          message: err instanceof Error ? err.message : 'Mutation failed',
          code: 'MUTATION_FAILED',
          status: 500,
        };

        setError(apiError);
        onError?.(apiError);

        // Rollback optimistic update if provided
        if (rollbackOnError) {
          rollbackOnError();
        }

        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [config, onSuccess, onError, onMutate, optimisticUpdate, rollbackOnError]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    data,
    reset,
  };
}

/**
 * Hook for real-time data with polling
 */
export function useTypedRealTime<T>(config: {
  url: string;
  interval?: number;
}) {
  const { interval = 30000, ...apiOptions } = config;
  const [isPolling, setIsPolling] = useState(false);

  const result = useTypedApi<T>(
    {
      method: 'GET',
      url: config.url,
    },
    {
      ...apiOptions,
      immediate: false,
    }
  );

  const startPolling = useCallback(() => {
    setIsPolling(true);
    result.execute();
  }, [result]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (isPolling && interval > 0) {
      const intervalId = setInterval(() => {
        result.execute();
      }, interval);

      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [isPolling, interval, result]);

  return {
    ...result,
    isPolling,
    startPolling,
    stopPolling,
  };
}
