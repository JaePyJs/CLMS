import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Check,
  ChevronsUpDown,
  BookOpen,
  Copy,
  MapPin,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { booksApi } from '@/lib/api';

interface BookEntry {
  id: string;
  accession_no: string;
  author: string;
  category: string | null;
  location: string | null;
  available_copies: number;
  total_copies: number;
}

interface TitleGroup {
  title: string;
  totalCopies: number;
  books: BookEntry[];
}

interface TitleLookupComboboxProps {
  // Parameters are used by callback consumers, not this component
  onChange?: (
    _bookId: string,
    _book: BookEntry | null,
    _titleGroup: TitleGroup | null
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TitleLookupCombobox({
  onChange,
  placeholder = 'Search for a book title...',
  disabled = false,
  className,
}: TitleLookupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTitle, setSelectedTitle] = useState<TitleGroup | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookEntry | null>(null);

  // Debounce search
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Query for title lookup
  const { data: lookupData, isLoading } = useQuery({
    queryKey: ['titleLookup', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return { titles: [] };
      const result = await booksApi.lookupTitles(debouncedQuery, 20);
      return result.data as { titles: TitleGroup[] };
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const titles = lookupData?.titles || [];

  // Handle title selection
  const handleSelectTitle = useCallback(
    (titleGroup: TitleGroup) => {
      setSelectedTitle(titleGroup);

      // If only one book with this title, auto-select it
      if (titleGroup.books.length === 1) {
        const book = titleGroup.books[0];
        setSelectedBook(book);
        onChange?.(book.id, book, titleGroup);
        setOpen(false);
      }
    },
    [onChange]
  );

  // Handle book selection from duplicate list
  const handleSelectBook = useCallback(
    (book: BookEntry) => {
      setSelectedBook(book);
      onChange?.(book.id, book, selectedTitle);
      setOpen(false);
    },
    [onChange, selectedTitle]
  );

  // Reset selection
  const handleClear = useCallback(() => {
    setSelectedTitle(null);
    setSelectedBook(null);
    setSearchQuery('');
    onChange?.('', null, null);
  }, [onChange]);

  // Format display value
  const displayValue = selectedBook
    ? `${selectedTitle?.title || 'Unknown'} (${selectedBook.accession_no})`
    : selectedTitle
      ? `${selectedTitle.title} (${selectedTitle.totalCopies} copies)`
      : '';

  return (
    <div className={cn('relative', className)}>
      {/* Toggle button / display */}
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full justify-between"
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {/* Dropdown */}
      {open && (
        <Card className="absolute z-50 mt-1 w-full shadow-lg">
          <CardContent className="p-2">
            {/* Search input */}
            <div className="relative mb-2">
              <Input
                placeholder="Type to search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>

            <ScrollArea className="h-[300px]">
              {/* Empty state */}
              {!isLoading && searchQuery.length < 2 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Type at least 2 characters to search...
                </div>
              )}

              {!isLoading &&
                searchQuery.length >= 2 &&
                titles.length === 0 &&
                !selectedTitle && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No books found.
                  </div>
                )}

              {/* Title results */}
              {!selectedTitle && titles.length > 0 && (
                <div className="space-y-1">
                  {titles.map((titleGroup) => (
                    <button
                      key={titleGroup.title}
                      onClick={() => handleSelectTitle(titleGroup)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">
                            {titleGroup.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            by {titleGroup.books[0]?.author || 'Unknown Author'}
                          </div>
                        </div>
                      </div>
                      {titleGroup.totalCopies > 1 && (
                        <Badge variant="secondary" className="ml-2">
                          <Copy className="h-3 w-3 mr-1" />
                          {titleGroup.totalCopies} copies
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Book copies for selected title (when there are duplicates) */}
              {selectedTitle && selectedTitle.totalCopies > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Select a copy of "{selectedTitle.title}"
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTitle(null)}
                    >
                      ← Back
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {selectedTitle.books.map((book) => (
                      <button
                        key={book.id}
                        onClick={() => handleSelectBook(book)}
                        className="w-full flex items-center justify-between p-2 rounded hover:bg-muted transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              'h-4 w-4',
                              selectedBook?.id === book.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <div>
                            <div className="font-medium text-sm">
                              {book.accession_no}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {book.location && (
                                <>
                                  <MapPin className="h-3 w-3" />
                                  {book.location}
                                </>
                              )}
                              {book.category && (
                                <Badge variant="outline" className="text-xs">
                                  {book.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-right">
                          <div
                            className={
                              book.available_copies > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {book.available_copies}/{book.total_copies}{' '}
                            available
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Clear button */}
            {(selectedTitle || selectedBook) && (
              <div className="pt-2 border-t mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear selection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TitleLookupCombobox;
