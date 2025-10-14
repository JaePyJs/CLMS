import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { reportingService, ReportConfig, AlertConfig } from '@/services/reportingService';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Create a new report configuration
router.post('/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;

    // Validate required fields
    const requiredFields = ['name', 'type', 'recipients', 'format'];
    for (const field of requiredFields) {
      if (!config[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    const newConfig = await reportingService.createReportConfig(config);

    res.json({
      success: true,
      data: { config: newConfig },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create report configuration', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to create report configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Generate a report on-demand
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { configId, config } = req.body;

    if (!config && !configId) {
      return res.status(400).json({
        success: false,
        error: 'Either configId or config object must be provided',
        timestamp: new Date().toISOString()
      });
    }

    let reportConfig;

    if (configId) {
      // In a real implementation, you would fetch the config from database
      // For now, use a default config
      reportConfig = {
        id: configId,
        name: 'On-Demand Report',
        type: 'on_demand',
        recipients: [],
        includeInsights: true,
        includeForecasts: true,
        includeHeatMaps: true,
        format: 'html',
        isActive: true
      };
    } else {
      reportConfig = config;
    }

    const report = await reportingService.generateReport(reportConfig);

    res.json({
      success: true,
      data: { report },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate report', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
      timestamp: new Date().toISOString()
    });
  }
});

// Get report history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const reports = await reportingService.getReportHistory(limit, offset);

    res.json({
      success: true,
      data: { reports, limit, offset },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get report history', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve report history',
      timestamp: new Date().toISOString()
    });
  }
});

// Create a new alert configuration
router.post('/alerts/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;

    // Validate required fields
    const requiredFields = ['name', 'type', 'threshold', 'operators', 'recipients'];
    for (const field of requiredFields) {
      if (config[field] === undefined) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    const newConfig = await reportingService.createAlertConfig(config);

    res.json({
      success: true,
      data: { config: newConfig },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create alert configuration', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to create alert configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Test alert functionality
router.post('/alerts/test', async (req: Request, res: Response) => {
  try {
    const { type, recipients } = req.body;

    if (!type || !recipients) {
      return res.status(400).json({
        success: false,
        error: 'Type and recipients are required',
        timestamp: new Date().toISOString()
      });
    }

    // Create a test alert configuration
    const testConfig = {
      id: 'test_alert_' + Date.now(),
      name: 'Test Alert',
      type,
      threshold: 50,
      operators: 'greater_than' as const,
      recipients,
      isActive: true,
      cooldownPeriod: 0
    };

    // In a real implementation, you would trigger the alert
    // For now, just return success
    logger.info(`Test alert created: ${type} to ${recipients.join(', ')}`);

    res.json({
      success: true,
      message: 'Test alert configuration created',
      data: { config: testConfig },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create test alert', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to create test alert',
      timestamp: new Date().toISOString()
    });
  }
});

// Get system status for reporting
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      reporting: {
        activeReports: 0, // Would be populated from actual active reports
        totalReportsGenerated: 0, // Would be populated from database
        lastReportGenerated: null,
        scheduledReports: 0
      },
      alerts: {
        activeAlerts: 0, // Would be populated from actual active alerts
        alertsTriggeredToday: 0,
        lastAlertTriggered: null
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get reporting status', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reporting status',
      timestamp: new Date().toISOString()
    });
  }
});

// Get available report templates
router.get('/templates', requirePermission(Permission.REPORTS_VIEW), asyncHandler(async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'weekly_operational',
        name: 'Weekly Operational Report',
        description: 'Comprehensive weekly operational overview with KPIs and insights',
        category: 'operational',
        type: 'weekly',
        sections: [
          { id: 'overview', type: 'overview', title: 'Library Overview', enabled: true, order: 1 },
          { id: 'kpi', type: 'kpi', title: 'Key Performance Indicators', enabled: true, order: 2 },
          { id: 'activities', type: 'table', title: 'Recent Activities', enabled: true, order: 3 },
          { id: 'insights', type: 'insights', title: 'Predictive Insights', enabled: true, order: 4 }
        ],
        includeInsights: true,
        includeForecasts: false,
        includeHeatMaps: false,
        includeROI: false,
        includeBenchmarks: false
      },
      {
        id: 'monthly_strategic',
        name: 'Monthly Strategic Report',
        description: 'Strategic analysis with ROI, benchmarks, and long-term trends',
        category: 'strategic',
        type: 'monthly',
        sections: [
          { id: 'overview', type: 'overview', title: 'Executive Summary', enabled: true, order: 1 },
          { id: 'kpi', type: 'kpi', title: 'Performance Metrics', enabled: true, order: 2 },
          { id: 'roi', type: 'roi', title: 'Return on Investment', enabled: true, order: 3 },
          { id: 'benchmarks', type: 'benchmark', title: 'Industry Benchmarks', enabled: true, order: 4 },
          { id: 'insights', type: 'insights', title: 'Strategic Insights', enabled: true, order: 5 }
        ],
        includeInsights: true,
        includeForecasts: true,
        includeHeatMaps: true,
        includeROI: true,
        includeBenchmarks: true
      },
      {
        id: 'reading_analytics',
        name: 'Student Reading Analytics',
        description: 'Detailed analysis of student reading patterns and engagement',
        category: 'administrative',
        type: 'monthly',
        sections: [
          { id: 'overview', type: 'overview', title: 'Reading Program Overview', enabled: true, order: 1 },
          { id: 'reading_patterns', type: 'reading_patterns', title: 'Reading Patterns', enabled: true, order: 2 },
          { id: 'activities', type: 'table', title: 'Top Readers', enabled: true, order: 3 },
          { id: 'insights', type: 'insights', title: 'Reading Insights', enabled: true, order: 4 }
        ],
        includeInsights: true,
        includeReadingPatterns: true,
        includeROI: false,
        includeBenchmarks: true
      },
      {
        id: 'space_utilization',
        name: 'Space Utilization Report',
        description: 'Analysis of library space usage and optimization recommendations',
        category: 'operational',
        type: 'weekly',
        sections: [
          { id: 'overview', type: 'overview', title: 'Space Overview', enabled: true, order: 1 },
          { id: 'space_utilization', type: 'space_utilization', title: 'Area Utilization', enabled: true, order: 2 },
          { id: 'heatmap', type: 'heatmap', title: 'Usage Heat Map', enabled: true, order: 3 },
          { id: 'insights', type: 'insights', title: 'Space Optimization Insights', enabled: true, order: 4 }
        ],
        includeInsights: true,
        includeHeatMaps: true,
        includeSpaceUtilization: true
      }
    ];

    res.json({
      success: true,
      data: { templates },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get report templates', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve report templates',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get advanced analytics data
router.get('/analytics/:type', requirePermission(Permission.ANALYTICS_VIEW), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { timeframe, filters } = req.query;

    let data;

    switch (type) {
      case 'roi':
        data = {
          totalInvestment: 150000,
          totalValue: 185000,
          roi: 23.3,
          costPerStudent: 150,
          valuePerStudent: 185,
          breakdown: [
            { category: 'Staff Costs', cost: 90000, value: 45000, roi: -50 },
            { category: 'Technology', cost: 35000, value: 50000, roi: 43 },
            { category: 'Collections', cost: 15000, value: 55000, roi: 267 },
            { category: 'Facilities', cost: 10000, value: 35000, roi: 250 }
          ]
        };
        break;

      case 'reading-patterns':
        data = {
          totalBooksRead: 1250,
          activeReaders: 85,
          averageReadingStreak: 4.2,
          topReaders: [
            { studentName: 'John Doe', gradeLevel: 'SENIOR_HIGH', booksRead: 25, readingStreak: 12 },
            { studentName: 'Jane Smith', gradeLevel: 'JUNIOR_HIGH', booksRead: 22, readingStreak: 8 }
          ],
          readingTrends: {
            daily: 45,
            weekly: 85,
            monthly: 120
          }
        };
        break;

      case 'space-utilization':
        data = [
          {
            area: 'Computer Lab',
            totalCapacity: 30,
            currentOccupancy: 22,
            utilizationRate: 73.3,
            peakHours: [10, 14, 16],
            recommendations: ['Consider adding 2 more workstations', 'Extend hours during peak times']
          },
          {
            area: 'Reading Lounge',
            totalCapacity: 50,
            currentOccupancy: 15,
            utilizationRate: 30.0,
            peakHours: [13, 15],
            recommendations: ['Promote reading lounge usage', 'Add comfortable seating']
          }
        ];
        break;

      case 'benchmarks':
        data = [
          { metric: 'Visits per Student', currentValue: 7.2, benchmark: 8.5, percentile: 65, comparison: 'below' },
          { metric: 'Book Circulation', currentValue: 18.5, benchmark: 15.2, percentile: 78, comparison: 'above' },
          { metric: 'Computer Usage', currentValue: 71.3, benchmark: 65.0, percentile: 82, comparison: 'above' },
          { metric: 'Program Attendance', currentValue: 22.1, benchmark: 25.0, percentile: 58, comparison: 'below' }
        ];
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown analytics type: ${type}`,
          timestamp: new Date().toISOString()
        });
    }

    res.json({
      success: true,
      data: {
        type,
        timeframe: timeframe || 'default',
        data,
        generatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get analytics data', { error: (error as Error).message, type: req.params.type });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics data',
      timestamp: new Date().toISOString()
    });
  }
}));

// Export data in various formats
router.post('/export', requirePermission(Permission.REPORTS_EXPORT), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { dataType, format, filters, dateRange } = req.body;

    if (!dataType || !format) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: dataType, format',
        timestamp: new Date().toISOString()
      });
    }

    const exportData = {
      id: `export_${Date.now()}`,
      dataType,
      format,
      filters: filters || {},
      dateRange: dateRange || { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
      status: 'processing',
      requestedBy: req.user?.id,
      createdAt: new Date()
    };

    logger.info('Data export requested', {
      exportId: exportData.id,
      dataType,
      format,
      requestedBy: req.user?.id
    });

    res.status(202).json({
      success: true,
      data: { export: exportData },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to export data', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Failed to export data',
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;