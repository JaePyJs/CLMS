import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useDebugValue,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { io, type Socket } from 'socket.io-client';

export interface WebSocketMessage<T = unknown> {
  id: string;
  type: string;
  data: T;
  timestamp: string;
}

// Typed message data payloads
interface ErrorMessageData {
  error: string;
  code?: string;
}

interface SubscriptionMessageData {
  subscription: string;
}

interface StudentActivityMessageData {
  studentId: string;
  studentName: string;
  activityType: string;
  timestamp?: string;
}

interface EquipmentStatusMessageData {
  equipmentId: string;
  equipmentName: string;
  status: string;
  studentId?: string;
}

interface SystemNotificationMessageData {
  notificationType?: string;
  title: string | { message: string };
  message?: string;
}

interface EmergencyAlertMessageData {
  message: string;
  severity?: string;
  location?: string;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  connectionAttempts: number;
}

export interface WebSocketOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  subscriptions?: string[];
  kioskMode?: boolean; // Allow unauthenticated connection for kiosk displays
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

export const useWebSocket = (options: WebSocketOptions = {}) => {
  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    subscriptions = [],
    kioskMode = false,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
  } = options;

  const { user, token } = useAuth();
  const devBypassFlag =
    String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';
  const wsRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Use ref to track connecting state synchronously to prevent race conditions
  const isConnectingRef = useRef(false);

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    connectionAttempts: 0,
  });

  const getWebSocketUrl = useCallback(() => {
    // In development, connect directly to backend using the same hostname as the frontend
    // to avoid CORS issues between localhost and 127.0.0.1
    if (import.meta.env.DEV) {
      const hostname =
        typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const url = `http://${hostname}:3001`;
      console.info('[useWebSocket] Using direct backend URL:', url);
      return url;
    }

    // In production, check for explicit WS URL
    const explicit = import.meta.env.VITE_WS_URL as string | undefined;
    if (explicit) {
      console.info('[useWebSocket] Using explicit URL:', explicit);
      return explicit;
    }

    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const scheme = secure ? 'https' : 'http';
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const url = `${scheme}://${host}:3001`;
    console.info('[useWebSocket] Using constructed URL:', url);
    return url;
  }, []);

  const createWebSocket = useCallback(() => {
    const devBypass =
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';

    // Allow connection in kioskMode without authentication
    if (!token && !devBypass && !kioskMode) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication token required for WebSocket connection',
      }));
      return null;
    }

    try {
      const socketUrl = getWebSocketUrl();
      console.debug('[useWebSocket] Creating socket to:', socketUrl, {
        kioskMode,
      });

      // Determine auth payload
      // In kioskMode, explicitly use kioskMode auth (don't use user token even if available)
      // This prevents kiosk connections from disconnecting user sessions
      let authPayload:
        | { token?: string; devBypass?: boolean; kioskMode?: boolean }
        | undefined;
      if (kioskMode) {
        authPayload = { kioskMode: true };
      } else if (token) {
        authPayload = { token };
      } else if (devBypass) {
        authPayload = { devBypass: true };
      }

      const socket = io(socketUrl, {
        path: '/socket.io',
        auth: authPayload,
        transports: ['websocket', 'polling'], // Try websocket first for faster connection
        reconnection: true,
        reconnectionDelay: reconnectInterval,
        reconnectionDelayMax: reconnectInterval * 16,
        randomizationFactor: 0.5,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 20000,
        forceNew: true,
      });
      return socket;
    } catch (error) {
      const errorMessage = `Failed to create WebSocket connection: ${(error as Error).message}`;
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
      }));
      if (onError) {
        onError(errorMessage);
      }
      return null;
    }
  }, [
    token,
    getWebSocketUrl,
    reconnectInterval,
    maxReconnectAttempts,
    kioskMode,
  ]);

  const setupHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.connected) {
        wsRef.current.emit('ping');
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Check if already connecting or connected using refs (synchronous check to prevent race conditions)
    if (wsRef.current?.connected || isConnectingRef.current) {
      return;
    }

    const devBypass =
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';
    // Allow connection in kioskMode without authentication
    if (!token && !devBypass && !kioskMode) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication required for WebSocket connection',
      }));
      return;
    }

    // Set connecting flag synchronously before async state update
    isConnectingRef.current = true;

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      isConnected: false, // Reset connected state when starting new connection
      error: null,
    }));

    const ws = createWebSocket();
    if (!ws) {
      return;
    }

    wsRef.current = ws;
    try {
      (window as unknown as { socket?: Socket }).socket = ws;
    } catch {}

    console.info('[useWebSocket] Socket created, waiting for connection...');

    ws.on('connect', () => {
      if (wsRef.current !== ws) {
        console.debug(
          'WebSocket connected but socket reference mismatch (cleanup occurred)'
        );
        return;
      }
      console.info('[useWebSocket] Connected! Socket ID:', ws.id);
      isConnectingRef.current = false; // Reset connecting flag
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
        connectionAttempts: 0,
      }));

      // Setup heartbeat
      setupHeartbeat();

      // Subscribe to specified channels
      subscriptions.forEach((subscription) => {
        ws.emit('subscribe', { subscription });
      });

      onConnect?.();
      toast.success('Real-time connection established');
    });

    ws.on('welcome', () => {
      if (wsRef.current !== ws) return;
      console.info('[useWebSocket] Received welcome event');
      isConnectingRef.current = false; // Reset connecting flag
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
        connectionAttempts: 0,
      }));
      setupHeartbeat();
      subscriptions.forEach((subscription) => {
        console.info(`[useWebSocket] Subscribing to: ${subscription}`);
        ws.emit('subscribe', { subscription });
      });
      onConnect?.();
    });

    // Listen for subscription confirmations
    ws.on('subscription_confirmed', (data: { subscription: string }) => {
      console.info('[useWebSocket] Subscription confirmed:', data);
    });

    // Listen for errors
    ws.on('error', (data: { message?: string; error?: string }) => {
      console.error('[useWebSocket] Error event:', data);
    });

    ws.on('message', (data) => {
      console.info('[useWebSocket] Received message event:', data);
      try {
        const message: WebSocketMessage =
          typeof data === 'string' ? JSON.parse(data) : data;

        setState((prev) => ({
          ...prev,
          lastMessage: message,
        }));

        // Handle pong response
        if (message.type === 'pong') {
          return;
        }

        // Handle welcome message
        if (message.type === 'welcome') {
          console.debug('WebSocket welcome message:', message.data);
          return;
        }

        // Handle errors
        if (message.type === 'error') {
          const errorData = message.data as ErrorMessageData;
          console.error('WebSocket error:', errorData.error);
          onError?.(errorData.error);
          return;
        }

        // Handle subscription confirmations
        if (message.type === 'subscription_confirmed') {
          const subData = message.data as SubscriptionMessageData;
          console.debug('Subscribed to:', subData.subscription);
          return;
        }

        // Pass message to custom handler
        onMessage?.(message);

        // Handle different message types
        switch (message.type) {
          case 'student_activity_update': {
            const activityData = message.data as StudentActivityMessageData;
            toast.info(
              `Student activity: ${activityData.studentName} - ${activityData.activityType}`
            );
            break;
          }
          case 'equipment_status_update': {
            const equipmentData = message.data as EquipmentStatusMessageData;
            toast.warning(
              `Equipment update: ${equipmentData.equipmentName} - ${equipmentData.status}`
            );
            break;
          }
          case 'system_notification': {
            const notificationData =
              message.data as SystemNotificationMessageData;
            const notificationType =
              notificationData.notificationType as keyof typeof toast;
            const title =
              typeof notificationData.title === 'string'
                ? notificationData.title
                : notificationData.title?.message || 'Notification';
            if (
              notificationType &&
              typeof toast[notificationType] === 'function'
            ) {
              (toast[notificationType] as (message: string) => void)(title);
            } else {
              toast.info(title);
            }
            break;
          }
          case 'emergency_alert': {
            const alertData = message.data as EmergencyAlertMessageData;
            toast.error(`🚨 EMERGENCY: ${alertData.message}`);
            break;
          }
          default:
            console.debug('WebSocket message:', message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Listen for dashboard_data events (backend emits these directly)
    ws.on('dashboard_data', (data) => {
      try {
        const message: WebSocketMessage = {
          id: `dashboard_${Date.now()}`,
          type: 'dashboard_data',
          data: data,
          timestamp: new Date().toISOString(),
        };

        setState((prev) => ({
          ...prev,
          lastMessage: message,
        }));

        onMessage?.(message);
      } catch (error) {
        console.error('[useWebSocket] Error handling dashboard_data:', error);
      }
    });

    ws.on('disconnect', (reason) => {
      console.debug('WebSocket disconnected:', reason);
      clearHeartbeat();
      isConnectingRef.current = false; // Reset connecting flag

      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }));

      onDisconnect?.();
    });

    ws.on('connect_error', (error) => {
      console.error('[useWebSocket] Connection error:', error.message, error);
      const errorMessage = 'WebSocket connection error';
      isConnectingRef.current = false; // Reset connecting flag
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
      }));
      onError?.(errorMessage);
    });

    // Track reconnection attempts and failover to offline state
    ws.on('reconnect_attempt', (attempt: number) => {
      setState((prev) => ({
        ...prev,
        isConnecting: true,
        connectionAttempts: attempt,
      }));
      const nextDelay = Math.min(
        reconnectInterval * Math.pow(2, attempt - 1),
        reconnectInterval * 16
      );
      try {
        const socketIO = ws as unknown as {
          io: { opts: { reconnectionDelay: number } };
        };
        socketIO.io.opts.reconnectionDelay = nextDelay;
      } catch {}
    });

    ws.on('reconnect_error', (err) => {
      console.warn('WebSocket reconnect error:', err);
    });

    ws.on('reconnect_failed', () => {
      console.warn('WebSocket reconnect failed, entering offline state');
      clearHeartbeat();
      isConnectingRef.current = false; // Reset connecting flag
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: 'offline',
      }));
    });
  }, [
    token,
    createWebSocket,
    setupHeartbeat,
    clearHeartbeat,
    subscriptions,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
  ]);

  const disconnect = useCallback(() => {
    clearHeartbeat();
    clearReconnectTimeout();
    isConnectingRef.current = false; // Reset connecting flag

    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null,
      connectionAttempts: 0,
    });
  }, [clearHeartbeat, clearReconnectTimeout]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.connected) {
      wsRef.current.emit('message', message);
      return true;
    } else {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
  }, []);

  const subscribe = useCallback((subscription: string) => {
    if (wsRef.current?.connected) {
      wsRef.current.emit('subscribe', { subscription });
      return true;
    }
    return false;
  }, []);

  const unsubscribe = useCallback((subscription: string) => {
    if (wsRef.current?.connected) {
      wsRef.current.emit('unsubscribe', { subscription });
      return true;
    }
    return false;
  }, []);

  const requestDashboardData = useCallback(
    (dataType: string, filters?: Record<string, unknown>) => {
      if (wsRef.current?.connected) {
        wsRef.current.emit('dashboard_request', { dataType, filters });
        return true;
      }
      return false;
    },
    []
  );

  const sendChatMessage = useCallback(
    (message: string, targetRole?: string, targetUserId?: string) => {
      if (wsRef.current?.connected) {
        wsRef.current.emit('chat_message', {
          message,
          targetRole,
          targetUserId,
        });
        return true;
      }
      return false;
    },
    []
  );

  const triggerEmergencyAlert = useCallback(
    (alertType: string, message: string, location?: string) => {
      if (wsRef.current?.connected) {
        wsRef.current.emit('emergency_alert', {
          alertType,
          message,
          location,
          severity: 'critical',
        });
        return true;
      }
      return false;
    },
    []
  );

  // Track if component is mounted (helps with StrictMode double-mount)
  const isMountedRef = useRef(true);

  // Auto-connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    const devBypass =
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';
    // Allow auto-connect in kioskMode without authentication
    if (autoConnect && (token || devBypass || kioskMode)) {
      // Small delay to handle StrictMode double-mount
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && !wsRef.current?.connected) {
          connect();
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [autoConnect, token, kioskMode, connect]);

  // Cleanup on unmount - but with a delay to handle StrictMode
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearHeartbeat();
      clearReconnectTimeout();
      // Delay disconnect to allow StrictMode remount
      setTimeout(() => {
        if (!isMountedRef.current && wsRef.current) {
          wsRef.current.disconnect();
          wsRef.current = null;
        }
      }, 200);
    };
  }, [clearHeartbeat, clearReconnectTimeout]);

  return {
    ...state,
    isConnected: state.isConnected || Boolean(wsRef.current?.connected),
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    requestDashboardData,
    sendChatMessage,
    triggerEmergencyAlert,
  };
};

// Hook for specific subscription types
export const useWebSocketSubscription = (
  subscription: string,
  options?: Omit<WebSocketOptions, 'subscriptions'>
) => {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  // Extract primitive values from options to use as stable dependencies
  const kioskMode = options?.kioskMode;
  const autoConnect = options?.autoConnect;
  const reconnectInterval = options?.reconnectInterval;
  const maxReconnectAttempts = options?.maxReconnectAttempts;
  const heartbeatInterval = options?.heartbeatInterval;

  const handleNewMessage = useCallback(
    (message: WebSocketMessage) => {
      console.info(
        `[useWebSocketSubscription:${subscription}] Received message:`,
        message.type,
        message
      );
      setMessages((prev) => [...prev.slice(-99), message]); // Keep last 100 messages
    },
    [subscription]
  );

  const wsOptions = useMemo(
    () => ({
      kioskMode,
      autoConnect,
      reconnectInterval,
      maxReconnectAttempts,
      heartbeatInterval,
      subscriptions: [subscription],
      onMessage: handleNewMessage,
    }),
    [
      subscription,
      handleNewMessage,
      kioskMode,
      autoConnect,
      reconnectInterval,
      maxReconnectAttempts,
      heartbeatInterval,
    ]
  );

  const ws = useWebSocket(wsOptions);

  // Debug: log connection state changes only when they change (use useEffect)
  useEffect(() => {
    console.debug(
      `[useWebSocketSubscription:${subscription}] Connected: ${ws.isConnected}, Messages: ${messages.length}`
    );
  }, [subscription, ws.isConnected, messages.length]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    ...ws,
    messages,
    clearMessages,
  };
};

// Hook for real-time dashboard updates
export const useDashboardWebSocket = () => {
  const [dashboardData, setDashboardData] = useState<Record<string, unknown>>(
    {}
  );

  const handleDashboardMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'dashboard_data') {
      const data = message.data as { dataType: string; data: unknown };
      setDashboardData((prev: Record<string, unknown>) => ({
        ...prev,
        [data.dataType]: data.data,
      }));
    }
  }, []);

  const ws = useWebSocketSubscription('dashboard', {
    onMessage: handleDashboardMessage,
  });

  const refreshDashboard = useCallback(
    (dataType: string, filters?: Record<string, unknown>) => {
      ws.requestDashboardData(dataType, filters);
    },
    [ws]
  );

  return {
    ...ws,
    dashboardData,
    refreshDashboard,
  };
};

interface ActivityData {
  id?: string;
  studentId: string;
  studentName: string;
  activityType: string;
  timestamp?: string;
}

// Hook for activity updates
export const useActivityWebSocket = () => {
  const [recentActivities, setRecentActivities] = useState<ActivityData[]>([]);

  const handleActivityMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'student_activity_update') {
      setRecentActivities((prev) => [
        message.data as ActivityData,
        ...prev.slice(0, 49),
      ]); // Keep last 50
    }
  }, []);

  const ws = useWebSocketSubscription('activities', {
    onMessage: handleActivityMessage,
  });

  return {
    ...ws,
    recentActivities,
  };
};

interface EquipmentStatusData {
  equipmentId: string;
  status: string;
  equipmentName?: string;
  studentId?: string;
  timestamp?: string;
}

// Hook for equipment status updates
export const useEquipmentWebSocket = () => {
  const [equipmentStatus, setEquipmentStatus] = useState<
    Record<string, EquipmentStatusData>
  >({});

  const handleEquipmentMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'equipment_status_update') {
      const data = message.data as EquipmentStatusData;
      setEquipmentStatus((prev: Record<string, EquipmentStatusData>) => ({
        ...prev,
        [data.equipmentId]: data,
      }));
    }
  }, []);

  const ws = useWebSocketSubscription('equipment', {
    onMessage: handleEquipmentMessage,
  });

  return {
    ...ws,
    equipmentStatus,
  };
};

interface NotificationData {
  id?: string;
  title: string;
  message?: string;
  type?: string;
  timestamp?: string;
}

// Hook for notifications
export const useNotificationWebSocket = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const handleNotificationMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'system_notification') {
      setNotifications((prev) => [
        message.data as NotificationData,
        ...prev.slice(0, 49),
      ]); // Keep last 50
    }
  }, []);

  const ws = useWebSocketSubscription('notifications', {
    onMessage: handleNotificationMessage,
  });

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    ...ws,
    notifications,
    clearNotifications,
  };
};

export default useWebSocket;
