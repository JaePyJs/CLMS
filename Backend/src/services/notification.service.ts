/* eslint-disable @typescript-eslint/no-explicit-any */
// Local type definitions matching Prisma schema
type notifications_type =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'SUCCESS'
  | 'OVERDUE'
  | 'REMINDER'
  | 'BOOK_DUE_SOON'
  | 'OVERDUE_BOOK'
  | 'FINE_ADDED'
  | 'FINE_WAIVED'
  | 'SYSTEM_ALERT'
  | 'EQUIPMENT_EXPIRING';
type notifications_priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';
import { NotificationsRepository, UsersRepository } from '../repositories';
import { prisma } from '../utils/prisma';
import Bull from 'bull';

// Create notification processing queue
const notificationQueue = new Bull('notification processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Notification preferences interface
interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  realTimeNotifications: boolean;
  dueDateReminders: boolean;
  overdueNotices: boolean;
  holdAvailable: boolean;
  returnConfirmations: boolean;
  fineAlerts: boolean;
  systemMaintenance: boolean;
  accountAlerts: boolean;
}

// Enhanced notification input with more options
interface CreateNotificationInput {
  id?: string;
  type: notifications_type;
  title: string;
  message: string;
  priority?: notifications_priority;
  action_url?: string;
  metadata?: any;
  expires_at?: Date;
  sendEmail?: boolean;
  email_to?: string;
  user_id?: string;
  scheduled_for?: Date;
  templateId?: string;
  templateData?: Record<string, any>;
}

// Email transporter configuration (using nodemailer)
const createEmailTransporter = () => {
  // For development, you can use ethereal.email or configure your SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Repositories are used as static classes (no instances needed)

export const notificationService = {
  // Create a new notification with enhanced capabilities
  async createNotification(data: CreateNotificationInput) {
    // Check if notification should be scheduled
    if (this.isScheduledNotification(data)) {
      return this.scheduleNotification(data);
    }

    const notificationData = this.buildNotificationData(data);
    const notification =
      await NotificationsRepository.createNotification(notificationData);

    // Handle post-creation actions
    await this.handlePostCreationActions(data, notification);

    // Log notification creation for analytics
    this.logNotificationCreation(notification, data);

    return notification;
  },

  // Helper method to check if notification should be scheduled
  isScheduledNotification(data: CreateNotificationInput): boolean {
    return !!(data.scheduled_for && data.scheduled_for > new Date());
  },

  // Helper method to build notification data object
  buildNotificationData(data: CreateNotificationInput): any {
    const notificationData: any = {
      type: data.type,
      title: data.title,
      message: data.message,
    };

    // Use conditional assignment pattern for exactOptionalPropertyTypes compliance
    if (data.priority !== undefined) {
      notificationData.priority = data.priority;
    }
    if (data.action_url !== undefined) {
      notificationData.action_url = data.action_url;
    }
    if (data.metadata !== undefined) {
      notificationData.metadata = data.metadata;
    }
    if (data.expires_at !== undefined) {
      notificationData.expires_at = data.expires_at;
    }
    if (data.user_id !== undefined) {
      notificationData.user_id = data.user_id;
    }

    return notificationData;
  },

  // Helper method to handle post-creation actions
  async handlePostCreationActions(
    data: CreateNotificationInput,
    notification: any,
  ): Promise<void> {
    // Send real-time notification via WebSocket
    if (data.user_id) {
      this.sendRealTimeNotification(data.user_id, notification);
    }

    // Handle email sending based on user preferences or direct email
    await this.handleEmailSending(data, notification);
  },

  // Helper method to handle email sending logic
  async handleEmailSending(
    data: CreateNotificationInput,
    notification: any,
  ): Promise<void> {
    if (data.user_id) {
      const preferences = await this.getUserNotificationPreferences(
        data.user_id,
      );

      if (this.shouldSendEmailForType(data.type, preferences)) {
        const user = await UsersRepository.findById(data.user_id);

        if (user?.email) {
          await this.sendEmailNotification(
            user.email,
            notification,
            user.full_name || undefined,
          );
        }
      }
    } else if (data.sendEmail && data.email_to) {
      await this.sendEmailNotification(data.email_to, notification);
    }
  },

  // Helper method to log notification creation
  logNotificationCreation(
    notification: any,
    data: CreateNotificationInput,
  ): void {
    logger.info('Notification created', {
      notificationId: notification.id,
      type: data.type,
      userId: data.user_id,
      priority: data.priority,
    });
  },

  // Schedule a notification for future delivery
  async scheduleNotification(data: CreateNotificationInput) {
    const delay = data.scheduled_for.getTime() - Date.now();

    notificationQueue.add('send-scheduled-notification', data, {
      delay: delay,
      attempts: 3,
      backoff: 2000,
    });

    logger.info('Notification scheduled', {
      type: data.type,
      scheduled_for: data.scheduled_for,
      userId: data.user_id,
    });

    return {
      id: data.id,
      scheduled: true,
      scheduled_for: data.scheduled_for,
    };
  },

  // Send real-time notification via WebSocket
  sendRealTimeNotification(userId: string, notification: any) {
    try {
      websocketServer.broadcastToRoom(userId, {
        id: notification.id || crypto.randomUUID(),
        type: 'notification',
        data: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          actionUrl: notification.action_url,
          timestamp: notification.created_at,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to send real-time notification', {
        error,
        userId,
        notificationId: notification.id,
      });
    }
  },

  // Get user notification preferences
  async getUserNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    // Default preferences
    const defaultPreferences: NotificationPreferences = {
      userId,
      emailNotifications: true,
      realTimeNotifications: true,
      dueDateReminders: true,
      overdueNotices: true,
      holdAvailable: true,
      returnConfirmations: true,
      fineAlerts: true,
      systemMaintenance: false,
      accountAlerts: true,
    };

    // TODO: Implement system_config table for storing user preferences
    return defaultPreferences;

    /* try {
      // Check if user has custom preferences in system_config
      const config = await prisma.system_config.findUnique({
        where: { key: `notification_preferences_${userId}` },
      });

      if (config?.value) {
        return { ...defaultPreferences, ...JSON.parse(config.value) };
      }

      return defaultPreferences;
    } catch (error) {
      logger.error('Error fetching user notification preferences', {
        error,
        userId,
      });
      return defaultPreferences;
    }
    */
  },

  // Update user notification preferences
  async updateUserNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ) {
    // TODO: Implement system_config table for storing user preferences
    const currentPrefs = await this.getUserNotificationPreferences(userId);
    const updatedPrefs = { ...currentPrefs, ...preferences };

    logger.info('User notification preferences would be updated', {
      userId,
      preferences,
    });
    return updatedPrefs;

    /* try {
      const currentPrefs = await this.getUserNotificationPreferences(userId);
      const updatedPrefs = { ...currentPrefs, ...preferences };

      await prisma.system_config.upsert({
        where: { key: `notification_preferences_${userId}` },
        update: {
          value: JSON.stringify(updatedPrefs),
          updated_at: new Date(),
        },
        create: {
          id: crypto.randomUUID(),
          key: `notification_preferences_${userId}`,
          value: JSON.stringify(updatedPrefs),
          category: 'NOTIFICATIONS',
          description: `User ${userId} notification preferences`,
          updated_at: new Date(),
        },
      });

      logger.info('User notification preferences updated', {
        userId,
        preferences,
      });
      return updatedPrefs;
    } catch (error) {
      logger.error('Error updating user notification preferences', {
        error,
        userId,
      });
      throw error;
    }
    */
  },

  // Check if email should be sent for notification type
  shouldSendEmailForType(
    type: notifications_type,
    preferences: NotificationPreferences,
  ): boolean {
    switch (type) {
      case 'BOOK_DUE_SOON':
        return preferences.dueDateReminders;
      case 'OVERDUE_BOOK':
        return preferences.overdueNotices;
      case 'FINE_ADDED':
      case 'FINE_WAIVED':
        return preferences.fineAlerts;
      case 'SYSTEM_ALERT':
        return preferences.systemMaintenance;
      default:
        return preferences.emailNotifications;
    }
  },

  // Get all notifications for a user
  async getUserNotifications(
    id?: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: notifications_type;
    },
  ) {
    const queryOptions: any = {
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    };

    if (id !== undefined) {
      queryOptions.userId = id;
    }
    if (options?.unreadOnly !== undefined) {
      queryOptions.unreadOnly = options.unreadOnly;
    }
    if (options?.type !== undefined) {
      queryOptions.type = options.type;
    }

    const notifications =
      await NotificationsRepository.getNotifications(queryOptions);

    // Get total count and unread count separately
    const total = await NotificationsRepository.count({ userId: id });
    const unreadCount = await NotificationsRepository.count({
      userId: id,
      read: false,
    });

    return {
      notifications,
      total,
      unreadCount,
    };
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    return await NotificationsRepository.markAsRead(notificationId);
  },

  // Mark all notifications as read for a user
  async markAllAsRead(id?: string) {
    await NotificationsRepository.markAllAsRead(id);
    return { success: true };
  },

  // Delete a notification
  async deleteNotification(notificationId: string) {
    const success =
      await NotificationsRepository.deleteNotification(notificationId);
    if (!success) {
      throw new Error('Notification not found');
    }
    return { success: true };
  },

  // Delete all read notifications
  async deleteReadNotifications(id?: string) {
    const deletedCount =
      await NotificationsRepository.deleteReadNotifications(id);
    return { deletedCount };
  },

  // Clean up expired notifications
  async cleanupExpiredNotifications() {
    const deletedCount =
      await NotificationsRepository.cleanupExpiredNotifications();
    return { deletedCount };
  },

  // Send email notification with enhanced templates
  async sendEmailNotification(
    to: string,
    notification: any,
    userName?: string,
  ) {
    try {
      const transporter = createEmailTransporter();

      const emailTemplate = this.generateEmailTemplate(notification, userName);

      const mailOptions = {
        from: process.env.SMTP_FROM || 'CLMS Notifications <noreply@clms.edu>',
        to,
        subject: this.generateEmailSubject(notification),
        html: emailTemplate,
        text: this.generateTextTemplate(notification, userName),
      };

      const result = await transporter.sendMail(mailOptions);

      logger.info('Email notification sent', {
        to,
        notificationId: notification.id,
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      logger.error('Error sending email notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to,
        notificationId: notification.id,
      });
      return false;
    }
  },

  // Generate email subject with priority and type
  generateEmailSubject(notification: any): string {
    const priorityPrefix =
      notification.priority === 'URGENT'
        ? '🚨 URGENT: '
        : notification.priority === 'HIGH'
          ? '⚠️ IMPORTANT: '
          : '';

    const typePrefix = this.getTypeDisplayName(notification.type);

    return `${priorityPrefix}[${typePrefix}] ${notification.title}`;
  },

  // Generate HTML email template
  generateEmailTemplate(notification: any, userName?: string): string {
    const priorityColor = this.getPriorityColor(notification.priority);
    const typeIcon = this.getTypeIcon(notification.type);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .notification-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${priorityColor}; margin: 20px 0; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: ${priorityColor}; color: white; margin-bottom: 15px; }
          .action-button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
          .icon { font-size: 48px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="icon">${typeIcon}</div>
          <h1>${notification.title}</h1>
          ${userName ? `<p>Dear ${userName},</p>` : ''}
        </div>

        <div class="content">
          <div class="notification-box">
            <div class="priority-badge">${notification.priority}</div>
            <p style="font-size: 16px; margin-bottom: 20px;">${notification.message}</p>

            ${
              notification.action_url
                ? `
              <a href="${notification.action_url}" class="action-button">
                View Details →
              </a>
            `
                : ''
            }
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <h4 style="margin: 0 0 10px 0; color: #1976d2;">📋 Notification Details</h4>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Type:</strong> ${this.getTypeDisplayName(notification.type)}</li>
              <li><strong>Priority:</strong> ${notification.priority}</li>
              <li><strong>Date:</strong> ${new Date(notification.created_at).toLocaleString()}</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Centralized Library Management System</p>
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>If you need assistance, please contact the library support team.</p>
        </div>
      </body>
      </html>
    `;
  },

  // Generate plain text template
  generateTextTemplate(notification: any, userName?: string): string {
    const greeting = userName ? `Dear ${userName},` : '';
    const actionText = notification.action_url
      ? `\nAction required: ${notification.action_url}`
      : '';

    return `
${greeting}

${notification.title}
${'='.repeat(notification.title.length)}

Priority: ${notification.priority}
Type: ${this.getTypeDisplayName(notification.type)}
Date: ${new Date(notification.created_at).toLocaleString()}

${notification.message}
${actionText}

---
Centralized Library Management System
This is an automated message. Please do not reply to this email.
    `.trim();
  },

  // Get display name for notification type
  getTypeDisplayName(type: notifications_type): string {
    const typeNames: Record<string, string> = {
      OVERDUE_BOOK: 'Overdue Book',
      FINE_ADDED: 'Fine Added',
      FINE_WAIVED: 'Fine Waived',
      BOOK_DUE_SOON: 'Book Due Soon',
      EQUIPMENT_EXPIRING: 'Equipment Expiring',
      SYSTEM_ALERT: 'System Alert',
      INFO: 'Information',
      WARNING: 'Warning',
      ERROR: 'Error',
      SUCCESS: 'Success',
      OVERDUE: 'Overdue',
      REMINDER: 'Reminder',
    };

    return typeNames[type] || type;
  },

  // Get icon for notification type
  getTypeIcon(type: notifications_type): string {
    const icons: Record<string, string> = {
      OVERDUE_BOOK: '📚',
      FINE_ADDED: '💰',
      FINE_WAIVED: '✅',
      BOOK_DUE_SOON: '⏰',
      EQUIPMENT_EXPIRING: '🖥️',
      SYSTEM_ALERT: '🔔',
      INFO: 'ℹ️',
      WARNING: '⚠️',
      ERROR: '❌',
      SUCCESS: '✅',
      OVERDUE: '📚',
      REMINDER: '⏰',
    };

    return icons[type] || '📢';
  },

  // Get color for priority level
  getPriorityColor(priority: notifications_priority): string {
    const colors = {
      URGENT: '#dc3545',
      HIGH: '#fd7e14',
      NORMAL: '#007bff',
      LOW: '#6c757d',
    };

    return colors[priority] || '#6c757d';
  },

  // Bulk create notifications
  async createBulkNotifications(notifications: CreateNotificationInput[]) {
    const notificationData = notifications.map(n =>
      this.buildBulkNotificationData(n),
    );

    const created = await prisma.app_notifications.createMany({
      data: notificationData,
    });

    return created;
  },

  // Helper method to build notification data for bulk operations
  buildBulkNotificationData(notification: CreateNotificationInput): any {
    const notifData: any = {
      id: notification.id || crypto.randomUUID(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority || 'NORMAL',
      created_at: new Date(),
    };

    // Use conditional assignment pattern for exactOptionalPropertyTypes compliance
    if (notification.action_url !== undefined) {
      notifData.action_url = notification.action_url;
    }
    if (notification.metadata !== undefined) {
      notifData.metadata = notification.metadata;
    }
    if (notification.expires_at !== undefined) {
      notifData.expires_at = notification.expires_at;
    }
    if (notification.user_id !== undefined) {
      notifData.user_id = notification.user_id;
    }

    return notifData;
  },

  // Get notification statistics
  async getNotificationStats(id?: string) {
    const where: any = {};
    if (id) {
      where.id = id;
    }

    const [total, unread, byType, byPriority] = await Promise.all([
      prisma.app_notifications.count({ where }),
      prisma.app_notifications.count({ where: { ...where, read: false } }),
      prisma.app_notifications.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
      prisma.app_notifications.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      unread,
      byType,
      byPriority,
    };
  },
};
