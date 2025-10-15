import express from 'express';
import { notificationService } from '../services/notification.service';
import { authMiddleware } from '../middleware/auth';
import { emailService } from '../services/emailService';
import { notificationWorker } from '../workers/notificationWorker';
import { body, query, param, validationResult } from 'express-validator';

const router = express.Router();

// Apply authentication middleware to all notification routes
router.use(authMiddleware);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications with filtering options
 * @access  Private
 */
router.get('/', [
  authMiddleware,
  query('unreadOnly').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isIn(['OVERDUE_BOOK', 'FINE_ADDED', 'FINE_WAIVED', 'BOOK_DUE_SOON', 'EQUIPMENT_EXPIRING', 'SYSTEM_ALERT', 'INFO', 'WARNING', 'ERROR', 'SUCCESS']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId as string | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const type = req.query.type as any;

    const result = await notificationService.getUserNotifications(userId, {
      unreadOnly,
      limit,
      offset,
      type,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const stats = await notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const notification = await notificationService.createNotification(req.body);

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications/bulk
 * @desc    Create multiple notifications
 * @access  Private
 */
router.post('/bulk', async (req, res) => {
  try {
    const { notifications } = req.body;

    if (!Array.isArray(notifications)) {
      return res.status(400).json({
        success: false,
        message: 'Notifications must be an array',
      });
    }

    const result = await notificationService.createBulkNotifications(notifications);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bulk notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id);

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for a user
 * @access  Private
 */
router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.body.userId as string | undefined;
    const result = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id);

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   DELETE /api/notifications/read
 * @desc    Delete all read notifications for a user
 * @access  Private
 */
router.delete('/read/all', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const result = await notificationService.deleteReadNotifications(userId);

    res.json({
      success: true,
      data: result,
      message: 'Read notifications deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete read notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications/cleanup
 * @desc    Clean up expired notifications
 * @access  Private
 */
router.post('/cleanup', async (req, res) => {
  try {
    const result = await notificationService.cleanupExpiredNotifications();

    res.json({
      success: true,
      data: result,
      message: 'Expired notifications cleaned up successfully',
    });
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up expired notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Middleware to handle validation errors
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences
 * @access  Private
 */
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const preferences = await notificationService.getUserNotificationPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences
 * @access  Private
 */
router.put('/preferences', [
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
], async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const preferences = await notificationService.updateUserNotificationPreferences(userId, req.body);

    res.json({
      success: true,
      data: preferences,
      message: 'Notification preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications/scheduled
 * @desc    Create a scheduled notification
 * @access  Private
 */
router.post('/scheduled', [
  authMiddleware,
  body('type').isIn(['OVERDUE_BOOK', 'FINE_ADDED', 'FINE_WAIVED', 'BOOK_DUE_SOON', 'EQUIPMENT_EXPIRING', 'SYSTEM_ALERT', 'INFO', 'WARNING', 'ERROR', 'SUCCESS']),
  body('title').isLength({ min: 1, max: 200 }),
  body('message').isLength({ min: 1, max: 1000 }),
  body('scheduledFor').isISO8601().toDate(),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  body('userId').optional().isUUID(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const notification = await notificationService.createNotification({
      ...req.body,
      scheduledFor: new Date(req.body.scheduledFor),
    });

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Scheduled notification created successfully',
    });
  } catch (error) {
    console.error('Error creating scheduled notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scheduled notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications/bulk
 * @desc    Send bulk notifications
 * @access  Private
 */
router.post('/bulk', [
  authMiddleware,
  body('notifications').isArray({ min: 1 }),
  body('notifications.*.type').isIn(['OVERDUE_BOOK', 'FINE_ADDED', 'FINE_WAIVED', 'BOOK_DUE_SOON', 'EQUIPMENT_EXPIRING', 'SYSTEM_ALERT', 'INFO', 'WARNING', 'ERROR', 'SUCCESS']),
  body('notifications.*.title').isLength({ min: 1, max: 200 }),
  body('notifications.*.message').isLength({ min: 1, max: 1000 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { notifications } = req.body;

    const results = await Promise.all(
      notifications.map(notification =>
        notificationService.createNotification(notification)
      )
    );

    res.status(201).json({
      success: true,
      data: results,
      message: 'Bulk notifications created successfully',
    });
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bulk notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications/test-email
 * @desc    Send test email
 * @access  Private
 */
router.post('/test-email', [
  authMiddleware,
  body('email').isEmail(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { email } = req.body;
    const result = await emailService.testConfiguration(email);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/notifications/analytics
 * @desc    Get notification analytics
 * @access  Private
 */
router.get('/analytics', [
  authMiddleware,
  query('days').optional().isInt({ min: 1, max: 365 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
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
  } catch (error) {
    console.error('Error fetching notification analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/notifications/system-status
 * @desc    Get notification system status
 * @access  Private
 */
router.get('/system-status', authMiddleware, async (req, res) => {
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
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/notifications/system-maintenance
 * @desc    Schedule system maintenance notification
 * @access  Private (Admin only)
 */
router.post('/system-maintenance', [
  authMiddleware,
  body('title').isLength({ min: 1, max: 200 }),
  body('message').isLength({ min: 1, max: 1000 }),
  body('scheduledTime').isISO8601().toDate(),
  body('affectedUsers').optional().isArray(),
  handleValidationErrors,
], async (req, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required',
      });
    }

    const jobId = await notificationWorker.scheduleSystemMaintenance({
      title: req.body.title,
      message: req.body.message,
      scheduledTime: new Date(req.body.scheduledTime),
      affectedUsers: req.body.affectedUsers,
    });

    res.json({
      success: true,
      data: { jobId },
      message: 'System maintenance notification scheduled successfully',
    });
  } catch (error) {
    console.error('Error scheduling system maintenance notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule system maintenance notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
