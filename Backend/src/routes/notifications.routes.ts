import express from 'express';
import { notificationService } from '../services/notification.service';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all notification routes
router.use(authMiddleware);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications with filtering options
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
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

export default router;
