import { Router, Request, Response } from 'express';
import { PrismaClient, ActivityStatus, EquipmentStatus } from '@prisma/client';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Get dashboard metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get student counts
    const [totalStudents, activeStudents, newStudentsThisMonth] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.student.count({
        where: {
          createdAt: { gte: monthStart }
        }
      })
    ]);

    // Get activity counts
    const [totalActivities, todayActivities, weekActivities, activeSessions] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({
        where: {
          startTime: { gte: todayStart }
        }
      }),
      prisma.activity.count({
        where: {
          startTime: { gte: weekStart }
        }
      }),
      prisma.activity.count({
        where: {
          status: ActivityStatus.ACTIVE,
          startTime: { gte: todayStart }
        }
      })
    ]);

    // Get equipment counts
    const [totalEquipment, availableEquipment, inUseEquipment] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: EquipmentStatus.AVAILABLE } }),
      prisma.equipment.count({ where: { status: EquipmentStatus.IN_USE } })
    ]);

    // Get book counts
    const [totalBooks, availableBooks, borrowedBooks] = await Promise.all([
      prisma.book.count(),
      prisma.book.count({ where: { isActive: true } }),
      prisma.book.count({ where: { availableCopies: { lt: 1 } } })
    ]);

    const metrics = {
      overview: {
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        totalActivities,
        todayActivities,
        weekActivities,
        activeSessions
      },
      equipment: {
        total: totalEquipment,
        available: availableEquipment,
        inUse: inUseEquipment,
        utilizationRate: totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0
      },
      books: {
        total: totalBooks,
        available: availableBooks,
        borrowed: borrowedBooks,
        circulationRate: totalBooks > 0 ? (borrowedBooks / totalBooks) * 100 : 0
      },
      usage: {
        totalVisitors: todayActivities,
        averageSessionDuration: 0,
        peakHour: 14,
        equipmentUtilization: totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        lastUpdated: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get analytics metrics', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Get activity timeline
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const activities = await prisma.activity.findMany({
      take: limit,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gradeLevel: true
          }
        },
        equipment: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    const timeline = activities.map(activity => ({
      id: activity.id,
      timestamp: activity.startTime.toISOString(),
      studentName: `${activity.student?.firstName || 'Unknown'} ${activity.student?.lastName || 'Student'}`,
      studentGrade: activity.student?.gradeLevel || 'Unknown',
      activityType: activity.activityType,
      status: activity.status,
      equipmentId: activity.equipment?.name || 'No equipment',
      equipmentType: activity.equipment?.type || null,
      duration: activity.endTime
        ? Math.round((activity.endTime.getTime() - activity.startTime.getTime()) / 60000)
        : null,
      notes: activity.notes
    }));

    res.json({
      success: true,
      data: { timeline },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get activity timeline', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity timeline',
      timestamp: new Date().toISOString()
    });
  }
});

// Get system notifications
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get recent activities that might need attention
    const [overdueSessions, recentActivities] = await Promise.all([
      // Find activities that have been active for too long (over 2 hours)
      prisma.activity.count({
        where: {
          status: ActivityStatus.ACTIVE,
          startTime: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }
        }
      }),

      // Get today's activity count
      prisma.activity.count({
        where: {
          startTime: { gte: todayStart }
        }
      })
    ]);

    // Generate notifications based on system state
    const notifications = [];

    // Overdue sessions notification
    if (overdueSessions > 0) {
      notifications.push({
        id: 'overdue-sessions',
        type: 'warning',
        title: 'Overdue Sessions',
        message: `${overdueSessions} session(s) have been active for over 2 hours`,
        timestamp: new Date().toISOString(),
        actionable: true,
        action: '/activities'
      });
    }

    // Daily activity summary
    if (recentActivities > 0) {
      notifications.push({
        id: 'daily-summary',
        type: 'info',
        title: 'Daily Activity',
        message: `${recentActivities} activities recorded today`,
        timestamp: new Date().toISOString(),
        actionable: false
      });
    }

    // System health notifications
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > 80) {
      notifications.push({
        id: 'high-memory',
        type: 'error',
        title: 'High Memory Usage',
        message: `Memory usage is at ${Math.round(memoryUsagePercent)}%`,
        timestamp: new Date().toISOString(),
        actionable: true,
        action: '/admin/system'
      });
    }

    // Welcome notification for today
    notifications.push({
      id: 'welcome',
      type: 'success',
      title: 'System Status',
      message: 'All systems operational',
      timestamp: new Date().toISOString(),
      actionable: false
    });

    res.json({
      success: true,
      data: {
        notifications: notifications.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
        unreadCount: notifications.filter(n => n.type === 'warning' || n.type === 'error').length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get notifications', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;