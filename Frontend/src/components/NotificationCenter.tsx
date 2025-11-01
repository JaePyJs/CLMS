import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Settings,
  RefreshCw,
  Filter,
} from 'lucide-react';
import notificationApi from '../services/notificationApi';
import type { AppNotification } from '../services/notificationApi';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

const NotificationCenter: React.FC = () => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showPreferences, setShowPreferences] = useState(false);

  // Real-time WebSocket integration
  const { isConnected } = useNotificationWebSocket();

  // Handle real-time notifications
  const handleRealTimeNotification = useCallback((message: any) => {
    if (message.type === 'notification') {
      const newNotification = message.payload;

      // Add to notifications list
      setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);

      // Update unread count
      setUnreadCount(prev => prev + 1);

      // Show toast notification
      const priority = newNotification.priority;
      const toastConfig = {
        duration: priority === 'URGENT' ? 10000 : priority === 'HIGH' ? 5000 : 3000,
      };

      if (priority === 'URGENT') {
        toast.error(newNotification.title, {
          description: newNotification.message,
          ...toastConfig,
        });
      } else if (priority === 'HIGH') {
        toast.warning(newNotification.title, {
          description: newNotification.message,
          ...toastConfig,
        });
      } else {
        toast.info(newNotification.title, {
          description: newNotification.message,
          ...toastConfig,
        });
      }
    }
  }, []);

  // Initialize WebSocket listener
  useEffect(() => {
    if (isConnected && user) {
      // Subscribe to real-time notifications
      const socket = (window as any).socket;
      if (socket) {
        socket.emit('notification:subscribe');

        // Listen for real-time notifications
        socket.on('notification', handleRealTimeNotification);

        return () => {
          socket.off('notification', handleRealTimeNotification);
          socket.emit('notification:unsubscribe');
        };
      }
    }
  }, [isConnected, user, handleRealTimeNotification]);

  const fetchNotifications = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!token) return;

    try {
      setLoading(true);
      const response = await notificationApi.getNotifications({
        unreadOnly: filter === 'unread',
        limit: 50,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, token]);

  useEffect(() => {
    // Only fetch if authenticated
    if (!token) return;
    
    // Initial fetch
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeFilter, token]); // fetchNotifications will be captured by closure when effect re-runs

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Update UI optimistically
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Mark via WebSocket if available
      const socket = (window as any).socket;
      if (socket && isConnected) {
        socket.emit('notification:mark-read', { notificationId });
      }
      
      // Fallback to API call
      await notificationApi.markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationApi.deleteNotification(notificationId);
      await fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleDeleteRead = async () => {
    try {
      await notificationApi.deleteReadNotifications();
      await fetchNotifications();
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  };

  const getNotificationIcon = (type: AppNotification['type'], priority: AppNotification['priority']) => {
    const iconClass = `w-5 h-5 ${
      priority === 'URGENT'
        ? 'text-red-600'
        : priority === 'HIGH'
        ? 'text-orange-600'
        : priority === 'NORMAL'
        ? 'text-blue-600'
        : 'text-gray-600'
    }`;

    switch (type) {
      case 'ERROR':
        return <AlertCircle className={iconClass} />;
      case 'WARNING':
        return <AlertTriangle className={iconClass} />;
      case 'SUCCESS':
        return <CheckCircle className={iconClass} />;
      case 'INFO':
        return <Info className={iconClass} />;
      case 'OVERDUE_BOOK':
      case 'BOOK_DUE_SOON':
      case 'EQUIPMENT_EXPIRING':
        return <Clock className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  const getPriorityColor = (priority: AppNotification['priority']) => {
    switch (priority) {
      case 'URGENT':
        return 'border-l-red-600 bg-red-50';
      case 'HIGH':
        return 'border-l-orange-600 bg-orange-50';
      case 'NORMAL':
        return 'border-l-blue-600 bg-blue-50';
      case 'LOW':
        return 'border-l-gray-600 bg-gray-50';
      default:
        return 'border-l-gray-600 bg-gray-50';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell Icon with Badge and Status Indicator */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title={isConnected ? "Connected" : "Disconnected"}
        data-testid="notification-center"
      >
        <Bell className="w-6 h-6" />

        {/* Connection Status Indicator */}
        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 border border-gray-200 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Notifications
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} title={isConnected ? "Real-time connected" : "Real-time disconnected"} />
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchNotifications}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title="Refresh notifications"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowPreferences(!showPreferences)}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title="Notification preferences"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === 'unread'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="OVERDUE_BOOK">Overdue Books</option>
                  <option value="BOOK_DUE_SOON">Due Soon</option>
                  <option value="FINE_ADDED">Fines</option>
                  <option value="EQUIPMENT_EXPIRING">Equipment</option>
                  <option value="SYSTEM_ALERT">System Alerts</option>
                  <option value="INFO">Information</option>
                  <option value="WARNING">Warnings</option>
                  <option value="ERROR">Errors</option>
                  <option value="SUCCESS">Success</option>
                </select>
              </div>

              {/* Action Buttons */}
              {notifications.length > 0 && (
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={handleDeleteRead}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear read
                  </button>
                </div>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                  <Bell className="w-12 h-12 mb-2 text-gray-400" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${
                        notification.read ? 'opacity-75' : ''
                      } ${getPriorityColor(notification.priority)}`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type, notification.priority)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {notification.title}
                            </h4>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                            {notification.message}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-2">
                            {!notification.read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                                Read
                              </button>
                            )}
                            {notification.actionUrl && (
                              <a
                                href={notification.actionUrl}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-100 rounded transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded transition-colors ml-auto"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
