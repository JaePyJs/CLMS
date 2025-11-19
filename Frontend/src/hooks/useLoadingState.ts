import { useState, useCallback } from 'react';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  data: any;
}

interface LoadingActions {
  start: () => void;
  finish: (data?: any) => void;
  error: (error: string) => void;
  reset: () => void;
}

/**
 * Hook for managing loading states consistently across components
 *
 * @param initialState - Initial loading state
 * @returns [state, actions] - Current state and actions to modify it
 *
 * @example
 * const [state, actions] = useLoadingState();
 *
 * // In async operation
 * actions.start();
 * try {
 *   const result = await fetchData();
 *   actions.finish(result);
 * } catch (error) {
 *   actions.error('Failed to fetch data');
 * }
 */
export function useLoadingState(initialState: Partial<LoadingState> = {}) {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    data: null,
    ...initialState,
  });

  const start = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
  }, []);

  const finish = useCallback((data?: any) => {
    setState((prev) => ({
      ...prev,
      isLoading: false,
      data: data ?? prev.data,
      error: null,
    }));
  }, []);

  const error = useCallback((errorMessage: string) => {
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: errorMessage,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      data: null,
    });
  }, []);

  const actions: LoadingActions = { start, finish, error, reset };

  return [state, actions] as const;
}

/**
 * Hook for managing multiple loading states with shared interface
 *
 * @param states - Object mapping state names to initial states
 * @returns [states, actions] - Current states and actions to modify them
 *
 * @example
 * const [states, actions] = useMultipleLoadingStates({
 *   fetchStudents: {},
 *   exportData: {},
 *   generateQRCode: {},
 * });
 *
 * // Use in component
 * {states.fetchStudents.isLoading && <Spinner />}
 * {states.exportData.error && <ErrorMessage error={states.exportData.error} />}
 */
export function useMultipleLoadingStates<
  T extends Record<string, Partial<LoadingState>>,
>(states: T) {
  const [loadingStates, setLoadingStates] = useState<
    Record<keyof T, LoadingState>
  >(() => {
    const result = {} as Record<keyof T, LoadingState>;
    Object.entries(states).forEach(([key, value]) => {
      result[key as keyof T] = {
        isLoading: false,
        error: null,
        data: null,
        ...value,
      };
    });
    return result;
  });

  const createActions = useCallback(
    (stateKey: keyof T): LoadingActions => ({
      start: () => {
        setLoadingStates((prev) => ({
          ...prev,
          [stateKey]: {
            ...prev[stateKey],
            isLoading: true,
            error: null,
          },
        }));
      },
      finish: (data?: any) => {
        setLoadingStates((prev) => ({
          ...prev,
          [stateKey]: {
            ...prev[stateKey],
            isLoading: false,
            data: data ?? prev[stateKey].data,
            error: null,
          },
        }));
      },
      error: (errorMessage: string) => {
        setLoadingStates((prev) => ({
          ...prev,
          [stateKey]: {
            ...prev[stateKey],
            isLoading: false,
            error: errorMessage,
          },
        }));
      },
      reset: () => {
        setLoadingStates((prev) => ({
          ...prev,
          [stateKey]: {
            isLoading: false,
            error: null,
            data: null,
          },
        }));
      },
    }),
    []
  );

  // Create actions object with all state keys
  const actions = Object.keys(states).reduce((acc, key) => {
    acc[key as keyof T] = createActions(key as keyof T);
    return acc;
  }, {} as any);

  return [loadingStates, actions] as const;
}

export default useLoadingState;
