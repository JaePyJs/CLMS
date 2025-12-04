import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarDays,
  AlertCircle,
  BookOpen,
  CheckCircle,
  Bell,
  Clock,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  CalendarPlus,
} from 'lucide-react';
import { useNotifications } from '@/hooks/api-hooks';
import { format, isSameDay } from 'date-fns';
import api from '@/services/api';
import { toast } from 'sonner';

interface LibraryNotification {
  id: string;
  date: string | Date;
  type: 'overdue' | 'due-soon' | 'return' | 'reminder';
  student: string;
  grade: number;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: 'reminder' | 'holiday' | 'deadline' | 'meeting' | 'other';
  color: string;
  all_day: boolean;
  is_active: boolean;
}

const EVENT_TYPES = [
  { value: 'reminder', label: 'Reminder', color: '#3b82f6' },
  { value: 'holiday', label: 'Holiday', color: '#22c55e' },
  { value: 'deadline', label: 'Deadline', color: '#ef4444' },
  { value: 'meeting', label: 'Meeting', color: '#a855f7' },
  { value: 'other', label: 'Other', color: '#6b7280' },
];

export function CalendarWidget() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const { data: notificationsData = [], isLoading } = useNotifications();

  // Custom events state
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventType: 'reminder',
    color: '#3b82f6',
  });

  // Fetch custom events
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/calendar-events');
      if (response.data.success) {
        setCustomEvents(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    }
  };

  // Ensure notifications is always an array and parse dates
  const notifications: LibraryNotification[] = Array.isArray(notificationsData)
    ? notificationsData.map((n: LibraryNotification) => ({
        ...n,
        date: new Date(n.date),
      }))
    : [];

  // Filter notifications for selected date
  const selectedNotifications = notifications.filter(
    (notif) => selectedDate && isSameDay(new Date(notif.date), selectedDate)
  );

  // Filter custom events for selected date
  const selectedEvents = customEvents.filter(
    (event) =>
      selectedDate && isSameDay(new Date(event.event_date), selectedDate)
  );

  // Get all dates with notifications or events for highlighting
  const datesWithNotifications = notifications.map((n) => new Date(n.date));
  const datesWithEvents = customEvents.map((e) => new Date(e.event_date));
  const allHighlightedDates = [...datesWithNotifications, ...datesWithEvents];

  const openAddEventDialog = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      eventType: 'reminder',
      color: '#3b82f6',
    });
    setIsEventDialogOpen(true);
  };

  const openEditEventDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      eventType: event.event_type,
      color: event.color,
    });
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    try {
      if (editingEvent) {
        const response = await api.put(`/calendar-events/${editingEvent.id}`, {
          title: eventForm.title,
          description: eventForm.description || null,
          eventDate: selectedDate.toISOString(),
          eventType: eventForm.eventType,
          color: eventForm.color,
        });

        if (response.data.success) {
          toast.success('Event updated');
          fetchEvents();
        }
      } else {
        const response = await api.post('/calendar-events', {
          title: eventForm.title,
          description: eventForm.description || null,
          eventDate: selectedDate.toISOString(),
          eventType: eventForm.eventType,
          color: eventForm.color,
        });

        if (response.data.success) {
          toast.success('Event created');
          fetchEvents();
        }
      }
      setIsEventDialogOpen(false);
    } catch (error) {
      toast.error('Failed to save event');
      console.error('Save event error:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await api.delete(`/calendar-events/${eventId}`);
      if (response.data.success) {
        toast.success('Event deleted');
        fetchEvents();
      }
    } catch (error) {
      toast.error('Failed to delete event');
      console.error('Delete event error:', error);
    }
  };

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
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs"
              >
                {isLoading
                  ? 'Loading...'
                  : `${notifications.length + customEvents.length} Events`}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
                onClick={openAddEventDialog}
                title="Add Event"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
                hasNotification: allHighlightedDates,
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
                <div className="flex items-center gap-2">
                  {(selectedNotifications.length > 0 ||
                    selectedEvents.length > 0) && (
                    <Badge variant="outline" className="text-xs">
                      {selectedNotifications.length + selectedEvents.length}{' '}
                      items
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={openAddEventDialog}
                    title="Add event for this day"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto p-3">
                {selectedEvents.length > 0 ||
                selectedNotifications.length > 0 ? (
                  <div className="space-y-2">
                    {/* Custom Events */}
                    {selectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-2 rounded-lg border text-xs"
                        style={{
                          backgroundColor: `${event.color}15`,
                          borderColor: `${event.color}50`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: event.color }}
                          />
                          <span className="truncate font-medium flex-1">
                            {event.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 px-1"
                          >
                            {event.event_type}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-5 w-5 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditEventDialog(event)}
                              >
                                <Pencil className="h-3 w-3 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteEvent(event.id)}
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {event.description && (
                          <p className="mt-1 opacity-80 line-clamp-1">
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Book Notifications */}
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
                            {notif.grade === 0 ? 'PS' : `G${notif.grade}`}
                          </Badge>
                        </div>
                        <p className="mt-1 opacity-80 line-clamp-1">
                          {notif.message}
                        </p>
                      </div>
                    ))}
                    {selectedNotifications.length > 3 && (
                      <p className="text-xs text-center text-muted-foreground">
                        +{selectedNotifications.length - 3} more notifications
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    <CalendarDays className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p className="text-xs">No events for this day</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs mt-1"
                      onClick={openAddEventDialog}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Event
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards - Separate from Calendar */}
      <div className="grid grid-cols-4 gap-2">
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
        <Card className="border-0 shadow-md bg-purple-50 dark:bg-purple-950/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-500">
              {customEvents.length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Events
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">
              {notifications.length + customEvents.length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Event Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Event title"
                value={eventForm.title}
                onChange={(e) =>
                  setEventForm({ ...eventForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional description"
                value={eventForm.description}
                onChange={(e) =>
                  setEventForm({ ...eventForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Type</label>
              <Select
                value={eventForm.eventType}
                onValueChange={(value) => {
                  const typeConfig = EVENT_TYPES.find((t) => t.value === value);
                  setEventForm({
                    ...eventForm,
                    eventType: value,
                    color: typeConfig?.color || '#3b82f6',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <p className="text-sm text-muted-foreground">
                {selectedDate
                  ? format(selectedDate, 'MMMM d, yyyy')
                  : 'Select a date on the calendar'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEventDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEvent}>
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
