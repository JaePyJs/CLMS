import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, Loader2, User, Clock, Calendar } from 'lucide-react';
import { equipmentApi } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SessionHistoryDialogProps {
  equipmentId: string;
  equipmentName: string;
  disabled?: boolean;
}

interface Session {
  id: string;
  student_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  student: {
    first_name: string;
    last_name: string;
    student_id: string;
  };
}

export function SessionHistoryDialog({
  equipmentId,
  equipmentName,
  disabled,
}: SessionHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await equipmentApi.getSessionHistory(equipmentId);
      if (response.data && response.data.success) {
        setHistory(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch session history', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'Ongoing';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diffMinutes = Math.round((endTime - startTime) / 60000);

    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <History className="h-3 w-3 mr-1" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session History – {equipmentName}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No session history available
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {history.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col space-y-2 p-3 border rounded-lg bg-card"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {session.student.first_name}{' '}
                          {session.student.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({session.student.student_id})
                        </span>
                      </div>
                      <Badge
                        variant={
                          session.status === 'ACTIVE' ? 'default' : 'secondary'
                        }
                        className={
                          session.status === 'ACTIVE' ? 'bg-green-500' : ''
                        }
                      >
                        {session.status === 'ACTIVE' ? 'Active' : 'Completed'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(session.start_time).toLocaleDateString()}
                        </span>
                        <Clock className="h-3 w-3 ml-2" />
                        <span>
                          {new Date(session.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="font-medium">
                        {formatDuration(session.start_time, session.end_time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
