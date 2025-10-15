import { useState, useDeferredValue, useMemo } from 'react';

/**
 * Custom hook that wraps React 18's useDeferredValue for performance optimization
 * Useful for deferring expensive computations or UI updates
 */
export function useDeferredValueWithComputed<T>(
  initialValue: T,
  computeFn?: (value: T) => any
) {
  const [value, setValue] = useState(initialValue);
  const deferredValue = useDeferredValue(value);

  const computedValue = useMemo(() => {
    if (computeFn) {
      return computeFn(deferredValue);
    }
    return deferredValue;
  }, [deferredValue, computeFn]);

  return {
    value,
    deferredValue,
    computedValue,
    setValue,
    isPending: value !== deferredValue,
  };
}

/**
 * Hook for managing search with deferred value for better performance
 */
export function useDeferredSearch(initialSearch: string = '') {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  return {
    searchTerm,
    deferredSearchTerm,
    setSearchTerm,
    isSearchPending: searchTerm !== deferredSearchTerm,
  };
}

/**
 * Hook for managing lists with deferred filtering
 */
export function useDeferredList<T>(
  items: T[],
  filterFn: (item: T, filterValue: string) => boolean,
  initialFilter: string = ''
) {
  const [filterValue, setFilterValue] = useState(initialFilter);
  const deferredFilterValue = useDeferredValue(filterValue);

  const filteredItems = useMemo(() => {
    return items.filter(item => filterFn(item, deferredFilterValue));
  }, [items, filterFn, deferredFilterValue]);

  return {
    filterValue,
    deferredFilterValue,
    filteredItems,
    setFilterValue,
    isFilterPending: filterValue !== deferredFilterValue,
  };
}