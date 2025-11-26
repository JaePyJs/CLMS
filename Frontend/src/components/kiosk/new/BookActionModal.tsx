import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, BookOpen, RotateCcw, Calendar } from 'lucide-react';

interface BookActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle: string;
  bookAuthor?: string;
  accessionNo?: string;
  studentName?: string;
  // eslint-disable-next-line no-unused-vars
  onBorrow: (date?: string) => void;
  onReturn: () => void;
  onRead: () => void;
}

export function BookActionModal({
  isOpen,
  onClose,
  bookTitle,
  bookAuthor,
  accessionNo,
  studentName,
  onBorrow,
  onReturn,
  onRead,
}: BookActionModalProps) {
  const [dueDate, setDueDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7); // Default 7 days from now
    return date.toISOString().split('T')[0];
  });

  const handleBorrow = () => {
    onBorrow(dueDate);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card dark:bg-card border-border transition-all duration-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Book Scanned - Select Action
          </DialogTitle>
          <DialogDescription className="text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground text-base">
              {bookTitle}
            </div>
            {bookAuthor && (
              <div className="text-sm">
                Author: <span className="text-foreground">{bookAuthor}</span>
              </div>
            )}
            {accessionNo && (
              <div className="text-sm font-mono">
                Accession:{' '}
                <span className="text-foreground">{accessionNo}</span>
              </div>
            )}
            {studentName && (
              <div className="mt-2 text-sm">
                Student:{' '}
                <span className="font-semibold text-foreground">
                  {studentName}
                </span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Due Date Input for Borrow */}
        <div className="space-y-2 py-2">
          <Label htmlFor="due-date" className="text-sm font-medium">
            <Calendar className="h-4 w-4 inline mr-2" />
            Due Date (for Borrow)
          </Label>
          <Input
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="transition-all duration-200 focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 py-2">
          <Button
            onClick={handleBorrow}
            className="w-full h-14 text-base bg-primary hover:bg-primary/90 dark:hover:bg-primary/80 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={!studentName}
          >
            <LogOut className="h-5 w-5" />
            Borrow Book
            {!studentName && (
              <span className="text-xs opacity-70 ml-2">
                (Scan Student ID first)
              </span>
            )}
          </Button>

          <Button
            onClick={onRead}
            variant="secondary"
            className="w-full h-14 text-base bg-secondary hover:bg-secondary/80 dark:hover:bg-secondary/60 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={!studentName}
          >
            <BookOpen className="h-5 w-5" />
            Read in Library
            {!studentName && (
              <span className="text-xs opacity-70 ml-2">
                (Scan Student ID first)
              </span>
            )}
          </Button>

          <Button
            onClick={onReturn}
            variant="outline"
            className="w-full h-14 text-base border-border hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="h-5 w-5" />
            Return Book
          </Button>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground dark:hover:bg-accent/30 transition-all duration-200"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
