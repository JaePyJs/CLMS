import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarDays,
  AlertCircle,
  BookOpen,
  CheckCircle,
  Bell,
  Clock,
} from 'lucide-react';
import { useNotifications } from '@/hooks/api-hooks';
import { format, isSameDay } from 'date-fns';

interface LibraryNotification {
  id: string;
  date: string | Date; // API might return string
  type: 'overdue' | 'due-soon' | 'return' | 'reminder';
  student: string;
  grade: number;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export function CalendarWidget() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const { data: notificationsData = [], isLoading } = useNotifications();

  // Ensure notifications is always an array and parse dates
  const notifications: LibraryNotification[] = Array.isArray(notificationsData)
    ? notificationsData.map((n: any) => ({
        ...n,
        date: new Date(n.date),
      }))
    : [];

  // Filter notifications for selected date
  const selectedNotifications = notifications.filter(
    (notif) => selectedDate && isSameDay(new Date(notif.date), selectedDate)
  );

  // Get all dates with notifications for highlighting
  const datesWithNotifications = notifications.map((n) => new Date(n.date));

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'due-soon':
        return <BookOpen className="w-4 h-4 text-orange-500" />;
      case 'return':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reminder':
        return <Bell className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case 'overdue':
        return 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700';
      case 'due-soon':
        return 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700';
      case 'return':
        return 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700';
      case 'reminder':
        return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700';
      default:
        return '';
    }
  };

  return (
    <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50 dark:from-card dark:to-blue-950/20 overflow-hidden h-full flex flex-col">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-6 w-6" />
            Library Calendar
          </CardTitle>
          <Badge
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            {isLoading ? 'Loading...' : `${notifications.length} Events`}
          </Badge>
        </div>
        <CardDescription className="text-blue-100">
          Track due dates, returns, and library events
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Calendar Section */}
        <div className="p-4 flex justify-center items-start border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-transparent">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border shadow-sm bg-white dark:bg-card"
            modifiers={{
              hasNotification: datesWithNotifications,
            }}
            modifiersClassNames={{
              hasNotification:
                'relative before:absolute before:bottom-1 before:left-1/2 before:-translate-x-1/2 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full font-bold text-blue-600 dark:text-blue-400',
            }}
          />
        </div>

        {/* Events List Section */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/30 dark:bg-transparent">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-transparent">
            <h3 className="font-semibold flex items-center gap-2">
              {selectedDate ? (
                <>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {format(selectedDate, 'MMMM d, yyyy')}
                </>
              ) : (
                'Select a date'
              )}
            </h3>
            {selectedNotifications.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {selectedNotifications.length} items
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {selectedNotifications.length > 0 ? (
                selectedNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border shadow-sm transition-all hover:scale-[1.01] ${getNotificationBadgeColor(
                      notif.type
                    )}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 bg-white/50 dark:bg-black/20 rounded-full">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="truncate font-semibold text-sm">
                            {notif.student}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 bg-white/50 dark:bg-black/20 border-0"
                          >
                            G{notif.grade}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed font-medium opacity-90">
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] opacity-75">
                          <span className="uppercase tracking-wider font-bold">
                            {notif.type.replace('-', ' ')}
                          </span>
                          <span>•</span>
                          <span>{format(new Date(notif.date), 'h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <CalendarDays className="w-6 h-6 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No events for this day</p>
                  <p className="text-xs opacity-70 mt-1 max-w-[180px]">
                    Select another date or check upcoming events below
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Stats Footer */}
          <div className="p-3 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">
                {notifications.filter((n) => n.type === 'overdue').length}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Overdue
              </div>
            </div>
            <div className="text-center border-l border-r border-gray-200 dark:border-gray-700">
              <div className="text-lg font-bold text-orange-500">
                {notifications.filter((n) => n.type === 'due-soon').length}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Due Soon
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500">
                {notifications.length}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
