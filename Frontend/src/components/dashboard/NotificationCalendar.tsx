import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar } from '../ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/api-hooks';
import {
  Bell,
  BookOpen,
  AlertCircle,
  CalendarDays,
  CheckCircle,
} from 'lucide-react';

interface LibraryNotification {
  id: string;
  date: Date;
  type: 'overdue' | 'due-soon' | 'return' | 'reminder';
  student: string;
  grade: number;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export function NotificationCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );

  // Real data from API (initialized to empty array)
  const { data: notificationsData = [], isLoading } = useNotifications();

  // Ensure notifications is always an array
  const notifications: LibraryNotification[] = Array.isArray(notificationsData)
    ? notificationsData
    : [];

  // Filter notifications for selected date
  const selectedNotifications = notifications.filter(
    (notif) =>
      selectedDate && notif.date.toDateString() === selectedDate.toDateString()
  );

  // Get all dates with notifications for highlighting
  const datesWithNotifications = notifications.map((n) => n.date);

  // Get upcoming notifications (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const upcomingNotifications = notifications
    .filter((n) => n.date >= today && n.date <= nextWeek)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

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
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          <span className="opacity-70">📅</span> Library Calendar
        </h3>
        <Badge
          variant="outline"
          className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
        >
          {isLoading
            ? 'Loading...'
            : `${upcomingNotifications.length} upcoming events`}
        </Badge>
      </div>

      {/* Centered Calendar View */}
      <div className="flex justify-center">
        <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl p-4 shadow-lg border border-blue-200 dark:border-blue-800 w-fit">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="text-sm"
            modifiers={{
              hasNotification: datesWithNotifications,
            }}
            modifiersClassNames={{
              hasNotification:
                'relative before:absolute before:bottom-1 before:left-1/2 before:-translate-x-1/2 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full underline decoration-blue-500 decoration-2 underline-offset-4',
            }}
          />
        </div>
      </div>

      {/* Selected Date Notifications */}
      {selectedDate && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <span className="opacity-70">📋</span>{' '}
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </h4>
          {selectedNotifications.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg border shadow-sm ${getNotificationBadgeColor(
                    notif.type
                  )}`}
                >
                  <div className="flex items-start gap-2">
                    {getNotificationIcon(notif.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="truncate font-medium text-sm">
                          {notif.student}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          G{notif.grade}
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div className="text-2xl mb-2 opacity-70">📚</div>
              <div>No events for this day</div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Notifications */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <span className="opacity-70">⏰</span> Coming Up
          </h4>
          <Badge
            variant="outline"
            className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700"
          >
            {upcomingNotifications.length} items
          </Badge>
        </div>

        <ScrollArea
          className={`${
            upcomingNotifications.length > 3 ? 'h-48' : 'h-32'
          } pr-2`}
        >
          <div className="space-y-2">
            {upcomingNotifications.length > 0 ? (
              upcomingNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-lg border bg-white dark:bg-gray-800/50 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    {getNotificationIcon(notif.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="truncate font-medium text-sm">
                          {notif.student}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          G{notif.grade}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>
                          {notif.date.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            notif.priority === 'high'
                              ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20'
                              : notif.priority === 'medium'
                              ? 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20'
                              : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                          }`}
                        >
                          {notif.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">
                <div className="text-2xl mb-2 opacity-70">🌟</div>
                <div>All caught up!</div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Compact Quick Stats */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {notifications.filter((n) => n.type === 'overdue').length}
          </div>
          <div className="text-xs text-red-600 dark:text-red-400">Overdue</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {notifications.filter((n) => n.type === 'due-soon').length}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400">
            Due Soon
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {notifications.filter((n) => n.type === 'return').length}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400">
            Returns
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {notifications.filter((n) => n.type === 'reminder').length}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400">
            Reminders
          </div>
        </div>
      </div>
    </div>
  );
}
