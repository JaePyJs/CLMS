// Loading state management hooks
export { useLoadingState, useMultipleLoadingStates } from './useLoadingState';

// Modal and dialog state management hooks
export { useModalState, useMultipleModals, useConfirmDialog } from './useModalState';

// Search and filter state management hooks
export { useSearchFilters, useTableFilters, useAdvancedFilters } from './useSearchFilters';

// Form state management hooks
export { useForm, useMultiStepForm, useFormValidation } from './useFormState';

// Data refresh and polling hooks
export { useDataRefresh, useBatchRefresh, useSmartRefresh, useOptimisticRefresh } from './useDataRefresh';

// Action and operation state management hooks
export { useActionState, useMultipleActions, useBatchOperation } from './useActionState';

// Existing hooks
export { useBreakpoint } from './useBreakpoint';
export { useDebounce } from './useDebounce';
export { useDeferredValueWithComputed, useDeferredSearch, useDeferredList } from './useDeferredValue';
export { useLocalStorage } from './useLocalStorage';
export { useWebSocket } from './useWebSocket';
export { useUSBScanner } from './useUSBScanner';
export { usePerformanceMetrics, useTrackedQuery, useTrackedMutation, useLazyLoad, useOptimizedImage } from './usePerformance';
export { usePerformanceMonitor } from './usePerformanceMonitor';
export { useReactPerformance } from './useReactPerformance';
export { useMobileOptimization } from './useMobileOptimization';
export { useOfflineSync } from './useOfflineSync';
export { useDocumentationWebSocket } from './useDocumentationWebSocket';
export { useAsyncData } from './useAsyncData';
export { useTypedApi } from './useTypedApi';

// Existing API hooks
export * from './api-hooks';

// Enhanced state hooks
export { useEnhancedState, useSelector, useSelectors, useComputed, useActions, useAsyncActions, usePersistedState, useOptimisticState, useDebouncedState, useUndoRedoState, useValidatedState, useCachedState } from './useEnhancedState';