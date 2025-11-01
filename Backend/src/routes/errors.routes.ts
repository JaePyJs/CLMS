import { Router, Request, Response } from 'express';
import { BaseError } from '@/utils/errors';
import { errorReportingService } from '@/services/errorReportingService';
import { recoveryService } from '@/services/recoveryService';
import { errorNotificationService } from '@/services/errorNotificationService';
import { selfHealingMiddleware } from '@/middleware/selfHealingMiddleware';
import { auditService } from '@/services/auditService';
import { logger } from '@/utils/logger';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

// Get error dashboard data
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as string) || '24h';
    const dashboard = await errorReportingService.getErrorDashboard(timeframe as any);

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get error dashboard', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error dashboard',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get error reports with filtering
router.get('/reports', authMiddleware, async (req: Request, res: Response) => {
  try {
    const filters = {
      category: req.query.category as string,
      severity: req.query.severity as string,
      resolved: req.query.resolved === 'true',
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    };

    const reports = await errorReportingService.getErrorReports(filters);

    res.json({
      success: true,
      data: reports,
      count: reports.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get error reports', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error reports',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get error report by ID
router.get('/reports/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reports = await errorReportingService.getErrorReports();

    const report = reports.find(r => r.id === id);
    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Error report not found',
      });
      return;
    }

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get error report', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error report',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Resolve an error
router.post('/reports/:id/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const userId = (req as any).user.id;

    await errorReportingService.resolveError(id, userId, resolutionNotes);

    // Log the resolution
    await auditService.createLog({
      action: 'ERROR_RESOLVED_MANUALLY',
      userId,
      details: {
        errorId: id,
        resolutionNotes,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: 'Error resolved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to resolve error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve error',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Assign an error
router.post('/reports/:id/assign', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assignee } = req.body;
    const userId = (req as any).user.id;

    await errorReportingService.assignError(id, assignee || userId);

    // Log the assignment
    await auditService.createLog({
      action: 'ERROR_ASSIGNED',
      userId,
      details: {
        errorId: id,
        assignee: assignee || userId,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: 'Error assigned successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to assign error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to assign error',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Export error reports
router.get('/reports/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const filters = {
      category: req.query.category as string,
      severity: req.query.severity as string,
      resolved: req.query.resolved === 'true',
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const exportData = await errorReportingService.exportErrorReports(filters, format as any);

    const filename = `error-reports-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');

    res.send(exportData);
  } catch (error) {
    logger.error('Failed to export error reports', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to export error reports',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Report client-side error
router.post('/report', async (req: Request, res: Response) => {
  try {
    const errorReport = req.body;
    const userId = (req as any).user?.id;

    // Create error context
    const context = {
      requestId: errorReport.requestId || `client_${Date.now()}`,
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent') || 'unknown',
      method: 'CLIENT',
      url: errorReport.url || req.get('Referer') || 'unknown',
      timestamp: new Date(errorReport.timestamp || Date.now()),
      duration: 0,
    };

    // Create a BaseError instance
    const error = new BaseError(
      errorReport.error || 'Unknown client error',
      errorReport.statusCode || 500,
      true,
      errorReport.code || 'CLIENT_ERROR'
    );

    // Process error reporting
    await errorReportingService.createErrorReport(error, context);

    // Send notifications for critical errors
    if (errorReport.severity === 'CRITICAL') {
      await errorNotificationService.processError(error, context);
    }

    res.json({
      success: true,
      message: 'Error report received',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to process client error report', { error });
    // Don't expose internal errors to client
    res.status(500).json({
      success: false,
      error: 'Failed to process error report',
    });
  }
});

// Get system health and recovery status
router.get('/health', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [systemHealth, activeRecoveries, healingHealth] = await Promise.all([
      recoveryService.getSystemHealth(),
      recoveryService.getActiveRecoveries(),
      selfHealingMiddleware.getSystemHealth(),
    ]);

    res.json({
      success: true,
      data: {
        systemHealth,
        activeRecoveries,
        healingStrategies: healingHealth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get system health', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get self-healing strategies
router.get('/healing/strategies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const strategies = selfHealingMiddleware.getHealingStrategies();
    const activationHistory = selfHealingMiddleware.getActivationHistory();

    res.json({
      success: true,
      data: {
        strategies,
        activationHistory,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get healing strategies', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve healing strategies',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Enable/disable healing strategy
router.post('/healing/strategies/:id/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const userId = (req as any).user.id;

    let success = false;
    if (enabled) {
      success = await selfHealingMiddleware.enableStrategy(id);
    } else {
      success = await selfHealingMiddleware.disableStrategy(id);
    }

    if (!success) {
      res.status(404).json({
        success: false,
        error: 'Healing strategy not found',
      });
      return;
    }

    // Log the action
    await auditService.createLog({
      action: 'HEALING_STRATEGY_TOGGLED',
      userId,
      details: {
        strategyId: id,
        enabled,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: `Healing strategy ${enabled ? 'enabled' : 'disabled'} successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to toggle healing strategy', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to toggle healing strategy',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get notification channels
router.get('/notifications/channels', authMiddleware, async (req: Request, res: Response) => {
  try {
    // This would be implemented in the notification service
    res.json({
      success: true,
      data: {
        channels: [
          {
            id: 'email-admins',
            name: 'Email Administrators',
            type: 'EMAIL',
            enabled: true,
          },
          {
            id: 'slack-alerts',
            name: 'Slack Alerts',
            type: 'SLACK',
            enabled: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get notification channels', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification channels',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Test notification channel
router.post('/notifications/channels/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await errorNotificationService.testChannel(id);

    if (!success) {
      res.status(400).json({
        success: false,
        error: 'Notification channel test failed',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test notification sent successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to test notification channel', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to test notification channel',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get notification history
router.get('/notifications/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = await errorNotificationService.getNotificationHistory(limit);

    res.json({
      success: true,
      data: history,
      count: history.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get notification history', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification history',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get error metrics
router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const metrics = await errorReportingService.getErrorMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get error metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error metrics',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Get error trends
router.get('/trends', authMiddleware, async (req: Request, res: Response) => {
  try {
    const trends = await errorReportingService.getErrorTrends();

    res.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get error trends', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error trends',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Enable maintenance mode
router.post('/maintenance/enable', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await recoveryService.enableMaintenanceMode();

    // Log the action
    await auditService.createLog({
      action: 'MAINTENANCE_MODE_ENABLED',
      userId,
      details: {
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: 'Maintenance mode enabled',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to enable maintenance mode', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to enable maintenance mode',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

// Disable maintenance mode
router.post('/maintenance/disable', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await recoveryService.disableMaintenanceMode();

    // Log the action
    await auditService.createLog({
      action: 'MAINTENANCE_MODE_DISABLED',
      userId,
      details: {
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: 'Maintenance mode disabled',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to disable maintenance mode', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to disable maintenance mode',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

export default router;