import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/authenticate';
// import { z } from 'zod'; // For future request validation
import { logger } from '../utils/logger';

const router = Router();
// const prisma = new PrismaClient();

// Validation schemas (for future request validation)
// const notificationSchema = z.object({
//   userId: z.string().optional(),
//   type: z.enum([
//     'OVERDUE_BOOK',
//     'FINE_ADDED',
//     'FINE_WAIVED',
//     'BOOK_DUE_SOON',
//     'EQUIPMENT_EXPIRING',
//     'SYSTEM_ALERT',
//     'INFO',
//     'WARNING',
//     'ERROR',
//     'SUCCESS'
//   ]),
//   title: z.string().min(1),
//   message: z.string().min(1),
//   priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
//   actionUrl: z.string().optional(),
//   metadata: z.any().optional(),
//   expiresAt: z.string().optional()
// });

// const markAsReadSchema = z.object({
//   notificationId: z.string()
// });

// const markAllAsReadSchema = z.object({
//   userId: z.string().optional()
// });

// GET /api/notifications - Get all notifications
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { unreadOnly, limit = 50, offset = 0, type } = req.query;

    const where: Record<string, unknown> = {};

    // Filter by user if authenticated
    if (userId) {
      where.userId = userId;
    }

    // Filter by unread status
    if (unreadOnly === 'true') {
      where.read = false;
    }

    // Filter by type
    if (type) {
      where.type = type;
    }

    // Get notifications
    const notifications = await prisma.app_notifications.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: Number(limit),
      skip: Number(offset),
    });

    // Get total count
    const total = await prisma.app_notifications.count({ where });

    // Get unread count
    const unreadCount = await prisma.app_notifications.count({
      where: {
        ...where,
        read: false,
      },
    });

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch notifications',
      },
    });
  }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const where: Record<string, unknown> = {};
    if (userId) {
      where.userId = userId;
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

    res.json({
      success: true,
      data: {
        total,
        unread,
        byType,
        byPriority,
      },
    });
  } catch (error) {
    logger.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to fetch notification statistics',
      },
    });
  }
});

// POST /api/notifications - Create a notification
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const notification = await prisma.app_notifications.create({
      data: {
        ...req.body,
        userId: req.body.userId || req.user?.userId,
        read: false,
        createdAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_ERROR',
        message: 'Failed to create notification',
      },
    });
  }
});

// POST /api/notifications/bulk - Create multiple notifications
router.post('/bulk', authenticate, async (req: Request, res: Response) => {
  try {
    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Notifications array is required',
        },
      });
    }

    const createdNotifications = await prisma.app_notifications.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: notifications.map((notif: any) => ({
        ...notif,
        userId: notif.userId || req.user?.userId,
        read: false,
        createdAt: new Date(),
      })),
    });

    res.json({
      success: true,
      data: {
        count: createdNotifications.count,
        notifications,
      },
    });
  } catch (error) {
    logger.error('Error creating bulk notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BULK_CREATE_ERROR',
        message: 'Failed to create bulk notifications',
      },
    });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const notification = await prisma.app_notifications.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    const updated = await prisma.app_notifications.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'Failed to mark notification as read',
      },
    });
  }
});

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || req.user?.userId;

    const result = await prisma.app_notifications.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        count: result.count,
      },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BULK_UPDATE_ERROR',
        message: 'Failed to mark all notifications as read',
      },
    });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const notification = await prisma.app_notifications.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    await prisma.app_notifications.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'Failed to delete notification',
      },
    });
  }
});

// DELETE /api/notifications/read/all - Delete all read notifications
router.delete(
  '/read/all',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;

      const result = await prisma.app_notifications.deleteMany({
        where: {
          userId,
          read: true,
        },
      });

      res.json({
        success: true,
        data: {
          count: result.count,
        },
        message: `Deleted ${result.count} read notifications`,
      });
    } catch (error) {
      logger.error('Error deleting read notifications:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete read notifications',
        },
      });
    }
  },
);

// POST /api/notifications/cleanup - Clean up expired notifications
router.post('/cleanup', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await prisma.app_notifications.deleteMany({
      where: {
        userId,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    res.json({
      success: true,
      data: {
        count: result.count,
      },
      message: `Cleaned up ${result.count} expired notifications`,
    });
  } catch (error) {
    logger.error('Error cleaning up notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLEANUP_ERROR',
        message: 'Failed to clean up notifications',
      },
    });
  }
});

export default router;
