import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-4">
      {/* Main Calendar Card - Compact */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50 dark:from-card dark:to-blue-950/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              Library Calendar
            </CardTitle>
            <Badge
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs"
            >
              {isLoading ? 'Loading...' : `${notifications.length} Events`}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Calendar Section */}
          <div className="p-3 flex justify-center items-start bg-white/50 dark:bg-transparent">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border shadow-sm bg-white dark:bg-card [&_.rdp-cell]:p-0 [&_.rdp-button]:h-8 [&_.rdp-button]:w-8"
              modifiers={{
                hasNotification: datesWithNotifications,
              }}
              modifiersClassNames={{
                hasNotification:
                  'relative before:absolute before:bottom-0.5 before:left-1/2 before:-translate-x-1/2 before:w-1 before:h-1 before:bg-blue-500 before:rounded-full font-bold text-blue-600 dark:text-blue-400',
              }}
            />
          </div>

          {/* Selected Date Events - Compact */}
          {selectedDate && (
            <div className="border-t border-gray-100 dark:border-gray-800 bg-white/30 dark:bg-transparent">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {format(selectedDate, 'MMM d, yyyy')}
                </h3>
                {selectedNotifications.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {selectedNotifications.length} items
                  </Badge>
                )}
              </div>

              <div className="max-h-32 overflow-y-auto p-3">
                {selectedNotifications.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNotifications.slice(0, 3).map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-2 rounded-lg border text-xs ${getNotificationBadgeColor(notif.type)}`}
                      >
                        <div className="flex items-center gap-2">
                          {getNotificationIcon(notif.type)}
                          <span className="truncate font-medium">
                            {notif.student}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 px-1 ml-auto"
                          >
                            G{notif.grade}
                          </Badge>
                        </div>
                        <p className="mt-1 opacity-80 line-clamp-1">
                          {notif.message}
                        </p>
                      </div>
                    ))}
                    {selectedNotifications.length > 3 && (
                      <p className="text-xs text-center text-muted-foreground">
                        +{selectedNotifications.length - 3} more events
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    <CalendarDays className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p className="text-xs">No events for this day</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards - Separate from Calendar */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-md bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-500">
              {notifications.filter((n) => n.type === 'overdue').length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Overdue
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">
              {notifications.filter((n) => n.type === 'due-soon').length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Due Soon
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">
              {notifications.length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
