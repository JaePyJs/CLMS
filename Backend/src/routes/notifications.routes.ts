/* eslint-disable no-console */
import express, { Request, Response, NextFunction } from 'express';
import { notifications_type } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { authMiddleware } from '../middleware/auth';
import { emailService } from '../services/emailService';
import { notificationWorker } from '../workers/notificationWorker';
import { body, query, validationResult } from 'express-validator';

const router = express.Router();

const NOTIFICATION_TYPES: readonly notifications_type[] = [
  'OVERDUE_BOOK',
  'FINE_ADDED',
  'FINE_WAIVED',
  'BOOK_DUE_SOON',
  'EQUIPMENT_EXPIRING',
  'SYSTEM_ALERT',
  'INFO',
  'WARNING',
  'ERROR',
  'SUCCESS',
];

const notificationTypeSet = new Set<notifications_type>(NOTIFICATION_TYPES);

type CreateNotificationInput = Parameters<
  typeof notificationService.createNotification
>[0];

type ScheduledNotificationRequest = Omit<
  CreateNotificationInput,
  'scheduled_for'
> & { scheduledFor: string | Date };

interface AuthenticatedUser {
  id?: string;
  role?: string;
  email?: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

function parseNotificationType(value: unknown): notifications_type | undefined {
  if (
    typeof value === 'string' &&
    notificationTypeSet.has(value as notifications_type)
  ) {
    return value as notifications_type;
  }

  return undefined;
}

function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
    return;
  }
  next();
}

// Apply authentication middleware to all notification routes
router.use(authMiddleware);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications with filtering options
 * @access  Private
 */
router.get(
  '/',
  [
    authMiddleware,
    query('unreadOnly').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('type')
      .optional()
      .isIn(NOTIFICATION_TYPES as string[]),
    handleValidationErrors,
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId =
        req.user?.id ??
        (typeof req.query.userId === 'string' ? req.query.userId : undefined);
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit
        ? Number.parseInt(req.query.limit as string, 10)
        : 50;
      const offset = req.query.offset
        ? Number.parseInt(req.query.offset as string, 10)
        : 0;
      const type = parseNotificationType(req.query.type);

      const filters: Parameters<
        typeof notificationService.getUserNotifications
      >[1] = {
        unreadOnly,
        limit,
        offset,
      };

      if (type !== undefined) {
        filters.type = type;
      }

      const result = await notificationService.getUserNotifications(
        userId,
        filters,
      );

      res.json({
        success: true,
        data: result,
      });
      return;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId =
      typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const stats = await notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
    return;
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private
 */
router.post('/', async (req: Request, res: Response): Promise<Response> => {
  try {
    const payload = req.body as CreateNotificationInput;
    const notification = await notificationService.createNotification(payload);

    res.status(201).json({
      success: true,
      data: notification,
    });
    return;
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch(
  '/:id/read',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Notification id is required',
        });
        return;
      }

      const notification = await notificationService.markAsRead(id);

      res.json({
        success: true,
        data: notification,
      });
      return;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for a user
 * @access  Private
 */
router.patch(
  '/read-all',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId =
        typeof req.body?.userId === 'string' ? req.body.userId : undefined;
      const result = await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        data: result,
      });
      return;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Notification id is required',
        });
        return;
      }

      await notificationService.deleteNotification(id);

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
      return;
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Delete all read notifications for a user
 * @access  Private
 */
router.delete(
  '/read/all',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId =
        typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const result = await notificationService.deleteReadNotifications(userId);

      res.json({
        success: true,
        data: result,
        message: 'Read notifications deleted successfully',
      });
      return;
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete read notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   POST /api/notifications/cleanup
 * @desc    Clean up expired notifications
 * @access  Private
 */
router.post(
  '/cleanup',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await notificationService.cleanupExpiredNotifications();

      res.json({
        success: true,
        data: result,
        message: 'Expired notifications cleaned up successfully',
      });
      return;
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean up expired notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences
 * @access  Private
 */
router.get(
  '/preferences',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const preferences =
        await notificationService.getUserNotificationPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
      return;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification preferences',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences
 * @access  Private
 */
router.put(
  '/preferences',
  [
    authMiddleware,
    body('emailNotifications').optional().isBoolean(),
    body('realTimeNotifications').optional().isBoolean(),
    body('dueDateReminders').optional().isBoolean(),
    body('overdueNotices').optional().isBoolean(),
    body('holdAvailable').optional().isBoolean(),
    body('returnConfirmations').optional().isBoolean(),
    body('fineAlerts').optional().isBoolean(),
    body('systemMaintenance').optional().isBoolean(),
    body('accountAlerts').optional().isBoolean(),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const preferences =
        await notificationService.updateUserNotificationPreferences(
          userId,
          req.body,
        );

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences updated successfully',
      });
      return;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   POST /api/notifications/scheduled
 * @desc    Create a scheduled notification
 * @access  Private
 */
router.post(
  '/scheduled',
  [
    authMiddleware,
    body('type').isIn(NOTIFICATION_TYPES as string[]),
    body('title').isLength({ min: 1, max: 200 }),
    body('message').isLength({ min: 1, max: 1000 }),
    body('scheduledFor').isISO8601().toDate(),
    body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    body('userId').optional().isUUID(),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { scheduledFor, ...rest } =
        req.body as ScheduledNotificationRequest;
      const scheduled_for =
        scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);

      const notification = await notificationService.createNotification({
        ...rest,
        scheduled_for,
      });

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Scheduled notification created successfully',
      });
      return;
    } catch (error) {
      console.error('Error creating scheduled notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create scheduled notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   POST /api/notifications/bulk
 * @desc    Send bulk notifications
 * @access  Private
 */
router.post(
  '/bulk',
  [
    authMiddleware,
    body('notifications').isArray({ min: 1 }),
    body('notifications.*.type').isIn(NOTIFICATION_TYPES as string[]),
    body('notifications.*.title').isLength({ min: 1, max: 200 }),
    body('notifications.*.message').isLength({ min: 1, max: 1000 }),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const notificationsPayload = req.body
        .notifications as CreateNotificationInput[];

      const results = await Promise.all(
        notificationsPayload.map(notification =>
          notificationService.createNotification(notification),
        ),
      );

      res.status(201).json({
        success: true,
        data: results,
        message: 'Bulk notifications created successfully',
      });
      return;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create bulk notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   POST /api/notifications/test-email
 * @desc    Send test email
 * @access  Private
 */
router.post(
  '/test-email',
  [authMiddleware, body('email').isEmail(), handleValidationErrors],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { email } = req.body as { email: string };
      const result = await emailService.testConfiguration(email);

      if (result.success) {
        res.json({
          success: true,
          message: 'Test email sent successfully',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
      });
      return;
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   GET /api/notifications/analytics
 * @desc    Get notification analytics
 * @access  Private
 */
router.get(
  '/analytics',
  [
    authMiddleware,
    query('days').optional().isInt({ min: 1, max: 365 }),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const parsedDays =
        typeof req.query.days === 'string'
          ? Number.parseInt(req.query.days, 10)
          : undefined;
      const days =
        parsedDays !== undefined &&
        Number.isInteger(parsedDays) &&
        parsedDays > 0
          ? parsedDays
          : 30;
      const userId = req.user?.id;

      const [notificationStats, emailStats] = await Promise.all([
        notificationService.getNotificationStats(userId),
        emailService.getDeliveryStats(days),
      ]);

      res.json({
        success: true,
        data: {
          notifications: notificationStats,
          emailDelivery: emailStats,
          period: `${days} days`,
        },
      });
      return;
    } catch (error) {
      console.error('Error fetching notification analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   GET /api/notifications/system-status
 * @desc    Get notification system status
 * @access  Private
 */
router.get(
  '/system-status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const [emailStatus, queueStats] = await Promise.all([
        emailService.getStatus(),
        notificationWorker.getQueueStats(),
      ]);

      res.json({
        success: true,
        data: {
          email: emailStatus,
          queues: queueStats,
          disabled: {
            queues: process.env.DISABLE_QUEUES === 'true',
            email: process.env.DISABLE_EMAIL === 'true',
          },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    } catch (error) {
      console.error('Error fetching system status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

/**
 * @route   POST /api/notifications/system-maintenance
 * @desc    Schedule system maintenance notification
 * @access  Private (Admin only)
 */
router.post(
  '/system-maintenance',
  [
    authMiddleware,
    body('title').isLength({ min: 1, max: 200 }),
    body('message').isLength({ min: 1, max: 1000 }),
    body('scheduledTime').isISO8601().toDate(),
    body('affectedUsers').optional().isArray(),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Admin privileges required',
        });
        return;
      }

      const { title, message, scheduledTime, affectedUsers } = req.body as {
        title: string;
        message: string;
        scheduledTime: Date | string;
        affectedUsers?: string[];
      };

      const scheduledPayload: Parameters<
        typeof notificationWorker.scheduleSystemMaintenance
      >[0] = {
        title,
        message,
        scheduledTime:
          scheduledTime instanceof Date
            ? scheduledTime
            : new Date(scheduledTime),
      };

      if (Array.isArray(affectedUsers)) {
        scheduledPayload.affectedUsers = affectedUsers;
      }

      const jobId =
        await notificationWorker.scheduleSystemMaintenance(scheduledPayload);

      res.json({
        success: true,
        data: { jobId },
        message: 'System maintenance notification scheduled successfully',
      });
      return;
    } catch (error) {
      console.error('Error scheduling system maintenance notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule system maintenance notification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  },
);

export default router;