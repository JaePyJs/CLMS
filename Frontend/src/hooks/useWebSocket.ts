import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { io, type Socket } from 'socket.io-client';

export interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: string;
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

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    connectionAttempts: 0,
  });

  const getWebSocketUrl = useCallback(() => {
    const explicit = import.meta.env.VITE_WS_URL as string | undefined;
    if (explicit) return explicit;
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const scheme = secure ? 'https' : 'http';
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const url = `${scheme}://${host}:3001`;
    console.log('[useWebSocket] Connecting to:', url);
    return url;
  }, []);

  const createWebSocket = useCallback(() => {
    const devBypass =
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';

    if (!token && !devBypass) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication token required for WebSocket connection',
      }));
      return null;
    }

    try {
      const socket = io(getWebSocketUrl(), {
        path: '/socket.io',
        auth: token ? { token } : undefined,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: reconnectInterval,
        reconnectionDelayMax: reconnectInterval * 16,
        randomizationFactor: 0.5,
        reconnectionAttempts: maxReconnectAttempts,
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
  }, [token, getWebSocketUrl, reconnectInterval, maxReconnectAttempts]);

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
    // Check if already connecting or connected using refs
    if (wsRef.current?.connected || state.isConnecting) {
      return;
    }

    const devBypass =
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';
    if (!token && !devBypass) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication required for WebSocket connection',
      }));
      return;
    }

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

    ws.on('connect', () => {
      if (wsRef.current !== ws) {
        console.debug(
          'WebSocket connected but socket reference mismatch (cleanup occurred)'
        );
        return;
      }
      console.debug('WebSocket connected');
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
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
        connectionAttempts: 0,
      }));
      setupHeartbeat();
      subscriptions.forEach((subscription) => {
        ws.emit('subscribe', { subscription });
      });
      onConnect?.();
    });

    ws.on('message', (data) => {
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
          console.error('WebSocket error:', message.data.error);
          onError?.(message.data.error);
          return;
        }

        // Handle subscription confirmations
        if (message.type === 'subscription_confirmed') {
          console.debug('Subscribed to:', message.data.subscription);
          return;
        }

        // Pass message to custom handler
        onMessage?.(message);

        // Handle different message types
        switch (message.type) {
          case 'student_activity_update':
            toast.info(
              `Student activity: ${message.data.studentName} - ${message.data.activityType}`
            );
            break;
          case 'equipment_status_update':
            toast.warning(
              `Equipment update: ${message.data.equipmentName} - ${message.data.status}`
            );
            break;
          case 'system_notification': {
            const notificationType = message.data
              .notificationType as keyof typeof toast;
            const title =
              typeof message.data.title === 'string'
                ? message.data.title
                : message.data.title?.message || 'Notification';
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
          case 'emergency_alert':
            toast.error(`🚨 EMERGENCY: ${message.data.message}`);
            break;
          default:
            console.debug('WebSocket message:', message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Listen for dashboard_data events (backend emits these directly)
    ws.on('dashboard_data', (data) => {
      console.log('[useWebSocket] dashboard_data received:', data);
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

      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }));

      onDisconnect?.();
    });

    ws.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      const errorMessage = 'WebSocket connection error';
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
        (ws as any).io.opts.reconnectionDelay = nextDelay;
      } catch {}
    });

    ws.on('reconnect_error', (err) => {
      console.warn('WebSocket reconnect error:', err);
    });

    ws.on('reconnect_failed', () => {
      console.warn('WebSocket reconnect failed, entering offline state');
      clearHeartbeat();
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

  const sendMessage = useCallback((message: any) => {
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
    (dataType: string, filters?: any) => {
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

  // Auto-connect on mount
  useEffect(() => {
    const devBypass =
      String(import.meta.env.VITE_WS_DEV_BYPASS || '').toLowerCase() === 'true';
    if (autoConnect && (token || devBypass)) {
      if (wsRef.current) {
        return;
      }
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [autoConnect, token, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHeartbeat();
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
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

  const handleNewMessage = useCallback((message: WebSocketMessage) => {
    setMessages((prev) => [...prev.slice(-99), message]); // Keep last 100 messages
  }, []);

  const wsOptions = useMemo(
    () => ({
      ...(options || {}),
      subscriptions: [subscription],
      onMessage: handleNewMessage,
    }),
    [subscription, handleNewMessage, options]
  );

  const ws = useWebSocket(wsOptions);

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
  const [dashboardData, setDashboardData] = useState<any>({});

  const handleDashboardMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'dashboard_data') {
      setDashboardData((prev: any) => ({
        ...prev,
        [message.data.dataType]: message.data.data,
      }));
    }
  }, []);

  const ws = useWebSocketSubscription('dashboard', {
    onMessage: handleDashboardMessage,
  });

  const refreshDashboard = useCallback(
    (dataType: string, filters?: any) => {
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

// Hook for activity updates
export const useActivityWebSocket = () => {
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const handleActivityMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'student_activity_update') {
      setRecentActivities((prev) => [message.data, ...prev.slice(0, 49)]); // Keep last 50
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

// Hook for equipment status updates
export const useEquipmentWebSocket = () => {
  const [equipmentStatus, setEquipmentStatus] = useState<any>({});

  const handleEquipmentMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'equipment_status_update') {
      setEquipmentStatus((prev: any) => ({
        ...prev,
        [message.data.equipmentId]: message.data,
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

// Hook for notifications
export const useNotificationWebSocket = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  const handleNotificationMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'system_notification') {
      setNotifications((prev) => [message.data, ...prev.slice(0, 49)]); // Keep last 50
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
