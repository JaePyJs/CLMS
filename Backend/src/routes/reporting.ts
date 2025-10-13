import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { reportingService } from '@/services/reportingService';

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

export default router;