import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface RefreshOptions {
  enabled?: boolean;
  interval?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  retryOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  initialData?: any;
}

interface RefreshState {
  isRefreshing: boolean;
  lastRefreshTime: Date | null;
  error: Error | null;
  refreshCount: number;
  data: any;
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
 *     onSuccess: (data) => console.log('Data refreshed:', data),
 *   }
 * );
 * 
 * // Manual refresh
 * const handleRefresh = () => actions.refresh();
 */
export function useDataRefresh<T>(
  queryFn: () => Promise<T>,
  options: RefreshOptions & {
    initialData?: T;
  } = {}
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

  const [state, setState] = useState<RefreshState>({
    isRefreshing: false,
    lastRefreshTime: null,
    error: null,
    refreshCount: 0,
    data: initialData,
  });

  const queryFnRef = useRef(queryFn);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (state.isRefreshing) return;

    try {
      setState(prev => ({
        ...prev,
        isRefreshing: true,
        error: null,
      }));

      const data = await queryFnRef.current();

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        isRefreshing: false,
        lastRefreshTime: new Date(),
        data,
        refreshCount: prev.refreshCount + 1,
      }));

      onSuccess?.(data);
    } catch (error) {
      if (!mountedRef.current) return;

      const err = error instanceof Error ? error : new Error('Refresh failed');
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: err,
      }));

      onError?.(err);
    }
  }, [state.isRefreshing, onSuccess, onError]);

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
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Set up interval polling
  useEffect(() => {
    if (!enabled || !interval) return;

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
  useEffect(() => {
    if (enabled && retryOnMount && !state.data) {
      fetchData(false);
    }
  }, [enabled, retryOnMount, state.data, fetchData]);

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

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
    if (!refetchOnReconnect) return;

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
export function useBatchRefresh(
  refreshConfigs: Array<{
    key: string;
    queryFn: () => Promise<any>;
    options?: RefreshOptions;
  }>
) {
  const [states, setStates] = useState<Record<string, RefreshState>>(() => {
    const initialStates = {} as Record<string, RefreshState>;
    refreshConfigs.forEach(config => {
      initialStates[config.key] = {
        isRefreshing: false,
        lastRefreshTime: null,
        error: null,
        refreshCount: 0,
        data: config.options?.initialData,
      };
    });
    return initialStates;
  });

  const refreshFunctions = useRef(new Map<string, () => Promise<void>>());
  const mountedRef = useRef(true);

  // Create individual refresh functions
  refreshConfigs.forEach(config => {
    const refreshFn = useDataRefresh(config.queryFn, {
      enabled: true,
      ...config.options,
      onSuccess: (data) => {
        if (!mountedRef.current) return;
        
        setStates(prev => ({
          ...prev,
          [config.key]: {
            ...prev[config.key],
            data,
            lastRefreshTime: new Date(),
            isRefreshing: false,
            refreshCount: (prev[config.key]?.refreshCount || 0) + 1,
            error: null,
          } as RefreshState,
        }));

        config.options?.onSuccess?.(data);
      },
      onError: (error) => {
        if (!mountedRef.current) return;

        setStates(prev => ({
          ...prev,
          [config.key]: {
            ...prev[config.key],
            error,
            isRefreshing: false,
            lastRefreshTime: new Date(),
            refreshCount: (prev[config.key]?.refreshCount || 0) + 1,
            data: prev[config.key]?.data || null,
          } as RefreshState,
        }));

        config.options?.onError?.(error);
      },
    })[1].refresh;

    refreshFunctions.current.set(config.key, async () => await refreshFn());
  });

  const refreshAll = useCallback(async () => {
    const promises = Array.from(refreshFunctions.current.values()).map(fn => fn());
    await Promise.allSettled(promises);
  }, []);

  const refreshByKey = useCallback((key: string) => {
    const refreshFn = refreshFunctions.current.get(key);
    if (refreshFn) {
      refreshFn();
    }
  }, []);

  const clearErrorByKey = useCallback((key: string) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        error: null,
        isRefreshing: prev[key]?.isRefreshing || false,
        lastRefreshTime: prev[key]?.lastRefreshTime || null,
        refreshCount: prev[key]?.refreshCount || 0,
        data: prev[key]?.data || null,
      } as RefreshState,
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setStates(prev => {
      const newStates = { ...prev };
      Object.keys(newStates).forEach(key => {
        newStates[key] = {
          ...newStates[key],
          error: null,
          isRefreshing: newStates[key]?.isRefreshing || false,
          lastRefreshTime: newStates[key]?.lastRefreshTime || null,
          refreshCount: newStates[key]?.refreshCount || 0,
          data: newStates[key]?.data || null,
        } as RefreshState;
      });
      return newStates;
    });
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const actions = {
    refreshAll,
    refreshByKey,
    clearErrorByKey,
    clearAllErrors,
  };

  return [states, actions] as const;
}

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
    maxAge = 30 * 60 * 1000,   // 30 minutes
    ...refreshOptions
  } = options;

  const [refreshState, refreshActions] = useDataRefresh(queryFn, {
    ...refreshOptions,
    initialData: options.initialData,
  });

  const isStale = useCallback(() => {
    if (!refreshState.lastRefreshTime) return true;
    
    const timeSinceRefresh = Date.now() - refreshState.lastRefreshTime.getTime();
    return timeSinceRefresh > staleTime;
  }, [refreshState.lastRefreshTime, staleTime]);

  const isExpired = useCallback(() => {
    if (!refreshState.lastRefreshTime) return true;
    
    const timeSinceRefresh = Date.now() - refreshState.lastRefreshTime.getTime();
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
export function useOptimisticRefresh(
  queryKey: string[],
  queryFn: () => Promise<any>
) {
  const queryClient = useQueryClient();
  const [refreshState, refreshActions] = useDataRefresh(queryFn);

  const updateOptimistically = useCallback(
    (updater: (oldData: any) => any) => {
      // Get current data
      const currentData = queryClient.getQueryData(queryKey);
      
      // Update optimistically
      queryClient.setQueryData(queryKey, (old: any) => {
        return updater(old);
      });

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, queryKey]
  );

  const addOptimisticItem = useCallback(
    (item: any, getId: (item: any) => string = (item) => item.id) => {
      updateOptimistically((oldData) => {
        if (!Array.isArray(oldData)) return [item];
        const existingIndex = oldData.findIndex(existing => getId(existing) === getId(item));
        
        if (existingIndex >= 0) {
          // Update existing item
          return oldData.map(existing => 
            getId(existing) === getId(item) ? item : existing
          );
        } else {
          // Add new item
          return [...oldData, item];
        }
      });
    },
    [updateOptimistically]
  );

  const removeOptimisticItem = useCallback(
    (itemId: string, getId: (item: any) => string = (item) => item.id) => {
      updateOptimistically((oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter(item => getId(item) !== itemId);
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
    }
  ] as const;
}

export default useDataRefresh;