import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const wsRef = useRef<WebSocket | null>(null);
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.VITE_WS_URL
      ? new URL(import.meta.env.VITE_WS_URL).port
      : '3001'; // Use backend port by default
    const wsUrl = `${protocol}//${host}:${port}/ws?token=${encodeURIComponent(token || '')}`;
    return wsUrl;
  }, [token]);

  const createWebSocket = useCallback(() => {
    if (!token) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication token required for WebSocket connection',
      }));
      return null;
    }

    try {
      const ws = new WebSocket(getWebSocketUrl());
      return ws;
    } catch (error) {
      const errorMessage = `Failed to create WebSocket connection: ${(error as Error).message}`;
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
      }));
      onError?.(errorMessage);
      return null;
    }
  }, [token, getWebSocketUrl, onError]);

  const setupHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
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
    if (
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    if (!token) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication required for WebSocket connection',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    const ws = createWebSocket();
    if (!ws) {
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
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
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            data: { subscription },
          })
        );
      });

      onConnect?.();
      toast.success('Real-time connection established');
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

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
    };

    ws.onclose = (event) => {
      console.debug('WebSocket disconnected:', event.code, event.reason);
      clearHeartbeat();

      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }));

      onDisconnect?.();

      // Attempt reconnection if not a normal closure
      if (
        event.code !== 1000 &&
        state.connectionAttempts < maxReconnectAttempts
      ) {
        const nextAttempt = state.connectionAttempts + 1;
        setState((prev) => ({
          ...prev,
          connectionAttempts: nextAttempt,
        }));

        reconnectTimeoutRef.current = setTimeout(() => {
          console.debug(
            `Attempting WebSocket reconnection (${nextAttempt}/${maxReconnectAttempts})`
          );
          connect();
        }, reconnectInterval);
      } else if (state.connectionAttempts >= maxReconnectAttempts) {
        const errorMessage =
          'Failed to establish WebSocket connection after maximum attempts';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        onError?.(errorMessage);
        toast.error('Real-time connection failed');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      const errorMessage = 'WebSocket connection error';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
      }));
      onError?.(errorMessage);
    };
  }, [
    token,
    createWebSocket,
    setupHeartbeat,
    clearHeartbeat,
    subscriptions,
    reconnectInterval,
    maxReconnectAttempts,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
  ]);

  const disconnect = useCallback(() => {
    clearHeartbeat();
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
  }, []);

  const subscribe = useCallback(
    (subscription: string) => {
      return sendMessage({
        type: 'subscribe',
        data: { subscription },
      });
    },
    [sendMessage]
  );

  const unsubscribe = useCallback(
    (subscription: string) => {
      return sendMessage({
        type: 'unsubscribe',
        data: { subscription },
      });
    },
    [sendMessage]
  );

  const requestDashboardData = useCallback(
    (dataType: string, filters?: any) => {
      return sendMessage({
        type: 'dashboard_request',
        data: { dataType, filters },
      });
    },
    [sendMessage]
  );

  const sendChatMessage = useCallback(
    (message: string, targetRole?: string, targetUserId?: string) => {
      return sendMessage({
        type: 'chat_message',
        data: { message, targetRole, targetUserId },
      });
    },
    [sendMessage]
  );

  const triggerEmergencyAlert = useCallback(
    (alertType: string, message: string, location?: string) => {
      return sendMessage({
        type: 'emergency_alert',
        data: { alertType, message, location, severity: 'critical' },
      });
    },
    [sendMessage]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && user && token) {
      connect();
    }

    // Cleanup on unmount only
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
        wsRef.current = null;
      }
    };
  }, [autoConnect, user, token]); // Removed connect and disconnect from dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHeartbeat();
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearHeartbeat, clearReconnectTimeout]);

  return {
    ...state,
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
  options: Omit<WebSocketOptions, 'subscriptions'> = {}
) => {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  const handleNewMessage = useCallback((message: WebSocketMessage) => {
    setMessages((prev) => [...prev.slice(-99), message]); // Keep last 100 messages
  }, []);

  const ws = useWebSocket({
    ...options,
    subscriptions: [subscription],
    onMessage: handleNewMessage,
  });

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
