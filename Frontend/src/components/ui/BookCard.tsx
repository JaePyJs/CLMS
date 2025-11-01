'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookOpen, BookMarked, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  isbn?: string;
  accessionNo: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  totalCopies: number;
  availableCopies: number;
  isActive: boolean;
  barcodeImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookCardProps {
  book: Book;
  onCheckout?: (bookId: string) => void;
  onViewDetails?: (book: Book) => void;
  compact?: boolean;
  className?: string;
}

export function BookCard({
  book,
  onCheckout,
  onViewDetails,
  compact = false,
  className
}: BookCardProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleCheckout = async () => {
    if (!onCheckout || book.availableCopies === 0) return;

    setIsCheckingOut(true);
    try {
      await onCheckout(book.id);
      toast.success(`"${book.title}" checked out successfully!`);
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to checkout book. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const getAvailabilityBadge = () => {
    if (book.availableCopies === 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Unavailable
        </Badge>
      );
    } else if (book.availableCopies < book.totalCopies) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-yellow-500">
          <AlertCircle className="h-3 w-3" />
          {book.availableCopies} left
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-500">
          <CheckCircle className="h-3 w-3" />
          Available
        </Badge>
      );
    }
  };

  const getCardOpacity = () => {
    if (!book.isActive) return 'opacity-60';
    if (book.availableCopies === 0) return 'opacity-75';
    return 'opacity-100';
  };

  return (
    <Card className={cn(
      'group hover:shadow-lg transition-all duration-200 cursor-pointer',
      getCardOpacity(),
      compact ? 'p-3' : 'p-4',
      className
    )}>
      {/* Book Cover/Visual */}
      <div className={cn(
        'flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-lg mb-3',
        compact ? 'h-24' : 'h-32'
      )}>
        {book.barcodeImage && !imageError ? (
          <img
            src={book.barcodeImage}
            alt={`${book.title} barcode`}
            className={cn(
              'rounded object-contain',
              compact ? 'h-16 w-16' : 'h-20 w-20'
            )}
            onError={() => setImageError(true)}
          />
        ) : (
          <BookOpen className={cn(
            'text-slate-400',
            compact ? 'h-8 w-8' : 'h-12 w-12'
          )} />
        )}
      </div>

      {/* Book Info */}
      <CardContent className={cn('p-0', compact ? 'space-y-1' : 'space-y-2')}>
        {/* Title */}
        <h3 className={cn(
          'font-semibold text-slate-900 dark:text-foreground line-clamp-2 group-hover:text-primary transition-colors',
          compact ? 'text-sm' : 'text-base'
        )}>
          {book.title}
        </h3>

        {/* Author */}
        <p className={cn(
          'text-slate-600 dark:text-slate-400 line-clamp-1',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {book.author}
        </p>

        {/* Category and Location */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn(
            'text-xs',
            compact ? 'px-1 py-0' : 'px-2 py-1'
          )}>
            {book.category}
          </Badge>
          {book.location && (
            <span className="text-xs text-muted-foreground truncate">
              {book.location}
            </span>
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center justify-between">
          {getAvailabilityBadge()}
          <div className="text-xs text-muted-foreground">
            {book.availableCopies}/{book.totalCopies}
          </div>
        </div>

        {/* ISBN for non-compact */}
        {!compact && book.isbn && (
          <div className="text-xs text-muted-foreground font-mono truncate">
            ISBN: {book.isbn}
          </div>
        )}
      </CardContent>

      {/* Actions */}
      <CardFooter className={cn(
        'p-0 pt-3 flex items-center gap-2',
        compact ? 'flex-col' : 'flex-row'
      )}>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={() => onViewDetails?.(book)}
          className="flex-1"
        >
          <Eye className="h-4 w-4 mr-1" />
          {!compact && 'Details'}
        </Button>

        {onCheckout && book.availableCopies > 0 && (
          <Button
            size={compact ? 'sm' : 'default'}
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="flex-1"
          >
            {isCheckingOut ? (
              <>
                <div className="animate-spin h-4 w-4 mr-1 border-2 border-current border-t-transparent rounded-full" />
                {!compact && 'Checking out...'}
              </>
            ) : (
              <>
                <BookMarked className="h-4 w-4 mr-1" />
                {!compact && 'Checkout'}
              </>
            )}
          </Button>
        )}

        {book.availableCopies === 0 && onCheckout && (
          <Button
            variant="secondary"
            size={compact ? 'sm' : 'default'}
            disabled
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-1" />
            {!compact && 'Unavailable'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default BookCard;