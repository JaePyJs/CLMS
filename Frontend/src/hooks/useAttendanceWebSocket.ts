import { useCallback } from 'react';
import { useWebSocketSubscription } from './useWebSocket';

interface StudentReminder {
  type: 'overdue_book' | 'book_due_soon' | 'custom' | 'general';
  message: string;
  priority: 'low' | 'normal' | 'high';
  bookTitle?: string;
  dueDate?: string;
}

interface StudentCheckInEvent {
  type: 'student_checkin';
  data: {
    activityId: string;
    studentId: string;
    studentName: string;
    checkinTime: string;
    autoLogoutAt: string;
    reminders?: StudentReminder[];
    customMessage?: string;
  };
}

interface StudentCheckOutEvent {
  type: 'student_checkout';
  data: {
    activityId: string;
    studentId: string;
    studentName: string;
    checkoutTime: string;
    reason: 'manual' | 'auto';
    customMessage?: string;
  };
}

interface AnnouncementEvent {
  type: 'announcement';
  data: {
    message: string;
  };
}

interface AttendanceSectionChangeEvent {
  type: 'attendance_section_change';
  data: {
    studentId: string;
    studentName: string;
    from?: string[];
    to: string[];
    at: string;
  };
}

interface AttendanceOccupancyEvent {
  type: 'attendance_occupancy';
  data: {
    sections: Record<string, number>;
    updatedAt: string;
  };
}

interface AnnouncementConfigEvent {
  type: 'announcement_config';
  data: {
    quietMode: boolean;
    intervalSeconds: number;
    messages: string[];
  };
}

type AttendanceWebSocketEvent =
  | StudentCheckInEvent
  | StudentCheckOutEvent
  | AnnouncementEvent
  | AttendanceSectionChangeEvent
  | AttendanceOccupancyEvent
  | AnnouncementConfigEvent;

interface UseAttendanceWebSocketReturn {
  events: AttendanceWebSocketEvent[];
  isConnected: boolean;
  reconnect: () => void;
}

/**
 * useAttendanceWebSocket - Hook for real-time attendance updates
 *
 * Subscribes to student check-in and check-out WebSocket events.
 */
export const useAttendanceWebSocket = (): UseAttendanceWebSocketReturn => {
  const ws = useWebSocketSubscription('attendance');

  // Debug: log all messages
  if (ws.messages.length > 0) {
    console.info(
      '[useAttendanceWebSocket] All messages:',
      ws.messages.length,
      ws.messages.map((m) => m.type)
    );
  }

  const filtered = ws.messages.filter(
    (m) =>
      m.type === 'student_checkin' ||
      m.type === 'student_checkout' ||
      m.type === 'announcement' ||
      m.type === 'attendance_section_change' ||
      m.type === 'attendance_occupancy' ||
      m.type === 'announcement_config' ||
      m.type === 'attendance:checkin' ||
      m.type === 'attendance:checkout' ||
      m.type === 'attendance:section-change' ||
      m.type === 'attendance:occupancy' ||
      m.type === 'announcement:config'
  ) as unknown as AttendanceWebSocketEvent[];

  // Debug: log filtered events
  if (filtered.length > 0) {
    console.info(
      '[useAttendanceWebSocket] Filtered events:',
      filtered.length,
      filtered.map((e) => e.type)
    );
  }

  const reconnect = useCallback(() => {
    ws.disconnect();
    ws.connect();
  }, [ws]);
  return { events: filtered, isConnected: ws.isConnected, reconnect };
};
