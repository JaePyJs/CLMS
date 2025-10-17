import { Prisma, notifications, notifications_type, notifications_priority } from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { BaseRepository } from './base.repository';

/**
 * Notifications Repository
 * 
 * Extends BaseRepository to provide notification-specific operations.
 */
export class NotificationsRepository extends BaseRepository<
  notifications,
  Prisma.notificationsCreateInput,
  Prisma.notificationsUpdateInput
> {
  constructor() {
    super(prisma, 'notifications', 'id');
  }

  /**
   * Get notifications with flexible filtering options
   */
  async getNotifications(options: {
    userId?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    type?: notifications_type;
    priority?: notifications_priority;
    sortBy?: 'created_at' | 'priority' | 'expires_at';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    notifications: notifications[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const {
        userId,
        unreadOnly,
        limit = 50,
        offset = 0,
        type,
        priority,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options;

      const where: Prisma.notificationsWhereInput = {
        // Filter out expired notifications
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } }
        ],
      };

      if (userId) {
        where.user_id = userId;
      }

      if (unreadOnly) {
        where.read = false;
      }

      if (type) {
        where.type = type;
      }

      if (priority) {
        where.priority = priority;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        this.getModel().findMany({
          where,
          orderBy: [
            { priority: 'desc' },
            { [sortBy]: sortOrder }
          ],
          take: limit,
          skip: offset,
        }),
        this.getModel().count({ where }),
        this.getModel().count({
          where: { ...where, read: false }
        }),
      ]);

      return {
        notifications,
        total,
        unreadCount,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getNotifications', options);
    }
  }

  /**
   * Create a new notification with automatic field population
   */
  async createNotification(data: {
    type: notifications_type;
    title: string;
    message: string;
    priority?: notifications_priority;
    action_url?: string;
    metadata?: any;
    expires_at?: Date;
    user_id?: string;
  }): Promise<notifications> {
    try {
      const processedData = this.populateMissingFields({
        type: data.type,
        title: data.title.trim(),
        message: data.message.trim(),
        priority: data.priority || notifications_priority.NORMAL,
        action_url: data.action_url?.trim() || null,
        metadata: data.metadata || null,
        expires_at: data.expires_at || null,
        user_id: data.user_id || null,
        read: false,
        read_at: null,
      });

      const notification = await this.getModel().create({
        data: processedData,
      });

      logger.info('Notification created successfully', {
        id: notification.id,
        type: notification.type,
        user_id: notification.user_id,
      });

      return notification;
    } catch (error) {
      this.handleDatabaseError(error, 'createNotification', {
        type: data.type,
        user_id: data.user_id,
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<notifications | null> {
    try {
      const notification = await this.getModel().update({
        where: { id: notificationId },
        data: {
          read: true,
          read_at: new Date(),
          updated_at: new Date(),
        },
      });

      logger.info('Notification marked as read', { notificationId });
      return notification;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn('Attempted to mark non-existent notification as read', { notificationId });
        return null;
      }

      this.handleDatabaseError(error, 'markAsRead', { notificationId });
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId?: string): Promise<number> {
    try {
      const where: Prisma.notificationsWhereInput = { read: false };
      if (userId) {
        where.user_id = userId;
      }

      const result = await this.getModel().updateMany({
        where,
        data: {
          read: true,
          read_at: new Date(),
          updated_at: new Date(),
        },
      });

      logger.info('Marked all notifications as read', { 
        userId, 
        count: result.count 
      });

      return result.count;
    } catch (error) {
      this.handleDatabaseError(error, 'markAllAsRead', { userId });
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      await this.getModel().delete({
        where: { id: notificationId },
      });

      logger.info('Notification deleted successfully', { notificationId });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn('Attempted to delete non-existent notification', { notificationId });
        return false;
      }

      this.handleDatabaseError(error, 'deleteNotification', { notificationId });
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteReadNotifications(userId?: string): Promise<number> {
    try {
      const where: Prisma.notificationsWhereInput = { read: true };
      if (userId) {
        where.user_id = userId;
      }

      const result = await this.getModel().deleteMany({ where });

      logger.info('Deleted all read notifications', { 
        userId, 
        count: result.count 
      });

      return result.count;
    } catch (error) {
      this.handleDatabaseError(error, 'deleteReadNotifications', { userId });
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await this.getModel().deleteMany({
        where: {
          expires_at: {
            lt: new Date(),
          },
        },
      });

      logger.info('Cleaned up expired notifications', { count: result.count });
      return result.count;
    } catch (error) {
      this.handleDatabaseError(error, 'cleanupExpiredNotifications');
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId?: string): Promise<{
    total: number;
    unread: number;
    read: number;
    byType: Array<{ type: notifications_type; count: number }>;
    byPriority: Array<{ priority: notifications_priority; count: number }>;
  }> {
    try {
      const where: Prisma.notificationsWhereInput = {};
      if (userId) {
        where.user_id = userId;
      }

      const [total, unread, byType, byPriority] = await Promise.all([
        this.getModel().count({ where }),
        this.getModel().count({ where: { ...where, read: false } }),
        this.getModel().groupBy({
          by: ['type'],
          where,
          _count: true,
        }),
        this.getModel().groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
      ]);

      return {
        total,
        unread,
        read: total - unread,
        byType,
        byPriority,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getNotificationStats', { userId });
    }
  }

  /**
   * Create multiple notifications in bulk
   */
  async createBulkNotifications(notifications: Array<{
    type: notifications_type;
    title: string;
    message: string;
    priority?: notifications_priority;
    action_url?: string;
    metadata?: any;
    expires_at?: Date;
    user_id?: string;
  }>): Promise<notifications[]> {
    try {
      const processedData = notifications.map(n => this.populateMissingFields({
        type: n.type,
        title: n.title.trim(),
        message: n.message.trim(),
        priority: n.priority || notifications_priority.NORMAL,
        action_url: n.action_url?.trim() || null,
        metadata: n.metadata || null,
        expires_at: n.expires_at || null,
        user_id: n.user_id || null,
        read: false,
        read_at: null,
      }));

      const result = await this.getModel().createMany({
        data: processedData,
        skipDuplicates: true,
      });

      logger.info('Bulk notifications created', { count: result.count });
      
      // Return the created notifications
      return await this.getModel().findMany({
        where: {
          id: {
            in: processedData.map(n => n.id).slice(0, result.count)
          }
        }
      });
    } catch (error) {
      this.handleDatabaseError(error, 'createBulkNotifications', { count: notifications.length });
    }
  }
}

// Export repository instance
export const notificationsRepository = new NotificationsRepository();