/**
 * SmartSearch - Google-style instant search component
 * Provides real-time fuzzy search with type-ahead suggestions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2, User, BookOpen, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'student' | 'book' | 'equipment';
  title: string;
  subtitle?: string;
  meta?: string;
  data?: any;
}

interface SmartSearchProps {
  placeholder?: string;
  onSelect: (result: SearchResult) => void;
  searchFn: (query: string) => Promise<SearchResult[]>;
  minChars?: number;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  showIcon?: boolean;
  autoFocus?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

export function SmartSearch({
  placeholder = 'Search...',
  onSelect,
  searchFn,
  minChars = 1,
  debounceMs = 150,
  className,
  inputClassName,
  showIcon = true,
  autoFocus = false,
  value: controlledValue,
  onValueChange,
  disabled = false,
}: SmartSearchProps) {
  const [query, setQuery] = useState(controlledValue || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync with controlled value
  useEffect(() => {
    if (controlledValue !== undefined) {
      setQuery(controlledValue);
    }
  }, [controlledValue]);

  // Search function with debounce
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < minChars) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await searchFn(searchQuery);
        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchFn, minChars]
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch, debounceMs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onValueChange?.(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle selection
  const handleSelect = (result: SearchResult) => {
    setQuery(result.title);
    onValueChange?.(result.title);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect(result);
  };

  // Clear input
  const handleClear = () => {
    setQuery('');
    onValueChange?.('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Get icon for result type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'book':
        return <BookOpen className="h-4 w-4 text-green-500" />;
      case 'equipment':
        return <Monitor className="h-4 w-4 text-purple-500" />;
      default:
        return <Search className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        {showIcon && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() =>
            query.length >= minChars && results.length > 0 && setIsOpen(true)
          }
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={cn(showIcon && 'pl-10', query && 'pr-10', inputClassName)}
        />
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {query && !disabled && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            type="button"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                index === selectedIndex && 'bg-slate-100 dark:bg-slate-800',
                index !== results.length - 1 &&
                  'border-b border-slate-100 dark:border-slate-800'
              )}
              type="button"
            >
              {getTypeIcon(result.type)}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {result.title}
                </div>
                {result.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">
                    {result.subtitle}
                  </div>
                )}
              </div>
              {result.meta && (
                <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {result.meta}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen &&
        query.length >= minChars &&
        !isLoading &&
        results.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
            No results found for "{query}"
          </div>
        )}
    </div>
  );
}
