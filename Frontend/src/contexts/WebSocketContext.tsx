import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  useWebSocket,
  type WebSocketState,
  type WebSocketMessage,
} from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';

// Define types for WebSocket data structures

interface DashboardFilters {
  [key: string]: unknown;
}

interface RecentActivity {
  id: string;
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

interface EquipmentStatus {
  [equipmentId: string]: unknown;
}

interface Notification {
  id: string;
  message: string;
  timestamp: number;
  [key: string]: unknown;
}

interface DashboardData {
  [dataType: string]: unknown;
}

export interface WebSocketContextType extends WebSocketState {
  // Connection methods
  connect: () => void;
  disconnect: () => void;

  // Message methods
  sendMessage: (message: WebSocketMessage) => boolean;

  // Subscription methods
  subscribe: (subscription: string) => boolean;
  unsubscribe: (subscription: string) => boolean;

  // Dashboard methods
  requestDashboardData: (
    dataType: string,
    filters?: DashboardFilters
  ) => boolean;

  // Communication methods
  sendChatMessage: (
    message: string,
    targetRole?: string,
    targetUserId?: string
  ) => boolean;

  // Emergency methods
  triggerEmergencyAlert: (
    alertType: string,
    message: string,
    location?: string
  ) => boolean;

  // Real-time data
  recentActivities: RecentActivity[];
  equipmentStatus: EquipmentStatus;
  notifications: Notification[];
  dashboardData: DashboardData;

  // Utility methods
  clearNotifications: () => void;
  refreshDashboard: (dataType: string, filters?: DashboardFilters) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user } = useAuth();
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    []
  );
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({});

  // Memoized event handlers to prevent infinite re-renders
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      // Handle student check-in events (from attendance channel)
      case 'student_checkin':
      case 'attendance:checkin':
        setRecentActivities((prev: RecentActivity[]) => {
          const activityId =
            (message.data as any).activityId || `checkin-${Date.now()}`;
          // Deduplicate: check if activity with same ID or same student+type within 5 seconds already exists
          const isDuplicate = prev.some((a) => {
            if (a.id === activityId) return true;
            const timeDiff = Math.abs(Date.now() - (a.timestamp || 0));
            return (
              a.studentId === (message.data as any).studentId &&
              a.type === 'CHECK_IN' &&
              timeDiff < 5000
            );
          });
          if (isDuplicate) return prev;

          const activity: RecentActivity = {
            id: activityId,
            type: 'CHECK_IN',
            studentId: (message.data as any).studentId,
            studentName: (message.data as any).studentName,
            timestamp: Date.now(),
            activityType: 'CHECK_IN',
            ...message.data,
          };
          return [activity, ...prev.slice(0, 49)];
        });
        break;

      // Handle student check-out events (from attendance channel)
      case 'student_checkout':
      case 'attendance:checkout':
        setRecentActivities((prev: RecentActivity[]) => {
          const activityId =
            (message.data as any).activityId || `checkout-${Date.now()}`;
          // Deduplicate: check if activity with same ID or same student+type within 5 seconds already exists
          const isDuplicate = prev.some((a) => {
            if (a.id === activityId) return true;
            const timeDiff = Math.abs(Date.now() - (a.timestamp || 0));
            return (
              a.studentId === (message.data as any).studentId &&
              a.type === 'CHECK_OUT' &&
              timeDiff < 5000
            );
          });
          if (isDuplicate) return prev;

          const activity: RecentActivity = {
            id: activityId,
            type: 'CHECK_OUT',
            studentId: (message.data as any).studentId,
            studentName: (message.data as any).studentName,
            timestamp: Date.now(),
            activityType: 'CHECK_OUT',
            ...message.data,
          };
          return [activity, ...prev.slice(0, 49)];
        });
        break;

      case 'student_activity_update':
        setRecentActivities((prev: RecentActivity[]) => {
          const newActivity = message.data as RecentActivity;
          // Deduplicate by ID
          if (prev.some((a) => a.id === newActivity.id)) return prev;
          return [newActivity, ...prev.slice(0, 49)];
        });
        break;
      case 'equipment_status_update':
        setEquipmentStatus((prev: EquipmentStatus) => ({
          ...prev,
          [(message.data as { equipmentId: string }).equipmentId]: message.data,
        }));
        break;
      case 'system_notification':
        setNotifications((prev: Notification[]) => [
          message.data as Notification,
          ...prev.slice(0, 49),
        ]);
        break;
      case 'dashboard_data': {
        const { dataType, data } = message.data as {
          dataType: string;
          data: any;
        };
        setDashboardData((prev: DashboardData) => ({
          ...prev,
          [dataType]: data,
        }));

        if (dataType === 'activities' && Array.isArray(data)) {
          setRecentActivities(data);
        } else if (dataType === 'equipment' && typeof data === 'object') {
          setEquipmentStatus(data);
        }
        break;
      }
    }
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('WebSocket connection error:', error);
  }, []);

  const handleDisconnect = useCallback(() => {
    console.debug('WebSocket disconnected');
  }, []);

  const handleConnect = useCallback(() => {
    console.debug('WebSocket connected');
  }, []);

  const wsOptions = useMemo(
    () => ({
      autoConnect: true,
      // Subscribe to 'attendance' channel to receive student check-in/check-out events
      subscriptions: [
        'attendance',
        'activities',
        'equipment',
        'notifications',
        'dashboard',
      ],
      onMessage: handleMessage,
      onError: handleError,
      onDisconnect: handleDisconnect,
      onConnect: handleConnect,
    }),
    [handleMessage, handleError, handleDisconnect, handleConnect]
  );

  // WebSocket connection
  const ws = useWebSocket(wsOptions);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Refresh dashboard data
  const refreshDashboard = useCallback(
    (dataType: string, filters?: DashboardFilters) => {
      ws.requestDashboardData(dataType, filters);
    },
    [ws.requestDashboardData]
  );

  // Auto-refresh dashboard data when connected
  useEffect(() => {
    if (ws.isConnected && user) {
      // Request initial dashboard data
      const timeoutId = setTimeout(() => {
        refreshDashboard('overview');
        refreshDashboard('activities');
        refreshDashboard('equipment');
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [ws.isConnected, user, refreshDashboard]);

  const contextValue: WebSocketContextType = {
    ...ws,
    isConnected:
      ws.isConnected ||
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true',
    recentActivities,
    equipmentStatus,
    notifications,
    dashboardData,
    clearNotifications,
    refreshDashboard,
  };

  const DevWsBanner = ({
    isConnected,
    error,
    attempts,
  }: {
    isConnected: boolean;
    error: string | null;
    attempts: number;
  }) => {
    const isDev = String(import.meta.env.DEV).toLowerCase() === 'true';
    if (!isDev) return null;

    // Only show if there is an actual error
    if (!error) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: '6px 12px',
          background: '#991b1b',
          color: '#fff',
          fontSize: '12px',
        }}
      >
        WS Error: {error} {attempts ? `(attempts: ${attempts})` : ''}
      </div>
    );
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      <DevWsBanner
        isConnected={ws.isConnected}
        error={ws.error}
        attempts={ws.connectionAttempts}
      />
      {children}
    </WebSocketContext.Provider>
  );
}

// Default/fallback context for when used outside provider (avoids throwing)
const defaultContext: WebSocketContextType = {
  isConnected: false,
  isConnecting: false,
  lastMessage: null,
  connectionAttempts: 0,
  error: null,
  connect: () => {},
  disconnect: () => {},
  sendMessage: () => false,
  subscribe: () => false,
  unsubscribe: () => false,
  requestDashboardData: () => false,
  sendChatMessage: () => false,
  triggerEmergencyAlert: () => false,
  recentActivities: [],
  equipmentStatus: {},
  notifications: [],
  dashboardData: {},
  clearNotifications: () => {},
  refreshDashboard: () => {},
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    // In development, warn but don't throw to handle HMR/StrictMode edge cases
    if (import.meta.env.DEV) {
      console.warn(
        'useWebSocketContext called outside WebSocketProvider - returning default context'
      );
      return defaultContext;
    }
    throw new Error(
      'useWebSocketContext must be used within a WebSocketProvider'
    );
  }
  return context;
};

// Optional version that never throws
export const useWebSocketContextOptional = (): WebSocketContextType | null => {
  return useContext(WebSocketContext) ?? null;
};

export default WebSocketProvider;
