import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, LogIn, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';
import { formatDistanceToNow } from 'date-fns';

interface AttendanceEvent {
  id: string;
  type: 'checkin' | 'checkout';
  studentName: string;
  timestamp: Date;
}

interface ActiveStudent {
  id: string;
  studentId: string;
  name: string;
  checkinTime: Date;
  autoLogoutAt: Date;
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
      };

      setActiveStudents((prev) => [...prev, student]);

      // Show welcome message
      setRecentEvent({
        id: latestEvent.data.activityId,
        type: 'checkin',
        studentName: latestEvent.data.studentName,
        timestamp: new Date(),
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
          <div className="text-6xl font-mono font-bold">{formatTime(currentTime)}</div>
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
            <Card className={`${
              recentEvent.type === 'checkin'
                ? 'bg-green-500/20 border-green-400'
                : 'bg-orange-500/20 border-orange-400'
            } backdrop-blur-sm`}>
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
                          Checked in {formatDistanceToNow(student.checkinTime, { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LogOut className="w-4 h-4" />
                        <span className="font-mono">
                          Auto-logout: {getTimeUntilLogout(student.autoLogoutAt)}
                        </span>
                      </div>
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
            <p className="text-3xl text-blue-200">No students currently checked in</p>
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
