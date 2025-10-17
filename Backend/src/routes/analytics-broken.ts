import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Get dashboard metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get student counts
    const [totalStudents, activeStudents, newStudentsThisMonth] =
      await Promise.all([
        prisma.students.count(),
        prisma.students.count({ where: { is_active: true } }),
        prisma.students.count({
          where: {
            created_at: { gte: monthStart },
          },
        }),
      ]);

    // Get activity counts
    const [totalActivities, todayActivities, weekActivities, activeSessions] =
      await Promise.all([
        prisma.student_activities.count(),
        prisma.student_activities.count({
          where: {
            start_time: { gte: todayStart },
          },
        }),
        prisma.student_activities.count({
          where: {
            start_time: { gte: weekStart },
          },
        }),
        prisma.student_activities.count({
          where: {
            status: 'ACTIVE',
            start_time: { gte: todayStart },
          },
        }),
      ]);

    // Get equipment counts
    const [totalEquipment, availableEquipment, inUseEquipment] =
      await Promise.all([
        prisma.equipment.count(),
        prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
        prisma.equipment.count({ where: { status: 'IN_USE' } }),
      ]);

    // Get book counts
    const [totalBooks, availableBooks] = await Promise.all([
      prisma.books.count(),
      prisma.books.count({ where: { available_copies: { gt: 0 } } }),
    ]);
    const borrowedBooks = totalBooks - availableBooks;

    // Calculate today's usage statistics
    const usageMetrics = {
      totalVisitors: todayActivities,
      averageSessionDuration: 0, // Would need calculation from actual session data
      peakHour: 14, // Would need calculation from actual data
      equipmentUtilization:
        totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0,
    };

    const metrics = {
      overview: {
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        totalActivities,
        todayActivities,
        weekActivities,
        activeSessions,
      },
      equipment: {
        total: totalEquipment,
        available: availableEquipment,
        inUse: inUseEquipment,
        utilizationRate:
          totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0,
      },
      books: {
        total: totalBooks,
        available: availableBooks,
        borrowed: borrowedBooks,
        circulationRate:
          totalBooks > 0 ? (borrowedBooks / totalBooks) * 100 : 0,
      },
      usage: usageMetrics,
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        lastUpdated: new Date().toISOString(),
      },
    };

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get analytics metrics', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get usage statistics for a period
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;

    let startDate: Date;
    switch (period) {
      case '1d':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get activities within the period
    const activities = await prisma.student_activities.findMany({
      where: {
        start_time: { gte: startDate },
      },
      orderBy: { start_time: 'desc' },
    });

    // Group activities by day
    const dailyStats = activities.reduce((acc: any, activity: any) => {
      const day = activity.start_time.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = {
          date: day,
          totalVisits: 0,
          uniqueStudents: new Set(),
          equipmentUsage: {},
          activityTypes: {},
        };
      }

      acc[day].totalVisits++;
      acc[day].uniqueStudents.add(activity.student_id);

      const activityType = activity.activity_type || 'unknown';
      acc[day].activityTypes[activityType] =
        (acc[day].activityTypes[activityType] || 0) + 1;

      if (activity.equipment_id) {
        const equipmentType = activity.equipment_id;
        acc[day].equipmentUsage[equipmentType] =
          (acc[day].equipmentUsage[equipmentType] || 0) + 1;
      }

      return acc;
    }, {} as any);

    // Convert Sets to counts and format the response
    const formattedStats = Object.values(dailyStats).map((stat: any) => ({
      date: stat.date,
      totalVisits: stat.totalVisits,
      uniqueStudents: stat.uniqueStudents.size,
      equipmentUsage: stat.equipmentUsage,
      activityTypes: stat.activityTypes,
    }));

    const usage = {
      period,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      totalActivities: activities.length,
      dailyStats: formattedStats,
      summary: {
        averageDailyVisits:
          formattedStats.length > 0
            ? Math.round(activities.length / formattedStats.length)
            : 0,
        peakDay:
          formattedStats.length > 0 && formattedStats[0]
            ? (formattedStats.reduce(
                (max, day) => (day.totalVisits > max.totalVisits ? day : max),
                formattedStats[0],
              )?.date ?? null)
            : null,
        mostUsedEquipment: (() => {
          const entries = Object.entries(
            formattedStats.reduce(
              (acc, day) => {
                Object.entries(day.equipmentUsage).forEach(
                  ([type, count]: [string, any]) => {
                    acc[type] = (acc[type] || 0) + count;
                  },
                );
                return acc;
              },
              {} as Record<string, number>,
            ),
          ).sort(([, a], [, b]) => b - a);
          return entries.length > 0 && entries[0] ? entries[0][0] : null;
        })(),
      },
    };

    res.json({
      success: true,
      data: usage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get usage statistics', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get activity timeline
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const activities = await prisma.student_activities.findMany({
      skip,
      take: limit,
      orderBy: { start_time: 'desc' },
    });

    const total = await prisma.student_activities.count();

    const timeline = activities.map((activity: any) => ({
      id: activity.id,
      timestamp: activity.start_time.toISOString(),
      studentName: activity.student_name || 'Unknown',
      studentGrade: activity.grade_level || 'N/A',
      activityType: activity.activity_type,
      status: activity.status,
      equipmentId: activity.equipment_id || 'No equipment',
      equipmentType: null,
      duration: activity.end_time
        ? Math.round(
            (activity.end_time.getTime() - activity.start_time.getTime()) /
              60000,
          ) // minutes
        : null,
      notes: activity.notes,
    }));

    res.json({
      success: true,
      data: {
        timeline,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get activity timeline', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity timeline',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get system notifications
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Get recent activities that might need attention
    const [overdueSessions, recentActivities] = await Promise.all([
      // Find activities that have been active for too long (over 2 hours)
      prisma.student_activities.count({
        where: {
          status: 'ACTIVE',
          start_time: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
        },
      }),

      // Get today's activity count
      prisma.student_activities.count({
        where: {
          start_time: { gte: todayStart },
        },
      }),
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
        action: '/activities',
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
        actionable: false,
      });
    }

    // System health notifications (placeholder for future expansion)
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > 80) {
      notifications.push({
        id: 'high-memory',
        type: 'error',
        title: 'High Memory Usage',
        message: `Memory usage is at ${Math.round(memoryUsagePercent)}%`,
        timestamp: new Date().toISOString(),
        actionable: true,
        action: '/admin/system',
      });
    }

    // Welcome notification for today
    notifications.push({
      id: 'welcome',
      type: 'success',
      title: 'System Status',
      message: 'All systems operational',
      timestamp: new Date().toISOString(),
      actionable: false,
    });

    res.json({
      success: true,
      data: {
        notifications: notifications.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
        unreadCount: notifications.filter(
          n => n.type === 'warning' || n.type === 'error',
        ).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get notifications', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
      timestamp: new Date().toISOString(),
    });
  }
});

// Export analytics data
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'json', period = '30d', type = 'activities' } = req.query;

    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let data: any = {};

    switch (type) {
      case 'activities':
        data = await prisma.student_activities.findMany({
          where: { start_time: { gte: startDate } },
          orderBy: { start_time: 'desc' },
        });
        break;

      case 'students':
        data = await prisma.students.findMany();
        break;

      case 'equipment':
        data = await prisma.equipment.findMany();
        break;

      default:
        throw new Error('Invalid export type');
    }

    // Set appropriate headers based on format
    const filename = `clms-export-${type}-${period}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      // Convert to CSV (simplified implementation)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.csv"`,
      );

      // Simple CSV conversion - would need proper CSV library for production
      const csv = JSON.stringify(data, null, 2);
      res.send(csv);
    } else {
      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.json"`,
      );

      res.json({
        success: true,
        metadata: {
          exportDate: new Date().toISOString(),
          period,
          type,
          format,
          recordCount: Array.isArray(data) ? data.length : 1,
        },
        data,
      });
    }
  } catch (error) {
    logger.error('Failed to export analytics data', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
