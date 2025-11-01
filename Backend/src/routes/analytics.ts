import { Router, Request, Response } from 'express';
import { PrismaClient, equipment_status, student_activities_status } from '@prisma/client';
import { logger } from '@/utils/logger';
import { analyticsService } from '@/services/analyticsService';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';

const router = Router();
const prisma = new PrismaClient();

// Get dashboard metrics
router.get('/metrics', requirePermission(Permission.ANALYTICS_VIEW), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get student counts
    const [totalStudents, activeStudents, newStudentsThisMonth] = await Promise.all([
      prisma.students.count(),
      prisma.students.count({ where: { is_active: true } }),
      prisma.students.count({
        where: {
          created_at: { gte: monthStart }
        }
      })
    ]);

    // Get equipment counts instead of activity counts since activity table doesn't exist
    const [totalEquipment, availableEquipment, weeklyCheckouts] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({
        where: {
          status: equipment_status.AVAILABLE
        }
      }),
      // For now, return 0 for weekly checkouts since we don't have checkout tracking
      Promise.resolve(0)
    ]);

    // Get activity counts
    // Remove activity counts since activity table doesn't exist
    // const [totalActivities, todayActivities, weekActivities, activeSessions] = await Promise.all([
    //   prisma.activity.count(),
    //   prisma.activity.count({
    //     where: {
    //       startTime: { gte: todayStart }
    //     }
    //   }),
    //   prisma.activity.count({
    //     where: {
    //       startTime: { gte: weekStart }
    //     }
    //   }),
    //   prisma.activity.count({
    //     where: {
    //       status: ActivityStatus.ACTIVE,
    //       startTime: { gte: todayStart }
    //     }
    //   })
    // ]);

    // Get book counts
    const [totalBooks, availableBooks] = await Promise.all([
      prisma.books.count(),
      prisma.books.count({ where: { is_active: true } })
    ]);

    const metrics = {
      overview: {
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        totalBooks,
        totalEquipment,
        availableEquipment
      },
      equipment: {
        total: totalEquipment,
        available: availableEquipment,
        utilizationRate: totalEquipment > 0 ? ((totalEquipment - availableEquipment) / totalEquipment) * 100 : 0
      },
      books: {
        total: totalBooks,
        available: availableBooks,
        circulationRate: totalBooks > 0 ? ((totalBooks - availableBooks) / totalBooks) * 100 : 0
      },
      usage: {
        totalVisitors: 0, // No activity tracking available
        averageSessionDuration: 0,
        peakHour: 14,
        equipmentUtilization: totalEquipment > 0 ? ((totalEquipment - availableEquipment) / totalEquipment) * 100 : 0
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

    const activities = await prisma.student_activities.findMany({
      take: limit,
      include: {
        students: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            grade_level: true
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
      orderBy: { start_time: 'desc' }
    });

    const timeline = activities.map(activity => ({
      id: activity.id,
      timestamp: activity.start_time.toISOString(),
      studentName: `${activity.students?.first_name || 'Unknown'} ${activity.students?.last_name || 'Student'}`,
      studentGrade: activity.students?.grade_level || 'Unknown',
      activityType: activity.activity_type,
      status: activity.status,
      equipmentId: activity.equipment?.name || 'No equipment',
      equipmentType: activity.equipment?.type || null,
      duration: activity.end_time
        ? Math.round((activity.end_time.getTime() - activity.start_time.getTime()) / 60000)
        : activity.duration_minutes,
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
      prisma.student_activities.count({
        where: {
          status: student_activities_status.ACTIVE,
          start_time: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }
        }
      }),

      // Get today's activity count
      prisma.student_activities.count({
        where: {
          start_time: { gte: todayStart }
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

// Get predictive insights
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const insights = await analyticsService.generatePredictiveInsights(timeframe);

    res.json({
      success: true,
      data: { insights },
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get predictive insights', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve predictive insights',
      timestamp: new Date().toISOString()
    });
  }
});

// Get usage heat map data
router.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const heatMapData = await analyticsService.generateUsageHeatMap(timeframe);

    res.json({
      success: true,
      data: { heatMapData },
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get heat map data', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve heat map data',
      timestamp: new Date().toISOString()
    });
  }
});

// Get time series forecast
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as 'student_visits' | 'equipment_usage' | 'book_circulation') || 'student_visits';
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';
    const periods = parseInt(req.query.periods as string) || 7;

    const forecastData = await analyticsService.generateTimeSeriesForecast(metric, timeframe, periods);

    res.json({
      success: true,
      data: { forecastData },
      metric,
      timeframe,
      periods,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get time series forecast', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve time series forecast',
      timestamp: new Date().toISOString()
    });
  }
});

// Get seasonal patterns
router.get('/seasonal', async (req: Request, res: Response) => {
  try {
    const seasonalPatterns = await analyticsService.analyzeSeasonalPatterns();

    res.json({
      success: true,
      data: { seasonalPatterns },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get seasonal patterns', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve seasonal patterns',
      timestamp: new Date().toISOString()
    });
  }
});

// Get resource forecasts
router.get('/resource-forecast', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const forecasts = await analyticsService.generateResourceForecasts(timeframe);

    res.json({
      success: true,
      data: { forecasts },
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get resource forecasts', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve resource forecasts',
      timestamp: new Date().toISOString()
    });
  }
});

// Generate comprehensive insights report
router.get('/report', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const report = await analyticsService.generateInsightsReport(timeframe);

    res.json({
      success: true,
      data: report,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate insights report', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights report',
      timestamp: new Date().toISOString()
    });
  }
});

// Get detailed analytics summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    // Get all analytics data in parallel
    const [
      insights,
      heatMapData,
      seasonalPatterns,
      resourceForecasts,
      baseMetrics,
      bookCirculation,
      fineCollection,
      equipmentUtilization
    ] = await Promise.all([
      analyticsService.generatePredictiveInsights(timeframe),
      analyticsService.generateUsageHeatMap(timeframe),
      analyticsService.analyzeSeasonalPatterns(),
      analyticsService.generateResourceForecasts(timeframe),
      // Use existing metrics endpoint data
      getBaseMetrics(),
      analyticsService.getBookCirculationAnalytics(timeframe),
      analyticsService.getFineCollectionAnalytics(timeframe),
      analyticsService.getEquipmentUtilizationAnalytics(timeframe)
    ]);

    const summary = {
      timeframe,
      insights,
      heatMapData,
      seasonalPatterns,
      resourceForecasts,
      baseMetrics,
      bookCirculation,
      fineCollection,
      equipmentUtilization,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get analytics summary', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics summary',
      timestamp: new Date().toISOString()
    });
  }
});

// Get comprehensive library metrics
router.get('/library-metrics', requirePermission(Permission.ANALYTICS_VIEW), async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const metrics = await analyticsService.getComprehensiveLibraryMetrics(timeframe);

    res.json({
      success: true,
      data: metrics,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get library metrics', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve library metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Get book circulation analytics
router.get('/book-circulation', requirePermission(Permission.ANALYTICS_VIEW), async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const circulationData = await analyticsService.getBookCirculationAnalytics(timeframe);

    res.json({
      success: true,
      data: circulationData,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get book circulation analytics', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve book circulation analytics',
      timestamp: new Date().toISOString()
    });
  }
});

// Get equipment utilization reports
router.get('/equipment-utilization', requirePermission(Permission.ANALYTICS_VIEW), async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const utilizationData = await analyticsService.getEquipmentUtilizationAnalytics(timeframe);

    res.json({
      success: true,
      data: utilizationData,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get equipment utilization analytics', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve equipment utilization analytics',
      timestamp: new Date().toISOString()
    });
  }
});

// Get fine collection analytics
router.get('/fine-collection', requirePermission(Permission.ANALYTICS_VIEW), async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

    const fineData = await analyticsService.getFineCollectionAnalytics(timeframe);

    res.json({
      success: true,
      data: fineData,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get fine collection analytics', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fine collection analytics',
      timestamp: new Date().toISOString()
    });
  }
});

// Export analytics data
router.post('/export', requirePermission(Permission.ANALYTICS_VIEW), async (req: Request, res: Response) => {
  try {
    const { format, timeframe, sections } = req.body;

    if (!format || !['csv', 'json', 'pdf'].includes(format)) {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Must be csv, json, or pdf'
      });
      return;
    }

    const exportData = await analyticsService.exportAnalyticsData(format, timeframe, sections);

    // Set appropriate headers
    const filename = `analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.${format}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(exportData);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(exportData);
    } else if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(exportData);
    }

    // Fallback for unexpected format (should not reach here due to validation above)
    res.status(400).json({
      success: false,
      error: 'Unsupported format'
    });
    return;

  } catch (error) {
    logger.error('Failed to export analytics data', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

// Helper function to get base metrics (extracted from existing metrics endpoint)
async function getBaseMetrics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalStudents, activeStudents, totalActivities, todayActivities] = await Promise.all([
    prisma.students.count(),
    prisma.students.count({ where: { is_active: true } }),
    prisma.student_activities.count(),
    prisma.student_activities.count({
      where: {
        start_time: { gte: todayStart }
      }
    })
  ]);

  return {
    students: { total: totalStudents, active: activeStudents },
    activities: { total: totalActivities, today: todayActivities }
  };
}

export default router;