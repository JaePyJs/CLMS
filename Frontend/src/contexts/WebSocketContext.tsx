import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { WebSocketState } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';

interface WebSocketContextType extends WebSocketState {
  // Connection methods
  connect: () => void;
  disconnect: () => void;

  // Message methods
  sendMessage: (message: any) => boolean;

  // Subscription methods
  subscribe: (subscription: string) => boolean;
  unsubscribe: (subscription: string) => boolean;

  // Dashboard methods
  requestDashboardData: (dataType: string, filters?: any) => boolean;

  // Communication methods
  sendChatMessage: (message: string, targetRole?: string, targetUserId?: string) => boolean;

  // Emergency methods
  triggerEmergencyAlert: (alertType: string, message: string, location?: string) => boolean;

  // Real-time data
  recentActivities: any[];
  equipmentStatus: any;
  notifications: any[];
  dashboardData: any;

  // Utility methods
  clearNotifications: () => void;
  refreshDashboard: (dataType: string, filters?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [equipmentStatus, setEquipmentStatus] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>({});

  // WebSocket connection
  const ws = useWebSocket({
    autoConnect: true,
    subscriptions: ['activities', 'equipment', 'notifications', 'dashboard'],
    onMessage: (message) => {
      switch (message.type) {
        case 'student_activity_update':
          setRecentActivities(prev => [message.data, ...prev.slice(0, 49)]);
          break;
        case 'equipment_status_update':
          setEquipmentStatus(prev => ({
            ...prev,
            [message.data.equipmentId]: message.data
          }));
          break;
        case 'system_notification':
          setNotifications(prev => [message.data, ...prev.slice(0, 49)]);
          break;
        case 'dashboard_data':
          setDashboardData(prev => ({
            ...prev,
            [message.data.dataType]: message.data.data
          }));
          break;
      }
    },
    onError: (error) => {
      console.error('WebSocket connection error:', error);
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
    onConnect: () => {
      console.log('WebSocket connected');
    }
  });

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Refresh dashboard data
  const refreshDashboard = useCallback((dataType: string, filters?: any) => {
    ws.requestDashboardData(dataType, filters);
  }, [ws.requestDashboardData]);

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
  }, [ws.isConnected, user, refreshDashboard]);

  const contextValue: WebSocketContextType = {
    ...ws,
    recentActivities,
    equipmentStatus,
    notifications,
    dashboardData,
    clearNotifications,
    refreshDashboard
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketProvider;