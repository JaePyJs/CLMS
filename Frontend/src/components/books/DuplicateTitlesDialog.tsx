import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, BookOpen, MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { booksApi } from '@/lib/api';

interface DuplicateTitlesDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onSelectBook?: (_bookId: string) => void;
}

export function DuplicateTitlesDialog({
  open,
  onOpenChange,
  onSelectBook,
}: DuplicateTitlesDialogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['duplicateTitles'],
    queryFn: async () => {
      const result = await booksApi.getDuplicateTitles();
      return result.data as {
        duplicates: Array<{
          title: string;
          count: number;
          books: Array<{
            id: string;
            accession_no: string;
            author: string;
            category: string | null;
            location: string | null;
          }>;
        }>;
        totalDuplicateTitles: number;
      };
    },
    enabled: open,
    staleTime: 60000, // Cache for 1 minute
  });

  const duplicates = data?.duplicates || [];
  const totalDuplicateTitles = data?.totalDuplicateTitles || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Duplicate Book Titles
            </DialogTitle>
            <DialogDescription>
              Books with the same title but different accession numbers
              (multiple copies or editions)
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 p-6 pt-2">
          {/* Stats */}
          <div className="mb-4 p-4 bg-muted/50 rounded-lg flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <div className="font-medium">
                {totalDuplicateTitles} titles have multiple copies
              </div>
              <div className="text-sm text-muted-foreground">
                Review these to ensure data consistency
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-8 text-red-500">
              Failed to load duplicate titles. Please try again.
            </div>
          )}

          {/* Duplicate titles list */}
          {!isLoading && !error && (
            <ScrollArea className="h-[calc(85vh-200px)]">
              <div className="space-y-4 pr-4">
                {duplicates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No duplicate titles found</p>
                    <p className="text-sm">All books have unique titles</p>
                  </div>
                ) : (
                  duplicates.map((titleGroup) => (
                    <Card key={titleGroup.title}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            {titleGroup.title}
                          </span>
                          <Badge variant="secondary">
                            <Copy className="h-3 w-3 mr-1" />
                            {titleGroup.count} copies
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2">
                          {titleGroup.books.map((book) => (
                            <div
                              key={book.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="font-mono text-sm font-medium">
                                  {book.accession_no}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  by {book.author || 'Unknown'}
                                </div>
                                {book.location && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {book.location}
                                  </div>
                                )}
                                {book.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {book.category}
                                  </Badge>
                                )}
                              </div>
                              {onSelectBook && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    onSelectBook(book.id);
                                    onOpenChange(false);
                                  }}
                                >
                                  Select
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateTitlesDialog;
