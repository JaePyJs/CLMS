import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAsyncDataOptions<T> {
  immediate?: boolean;
  retryCount?: number;
  retryDelay?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastFetched: Date | null;
}

/**
 * Custom hook for managing async data with React 18 patterns
 * Supports retry logic, error handling, and loading states
 */
export function useAsyncData<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
) {
  const {
    immediate = true,
    retryCount = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<AsyncDataState<T>>({
    data: null,
    loading: immediate,
    error: null,
    lastFetched: null,
  });

  const retryAttemptRef = useRef(0);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    if (!mountedRef.current) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await asyncFn();

      if (!mountedRef.current) return;

      setState({
        data,
        loading: false,
        error: null,
        lastFetched: new Date(),
      });

      retryAttemptRef.current = 0;
      onSuccess?.(data);
    } catch (error) {
      if (!mountedRef.current) return;

      const errorObj = error instanceof Error ? error : new Error('Unknown error');

      // Retry logic
      if (retryAttemptRef.current < retryCount) {
        retryAttemptRef.current++;
        setTimeout(() => {
          if (mountedRef.current) {
            execute();
          }
        }, retryDelay * retryAttemptRef.current);
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorObj,
      }));

      onError?.(errorObj);
    }
  }, [asyncFn, retryCount, retryDelay, onSuccess, onError]);

  // Immediate execution
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  // Refetch function
  const refetch = useCallback(() => {
    retryAttemptRef.current = 0;
    execute();
  }, [execute]);

  // Reset function
  const reset = useCallback(() => {
    retryAttemptRef.current = 0;
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetched: null,
    });
  }, []);

  return {
    ...state,
    execute,
    refetch,
    reset,
    retryAttempt: retryAttemptRef.current,
  };
}

/**
 * Custom hook for paginated async data
 */
export function useAsyncPaginatedData<T>(
  asyncFn: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options: UseAsyncDataOptions<{ data: T[]; total: number }> & {
    pageSize?: number;
  } = {}
) {
  const { pageSize = 20, ...asyncOptions } = options;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);

  const paginatedAsyncFn = useCallback(() => asyncFn(page, limit), [asyncFn, page, limit]);

  const result = useAsyncData(paginatedAsyncFn, asyncOptions);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const changePageSize = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page
  }, []);

  const totalPages = result.data ? Math.ceil(result.data.total / limit) : 0;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    ...result,
    page,
    limit,
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
 * Custom hook for cached async data with React 18 Suspense support
 */
export function useSuspenseData<T>(
  key: string,
  asyncFn: () => Promise<T>
): T {
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = useCallback(() => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, [key]);

  const setCachedData = useCallback((data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, [key]);

  const cachedData = getCachedData();

  if (cachedData !== null) {
    return cachedData;
  }

  // Throw promise for Suspense
  const promise = asyncFn().then((data) => {
    setCachedData(data);
    return data;
  });

  throw promise;
}