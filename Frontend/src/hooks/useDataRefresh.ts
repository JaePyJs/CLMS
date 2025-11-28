import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface RefreshOptions<T = unknown> {
  enabled?: boolean;
  interval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retryOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  initialData?: T;
}

interface RefreshState<T = unknown> {
  isRefreshing: boolean;
  lastRefreshTime: Date | null;
  error: Error | null;
  refreshCount: number;
  data: T | null;
}

/**
 * Hook for managing data refresh and polling patterns
 *
 * @param queryFn - Function that fetches the data
 * @param options - Configuration options for refresh behavior
 * @returns [state, actions] - Current state and refresh actions
 *
 * @example
 * const [state, actions] = useDataRefresh(
 *   () => studentsApi.getStudents(),
 *   {
 *     interval: 30000,
 *     onSuccess: (data) => console.debug('Data refreshed:', data),
 *   }
 * );
 *
 * // Manual refresh
 * const handleRefresh = () => actions.refresh();
 */
export function useDataRefresh<T>(
  queryFn: () => Promise<T>,
  options: RefreshOptions<T> = {}
) {
  const {
    enabled = true,
    interval,
    onSuccess,
    onError,
    retryOnMount = true,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    initialData,
  } = options;

  const [state, setState] = useState<RefreshState<T>>({
    isRefreshing: false,
    lastRefreshTime: null,
    error: null,
    refreshCount: 0,
    data: initialData ?? null,
  });

  const queryFnRef = useRef(queryFn);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const fetchData = useCallback(
    async (_isManualRefresh = false) => {
      if (state.isRefreshing) {
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          isRefreshing: true,
          error: null,
        }));

        const data = await queryFnRef.current();

        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          lastRefreshTime: new Date(),
          data,
          refreshCount: prev.refreshCount + 1,
        }));

        onSuccess?.(data);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        const err =
          error instanceof Error ? error : new Error('Refresh failed');

        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          error: err,
        }));

        onError?.(err);
      }
    },
    [state.isRefreshing, onSuccess, onError]
  );

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const toggleRefresh = useCallback(() => {
    if (state.isRefreshing) {
      // Cancel current refresh
      return;
    }
    refresh();
  }, [state.isRefreshing, refresh]);

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Set up interval polling
  useEffect(() => {
    if (!enabled || !interval) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval
    intervalRef.current = setInterval(() => {
      if (!state.isRefreshing) {
        fetchData(false);
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, state.isRefreshing, fetchData]);

  // Initial fetch
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (enabled && retryOnMount && !state.data && !initialFetchDone.current) {
      // console.log removed('useDataRefresh: Initial fetch triggered');
      initialFetchDone.current = true;
      fetchData(false);
    } else {
      /* // console.log removed('useDataRefresh: Initial fetch skipped', {
        enabled,
        retryOnMount,
        hasData: !!state.data,
        alreadyFetched: initialFetchDone.current
      }); */
    }
  }, [enabled, retryOnMount, state.data, fetchData]);

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus) {
      return;
    }

    const handleFocus = () => {
      if (enabled && !state.isRefreshing) {
        fetchData(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [enabled, refetchOnWindowFocus, state.isRefreshing, fetchData]);

  // Reconnect refetch
  useEffect(() => {
    if (!refetchOnReconnect) {
      return;
    }

    const handleOnline = () => {
      if (enabled && !state.isRefreshing) {
        fetchData(false);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [enabled, refetchOnReconnect, state.isRefreshing, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const actions = {
    refresh,
    toggleRefresh,
    clearError,
  };

  return [state, actions] as const;
}

/**
 * Hook for managing batch refresh operations
 *
 * @param refreshConfigs - Array of refresh configurations
 * @returns [states, actions] - States and actions for all refresh operations
 *
 * @example
 * const [states, actions] = useBatchRefresh([
 *   {
 *     key: 'students',
 *     queryFn: () => studentsApi.getStudents(),
 *     interval: 30000,
 *   },
 *   {
 *     key: 'equipment',
 *     queryFn: () => equipmentApi.getEquipment(),
 *     interval: 10000,
 *   },
 * ]);
 *
 * // Refresh all
 * const refreshAll = () => actions.refreshAll();
 */

/**
 * Hook for managing smart refresh based on data staleness
 *
 * @param queryFn - Function that fetches the data
 * @param options - Configuration for smart refresh
 * @returns [state, actions] - State with staleness info and refresh actions
 *
 * @example
 * const [state, actions] = useSmartRefresh(
 *   () => analyticsApi.getMetrics(),
 *   {
 *     staleTime: 5 * 60 * 1000, // 5 minutes
 *     maxAge: 30 * 60 * 1000, // 30 minutes
 *   }
 * );
 */
export function useSmartRefresh<T>(
  queryFn: () => Promise<T>,
  options: RefreshOptions & {
    staleTime?: number;
    maxAge?: number;
    initialData?: T;
  } = {}
) {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    maxAge = 30 * 60 * 1000, // 30 minutes
    ...refreshOptions
  } = options;

  const [refreshState, refreshActions] = useDataRefresh(queryFn, {
    ...refreshOptions,
    initialData: options.initialData,
  });

  const isStale = useCallback(() => {
    if (!refreshState.lastRefreshTime) {
      return true;
    }

    const timeSinceRefresh =
      Date.now() - refreshState.lastRefreshTime.getTime();
    return timeSinceRefresh > staleTime;
  }, [refreshState.lastRefreshTime, staleTime]);

  const isExpired = useCallback(() => {
    if (!refreshState.lastRefreshTime) {
      return true;
    }

    const timeSinceRefresh =
      Date.now() - refreshState.lastRefreshTime.getTime();
    return timeSinceRefresh > maxAge;
  }, [refreshState.lastRefreshTime, maxAge]);

  const shouldRefresh = useCallback(() => {
    return isStale() || (refreshState.error && !refreshState.isRefreshing);
  }, [isStale, refreshState.error, refreshState.isRefreshing]);

  const smartRefresh = useCallback(() => {
    if (shouldRefresh()) {
      refreshActions.refresh();
    }
  }, [shouldRefresh, refreshActions]);

  // Auto-refresh when data becomes stale
  useEffect(() => {
    if (isStale() && !refreshState.isRefreshing) {
      smartRefresh();
    }
  }, [isStale, refreshState.isRefreshing, smartRefresh]);

  const state = {
    ...refreshState,
    isStale: isStale(),
    isExpired: isExpired(),
    shouldRefresh: shouldRefresh(),
  };

  const actions = {
    ...refreshActions,
    smartRefresh,
    isStale,
    isExpired,
    shouldRefresh,
  };

  return [state, actions] as const;
}

/**
 * Hook for managing optimistic updates with refresh coordination
 *
 * @param queryKey - React Query key for the data
 * @param queryFn - Function that fetches the data
 * @returns [optimisticState, actions] - State with optimistic update support
 */
export function useOptimisticRefresh<T>(
  queryKey: string[],
  queryFn: () => Promise<T>
) {
  const queryClient = useQueryClient();
  const [refreshState, refreshActions] = useDataRefresh(queryFn);

  const updateOptimistically = useCallback(
    (updater: (oldData: T) => T) => {
      // Get current data
      const _currentData = queryClient.getQueryData(queryKey);

      // Update optimistically
      queryClient.setQueryData(queryKey, (old: T) => {
        return updater(old);
      });

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, queryKey]
  );

  const addOptimisticItem = useCallback(
    <Item extends { id?: string }>(
      item: Item,
      getId: (item: Item) => string = (item) => item.id ?? ''
    ) => {
      updateOptimistically((oldData) => {
        if (!Array.isArray(oldData)) {
          return [item] as T;
        }
        const existingIndex = (oldData as Item[]).findIndex(
          (existing) => getId(existing) === getId(item)
        );

        if (existingIndex >= 0) {
          // Update existing item
          return (oldData as Item[]).map((existing) =>
            getId(existing) === getId(item) ? item : existing
          ) as T;
        } else {
          // Add new item
          return [...(oldData as Item[]), item] as T;
        }
      });
    },
    [updateOptimistically]
  );

  const removeOptimisticItem = useCallback(
    <Item extends { id?: string }>(
      itemId: string,
      getId: (item: Item) => string = (item) => item.id ?? ''
    ) => {
      updateOptimistically((oldData) => {
        if (!Array.isArray(oldData)) {
          return oldData;
        }
        return (oldData as Item[]).filter(
          (item) => getId(item) !== itemId
        ) as T;
      });
    },
    [updateOptimistically]
  );

  return [
    refreshState,
    {
      ...refreshActions,
      updateOptimistically,
      addOptimisticItem,
      removeOptimisticItem,
    },
  ] as const;
}

export default useDataRefresh;
