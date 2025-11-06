import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  LogIn,
  LogOut,
  BookOpen,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface StudentReminder {
  type: 'overdue_book' | 'book_due_soon' | 'custom' | 'general';
  message: string;
  priority: 'low' | 'normal' | 'high';
  bookTitle?: string;
  dueDate?: Date;
}

interface AttendanceEvent {
  id: string;
  type: 'checkin' | 'checkout';
  studentName: string;
  timestamp: Date;
  reminders?: StudentReminder[];
  customMessage?: string;
}

interface ActiveStudent {
  id: string;
  studentId: string;
  name: string;
  checkinTime: Date;
  autoLogoutAt: Date;
  reminders?: StudentReminder[];
}

/**
 * AttendanceDisplay - Full-screen kiosk display for student attendance monitoring
 *
 * Shows welcome/goodbye messages and list of currently checked-in students.
 * Updates in real-time via WebSocket.
 */
export const AttendanceDisplay: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentEvent, setRecentEvent] = useState<AttendanceEvent | null>(null);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);

  // WebSocket connection for real-time updates
  const { events, isConnected } = useAttendanceWebSocket();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle incoming WebSocket events
  useEffect(() => {
    if (!events || events.length === 0) {
      return;
    }

    const latestEvent = events[events.length - 1];

    if (latestEvent.type === 'student_checkin') {
      const student: ActiveStudent = {
        id: latestEvent.data.activityId,
        studentId: latestEvent.data.studentId,
        name: latestEvent.data.studentName,
        checkinTime: new Date(latestEvent.data.checkinTime),
        autoLogoutAt: new Date(latestEvent.data.autoLogoutAt),
        reminders: latestEvent.data.reminders,
      };

      setActiveStudents((prev) => [...prev, student]);

      // Show welcome message
      setRecentEvent({
        id: latestEvent.data.activityId,
        type: 'checkin',
        studentName: latestEvent.data.studentName,
        timestamp: new Date(),
        reminders: latestEvent.data.reminders,
        customMessage: latestEvent.data.customMessage,
      });

      // Clear message after 5 seconds
      setTimeout(() => {
        setRecentEvent(null);
      }, 5000);
    } else if (latestEvent.type === 'student_checkout') {
      setActiveStudents((prev) =>
        prev.filter((s) => s.id !== latestEvent.data.activityId)
      );

      // Show goodbye message
      setRecentEvent({
        id: latestEvent.data.activityId,
        type: 'checkout',
        studentName: latestEvent.data.studentName,
        timestamp: new Date(),
        customMessage: latestEvent.data.customMessage,
      });

      // Clear message after 5 seconds
      setTimeout(() => {
        setRecentEvent(null);
      }, 5000);
    }
  }, [events]);

  // Check for auto-logout
  useEffect(() => {
    const checkAutoLogout = () => {
      const now = new Date();
      setActiveStudents((prev) =>
        prev.filter((student) => student.autoLogoutAt > now)
      );
    };

    const timer = setInterval(checkAutoLogout, 10000); // Check every 10 seconds

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTimeUntilLogout = (logoutTime: Date): string => {
    const now = new Date();
    const diff = logoutTime.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes < 0) {
      return 'Logging out...';
    }
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white p-8 flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold mb-2">Library Attendance</h1>
          <p className="text-xl text-blue-200">{formatDate(currentTime)}</p>
        </div>
        <div className="text-right">
          <div className="text-6xl font-mono font-bold">
            {formatTime(currentTime)}
          </div>
          <div className="flex items-center justify-end mt-2 gap-2">
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Welcome/Goodbye Message */}
      <AnimatePresence>
        {recentEvent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: '2rem' }}
          >
            <Card
              className={`${
                recentEvent.type === 'checkin'
                  ? 'bg-green-500/20 border-green-400'
                  : 'bg-orange-500/20 border-orange-400'
              } backdrop-blur-sm`}
            >
              <CardContent className="p-12 text-center">
                <div className="flex items-center justify-center mb-4">
                  {recentEvent.type === 'checkin' ? (
                    <LogIn className="w-20 h-20 text-green-400" />
                  ) : (
                    <LogOut className="w-20 h-20 text-orange-400" />
                  )}
                </div>
                <h2 className="text-7xl font-bold mb-4">
                  {recentEvent.type === 'checkin' ? 'Welcome' : 'Goodbye'}
                </h2>
                <p className="text-6xl font-semibold text-white">
                  {recentEvent.studentName}
                </p>

                {/* Custom message from librarian */}
                {recentEvent.customMessage && (
                  <p className="text-3xl text-yellow-300 mt-6 font-semibold">
                    {recentEvent.customMessage}
                  </p>
                )}

                {/* Student reminders */}
                {recentEvent.reminders && recentEvent.reminders.length > 0 && (
                  <div className="mt-6 space-y-3 max-w-3xl mx-auto">
                    {recentEvent.reminders.map((reminder, idx) => (
                      <Alert
                        key={idx}
                        variant={
                          reminder.priority === 'high'
                            ? 'destructive'
                            : 'default'
                        }
                        className={cn(
                          'text-left',
                          reminder.priority === 'high'
                            ? 'bg-red-500/20 border-red-400/50'
                            : 'bg-white/10 border-white/30'
                        )}
                      >
                        {reminder.type === 'overdue_book' && (
                          <AlertCircle className="h-5 w-5" />
                        )}
                        {reminder.type === 'book_due_soon' && (
                          <BookOpen className="h-5 w-5" />
                        )}
                        {(reminder.type === 'custom' ||
                          reminder.type === 'general') && (
                          <Info className="h-5 w-5" />
                        )}
                        <AlertDescription className="text-xl text-white">
                          {reminder.message}
                          {reminder.bookTitle && (
                            <span className="block text-base text-blue-200 mt-1">
                              Book: {reminder.bookTitle}
                            </span>
                          )}
                          {reminder.dueDate && (
                            <span className="block text-base text-blue-200 mt-1">
                              Due:{' '}
                              {new Date(reminder.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Students List */}
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8" />
          <h2 className="text-3xl font-semibold">
            Currently in Library ({activeStudents.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {activeStudents.map((student) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors">
                  <CardContent className="p-6">
                    <h3 className="text-2xl font-bold mb-2">{student.name}</h3>
                    <div className="space-y-2 text-blue-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          Checked in{' '}
                          {formatDistanceToNow(student.checkinTime, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LogOut className="w-4 h-4" />
                        <span className="font-mono">
                          Auto-logout:{' '}
                          {getTimeUntilLogout(student.autoLogoutAt)}
                        </span>
                      </div>

                      {/* Student reminders */}
                      {student.reminders &&
                        student.reminders.length > 0 &&
                        student.reminders.slice(0, 2).map((reminder, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'flex items-start gap-2 text-sm mt-2 p-2 rounded',
                              reminder.priority === 'high'
                                ? 'bg-red-500/20 text-red-200'
                                : 'bg-blue-500/20 text-blue-200'
                            )}
                          >
                            {reminder.type === 'overdue_book' && (
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            )}
                            {reminder.type === 'book_due_soon' && (
                              <BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            )}
                            {(reminder.type === 'custom' ||
                              reminder.type === 'general') && (
                              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            )}
                            <span className="flex-1">{reminder.message}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {activeStudents.length === 0 && !recentEvent && (
          <div className="text-center py-20">
            <Users className="w-24 h-24 mx-auto mb-6 text-blue-300 opacity-50" />
            <p className="text-3xl text-blue-200">
              No students currently checked in
            </p>
            <p className="text-xl text-blue-300 mt-2">
              Students will appear here when they check in
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-blue-300">
        <p className="text-lg">
          Library Management System - Attendance Monitoring
        </p>
      </footer>
    </div>
  );
};

export default AttendanceDisplay;
