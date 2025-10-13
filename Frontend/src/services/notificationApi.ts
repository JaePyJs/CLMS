import api from './api';

export interface Notification {
  id: string;
  userId?: string;
  type: 'OVERDUE_BOOK' | 'FINE_ADDED' | 'FINE_WAIVED' | 'BOOK_DUE_SOON' | 
        'EQUIPMENT_EXPIRING' | 'SYSTEM_ALERT' | 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  read: boolean;
  readAt?: string;
  actionUrl?: string;
  metadata?: any;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    total: number;
    unreadCount: number;
  };
}

export interface NotificationStats {
  success: boolean;
  data: {
    total: number;
    unread: number;
    byType: Array<{ type: string; _count: number }>;
    byPriority: Array<{ priority: string; _count: number }>;
  };
}

export const notificationApi = {
  // Get all notifications with filters
  async getNotifications(params?: {
    userId?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<NotificationResponse> {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  // Get notification statistics
  async getStats(userId?: string): Promise<NotificationStats> {
    const response = await api.get('/notifications/stats', {
      params: { userId },
    });
    return response.data;
  },

  // Create a notification
  async createNotification(data: Partial<Notification>): Promise<{ success: boolean; data: Notification }> {
    const response = await api.post('/notifications', data);
    return response.data;
  },

  // Create multiple notifications
  async createBulkNotifications(notifications: Partial<Notification>[]): Promise<{ success: boolean; data: any }> {
    const response = await api.post('/notifications/bulk', { notifications });
    return response.data;
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<{ success: boolean; data: Notification }> {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  // Mark all notifications as read
  async markAllAsRead(userId?: string): Promise<{ success: boolean; data: any }> {
    const response = await api.patch('/notifications/read-all', { userId });
    return response.data;
  },

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  // Delete all read notifications
  async deleteReadNotifications(userId?: string): Promise<{ success: boolean; data: any; message: string }> {
    const response = await api.delete('/notifications/read/all', {
      params: { userId },
    });
    return response.data;
  },

  // Clean up expired notifications
  async cleanupExpired(): Promise<{ success: boolean; data: any; message: string }> {
    const response = await api.post('/notifications/cleanup');
    return response.data;
  },
};

export default notificationApi;
