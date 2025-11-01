/**
 * Modern State Management System
 * Combines multiple state management patterns for optimal performance and developer experience
 */

import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types for our state management system
export type StateUpdater<T> = (updater: T | ((prev: T) => T)) => void;
export type StateSelector<T, R> = (state: T) => R;
export type StateEffect<T> = (state: T, previousState: T) => void;
export type StateMiddleware<T> = (state: T, setState: StateUpdater<T>) => void;

/**
 * Enhanced state store with multiple management patterns
 */
export interface EnhancedStateStore<T> {
  // Core state
  state: T;

  // State management
  setState: StateUpdater<T>;
  getState: () => T;
  resetState: () => void;

  // Selectors
  select: <R>(selector: StateSelector<T, R>) => R;

  // Effects
  subscribe: (callback: (state: T, previousState: T) => void) => () => void;
  effect: (effect: StateEffect<T>) => () => void;

  // Batch operations
  batch: (updates: Array<() => void>) => void;

  // Computed values
  computed: Record<string, any>;

  // Actions
  actions: Record<string, (...args: any[]) => void>;

  // Async actions
  asyncActions: Record<string, (...args: any[]) => Promise<any>>;
}

/**
 * Configuration options for the state store
 */
export interface StateStoreConfig<T> {
  name: string;
  initialState: T;
  persist?: {
    enabled: boolean;
    storage?: 'localStorage' | 'sessionStorage' | 'custom';
    customStorage?: Storage;
    partialize?: (state: T) => Partial<T>;
    onRehydrateStorage?: (state: T) => void;
  };
  middlewares?: StateMiddleware<T>[];
  effects?: StateEffect<T>[];
  actions?: Record<string, (state: T, setState: StateUpdater<T>) => (...args: any[]) => void>;
  asyncActions?: Record<string, (state: T, setState: StateUpdater<T>) => (...args: any[]) => Promise<any>>;
  computed?: Record<string, (state: T) => any>;
}

/**
 * Create an enhanced state store
 */
export function createStateStore<T>(config: StateStoreConfig<T>): EnhancedStateStore<T> {
  const {
    name,
    initialState,
    persist: persistConfig,
    middlewares = [],
    effects: globalEffects = [],
    actions: actionDefinitions = {},
    asyncActions: asyncActionDefinitions = {},
    computed: computedDefinitions = {},
  } = config;

  // Create Zustand store with middleware
  const createStore = (set: any, get: any, api: any) => ({
    state: initialState,

    setState: (updater: T | ((prev: T) => T)) => {
      set((prev: { state: T }) => ({
        state: typeof updater === 'function' ? (updater as Function)(prev.state) : updater
      }));
    },

    getState: () => get().state,

    resetState: () => set({ state: initialState }),

    select: <R>(selector: StateSelector<T, R>) => selector(get().state),

    subscribe: (callback: (state: T, previousState: T) => void) => {
      return api.subscribe(
        (s: { state: T }) => s.state,
        (state: T, previousState: T) => callback(state, previousState)
      );
    },

    batch: (updates: Array<() => void>) => {
      set(() => {
        updates.forEach(update => update());
      });
    },

    // Actions
    actions: {} as Record<string, (...args: any[]) => void>,

    // Async actions
    asyncActions: {} as Record<string, (...args: any[]) => Promise<any>>,

    // Computed values
    computed: {} as Record<string, any>,
  });

  // Apply persistence middleware
  let storeWithMiddleware = createStore;

  if (persistConfig?.enabled) {
    const storage = persistConfig.storage === 'localStorage'
      ? localStorage
      : persistConfig.storage === 'sessionStorage'
        ? sessionStorage
        : persistConfig.customStorage || localStorage;

    storeWithMiddleware = persist(createStore, {
      name,
      storage: createJSONStorage(() => storage),
      partialize: persistConfig.partialize || ((state: T) => state),
      onRehydrateStorage: persistConfig.onRehydrateStorage,
    });
  }

  // Apply selector middleware
  storeWithMiddleware = subscribeWithSelector(storeWithMiddleware);

  // Create the store
  const useStore = create(storeWithMiddleware);

  // Create enhanced store interface
  const enhancedStore: EnhancedStateStore<T> = {
    state: initialState,

    setState: (updater) => {
      const currentStore = useStore.getState();
      currentStore.setState(updater);
    },

    getState: () => {
      return useStore.getState().getState();
    },

    resetState: () => {
      useStore.getState().resetState();
    },

    select: <R>(selector: StateSelector<T, R>) => {
      return selector(useStore.getState().getState());
    },

    subscribe: (callback) => {
      return useStore.subscribe(
        (s) => s.state,
        (state, previousState) => {
          callback(state, previousState);
        }
      );
    },

    effect: (effect) => {
      let previousState = useStore.getState().getState();

      const unsubscribe = useStore.subscribe((state) => {
        const currentState = state.state;
        if (currentState !== previousState) {
          effect(currentState, previousState);
          previousState = currentState;
        }
      });

      return unsubscribe;
    },

    batch: (updates) => {
      useStore.getState().batch(updates);
    },

    computed: {} as Record<string, any>,

    actions: {},

    asyncActions: {},
  };

  // Initialize actions
  Object.entries(actionDefinitions).forEach(([name, action]) => {
    enhancedStore.actions[name] = (...args: any[]) => {
      const currentStore = useStore.getState();
      return action(currentStore.getState(), currentStore.setState)(...args);
    };
  });

  // Initialize async actions
  Object.entries(asyncActionDefinitions).forEach(([name, action]) => {
    enhancedStore.asyncActions[name] = async (...args: any[]) => {
      const currentStore = useStore.getState();
      return await action(currentStore.getState(), currentStore.setState)(...args);
    };
  });

  // Initialize computed values
  Object.entries(computedDefinitions).forEach(([name, computeFn]) => {
    Object.defineProperty(enhancedStore.computed, name, {
      get: () => computeFn(useStore.getState().getState()),
      enumerable: true,
    });
  });

  // Apply middlewares
  middlewares.forEach(middleware => {
    middleware(enhancedStore.state, enhancedStore.setState);
  });

  // Apply global effects
  globalEffects.forEach(effect => {
    enhancedStore.effect(effect);
  });

  return enhancedStore;
}

/**
 * Hook to use the state store
 */
export function useStateStore<T>(store: EnhancedStateStore<T>): [T, StateUpdater<T>] {
  const [state, setState] = React.useState(store.getState());

  React.useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [store]);

  return [state, store.setState];
}

/**
 * Hook to use a selector from the state store
 */
export function useStateStoreSelector<T, R>(
  store: EnhancedStateStore<T>,
  selector: StateSelector<T, R>
): R {
  const [selectedState, setSelectedState] = React.useState(() => selector(store.getState()));

  React.useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      const newSelectedState = selector(newState);
      setSelectedState(newSelectedState);
    });

    return unsubscribe;
  }, [store, selector]);

  return selectedState;
}

/**
 * Hook to use computed values from the state store
 */
export function useStateStoreComputed<T, R>(
  store: EnhancedStateStore<T>,
  computedKey: string
): R {
  const [computedValue, setComputedValue] = React.useState(() => store.computed[computedKey]);

  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const newComputedValue = store.computed[computedKey];
      setComputedValue(newComputedValue);
    });

    return unsubscribe;
  }, [store, computedKey]);

  return computedValue;
}

/**
 * Hook to use actions from the state store
 */
export function useStateStoreActions<T>(store: EnhancedStateStore<T>) {
  return React.useCallback(() => store.actions, [store]);
}

/**
 * Hook to use async actions from the state store
 */
export function useStateStoreAsyncActions<T>(store: EnhancedStateStore<T>) {
  return React.useCallback(() => store.asyncActions, [store]);
}

/**
 * Store registry for managing multiple stores
 */
export class StoreRegistry {
  private static instance: StoreRegistry;
  private stores: Map<string, EnhancedStateStore<any>> = new Map();

  static getInstance(): StoreRegistry {
    if (!StoreRegistry.instance) {
      StoreRegistry.instance = new StoreRegistry();
    }
    return StoreRegistry.instance;
  }

  register<T>(name: string, store: EnhancedStateStore<T>): void {
    this.stores.set(name, store);
  }

  get<T>(name: string): EnhancedStateStore<T> | undefined {
    return this.stores.get(name);
  }

  unregister(name: string): boolean {
    return this.stores.delete(name);
  }

  getAll(): Map<string, EnhancedStateStore<any>> {
    return new Map(this.stores);
  }

  clear(): void {
    this.stores.clear();
  }
}

/**
 * Utility functions for store management
 */
export const StoreUtils = {
  /**
   * Create a deep selector for nested state
   */
  deepSelect: <T extends Record<string, any>, R>(path: Array<string | number>) => (state: T): R => {
    return path.reduce((current: any, key) => current?.[key], state as any) as R;
  },

  /**
   * Create a memoized selector
   */
  memoSelect: <T, R>(
    selector: StateSelector<T, R>,
    equalityFn?: (a: R, b: R) => boolean
  ): StateSelector<T, R> => {
    let cachedValue: R;
    let cachedState: T;

    return (state: T): R => {
      if (cachedState === state && equalityFn?.(cachedValue, selector(state))) {
        return cachedValue;
      }

      cachedState = state;
      cachedValue = selector(state);
      return cachedValue;
    };
  },

  /**
   * Create a selector with fallback
   */
  selectWithFallback: <T, R>(
    selector: StateSelector<T, R>,
    fallback: R
  ): StateSelector<T, R> => {
    return (state: T): R => {
      try {
        return selector(state);
      } catch {
        return fallback;
      }
    };
  },

  /**
   * Create a batch updater
   */
  batchUpdater: <T>(store: EnhancedStateStore<T>) => {
    const batchedUpdates: Array<() => void> = [];

    return {
      update: (updater: () => void) => {
        batchedUpdates.push(updater);
      },

      flush: () => {
        if (batchedUpdates.length > 0) {
          store.batch(batchedUpdates);
          batchedUpdates.length = 0;
        }
      },
    };
  },
};

export default createStateStore;
