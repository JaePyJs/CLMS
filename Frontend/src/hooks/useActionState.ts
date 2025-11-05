import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ActionState {
  isLoading: boolean;
  error: string | null;
  data: any;
  progress: number;
  isCancelled: boolean;
}

interface ActionActions {
  start: (data?: any) => void;
  updateProgress: (progress: number) => void;
  complete: (data?: any) => void;
  error: (error: string) => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * Hook for managing action states (export, download, bulk operations, etc.)
 *
 * @param actionFn - Function that performs the action
 * @param options - Configuration options for the action
 * @returns [state, actions] - Current state and action methods
 *
 * @example
 * const [state, actions] = useActionState(
 *   async ({ format, data }) => {
 *     // Perform export operation
 *     const blob = await exportData(format, data);
 *     return blob;
 *   },
 *   {
 *     onSuccess: (blob) => {
 *       // Handle successful export
 *       downloadFile(blob, `export.${format}`);
 *     },
 *   }
 * );
 *
 * // Execute action
 * const handleExport = () => {
 *   actions.start({ format: 'csv', data: studentData });
 * };
 */
export function useActionState<T = any>(
  actionFn: (params: any) => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error | string) => void;
    onProgress?: (progress: number) => void;
    autoReset?: boolean;
    resetDelay?: number;
  } = {}
) {
  const {
    onSuccess,
    onError,
    onProgress,
    autoReset = true,
    resetDelay = 2000,
  } = options;

  const [state, setState] = useState<ActionState>({
    isLoading: false,
    error: null,
    data: null,
    progress: 0,
    isCancelled: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const start = useCallback(
    (params?: any) => {
      // Cancel any ongoing action
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setState({
        isLoading: true,
        error: null,
        data: null,
        progress: 0,
        isCancelled: false,
      });

      // Execute action
      const executeAction = async () => {
        try {
          const result = await actionFn({
            ...params,
            signal: abortControllerRef.current?.signal,
            onProgress: (progress: number) => {
              setState((prev) => ({ ...prev, progress }));
              onProgress?.(progress);
            },
          });

          if (!abortControllerRef.current?.signal.aborted) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              data: result,
              progress: 100,
            }));

            onSuccess?.(result);
          }
        } catch (error) {
          if (!abortControllerRef.current?.signal.aborted) {
            const errorMessage =
              error instanceof Error ? error.message : 'Action failed';

            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: errorMessage,
              progress: 0,
            }));

            onError?.(error instanceof Error ? error : new Error(errorMessage));
          }
        }
      };

      executeAction();

      // Auto reset if enabled
      if (autoReset && resetDelay > 0) {
        setTimeout(() => {
          reset();
        }, resetDelay);
      }
    },
    [actionFn, onSuccess, onError, onProgress, autoReset, resetDelay]
  );

  const updateProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  const complete = useCallback(
    (data?: T) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        data: data ?? prev.data,
        progress: 100,
        error: null,
      }));

      if (data !== undefined) {
        onSuccess?.(data);
      }
    },
    [onSuccess]
  );

  const error = useCallback(
    (errorMessage: string) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        progress: 0,
      }));

      onError?.(errorMessage);
    },
    [onError]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      isCancelled: true,
      progress: 0,
    }));

    toast.info('Action cancelled');
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      isLoading: false,
      error: null,
      data: null,
      progress: 0,
      isCancelled: false,
    });
  }, []);

  const actionHandlers: ActionActions = {
    start,
    updateProgress,
    complete,
    error,
    cancel,
    reset,
  };

  return [state, actionHandlers] as const;
}

/**
 * Hook for managing multiple action states
 *
 * @param actions - Object mapping action names to their configurations
 * @returns [states, actions] - States and actions for all operations
 *
 * @example
 * const [states, actions] = useMultipleActions({
 *   exportCSV: {
 *     actionFn: (params) => exportToCSV(params.data),
 *     onSuccess: (blob) => downloadFile(blob, 'export.csv'),
 *   },
 *   exportPDF: {
 *     actionFn: (params) => exportToPDF(params.data),
 *     onSuccess: (blob) => downloadFile(blob, 'export.pdf'),
 *   },
 *   deleteSelected: {
 *     actionFn: (params) => deleteItems(params.ids),
 *     onSuccess: () => toast.success('Items deleted'),
 *   },
 * });
 */
export function useMultipleActions<T extends Record<string, any>>(
  actions: Record<
    string,
    {
      actionFn: (params: any) => Promise<any>;
      onSuccess?: (data: any) => void;
      onError?: (error: Error | string) => void;
      onProgress?: (progress: number) => void;
      autoReset?: boolean;
      resetDelay?: number;
    }
  >
) {
  const [states, setStates] = useState<Record<keyof T, ActionState>>(() => {
    const initialStates = {} as Record<keyof T, ActionState>;
    Object.keys(actions).forEach((key) => {
      initialStates[key as keyof T] = {
        isLoading: false,
        error: null,
        data: null,
        progress: 0,
        isCancelled: false,
      };
    });
    return initialStates;
  });

  const actionFunctions = useRef(new Map<string, (params?: any) => void>());

  // Create individual action functions
  Object.entries(actions).forEach(([key, config]) => {
    const options: {
      onSuccess?: (data: any) => void;
      onError?: (error: Error | string) => void;
      onProgress?: (progress: number) => void;
      autoReset?: boolean;
      resetDelay?: number;
    } = {};

    // Use type guards to ensure we only assign defined values
    if (config.onSuccess !== undefined) {
      options.onSuccess = config.onSuccess;
    }
    if (config.onError !== undefined) {
      options.onError = config.onError;
    }
    if (config.onProgress !== undefined) {
      options.onProgress = config.onProgress;
    }
    if (config.autoReset !== undefined) {
      options.autoReset = config.autoReset;
    }
    if (config.resetDelay !== undefined) {
      options.resetDelay = config.resetDelay;
    }

    const [, actionActions] = useActionState(config.actionFn, options);

    // Store the start function
    actionFunctions.current.set(key, actionActions.start);

    // Update global state when individual state changes
    // Note: This is a simplified approach. In a real implementation,
    // you might want to use a more sophisticated state management approach
  });

  const startAction = useCallback((actionKey: string, params?: any) => {
    const actionFn = actionFunctions.current.get(actionKey);
    if (actionFn) {
      actionFn(params);
    }
  }, []);

  const cancelAction = useCallback((actionKey: string) => {
    // This would need to be implemented in the individual useActionState calls
    console.warn('Cancel action not implemented for individual actions');
    void actionKey;
  }, []);

  const cancelAll = useCallback(() => {
    // This would cancel all ongoing actions
    console.warn('Cancel all actions not implemented');
  }, []);

  const resetAction = useCallback((actionKey: string) => {
    // This would reset the specific action state
    setStates((prev) => ({
      ...prev,
      [actionKey]: {
        isLoading: false,
        error: null,
        data: null,
        progress: 0,
        isCancelled: false,
      },
    }));
  }, []);

  const resetAll = useCallback(() => {
    Object.keys(actions).forEach((key) => {
      resetAction(key);
    });
  }, [resetAction, actions]);

  const actionsRegistry: Record<string, ActionActions> = {};

  // Create action objects for each key
  Object.keys(actions).forEach((key) => {
    actionsRegistry[key] = {
      start: (params?: any) => startAction(key, params),
      cancel: () => cancelAction(key),
      reset: () => resetAction(key),
      updateProgress: (progress: number) => {
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            progress,
          },
        }));
      },
      complete: (data?: any) => {
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            isLoading: false,
            data,
            progress: 100,
            error: null,
          },
        }));
      },
      error: (errorMessage: string) => {
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            isLoading: false,
            error: errorMessage,
            progress: 0,
          },
        }));
      },
    };
  });

  const globalActions = {
    startAction,
    cancelAction,
    cancelAll,
    resetAction,
    resetAll,
  };

  return [states, { ...actions, ...globalActions }] as const;
}

/**
 * Hook for managing batch operations with progress tracking
 *
 * @param batchFn - Function that performs batch operations
 * @param options - Configuration for batch operations
 * @returns [state, actions] - State with batch progress and control actions
 *
 * @example
 * const [state, actions] = useBatchOperation(
 *   async ({ items, onProgress }) => {
 *     const results = [];
 *     for (let i = 0; i < items.length; i++) {
 *       const result = await processItem(items[i]);
 *       results.push(result);
 *       onProgress((i + 1) / items.length * 100);
 *     }
 *     return results;
 *   },
 *   {
 *     onSuccess: (results) => console.log('Batch completed:', results.length),
 *   }
 * );
 */
export function useBatchOperation<T = any>(
  batchFn: (params: {
    items: any[];
    onProgress: (progress: number) => void;
    signal?: AbortSignal;
  }) => Promise<T[]>,
  options: {
    onSuccess?: (results: T[]) => void;
    onError?: (error: Error) => void;
    onProgress?: (progress: number) => void;
    onItemComplete?: (item: any, index: number) => void;
    itemDelay?: number;
  } = {}
) {
  const {
    onSuccess,
    onError,
    onProgress,
    onItemComplete,
    itemDelay = 0,
  } = options;

  const [state, setState] = useState<{
    isRunning: boolean;
    progress: number;
    currentItem: number;
    totalItems: number;
    results: T[];
    errors: Array<{ item: any; error: string; index: number }>;
    isCancelled: boolean;
  }>({
    isRunning: false,
    progress: 0,
    currentItem: 0,
    totalItems: 0,
    results: [],
    errors: [],
    isCancelled: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to process individual items
  const processItem = useCallback(
    async (item: any, signal?: AbortSignal): Promise<T> => {
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      // This would call the actual batch function logic
      // For now, return a placeholder
      return item as T;
    },
    []
  );

  const start = useCallback(
    async (items: any[]) => {
      // Cancel any ongoing operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState({
        isRunning: true,
        progress: 0,
        currentItem: 0,
        totalItems: items.length,
        results: [],
        errors: [],
        isCancelled: false,
      });

      try {
        // Use the batchFn parameter properly
        const results: T[] = await batchFn({
          items,
          onProgress: (progress: number) => {
            setState((prev) => ({
              ...prev,
              progress,
              currentItem: Math.floor((progress / 100) * items.length),
            }));
            onProgress?.(progress);
          },
          signal: abortControllerRef.current?.signal,
        });

        const errors: Array<{ item: any; error: string; index: number }> = [];

        setState((prev) => ({
          ...prev,
          isRunning: false,
          progress: 100,
          currentItem: items.length,
          results,
          errors,
        }));

        onSuccess?.(results);
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : 'Batch operation failed';

          setState((prev) => ({
            ...prev,
            isRunning: false,
            isCancelled: abortControllerRef.current?.signal.aborted || false,
            error: errorMessage,
          }));

          onError?.(new Error(errorMessage));
        }
      }
    },
    [
      onSuccess,
      onError,
      onProgress,
      onItemComplete,
      itemDelay,
      processItem,
      batchFn,
    ]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState((prev) => ({
      ...prev,
      isCancelled: true,
      isRunning: false,
    }));
  }, []);

  const retry = useCallback(() => {
    if (state.totalItems > 0) {
      // This would need to store the original items
      console.warn('Retry requires original items to be stored');
    }
  }, [state.totalItems]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      isRunning: false,
      progress: 0,
      currentItem: 0,
      totalItems: 0,
      results: [],
      errors: [],
      isCancelled: false,
    });
  }, []);

  const actionHandlers = {
    start,
    cancel,
    retry,
    reset,
  };

  return [state, actionHandlers] as const;
}

export default useActionState;
