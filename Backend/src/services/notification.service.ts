import { PrismaClient, notifications_type, notifications_priority } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

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

interface CreateNotificationInput {
  id?: string;
  type: notifications_type;
  title: string;
  message: string;
  priority?: notifications_priority;
  actionUrl?: string;
  metadata?: any;
  expiresAt?: Date;
  sendEmail?: boolean;
  emailTo?: string;
}

export const notificationService = {
  // Create a new notification
  async createNotification(data: CreateNotificationInput) {
    const notification = await prisma.notifications.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        id: data.id,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || 'NORMAL',
        action_url: data.action_url,
        metadata: data.metadata,
        expires_at: data.expires_at,
      },
    });

    // Send email if requested
    if (data.sendEmail && data.emailTo) {
      await this.sendEmailNotification(data.emailTo, notification);
    }

    return notification;
  },

  // Get all notifications for a user
  async getUserNotifications(id?: string, options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    type?: notifications_type;
  }) {
    const where: any = {};
    
    if (id) {
      where.id = id;
    }
    
    if (options?.unreadOnly) {
      where.read = false;
    }
    
    if (options?.type) {
      where.type = options.type;
    }

    // Filter out expired notifications
    where.OR = [
      { expires_at: null },
      { expires_at: { gt: new Date() } }
    ];

    const [notifications, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' }
        ],
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.notifications.count({ where })
    ]);

    return {
      notifications,
      total,
      unreadCount: await prisma.notifications.count({
        where: { ...where, read: false }
      })
    };
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    return await prisma.notifications.update({
      where: { id: notificationId },
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        read: true,
        read_at: new Date(),
      },
    });
  },

  // Mark all notifications as read for a user
  async markAllAsRead(id?: string) {
    const where: any = { read: false };
    if (id) {
      where.id = id;
    }

    return await prisma.notifications.updateMany({
      where,
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        read: true,
        read_at: new Date(),
      },
    });
  },

  // Delete a notification
  async deleteNotification(notificationId: string) {
    return await prisma.notifications.delete({
      where: { id: notificationId },
    });
  },

  // Delete all read notifications
  async deleteReadNotifications(id?: string) {
    const where: any = { read: true };
    if (id) {
      where.id = id;
    }

    return await prisma.notifications.deleteMany({
      where,
    });
  },

  // Clean up expired notifications
  async cleanupExpiredNotifications() {
    return await prisma.notifications.deleteMany({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });
  },

  // Send email notification
  async sendEmailNotification(to: string, notification: any) {
    try {
      const transporter = createEmailTransporter();
      
      const mailOptions = {
        from: process.env.SMTP_FROM || 'CLMS Notifications <noreply@clms.edu>',
        to,
        subject: `[${notification.priority}] ${notification.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${notification.title}</h2>
            <p style="color: #666;">${notification.message}</p>
            ${notification.action_url ? `
              <a href="${notification.action_url}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #007bff; 
                        color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                View Details
              </a>
            ` : ''}
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              This is an automated notification from the Centralized Library Management System.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  },

  // Bulk create notifications
  async createBulkNotifications(notifications: CreateNotificationInput[]) {
    const created = await prisma.notifications.createMany({
      data: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority || 'NORMAL',
        action_url: n.action_url,
        metadata: n.metadata,
        expires_at: n.expires_at,
      })),
    });

    return created;
  },

  // Get notification statistics
  async getNotificationStats(id?: string) {
    const where: any = {};
    if (id) {
      where.id = id;
    }

    const [total, unread, byType, byPriority] = await Promise.all([
      prisma.notifications.count({ where }),
      prisma.notifications.count({ where: { ...where, read: false } }),
      prisma.notifications.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
      prisma.notifications.groupBy({
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
