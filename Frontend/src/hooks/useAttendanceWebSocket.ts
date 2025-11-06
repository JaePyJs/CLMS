import { useState, useEffect, useCallback, useRef } from 'react';

interface StudentCheckInEvent {
  type: 'student_checkin';
  data: {
    activityId: string;
    studentId: string;
    studentName: string;
    checkinTime: string;
    autoLogoutAt: string;
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
  };
}

type AttendanceWebSocketEvent = StudentCheckInEvent | StudentCheckOutEvent;

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
  const [events, setEvents] = useState<AttendanceWebSocketEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    try {
      // Determine WebSocket URL based on environment
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('[AttendanceWebSocket] Connected');
        setIsConnected(true);

        // Subscribe to attendance events
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: ['attendance'],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle student check-in/check-out events
          if (
            message.type === 'student_checkin' ||
            message.type === 'student_checkout'
          ) {
            setEvents((prev) => [...prev, message as AttendanceWebSocketEvent]);
          }
        } catch (error) {
          console.error('[AttendanceWebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[AttendanceWebSocket] Error:', error);
      };

      ws.onclose = () => {
        // eslint-disable-next-line no-console
        console.log('[AttendanceWebSocket] Disconnected');
        setIsConnected(false);

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('[AttendanceWebSocket] Attempting to reconnect...');
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[AttendanceWebSocket] Connection error:', error);
      setIsConnected(false);

      // Retry connection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    events,
    isConnected,
    reconnect,
  };
};
