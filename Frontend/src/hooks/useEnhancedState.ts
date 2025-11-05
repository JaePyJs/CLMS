import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
} from 'react';
import type {
  EnhancedStateStore,
  StateSelector,
  StateUpdater,
} from '@/store/state-manager';

/**
 * React hooks for the enhanced state management system
 */

/**
 * Hook to use an enhanced state store
 */
export function useEnhancedState<T>(
  store: EnhancedStateStore<T>
): [T, StateUpdater<T>, EnhancedStateStore<T>] {
  const [state, setState] = useState(store.getState());

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = store.subscribe((newState, previousState) => {
      if (newState !== previousState) {
        setState(newState);
      }
    });

    // Initial sync
    setState(store.getState());

    return unsubscribe;
  }, [store]);

  const updateState = useCallback<StateUpdater<T>>(
    (updater) => {
      store.setState(updater);
    },
    [store]
  );

  return [state, updateState, store];
}

/**
 * Hook to use a selector from the enhanced state store
 */
export function useSelector<T, R>(
  store: EnhancedStateStore<T>,
  selector: StateSelector<T, R>,
  equalityFn?: (a: R, b: R) => boolean
): R {
  const [selectedState, setSelectedState] = React.useState<R>(() => {
    try {
      return selector(store.getState());
    } catch (error) {
      console.error('Selector error:', error);
      throw error;
    }
  });

  const previousSelectorRef = useRef(selector);
  const previousEqualityFnRef = useRef(equalityFn);

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      try {
        const newSelectedState = selector(newState);

        // Check if selected state has changed
        const hasChanged = !equalityFn
          ? newSelectedState !== selectedState
          : !equalityFn(newSelectedState, selectedState);

        if (hasChanged) {
          setSelectedState(newSelectedState);
        }
      } catch (error) {
        console.error('Selector error in subscription:', error);
      }
    });

    // Update selector if it has changed
    if (
      previousSelectorRef.current !== selector ||
      previousEqualityFnRef.current !== equalityFn
    ) {
      previousSelectorRef.current = selector;
      previousEqualityFnRef.current = equalityFn;

      try {
        const newSelectedState = selector(store.getState());
        setSelectedState(newSelectedState);
      } catch (error) {
        console.error('Selector error on update:', error);
      }
    }

    return unsubscribe;
  }, [store, selector, equalityFn, selectedState]);

  return selectedState;
}

/**
 * Hook to use multiple selectors from the enhanced state store
 */
export function useSelectors<T>(
  store: EnhancedStateStore<T>
): <R>(
  selector: StateSelector<T, R>,
  equalityFn?: (a: R, b: R) => boolean
) => R {
  const useSelectedState = useCallback(
    <R>(
      selector: StateSelector<T, R>,
      equalityFn?: (a: R, b: R) => boolean
    ) => {
      return useSelector(store, selector, equalityFn);
    },
    [store]
  );

  return useSelectedState;
}

/**
 * Hook to use computed values from the enhanced state store
 */
export function useComputed<T, R>(
  store: EnhancedStateStore<T>,
  computedKey: string
): R {
  const [computedValue, setComputedValue] = React.useState<R>(() => {
    return store.computed[computedKey];
  });

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const newComputedValue = store.computed[computedKey];
      if (newComputedValue !== computedValue) {
        setComputedValue(newComputedValue);
      }
    });

    // Initial sync
    setComputedValue(store.computed[computedKey]);

    return unsubscribe;
  }, [store, computedKey, computedValue]);

  return computedValue;
}

/**
 * Hook to use actions from the enhanced state store
 */
export function useActions<T>(store: EnhancedStateStore<T>) {
  const actions = useMemo(() => store.actions, [store]);

  const stableActions = useMemo(() => {
    const boundActions: Record<string, (...args: any[]) => void> = {};

    Object.entries(actions).forEach(([name, action]) => {
      boundActions[name] = (...args: any[]) => {
        action(...args);
      };
    });

    return boundActions;
  }, [actions]);

  return stableActions;
}

/**
 * Hook to use async actions from the enhanced state store
 */
export function useAsyncActions<T>(store: EnhancedStateStore<T>) {
  const asyncActions = useMemo(() => store.asyncActions, [store]);

  const stableAsyncActions = useMemo(() => {
    const boundActions: Record<string, (...args: any[]) => Promise<any>> = {};

    Object.entries(asyncActions).forEach(([name, action]) => {
      boundActions[name] = (...args: any[]) => {
        return action(...args);
      };
    });

    return boundActions;
  }, [asyncActions]);

  return stableAsyncActions;
}

/**
 * Hook to use state with persistence
 */
export function usePersistedState<T>(
  store: EnhancedStateStore<T>,
  persistKey: string
): [T, StateUpdater<T>, () => void] {
  const [state, setState] = useEnhancedState(store);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Handle hydration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const clearPersistedState = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(persistKey);
      store.resetState();
    }
  }, [store, persistKey]);

  // Return placeholder state during hydration
  if (!isHydrated) {
    return [store.getState(), setState, clearPersistedState];
  }

  return [state, setState, clearPersistedState];
}

/**
 * Hook to use state with optimistic updates
 */
export function useOptimisticState<T>(
  store: EnhancedStateStore<T>
): [T, StateUpdater<T>, StateUpdater<T>] {
  const [state, setState] = useEnhancedState(store);
  const [optimisticState, setOptimisticState] = React.useState<T>(state);

  const updateWithOptimism = useCallback<StateUpdater<T>>(
    (updater) => {
      // Apply optimistic update immediately
      const optimisticUpdate =
        typeof updater === 'function'
          ? (updater as (state: T) => T)(optimisticState)
          : updater;

      setOptimisticState(optimisticUpdate);

      // Apply actual update
      setState(updater);
    },
    [optimisticState, setState]
  );

  const resetOptimistic = useCallback(() => {
    setOptimisticState(state);
  }, [state]);

  // Sync optimistic state with actual state
  useEffect(() => {
    setOptimisticState(state);
  }, [state]);

  return [optimisticState, updateWithOptimism, resetOptimistic];
}

/**
 * Hook to use state with debounced updates
 */
export function useDebouncedState<T>(
  store: EnhancedStateStore<T>,
  delay: number = 300
): [T, StateUpdater<T>, T] {
  const [state, setState] = useEnhancedState(store);
  const [debouncedState, setDebouncedState] = React.useState<T>(state);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedSetState = useCallback<StateUpdater<T>>(
    (updater) => {
      setState(updater);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedState(
          typeof updater === 'function'
            ? (updater as (state: T) => T)(store.getState())
            : updater
        );
      }, delay);
    },
    [setState, store, delay]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Sync debounced state with actual state
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDebouncedState(state);
  }, [state]);

  return [state, debouncedSetState, debouncedState];
}

/**
 * Hook to use state with undo/redo functionality
 */
export function useUndoRedoState<T>(
  store: EnhancedStateStore<T>,
  maxHistory: number = 50
): [T, StateUpdater<T>, () => void, () => void, boolean, boolean] {
  const [state, setState] = useEnhancedState(store);
  const [history, setHistory] = React.useState<T[]>([state]);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const updateWithHistory = useCallback<StateUpdater<T>>(
    (updater) => {
      const newState =
        typeof updater === 'function'
          ? (updater as (state: T) => T)(state)
          : updater;

      setState(newState);

      // Update history
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(newState);

      // Limit history size
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        setCurrentIndex((prev) => prev - 1);
      } else {
        setCurrentIndex(newHistory.length - 1);
      }

      setHistory(newHistory);
    },
    [state, setState, history, currentIndex, maxHistory]
  );

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const previousState = history[newIndex];
      if (previousState !== undefined) {
        setCurrentIndex(newIndex);
        setState(previousState);
      }
    }
  }, [currentIndex, history, setState]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const nextState = history[newIndex];
      if (nextState !== undefined) {
        setCurrentIndex(newIndex);
        setState(nextState);
      }
    }
  }, [currentIndex, history, setState]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  // Reset history when external state changes
  useEffect(() => {
    if (!history.includes(state)) {
      setHistory([state]);
      setCurrentIndex(0);
    }
  }, [state, history]);

  return [state, updateWithHistory, undo, redo, canUndo, canRedo];
}

/**
 * Hook to use state with validation
 */
export function useValidatedState<T>(
  store: EnhancedStateStore<T>,
  validator: (state: T) => string | null
): [T, StateUpdater<T>, string | null, boolean] {
  const [state, setState] = useEnhancedState(store);
  const [error, setError] = React.useState<string | null>(() =>
    validator(state)
  );

  const validateAndUpdate = useCallback<StateUpdater<T>>(
    (updater) => {
      const newState =
        typeof updater === 'function'
          ? (updater as (state: T) => T)(state)
          : updater;

      const validationError = validator(newState);
      setError(validationError);

      if (!validationError) {
        setState(updater);
      }
    },
    [state, setState, validator]
  );

  // Re-validate when state changes externally
  useEffect(() => {
    const validationError = validator(state);
    setError(validationError);
  }, [state, validator]);

  const isValid = error === null;

  return [state, validateAndUpdate, error, isValid];
}

/**
 * Hook to use state with local caching
 */
export function useCachedState<T>(
  store: EnhancedStateStore<T>,
  cacheKey: string,
  cacheTimeout: number = 5 * 60 * 1000 // 5 minutes
): [T, StateUpdater<T>, () => void] {
  const [state, setState] = useEnhancedState(store);

  const getFromCache = useCallback((): T | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTimeout) {
          return data;
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  }, [cacheKey, cacheTimeout]);

  const saveToCache = useCallback(
    (data: T) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        console.error('Cache write error:', error);
      }
    },
    [cacheKey]
  );

  const updateWithCache = useCallback<StateUpdater<T>>(
    (updater) => {
      const newState =
        typeof updater === 'function'
          ? (updater as (state: T) => T)(state)
          : updater;

      setState(newState);
      saveToCache(newState);
    },
    [state, setState, saveToCache]
  );

  const clearCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
  }, [cacheKey]);

  // Initialize from cache if available
  useEffect(() => {
    const cachedState = getFromCache();
    if (cachedState) {
      setState(cachedState);
    }
  }, [getFromCache, setState]);

  return [state, updateWithCache, clearCache];
}

export default useEnhancedState;
