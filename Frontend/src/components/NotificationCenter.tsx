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
} from 'lucide-react';
import notificationApi, { Notification } from '../services/notificationApi';
import { useAuth } from '@/contexts/AuthContext';

const NotificationCenter: React.FC = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await notificationApi.getNotifications({
        unreadOnly: filter === 'unread',
        limit: 50,
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, token]);

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
  }, [filter, token]); // fetchNotifications will be captured by closure when effect re-runs

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
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

  const getNotificationIcon = (type: Notification['type'], priority: Notification['priority']) => {
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

  const getPriorityColor = (priority: Notification['priority']) => {
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
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
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
                <h3 className="text-lg font-semibold text-gray-900">
                  Notifications
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
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

              {/* Action Buttons */}
              {notifications.length > 0 && (
                <div className="flex gap-2 mt-2">
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
