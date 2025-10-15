import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';
import { SecurityMonitoringService, SecurityEventType, AlertSeverity } from '@/services/securityMonitoringService';
import Redis from 'ioredis';

const router = Router();

// Initialize Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

// Initialize security monitoring service
const securityService = new SecurityMonitoringService(redis);

/**
 * GET /api/security/metrics - Get security metrics and statistics
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/metrics',
  requirePermission(Permission.SECURITY_MONITORING_VIEW),
  async (req: Request, res: Response) => {
    try {
      const { timeframe = '24h' } = req.query;

      // Convert timeframe string to milliseconds
      let timeRange = 24 * 60 * 60 * 1000; // Default 24 hours
      if (timeframe === '7d') {
        timeRange = 7 * 24 * 60 * 60 * 1000;
      } else if (timeframe === '30d') {
        timeRange = 30 * 24 * 60 * 60 * 1000;
      }

      const metrics = await securityService.getSecurityMetrics(timeRange);

      const response: ApiResponse = {
        success: true,
        data: {
          metrics,
          timestamp: new Date().toISOString(),
          timeframe
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching security metrics', {
        error: (error as Error).message,
        query: req.query
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/security/alerts/active - Get active security alerts
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/alerts/active',
  requirePermission(Permission.SECURITY_MONITORING_VIEW),
  async (req: Request, res: Response) => {
    try {
      const alerts = await securityService.getActiveAlerts();

      const response: ApiResponse = {
        success: true,
        data: {
          alerts,
          count: alerts.length,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching active alerts', {
        error: (error as Error).message
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /api/security/alerts/:alertId/resolve - Resolve a security alert
 * Requires: SUPER_ADMIN role
 */
router.post(
  '/alerts/:alertId/resolve',
  requirePermission(Permission.SECURITY_ALERTS_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const resolvedBy = (req as any).user?.username || 'system';

      const success = await securityService.resolveAlert(alertId, resolvedBy);

      if (success) {
        const response: ApiResponse = {
          success: true,
          message: `Security alert ${alertId} resolved successfully`,
          timestamp: new Date().toISOString()
        };

        res.json(response);
      } else {
        res.status(404).json({
          success: false,
          error: 'Alert not found or already resolved',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error resolving security alert', {
        error: (error as Error).message,
        alertId: req.params.alertId
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timeline: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/security/events/history - Get security event history for an IP
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/events/history',
  requirePermission(Permission.SECURITY_MONITORING_VIEW),
  async (req: Request, res: Response) => {
    try {
      const { ip, timeframe = '24h' } = req.query;

      if (!ip) {
        return res.status(400).json({
          success: false,
          error: 'IP address is required',
          timestamp: new Date().toISOString(),
        });
      }

      let timeRange = 24 * 60 * 60 * 1000; // Default 24 hours
      if (timeframe === '7d') {
        timeRange = 7 * 24 * 60 * 60 * 1000;
      } else if (timeframe === '30d') {
        timeRange = 30 * 24 * 60 * 60 * 1000;
      }

      const events = await securityService.getEventHistory(ip as string, timeRange);

      const response: ApiResponse = {
        success: true,
        data: {
          ip,
          events,
          count: events.length,
          timeframe,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching security event history', {
        error: (error as Error).message,
        query: req.query
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/security/events/types - Get available security event types
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/events/types',
  requirePermission(Permission.SECURITY_MONITORING_VIEW),
  async (req: Request, res: Response) => {
  try {
    const eventTypes = Object.values(SecurityEventType).map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').replace(/\b\w/g, word => word.charAt(0).toUpperCase() + word.slice(1)),
      category: type.startsWith('FERPA_') ? 'FERPA' : 'General'
    }));

    const severityLevels = Object.values(AlertSeverity).map(severity => ({
      value: severity,
      label: severity.charAt(0).toUpperCase() + severity.slice(1),
      priority: {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1
      }[severity as AlertSeverity] || 0
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        eventTypes,
        severityLevels,
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
      logger.error('Error fetching security event types', {
        error: (error as Error).message
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /api/security/record - Manually record a security event
 * Requires: SUPER_ADMIN role
 */
router.post(
  '/record',
  requirePermission(Permission.SECURITY_MONITORING_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const { eventType, details } = req.body;

      if (!eventType) {
        return res.status(400).json({
          success: false,
          error: 'Event type is required',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate event type
      if (!Object.values(SecurityEventType).includes(eventType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid event type',
          timestamp: new Date().toISOString(),
        });
      }

      await securityService.recordSecurityEvent(
        eventType as SecurityEventType,
        req,
        details || {}
      );

      const response: ApiResponse = {
        success: true,
        message: 'Security event recorded successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error recording security event', {
        error: (error as Error).message,
        body: req.body
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/security/config/alerts - Get alert configurations
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/config/alerts',
  requirePermission(Permission.SECURITY_MONITORING_CONFIGURE),
  async (req: Request, res: Response) => {
  try {
    // Return current alert configurations
    // This would normally be stored in database
    const alertConfigs = {
      [SecurityEventType.AUTHENTICATION_FAILURE]: {
        enabled: true,
        threshold: 5,
        timeWindow: 5 * 60 * 1000,
        cooldown: 10 * 60 * 1000,
        severity: AlertSeverity.HIGH,
        notificationChannels: ['email', 'slack', 'admin_dashboard']
      },
      [SecurityEventType.FERPA_VIOLATION]: {
        enabled: true,
        threshold: 1,
        timeWindow: 60 * 1000,
        cooldown: 60 * 60 * 1000,
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard', 'compliance_team']
      }
      };

    const response: ApiResponse = {
      success: true,
      data: alertConfigs,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
      logger.error('Error fetching alert configurations', {
        error: (error as Error).message
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * PUT /api/security/config/alerts/:eventType - Update alert configuration
 * Requires: SUPER_ADMIN role
 */
router.put(
  '/config/alerts/:eventType',
  requirePermission(Permission.SECURITY_MONITORING_CONFIGURE),
  async (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    const { config } = req.body;

    if (!eventType || !config) {
      return res.status(400).json({
        success: false,
        error: 'Event type and configuration are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate event type
    if (!Object.values(SecurityEventType).includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event type',
        timestamp: new Date().toISOString(),
      });
    }

    securityService.updateAlertConfig(eventType as SecurityEventType, config);

    const response: ApiResponse = {
      success: true,
      message: `Alert configuration updated for ${eventType}`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
      logger.error('Error updating alert configuration', {
        error: (error as Error).message,
        eventType: req.params.eventType,
        config: req.body
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/security/health - Get security monitoring service health status
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/health',
  requirePermission(Permission.SECURITY_MONITORING_VIEW),
  async (req: Request, res: Response) => {
  try {
    // Check Redis connection
    await redis.ping();

    const healthStatus = {
      status: 'healthy',
      redis: 'connected',
      service: 'operational',
      timestamp: new Date().toISOString()
    };

    const response: ApiResponse = {
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
      logger.error('Security monitoring health check failed', {
        error: (error as Error).message
      });
      res.status(503).json({
        success: false,
        error: 'Security monitoring service unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/security/export/summary - Export security summary report
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/export/summary',
  requirePermission(Permission.SECURITY_EXPORT),
  async (req: Request, res: Response) => {
  try {
    const { timeframe = '24h', format = 'json' } = req.query;

    let timeRange = 24 * 60 * 60 * 1000;
    if (timeframe === '7d') {
      timeRange = 7 * 24 * 60 * 60 * 1000;
    } else if (timeframe === '30d') {
      timeRange = 30 * 24 * 60 * 60 * 1000;
    }

    const metrics = await securityService.getSecurityMetrics(timeRange);
    const activeAlerts = await securityService.getActiveAlerts();

    const summary = {
      timeframe,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEvents: metrics.totalEvents,
        activeThreats: metrics.activeThreats,
        resolvedThreats: metrics.resolvedThreats,
        topEventTypes: Object.entries(metrics.eventsByType)
          .sort(([,a]) => b - a)
          .slice(0, 10)
          .map(([type, count]) => ({ type, count })),
        topOffenders: metrics.topOffenders.slice(0, 5),
        recentTrends: metrics.recentTrends.slice(-12), // Last 12 hours
        criticalAlerts: activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL)
      }
    };

    if (format === 'csv') {
      // CSV export
      const csv = [
        'Timestamp,Event Type,Severity,IP,User ID,Count'
      ];

      summary.recentTrends.forEach(trend => {
        csv.push(
          `${new Date(trend.timestamp).toISOString()},${trend.severity},${trend.count}`
        );
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="security-summary-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv.join('\n'));
    } else {
      // JSON export (default)
      const response: ApiResponse = {
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    }
  } catch (error) {
    logger.error('Error exporting security summary', {
      error: (error as Error).message,
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
  }
);

export default router;