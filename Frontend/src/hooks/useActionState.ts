import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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

const createDefaultActionState = (): ActionState => ({
  isLoading: false,
  error: null,
  data: null,
  progress: 0,
  isCancelled: false,
});

interface MultipleActionConfig<TResult = any> {
  actionFn: (params: any) => Promise<TResult>;
  onSuccess?: (data: TResult) => void;
  onError?: (error: Error | string) => void;
  onProgress?: (progress: number) => void;
  autoReset?: boolean;
  resetDelay?: number;
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
export function useMultipleActions<
  TConfig extends Record<string, MultipleActionConfig<any>>,
>(actions: TConfig) {
  const actionEntries = useMemo(
    () => Object.entries(actions) as Array<[string, MultipleActionConfig<any>]>,
    [actions]
  );

  const actionKeys = useMemo(
    () => actionEntries.map(([key]) => key),
    [actionEntries]
  );

  const [states, setStates] = useState<Record<string, ActionState>>(() => {
    const initialStates: Record<string, ActionState> = {};
    actionKeys.forEach((key) => {
      initialStates[key] = createDefaultActionState();
    });
    return initialStates;
  });

  useEffect(() => {
    setStates((prev) => {
      const next: Record<string, ActionState> = {};
      actionKeys.forEach((key) => {
        next[key] = prev[key] ?? createDefaultActionState();
      });
      return next;
    });
  }, [actionKeys]);

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const controllersRef = useRef(new Map<string, AbortController>());
  const autoResetTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  useEffect(() => {
    return () => {
      controllersRef.current.forEach((controller) => controller.abort());
      autoResetTimersRef.current.forEach((timeoutId) =>
        clearTimeout(timeoutId)
      );
      controllersRef.current.clear();
      autoResetTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const validKeys = new Set(actionKeys);
    controllersRef.current.forEach((controller, key) => {
      if (!validKeys.has(key)) {
        controller.abort();
        controllersRef.current.delete(key);
      }
    });
    autoResetTimersRef.current.forEach((timeoutId, key) => {
      if (!validKeys.has(key)) {
        clearTimeout(timeoutId);
        autoResetTimersRef.current.delete(key);
      }
    });
  }, [actionKeys]);

  const updateActionState = useCallback(
    (actionKey: string, updater: (current: ActionState) => ActionState) => {
      setStates((prev) => {
        const current = prev[actionKey] ?? createDefaultActionState();
        return {
          ...prev,
          [actionKey]: updater(current),
        };
      });
    },
    []
  );

  const clearAutoResetTimeout = useCallback((actionKey: string) => {
    const timeout = autoResetTimersRef.current.get(actionKey);
    if (timeout) {
      clearTimeout(timeout);
      autoResetTimersRef.current.delete(actionKey);
    }
  }, []);

  const resetAction = useCallback(
    (actionKey: string) => {
      clearAutoResetTimeout(actionKey);
      const controller = controllersRef.current.get(actionKey);
      if (controller) {
        controller.abort();
        controllersRef.current.delete(actionKey);
      }
      setStates((prev) => ({
        ...prev,
        [actionKey]: createDefaultActionState(),
      }));
    },
    [clearAutoResetTimeout]
  );

  const resetAll = useCallback(() => {
    actionKeys.forEach((key) => resetAction(key));
  }, [actionKeys, resetAction]);

  const updateProgress = useCallback(
    (actionKey: string, progress: number) => {
      const clamped = Math.max(0, Math.min(100, progress));
      updateActionState(actionKey, (current) => ({
        ...current,
        progress: clamped,
      }));
      const config = actionsRef.current[actionKey];
      config?.onProgress?.(clamped);
    },
    [updateActionState]
  );

  const completeAction = useCallback(
    (actionKey: string, data?: any) => {
      updateActionState(actionKey, (current) => ({
        ...current,
        isLoading: false,
        data: data ?? current.data,
        error: null,
        progress: 100,
        isCancelled: false,
      }));
      if (data !== undefined) {
        const config = actionsRef.current[actionKey];
        config?.onSuccess?.(data);
      }
    },
    [updateActionState]
  );

  const failAction = useCallback(
    (actionKey: string, errorValue: Error | string) => {
      const message =
        errorValue instanceof Error ? errorValue.message : errorValue;
      updateActionState(actionKey, (current) => ({
        ...current,
        isLoading: false,
        error: message,
        progress: 0,
      }));
      const config = actionsRef.current[actionKey];
      config?.onError?.(errorValue);
    },
    [updateActionState]
  );

  const scheduleAutoReset = useCallback(
    (actionKey: string, delay: number) => {
      if (delay <= 0) {
        resetAction(actionKey);
        return;
      }

      clearAutoResetTimeout(actionKey);
      const timeoutId = setTimeout(() => {
        autoResetTimersRef.current.delete(actionKey);
        resetAction(actionKey);
      }, delay);
      autoResetTimersRef.current.set(actionKey, timeoutId);
    },
    [clearAutoResetTimeout, resetAction]
  );

  const startAction = useCallback(
    (actionKey: string, params?: any) => {
      const config = actionsRef.current[actionKey];
      if (!config) {
        console.warn(`Action "${actionKey}" not found in useMultipleActions`);
        return;
      }

      clearAutoResetTimeout(actionKey);
      const existingController = controllersRef.current.get(actionKey);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      controllersRef.current.set(actionKey, controller);

      updateActionState(actionKey, () => ({
        isLoading: true,
        error: null,
        data: null,
        progress: 0,
        isCancelled: false,
      }));

      const shouldAutoReset = config.autoReset ?? true;
      const autoResetDelay = config.resetDelay ?? 2000;

      const execute = async () => {
        try {
          const result = await config.actionFn({
            ...(params ?? {}),
            signal: controller.signal,
            onProgress: (progress: number) => {
              updateProgress(actionKey, progress);
            },
          });

          if (!controller.signal.aborted) {
            completeAction(actionKey, result);
            if (shouldAutoReset) {
              scheduleAutoReset(actionKey, autoResetDelay);
            }
          }
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          const normalisedError =
            error instanceof Error ? error : new Error('Action failed');

          failAction(actionKey, normalisedError);
          if (shouldAutoReset) {
            scheduleAutoReset(actionKey, autoResetDelay);
          }
        }
      };

      void execute();
    },
    [
      clearAutoResetTimeout,
      updateActionState,
      updateProgress,
      completeAction,
      failAction,
      scheduleAutoReset,
    ]
  );

  const cancelAction = useCallback(
    (actionKey: string) => {
      const controller = controllersRef.current.get(actionKey);
      if (controller) {
        controller.abort();
        controllersRef.current.delete(actionKey);
      }

      clearAutoResetTimeout(actionKey);

      updateActionState(actionKey, (current) => ({
        ...current,
        isLoading: false,
        isCancelled: true,
        progress: 0,
      }));

      toast.info(`Action ${actionKey} cancelled`);
    },
    [clearAutoResetTimeout, updateActionState]
  );

  const cancelAll = useCallback(() => {
    actionKeys.forEach((key) => cancelAction(key));
  }, [actionKeys, cancelAction]);

  const actionsRegistry = useMemo(() => {
    const registry: Record<string, ActionActions> = {};
    actionKeys.forEach((key) => {
      registry[key] = {
        start: (params?: any) => startAction(key, params),
        cancel: () => cancelAction(key),
        reset: () => resetAction(key),
        updateProgress: (progress: number) => updateProgress(key, progress),
        complete: (data?: any) => completeAction(key, data),
        error: (message: string) => failAction(key, message),
      };
    });
    return registry;
  }, [
    actionKeys,
    startAction,
    cancelAction,
    resetAction,
    updateProgress,
    completeAction,
    failAction,
  ]);

  const globalActions = useMemo(
    () => ({
      startAction: (key: keyof TConfig, params?: any) =>
        startAction(String(key), params),
      cancelAction: (key: keyof TConfig) => cancelAction(String(key)),
      cancelAll,
      resetAction: (key: keyof TConfig) => resetAction(String(key)),
      resetAll,
    }),
    [startAction, cancelAction, cancelAll, resetAction, resetAll]
  );

  return [
    states as Record<keyof TConfig, ActionState>,
    {
      ...(actionsRegistry as Record<keyof TConfig, ActionActions>),
      ...globalActions,
    },
  ] as const;
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
 *     onSuccess: (results) => console.debug('Batch completed:', results.length),
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
