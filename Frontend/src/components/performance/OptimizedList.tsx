import React, {
  memo,
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react';
import type { ComponentType, ReactNode, Key } from 'react';
import { FixedSizeList as List, VariableSizeList as VariableList } from 'react-window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';

// Types
interface OptimizedListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  width?: number | string;
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  itemKey?: (item: T, index: number) => Key;
  className?: string;
  overscanCount?: number;
  estimatedItemSize?: number;
  variableSize?: boolean;
  getItemSize?: (index: number) => number;
  onScroll?: (scrollInfo: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => void;
  loadingIndicator?: ReactNode;
  emptyState?: ReactNode;
  searchPlaceholder?: string;
  searchable?: boolean;
  sortable?: boolean;
  sortOptions?: Array<{ key: keyof T; label: string; direction?: 'asc' | 'desc' }>;
  filterable?: boolean;
  filterOptions?: Array<{ key: keyof T; label: string; options: Array<{ value: any; label: string }> }>;
  infiniteScroll?: boolean;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  loadNextPage?: () => void;
  itemCount?: number;
}

interface ListRowProps<T> {
  index: number;
  style: React.CSSProperties;
  data: {
    items: T[];
    renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  };
}

// Memoized list row component
const ListRow = memo(<T,>({ index, style, data }: ListRowProps<T>) => {
  const { items, renderItem } = data;
  const item = items[index];

  if (!item) {
    return (
      <div style={style} className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{renderItem(item, index, style)}</>;
}) as ComponentType<ListRowProps<any>>;

ListRow.displayName = 'ListRow';

// Search and Filter Component
interface SearchFilterProps<T> {
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  searchPlaceholder?: string;
  sortOptions?: Array<{ key: keyof T; label: string; direction?: 'asc' | 'desc' }>;
  filterOptions?: Array<{ key: keyof T; label: string; options: Array<{ value: any; label: string }> }>;
  onSearch: (query: string) => void;
  onSort: (key: keyof T, direction: 'asc' | 'desc') => void;
  onFilter: (key: keyof T, value: any) => void;
  totalCount: number;
  filteredCount: number;
}

const SearchFilter = <T,>({
  searchable = true,
  sortable = true,
  filterable = true,
  searchPlaceholder = 'Search...',
  sortOptions = [],
  filterOptions = [],
  onSearch,
  onSort,
  onFilter,
  totalCount,
  filteredCount,
}: SearchFilterProps<T>) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSort, setCurrentSort] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    onSearch(query);
  }, [onSearch]);

  const handleSort = useCallback((key: keyof T, direction: 'asc' | 'desc') => {
    setCurrentSort({ key, direction });
    onSort(key, direction);
  }, [onSort]);

  const handleFilter = useCallback((key: keyof T, value: any) => {
    onFilter(key, value);
  }, [onFilter]);

  const toggleSortDirection = useCallback((key: keyof T) => {
    const newDirection = currentSort?.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
    handleSort(key, newDirection);
  }, [currentSort, handleSort]);

  return (
    <div className="space-y-4 p-4 border-b">
      {/* Search */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Sort */}
          {sortable && sortOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <div className="flex gap-1">
                {sortOptions.map((option) => (
                  <Button
                    key={String(option.key)}
                    variant={currentSort?.key === option.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSortDirection(option.key)}
                    className="flex items-center gap-1"
                  >
                    {option.label}
                    {currentSort?.key === option.key && (
                      currentSort.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Toggle */}
          {filterable && filterOptions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1"
            >
              <Filter className="h-3 w-3" />
              Filters
              {showFilters && <ChevronUp className="h-3 w-3" />}
            </Button>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground px-2 py-1 border rounded">
          {filteredCount} of {totalCount} items
        </div>
      </div>

      {/* Filters */}
      {showFilters && filterable && filterOptions.length > 0 && (
        <div className="space-y-3">
          {filterOptions.map((filter) => (
            <div key={String(filter.key)} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground min-w-fit">{filter.label}:</span>
              <select
                className="flex-1 px-2 py-1 text-sm border rounded"
                onChange={(e) => handleFilter(filter.key, e.target.value)}
                defaultValue=""
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main Optimized List Component
export const OptimizedList = <T,>({
  items,
  itemHeight,
  height,
  width = '100%',
  renderItem,
  itemKey,
  className = '',
  overscanCount = 5,
  variableSize = false,
  getItemSize,
  onScroll,
  loadingIndicator,
  emptyState,
  searchPlaceholder,
  searchable = true,
  sortable = true,
  sortOptions,
  filterable = true,
  filterOptions,
  infiniteScroll = false,
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  itemCount,
}: OptimizedListProps<T>) => {
  const [filteredItems, setFilteredItems] = useState<T[]>(items);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSort, setCurrentSort] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);
  const [currentFilters, setCurrentFilters] = useState<Record<string, any>>({});
  const listRef = useRef<any>(null);

  // Apply search, sort, and filters
  const processedItems = useMemo(() => {
    let result = [...items];

    // Apply search
    if (searchQuery) {
      result = result.filter(item => {
        return Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    // Apply filters
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        result = result.filter(item => {
          const itemValue = (item as any)[key];
          return String(itemValue).toLowerCase() === String(value).toLowerCase();
        });
      }
    });

    // Apply sort
    if (currentSort) {
      result.sort((a, b) => {
        const aValue = a[currentSort.key];
        const bValue = b[currentSort.key];

        if (aValue < bValue) return currentSort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, searchQuery, currentSort, currentFilters]);

  // Update filtered items when processed items change
  useEffect(() => {
    setFilteredItems(processedItems);
  }, [processedItems]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle sort
  const handleSort = useCallback((key: keyof T, direction: 'asc' | 'desc') => {
    setCurrentSort({ key, direction });
  }, []);

  // Handle filter
  const handleFilter = useCallback((key: keyof T, value: any) => {
    setCurrentFilters(prev => ({
      ...prev,
      [String(key)]: value,
    }));
  }, []);

  // Get item key
  const getItemKey = useCallback((index: number): Key => {
    const item = filteredItems[index];
    if (itemKey) {
      return itemKey(item, index);
    }
    return index;
  }, [filteredItems, itemKey]);

  // Render row
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index];

    if (!item && infiniteScroll && isNextPageLoading) {
      return (
        <div style={style} className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    return <>{renderItem(item, index, style)}</>;
  }, [filteredItems, renderItem, infiniteScroll, isNextPageLoading]);

  // Handle scroll
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: any) => {
    if (onScroll) {
      onScroll({ scrollOffset, scrollDirection });
    }

    // Infinite scroll loading
    if (infiniteScroll && hasNextPage && !isNextPageLoading) {
      const listElement = listRef.current;
      if (listElement) {
        const { scrollHeight, clientHeight, scrollTop } = listElement._outerRef;
        if (scrollHeight - scrollTop <= clientHeight * 1.5) {
          loadNextPage?.();
        }
      }
    }
  }, [onScroll, infiniteScroll, hasNextPage, isNextPageLoading, loadNextPage]);

  // Item data for list
  const itemData = useMemo(() => ({
    items: filteredItems,
    renderItem,
  }), [filteredItems, renderItem]);

  // Determine which list component to use
  const ListComponent = variableSize ? VariableList : List;
  const actualItemCount = infiniteScroll ? (itemCount || filteredItems.length) : filteredItems.length;

  return (
    <Card className={className}>
      {(searchable || sortable || filterable) && (
        <SearchFilter
          searchable={searchable}
          sortable={sortable}
          filterable={filterable}
          searchPlaceholder={searchPlaceholder}
          sortOptions={sortOptions}
          filterOptions={filterOptions}
          onSearch={handleSearch}
          onSort={handleSort}
          onFilter={handleFilter}
          totalCount={items.length}
          filteredCount={filteredItems.length}
        />
      )}

      <CardContent className="p-0">
        {filteredItems.length === 0 ? (
          emptyState || (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="text-muted-foreground mb-2">No items found</div>
              <div className="text-sm text-muted-foreground">
                {searchQuery || Object.keys(currentFilters).length > 0
                  ? 'Try adjusting your search or filters'
                  : 'No items available'}
              </div>
            </div>
          )
        ) : (
          <div style={{ height, width }}>
            <ListComponent
              ref={listRef}
              height={height}
              width={width}
              itemCount={actualItemCount}
              itemSize={variableSize ? (getItemSize || (() => itemHeight)) : itemHeight}
              itemData={itemData}
              itemKey={getItemKey}
              overscanCount={overscanCount}
              onScroll={handleScroll}
            >
              {renderRow}
            </ListComponent>
          </div>
        )}

        {loadingIndicator && isNextPageLoading && (
          <div className="flex items-center justify-center p-4">
            {loadingIndicator}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

OptimizedList.displayName = 'OptimizedList';

// Specialized list components for common use cases
export const StudentList = (props: Omit<OptimizedListProps<any>, 'sortOptions' | 'filterOptions'>) => (
  <OptimizedList
    {...props}
    sortOptions={[
      { key: 'name', label: 'Name' },
      { key: 'grade', label: 'Grade' },
      { key: 'section', label: 'Section' },
      { key: 'lrn', label: 'LRN' },
    ]}
    filterOptions={[
      {
        key: 'grade',
        label: 'Grade Level',
        options: [
          { value: 'GRADE_7', label: 'Grade 7' },
          { value: 'GRADE_8', label: 'Grade 8' },
          { value: 'GRADE_9', label: 'Grade 9' },
          { value: 'GRADE_10', label: 'Grade 10' },
          { value: 'GRADE_11', label: 'Grade 11' },
          { value: 'GRADE_12', label: 'Grade 12' },
        ],
      },
      {
        key: 'section',
        label: 'Section',
        options: [
          { value: 'A', label: 'Section A' },
          { value: 'B', label: 'Section B' },
          { value: 'C', label: 'Section C' },
          { value: 'D', label: 'Section D' },
        ],
      },
    ]}
    searchPlaceholder="Search students by name, LRN, or grade..."
  />
);

export const BookList = (props: Omit<OptimizedListProps<any>, 'sortOptions' | 'filterOptions'>) => (
  <OptimizedList
    {...props}
    sortOptions={[
      { key: 'title', label: 'Title' },
      { key: 'author', label: 'Author' },
      { key: 'accessionNumber', label: 'Accession No.' },
      { key: 'category', label: 'Category' },
    ]}
    filterOptions={[
      {
        key: 'category',
        label: 'Category',
        options: [
          { value: 'FICTION', label: 'Fiction' },
          { value: 'NON_FICTION', label: 'Non-Fiction' },
          { value: 'REFERENCE', label: 'Reference' },
          { value: 'TEXTBOOK', label: 'Textbook' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'BORROWED', label: 'Borrowed' },
          { value: 'RESERVED', label: 'Reserved' },
          { value: 'LOST', label: 'Lost' },
        ],
      },
    ]}
    searchPlaceholder="Search books by title, author, or accession number..."
  />
);

export const EquipmentList = (props: Omit<OptimizedListProps<any>, 'sortOptions' | 'filterOptions'>) => (
  <OptimizedList
    {...props}
    sortOptions={[
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'serialNumber', label: 'Serial No.' },
      { key: 'status', label: 'Status' },
    ]}
    filterOptions={[
      {
        key: 'category',
        label: 'Category',
        options: [
          { value: 'COMPUTER', label: 'Computer' },
          { value: 'PRINTER', label: 'Printer' },
          { value: 'PROJECTOR', label: 'Projector' },
          { value: 'SCANNER', label: 'Scanner' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'IN_USE', label: 'In Use' },
          { value: 'MAINTENANCE', label: 'Maintenance' },
          { value: 'DAMAGED', label: 'Damaged' },
        ],
      },
    ]}
    searchPlaceholder="Search equipment by name, category, or serial number..."
  />
);

export default OptimizedList;
