import { useState, useCallback, useMemo } from 'react';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface SearchFilters {
  searchTerm: string;
  filters: Record<string, string | string[]>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

interface FilterActions {
  setSearchTerm: (term: string) => void;
  setFilter: (key: string, value: string | string[]) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  setSortBy: (field: string) => void;
  toggleSortOrder: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

/**
 * Hook for managing search and filter states consistently across components
 * 
 * @param options - Configuration options for the filter system
 * @returns [state, actions] - Current state and actions to modify it
 * 
 * @example
 * const [state, actions] = useSearchFilters({
 *   defaultSearchTerm: '',
 *   defaultFilters: { gradeLevel: '', status: 'active' },
 *   sortOptions: [
 *     { label: 'Name', value: 'name' },
 *     { label: 'Grade', value: 'gradeLevel' },
 *   ],
 *   pageSize: 25,
 * });
 * 
 * // Use in component
 * const filteredData = useMemo(() => {
 *   return applyFilters(data, state);
 * }, [data, state]);
 */
export function useSearchFilters(
  options: {
    defaultSearchTerm?: string;
    defaultFilters?: Record<string, string | string[]>;
    defaultSortBy?: string;
    defaultSortOrder?: 'asc' | 'desc';
    defaultPage?: number;
    defaultPageSize?: number;
    availableFilters?: Record<string, FilterOption[]>;
    sortOptions?: FilterOption[];
  } = {}
) {
  const {
    defaultSearchTerm = '',
    defaultFilters = {},
    defaultSortBy = '',
    defaultSortOrder = 'asc',
    defaultPage = 1,
    defaultPageSize = 25,
  } = options;

  const [state, setState] = useState<SearchFilters>({
    searchTerm: defaultSearchTerm,
    filters: defaultFilters,
    sortBy: defaultSortBy,
    sortOrder: defaultSortOrder,
    page: defaultPage,
    pageSize: defaultPageSize,
  });

  const setSearchTerm = useCallback((term: string) => {
    setState(prev => ({
      ...prev,
      searchTerm: term,
      page: 1, // Reset to first page when searching
    }));
  }, []);

  const setFilter = useCallback((key: string, value: string | string[]) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
      page: 1, // Reset to first page when filtering
    }));
  }, []);

  const removeFilter = useCallback((key: string) => {
    setState(prev => {
      const newFilters = { ...prev.filters };
      delete newFilters[key];
      return {
        ...prev,
        filters: newFilters,
        page: 1, // Reset to first page when removing filter
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: {},
      page: 1,
    }));
  }, []);

  const setSortBy = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'asc',
      page: 1,
    }));
  }, []);

  const toggleSortOrder = useCallback(() => {
    setState(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      page: Math.max(1, page),
    }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState(prev => ({
      ...prev,
      pageSize: Math.max(1, size),
      page: 1, // Reset to first page when changing page size
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      searchTerm: defaultSearchTerm,
      filters: defaultFilters,
      sortBy: defaultSortBy,
      sortOrder: defaultSortOrder,
      page: defaultPage,
      pageSize: defaultPageSize,
    });
  }, [
    defaultSearchTerm,
    defaultFilters,
    defaultSortBy,
    defaultSortOrder,
    defaultPage,
    defaultPageSize,
  ]);

  const actions: FilterActions = {
    setSearchTerm,
    setFilter,
    removeFilter,
    clearFilters,
    setSortBy,
    toggleSortOrder,
    setPage,
    setPageSize,
    reset,
  };

  // Computed values
  const hasActiveFilters = useMemo(() => {
    return state.searchTerm.trim() !== '' || Object.keys(state.filters).length > 0;
  }, [state.searchTerm, state.filters]);

  const isSortActive = useMemo(() => {
    return state.sortBy !== '' && state.sortOrder !== 'asc';
  }, [state.sortBy, state.sortOrder]);

  return [state, actions, { hasActiveFilters, isSortActive }] as const;
}

/**
 * Hook for managing table-specific filter states
 * 
 * @param options - Table-specific configuration options
 * @returns [state, actions, computed] - State, actions, and computed values
 * 
 * @example
 * const [state, actions, computed] = useTableFilters({
 *   data: students,
 *   searchableFields: ['name', 'gradeLevel', 'section'],
 *   filterableFields: {
 *     gradeLevel: gradeOptions,
 *     isActive: [{ label: 'Active', value: 'true' }, { label: 'Inactive', value: 'false' }],
 *   },
 * });
 */
export function useTableFilters<T extends Record<string, any>>(
  options: {
    data: T[];
    searchableFields?: string[];
    filterableFields?: Record<string, FilterOption[]>;
    defaultSortBy?: string;
    defaultSortOrder?: 'asc' | 'desc';
    defaultPageSize?: number;
  }
) {
  const {
    data,
    searchableFields = [],
    filterableFields = {},
    ...filterOptions
  } = options;

  const [state, actions, computed] = useSearchFilters(filterOptions);

  // Apply filters and search to data
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply search term
    if (state.searchTerm.trim()) {
      const searchLower = state.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item =>
        searchableFields.some(field => {
          const value = item[field];
          return value && value.toString().toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply filters
    Object.entries(state.filters).forEach(([key, value]) => {
      if (value && value.toString().trim() !== '') {
        if (Array.isArray(value)) {
          // Multi-select filter
          filtered = filtered.filter(item =>
            value.includes(item[key]?.toString())
          );
        } else {
          // Single-select filter
          filtered = filtered.filter(item =>
            item[key]?.toString() === value.toString()
          );
        }
      }
    });

    // Apply sorting
    if (state.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[state.sortBy];
        const bVal = b[state.sortBy];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;
        
        return state.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, state, searchableFields]);

  // Apply pagination
  const paginatedData = useMemo(() => {
    const startIndex = (state.page - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, state.page, state.pageSize]);

  // Compute pagination info
  const paginationInfo = useMemo(() => {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / state.pageSize);
    const currentPageItems = paginatedData.length;
    const startItem = totalItems === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const endItem = totalItems === 0 ? 0 : startItem + currentPageItems - 1;

    return {
      totalItems,
      totalPages,
      currentPageItems,
      startItem,
      endItem,
      canGoToPrevPage: state.page > 1,
      canGoToNextPage: state.page < totalPages,
    };
  }, [filteredData, paginatedData, state.page, state.pageSize]);

  return [
    { ...state, filteredData: paginatedData },
    actions,
    { ...computed, filteredData, paginationInfo, totalData: data }
  ] as const;
}

/**
 * Hook for managing advanced filter builders
 * 
 * @param filterSchema - Schema defining available filters
 * @returns [state, actions, filterFunctions] - State and functions for building filters
 */
export function useAdvancedFilters(
  filterSchema: Record<string, {
    type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'boolean';
    label: string;
    options?: FilterOption[];
    placeholder?: string;
  }>
) {
  const [state, setState] = useState<Record<string, any>>({});

  const setFilterValue = useCallback((key: string, value: any) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const removeFilter = useCallback((key: string) => {
    setState(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setState({});
  }, []);

  // Build filter functions for applying to data
  const filterFunctions = useMemo(() => {
    const functions: Record<string, (item: any) => boolean> = {};

    Object.entries(state).forEach(([key, value]) => {
      const schema = filterSchema[key];
      if (!schema || !value) return;

      switch (schema.type) {
        case 'text':
          functions[key] = (item) =>
            item[key]?.toString().toLowerCase().includes(value.toLowerCase());
          break;
        
        case 'select':
          functions[key] = (item) => item[key]?.toString() === value.toString();
          break;
        
        case 'multiselect':
          functions[key] = (item) => Array.isArray(value) && value.includes(item[key]?.toString());
          break;
        
        case 'date':
          functions[key] = (item) => {
            const itemDate = new Date(item[key]);
            const filterDate = new Date(value);
            return itemDate.toDateString() === filterDate.toDateString();
          };
          break;
        
        case 'daterange':
          functions[key] = (item) => {
            const itemDate = new Date(item[key]);
            const startDate = new Date(value.start);
            const endDate = new Date(value.end);
            return itemDate >= startDate && itemDate <= endDate;
          };
          break;
        
        case 'number':
          functions[key] = (item) => {
            const itemValue = Number(item[key]);
            const filterValue = Number(value);
            return itemValue === filterValue;
          };
          break;
        
        case 'boolean':
          functions[key] = (item) => item[key] === Boolean(value);
          break;
      }
    });

    return functions;
  }, [state, filterSchema]);

  const applyFilters = useCallback((data: any[]) => {
    if (Object.keys(filterFunctions).length === 0) return data;

    return data.filter(item =>
      Object.values(filterFunctions).every(fn => fn(item))
    );
  }, [filterFunctions]);

  const actions = {
    setFilterValue,
    removeFilter,
    clearAllFilters,
  };

  return [state, actions, filterFunctions, applyFilters] as const;
}

export default useSearchFilters;