import { Request, Response } from 'express';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { ValidationError, AuthenticationError } from '@/utils/errors';
import { FERPAComplianceLevel } from '@/services/ferpaService';

// Create a local FERPAComplianceError class if it doesn't exist
class FERPAComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FERPAComplianceError';
  }
}
import { FERPAComplianceLevel, DataSensitivity } from './ferpaService';

// Security event types
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'authentication_failure',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHORIZATION_FAILURE = 'authorization_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_INPUT = 'suspicious_input',
  FERPA_VIOLATION = 'ferpa_violation',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  ABNORMAL_API_USAGE = 'abnormal_api_usage',
  SECURITY_HEADER_VIOLATION = 'security_header_violation',
  SUSPICIOUS_USER_AGENT = 'suspicious_user_agent',
  UNUSUAL_LOGIN_PATTERN = 'unusual_login_pattern',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  DATA_EXFILTRATION_ATTEMPT = 'data_exfiltration_attempt',
  MALICIOUS_REQUEST = 'malicious_request',
  SYSTEM_INTEGRITY_CHECK = 'system_integrity_check',
  // FERPA-specific events
  FERPA_DATA_ACCESS_WITHOUT_JUSTIFICATION = 'ferpa_data_access_without_justification',
  FERPA_UNAUTHORIZED_SENSITIVE_DATA_ACCESS = 'ferpa_unauthorized_sensitive_data_access',
  FERPA_MASS_DATA_EXPORT = 'ferpa_mass_data_export',
  FERPA_SUSPICIOUS_SEARCH_PATTERN = 'ferpa_suspicious_search_pattern',
  FERPA_UNUSUAL_OFFICE_HOURS_ACCESS = 'ferpa_unusual_office_hours_access',
  FERPA_MULTIPLE_STUDENT_ACCESS = 'ferpa_multiple_student_access',
  FERPA_DATA_RETENTION_VIOLATION = 'ferpa_data_retention_violation',
  FERPA_CONSENT_NOT_VERIFIED = 'ferpa_consent_not_verified',
  FERPA_ENCRYPTION_KEY_COMPROMISE = 'ferpa_encryption_key_compromise',
  FERPA_AUDIT_LOG_TAMPERING = 'ferpa_audit_log_tampering'
}

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security event interface
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: AlertSeverity;
  timestamp: number;
  ip: string;
  userAgent?: string;
  userId?: string;
  userRole?: string;
  endpoint?: string;
  method?: string;
  details: Record<string, any>;
  resolved: boolean;
  metadata?: {
    requestId?: string;
    sessionId?: string;
    geoLocation?: string;
    deviceFingerprint?: string;
  };
}

// Alert configuration
export interface AlertConfig {
  enabled: boolean;
  threshold: number;
  timeWindow: number; // milliseconds
  cooldown: number; // milliseconds between alerts
  severity: AlertSeverity;
  notificationChannels: string[];
  escalationRules?: Array<{
    condition: string;
    action: string;
    delay: number;
  }>;
}

// Monitoring metrics
export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<AlertSeverity, number>;
  topOffenders: Array<{ ip: string; count: number; events: SecurityEventType[] }>;
  recentTrends: Array<{ timestamp: number; count: number; severity: AlertSeverity }>;
  activeThreats: number;
  resolvedThreats: number;
  falsePositives: number;
}

export class SecurityMonitoringService {
  private redis: Redis;
  private alertConfigs: Map<SecurityEventType, AlertConfig>;
  private eventHistory: Map<string, SecurityEvent[]> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.setupDefaultAlertConfigurations();
    this.startPeriodicCleanup();
  }

  private setupDefaultAlertConfigurations(): void {
    this.alertConfigs = new Map([
      // Authentication failures - high priority
      [SecurityEventType.AUTHENTICATION_FAILURE, {
        enabled: true,
        threshold: 5, // 5 failures in 5 minutes
        timeWindow: 5 * 60 * 1000,
        cooldown: 10 * 60 * 1000, // 10 minutes between alerts
        severity: AlertSeverity.HIGH,
        notificationChannels: ['email', 'slack', 'admin_dashboard']
      }],

      // Brute force attempts - critical priority
      [SecurityEventType.BRUTE_FORCE_ATTEMPT, {
        enabled: true,
        threshold: 10, // 10 attempts in 1 minute
        timeWindow: 60 * 1000,
        cooldown: 5 * 60 * 1000, // 5 minutes between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard']
      }],

      // Rate limiting - medium priority
      [SecurityEventType.RATE_LIMIT_EXCEEDED, {
        enabled: true,
        threshold: 20, // 20 violations in 10 minutes
        timeWindow: 10 * 60 * 1000,
        cooldown: 30 * 60 * 1000, // 30 minutes between alerts
        severity: AlertSeverity.MEDIUM,
        notificationChannels: ['admin_dashboard']
      }],

      // FERPA violations - critical priority
      [SecurityEventType.FERPA_VIOLATION, {
        enabled: true,
        threshold: 1, // Any FERPA violation triggers alert
        timeWindow: 60 * 1000,
        cooldown: 60 * 60 * 1000, // 1 hour between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard', 'compliance_team']
      }],

      // Suspicious input - medium priority
      [SecurityEventType.SUSPICIOUS_INPUT, {
        enabled: true,
        threshold: 3, // 3 suspicious inputs in 5 minutes
        timeWindow: 5 * 60 * 1000,
        cooldown: 15 * 60 * 1000, // 15 minutes between alerts
        severity: AlertSeverity.MEDIUM,
        notificationChannels: ['admin_dashboard']
      }],

      // Authorization failures - high priority
      [SecurityEventType.AUTHORIZATION_FAILURE, {
        enabled: true,
        threshold: 5, // 5 authorization failures in 5 minutes
        timeWindow: 5 * 60 * 1000,
        cooldown: 10 * 60 * 1000, // 10 minutes between alerts
        severity: AlertSeverity.HIGH,
        notificationChannels: ['email', 'admin_dashboard']
      }],

      // Abnormal API usage - medium priority
      [SecurityEventType.ABNORMAL_API_USAGE, {
        enabled: true,
        threshold: 100, // 100% increase in normal usage
        timeWindow: 60 * 60 * 1000, // 1 hour window
        cooldown: 60 * 60 * 1000, // 1 hour between alerts
        severity: AlertSeverity.MEDIUM,
        notificationChannels: ['admin_dashboard']
      }],

      // Privilege escalation attempts - critical priority
      [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT, {
        enabled: true,
        threshold: 1, // Any attempt triggers alert
        timeWindow: 60 * 1000,
        cooldown: 30 * 60 * 1000, // 30 minutes between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard']
      }],

      // Data exfiltration attempts - critical priority
      [SecurityEventType.DATA_EXFILTRATION_ATTEMPT, {
        enabled: true,
        threshold: 1, // Any attempt triggers alert
        timeWindow: 60 * 1000,
        cooldown: 15 * 60 * 1000, // 15 minutes between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard', 'compliance_team']
      }],

      // FERPA-specific alert configurations

      // FERPA data access without justification - critical priority
      [SecurityEventType.FERPA_DATA_ACCESS_WITHOUT_JUSTIFICATION, {
        enabled: true,
        threshold: 1, // Any violation triggers alert
        timeWindow: 60 * 1000,
        cooldown: 30 * 60 * 1000, // 30 minutes between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'admin_dashboard', 'compliance_team']
      }],

      // FERPA unauthorized sensitive data access - critical priority
      [SecurityEventType.FERPA_UNAUTHORIZED_SENSITIVE_DATA_ACCESS, {
        enabled: true,
        threshold: 1, // Any unauthorized access triggers alert
        timeWindow: 60 * 1000,
        cooldown: 15 * 60 * 1000, // 15 minutes between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard', 'compliance_team']
      }],

      // FERPA mass data export - critical priority
      [SecurityEventType.FERPA_MASS_DATA_EXPORT, {
        enabled: true,
        threshold: 1, // Any mass export triggers alert
        timeWindow: 60 * 1000,
        cooldown: 60 * 60 * 1000, // 1 hour between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard', 'compliance_team']
      }],

      // FERPA suspicious search pattern - high priority
      [SecurityEventType.FERPA_SUSPICIOUS_SEARCH_PATTERN, {
        enabled: true,
        threshold: 5, // 5 suspicious searches in 10 minutes
        timeWindow: 10 * 60 * 1000,
        cooldown: 20 * 60 * 1000, // 20 minutes between alerts
        severity: AlertSeverity.HIGH,
        notificationChannels: ['email', 'admin_dashboard', 'compliance_team']
      }],

      // FERPA unusual office hours access - medium priority
      [SecurityEventType.FERPA_UNUSUAL_OFFICE_HOURS_ACCESS, {
        enabled: true,
        threshold: 3, // 3 accesses outside office hours in 1 hour
        timeWindow: 60 * 60 * 1000,
        cooldown: 30 * 60 * 1000, // 30 minutes between alerts
        severity: AlertSeverity.MEDIUM,
        notificationChannels: ['admin_dashboard']
      }],

      // FERPA multiple student access - high priority
      [SecurityEventType.FERPA_MULTIPLE_STUDENT_ACCESS, {
        enabled: true,
        threshold: 50, // Access to 50+ students in 10 minutes
        timeWindow: 10 * 60 * 1000,
        cooldown: 15 * 60 * 1000, // 15 minutes between alerts
        severity: AlertSeverity.HIGH,
        notificationChannels: ['email', 'admin_dashboard']
      }],

      // FERPA audit log tampering - critical priority
      [SecurityEventType.FERPA_AUDIT_LOG_TAMPERING, {
        enabled: true,
        threshold: 1, // Any tampering attempt triggers alert
        timeWindow: 60 * 1000,
        cooldown: 60 * 60 * 1000, // 1 hour between alerts
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['email', 'slack', 'sms', 'admin_dashboard', 'compliance_team']
      }]
    ]);
  }

  /**
   * Record a security event
   */
  public async recordSecurityEvent(
    eventType: SecurityEventType,
    req: Request,
    details: Record<string, any> = {},
    severity?: AlertSeverity
  ): Promise<void> {
    try {
      const event: SecurityEvent = {
        id: this.generateEventId(),
        type: eventType,
        severity: severity || this.alertConfigs.get(eventType)?.severity || AlertSeverity.MEDIUM,
        timestamp: Date.now(),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        userRole: (req as any).user?.role,
        endpoint: req.path,
        method: req.method,
        details,
        resolved: false,
        metadata: {
          requestId: (req as any).requestId,
          sessionId: (req as any).sessionId
        }
      };

      // Store event in Redis
      await this.storeEvent(event);

      // Store in memory history for quick access
      const memoryKey = `${event.ip}:${event.type}`;
      if (!this.eventHistory.has(memoryKey)) {
        this.eventHistory.set(memoryKey, []);
      }
      this.eventHistory.get(memoryKey)!.push(event);

      // Check if alert should be triggered
      await this.evaluateAlertConditions(event);

      // Log the event
      this.logSecurityEvent(event);

    } catch (error) {
      logger.error('Failed to record security event', { error, eventType });
    }
  }

  /**
   * Store event in Redis with TTL
   */
  private async storeEvent(event: SecurityEvent): Promise<void> {
    const eventKey = `security_event:${event.id}`;
    const typeKey = `security_events:${event.type}`;
    const ipKey = `security_events_ip:${event.ip}`;
    const timeKey = `security_events_time:${Math.floor(event.timestamp / (60 * 1000))}`; // Group by minute

    const pipeline = this.redis.pipeline();

    // Store full event data
    pipeline.hset(eventKey, {
      id: event.id,
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp.toString(),
      ip: event.ip,
      userAgent: event.userAgent || '',
      userId: event.userId || '',
      userRole: event.userRole || '',
      endpoint: event.endpoint || '',
      method: event.method || '',
      details: JSON.stringify(event.details),
      resolved: event.resolved.toString(),
      metadata: JSON.stringify(event.metadata || {})
    });

    // Set TTL (30 days)
    pipeline.expire(eventKey, 30 * 24 * 60 * 60);

    // Add to type index
    pipeline.sadd(typeKey, event.id);
    pipeline.expire(typeKey, 7 * 24 * 60 * 60); // 7 days

    // Add to IP index
    pipeline.sadd(ipKey, event.id);
    pipeline.expire(ipKey, 7 * 24 * 60 * 60); // 7 days

    // Add to time index for trend analysis
    pipeline.sadd(timeKey, event.id);
    pipeline.expire(timeKey, 7 * 24 * 60 * 60); // 7 days

    await pipeline.exec();
  }

  /**
   * Evaluate if alert should be triggered based on event patterns
   */
  private async evaluateAlertConditions(event: SecurityEvent): Promise<void> {
    const config = this.alertConfigs.get(event.type);
    if (!config || !config.enabled) return;

    // Check cooldown
    const cooldownKey = `${event.type}:${event.ip}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    if (lastAlert && Date.now() - lastAlert < config.cooldown) {
      return;
    }

    // Count similar events in time window
    const recentEvents = await this.countEventsByTypeAndIP(
      event.type,
      event.ip,
      config.timeWindow
    );

    if (recentEvents >= config.threshold) {
      await this.triggerAlert(event, config);
      this.alertCooldowns.set(cooldownKey, Date.now());
    }
  }

  /**
   * Count events by type and IP in time window
   */
  private async countEventsByTypeAndIP(
    type: SecurityEventType,
    ip: string,
    timeWindow: number
  ): Promise<number> {
    try {
      const now = Date.now();
      const windowStart = now - timeWindow;

      // Get all event IDs for this IP
      const ipKey = `security_events_ip:${ip}`;
      const eventIds = await this.redis.smembers(ipKey);

      let count = 0;
      for (const eventId of eventIds) {
        const eventKey = `security_event:${eventId}`;
        const eventData = await this.redis.hgetall(eventKey);

        if (eventData.type === type &&
            parseInt(eventData.timestamp) >= windowStart) {
          count++;
        }
      }

      return count;
    } catch (error) {
      logger.error('Failed to count events', { error, type, ip });
      return 0;
    }
  }

  /**
   * Trigger security alert
   */
  private async triggerAlert(event: SecurityEvent, config: AlertConfig): Promise<void> {
    const alert = {
      id: this.generateEventId(),
      eventId: event.id,
      type: event.type,
      severity: config.severity,
      timestamp: Date.now(),
      ip: event.ip,
      userAgent: event.userAgent,
      userId: event.userId,
      userRole: event.userRole,
      endpoint: event.endpoint,
      method: event.method,
      details: event.details,
      threshold: config.threshold,
      actualCount: await this.countEventsByTypeAndIP(
        event.type,
        event.ip,
        config.timeWindow
      ),
      timeWindow: config.timeWindow,
      notificationChannels: config.notificationChannels,
      escalationRules: config.escalationRules
    };

    // Store alert
    await this.storeAlert(alert);

    // Send notifications
    await this.sendNotifications(alert);

    // Log alert
    logger.warn('Security alert triggered', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      ip: alert.ip,
      threshold: alert.threshold,
      actualCount: alert.actualCount,
      timeWindow: alert.timeWindow
    });
  }

  /**
   * Store alert in Redis
   */
  private async storeAlert(alert: any): Promise<void> {
    const alertKey = `security_alert:${alert.id}`;
    const activeAlertsKey = 'active_security_alerts';

    const pipeline = this.redis.pipeline();

    pipeline.hset(alertKey, {
      id: alert.id,
      eventId: alert.eventId,
      type: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp.toString(),
      ip: alert.ip,
      userAgent: alert.userAgent || '',
      userId: alert.userId || '',
      userRole: alert.userRole || '',
      endpoint: alert.endpoint || '',
      method: alert.method || '',
      details: JSON.stringify(alert.details),
      threshold: alert.threshold.toString(),
      actualCount: alert.actualCount.toString(),
      timeWindow: alert.timeWindow.toString(),
      notificationChannels: JSON.stringify(alert.notificationChannels),
      escalationRules: JSON.stringify(alert.escalationRules || []),
      resolved: 'false'
    });

    pipeline.expire(alertKey, 30 * 24 * 60 * 60); // 30 days
    pipeline.sadd(activeAlertsKey, alert.id);
    pipeline.expire(activeAlertsKey, 7 * 24 * 60 * 60); // 7 days

    await pipeline.exec();
  }

  /**
   * Send notifications to configured channels
   */
  private async sendNotifications(alert: any): Promise<void> {
    const notifications = alert.notificationChannels;

    for (const channel of notifications) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'slack':
            await this.sendSlackNotification(alert);
            break;
          case 'sms':
            await this.sendSMSNotification(alert);
            break;
          case 'admin_dashboard':
            await this.updateAdminDashboard(alert);
            break;
          case 'compliance_team':
            await this.notifyComplianceTeam(alert);
            break;
          default:
            logger.warn('Unknown notification channel', { channel });
        }
      } catch (error) {
        logger.error('Failed to send notification', { channel, error });
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: any): Promise<void> {
    // Implementation would integrate with email service
    logger.info('Email notification sent', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: any): Promise<void> {
    // Implementation would integrate with Slack API
    logger.info('Slack notification sent', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(alert: any): Promise<void> {
    // Implementation would integrate with SMS service
    logger.info('SMS notification sent', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  /**
   * Update admin dashboard
   */
  private async updateAdminDashboard(alert: any): Promise<void> {
    // Implementation would update admin dashboard real-time
    logger.info('Admin dashboard updated', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  /**
   * Notify compliance team
   */
  private async notifyComplianceTeam(alert: any): Promise<void> {
    // Implementation would send detailed compliance notification
    logger.info('Compliance team notified', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  /**
   * Get security metrics
   */
  public async getSecurityMetrics(timeRange: number = 24 * 60 * 60 * 1000): Promise<SecurityMetrics> {
    try {
      const now = Date.now();
      const startTime = now - timeRange;

      const metrics: SecurityMetrics = {
        totalEvents: 0,
        eventsByType: {} as Record<SecurityEventType, number>,
        eventsBySeverity: {} as Record<AlertSeverity, number>,
        topOffenders: [],
        recentTrends: [],
        activeThreats: 0,
        resolvedThreats: 0,
        falsePositives: 0
      };

      // Get all active alerts
      const activeAlertsKey = 'active_security_alerts';
      const activeAlertIds = await this.redis.smembers(activeAlertsKey);
      metrics.activeThreats = activeAlertIds.length;

      // Analyze events by time ranges
      const timeBuckets = 24; // 24 hourly buckets
      for (let i = 0; i < timeBuckets; i++) {
        const bucketStart = startTime + (i * timeRange / timeBuckets);
        const bucketEnd = bucketStart + (timeRange / timeBuckets);

        const bucketKey = `security_events_time:${Math.floor(bucketStart / (60 * 1000))}`;
        const eventIds = await this.redis.smembers(bucketKey);

        let highCount = 0;
        let criticalCount = 0;

        for (const eventId of eventIds) {
          const eventKey = `security_event:${eventId}`;
          const eventData = await this.redis.hgetall(eventKey);

          if (parseInt(eventData.timestamp) >= bucketStart &&
              parseInt(eventData.timestamp) < bucketEnd) {
            metrics.totalEvents++;

            // Count by type
            const type = eventData.type as SecurityEventType;
            metrics.eventsByType[type] = (metrics.eventsByType[type] || 0) + 1;

            // Count by severity
            const severity = eventData.severity as AlertSeverity;
            metrics.eventsBySeverity[severity] = (metrics.eventsBySeverity[severity] || 0) + 1;

            if (severity === AlertSeverity.HIGH) highCount++;
            if (severity === AlertSeverity.CRITICAL) criticalCount++;
          }
        }

        metrics.recentTrends.push({
          timestamp: bucketStart,
          count: eventIds.length,
          severity: criticalCount > 0 ? AlertSeverity.CRITICAL :
                   highCount > 0 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM
        });
      }

      // Get top offenders
      await this.calculateTopOffenders(metrics);

      return metrics;
    } catch (error) {
      logger.error('Failed to get security metrics', { error });
      throw error;
    }
  }

  /**
   * Calculate top offending IPs
   */
  private async calculateTopOffenders(metrics: SecurityMetrics): Promise<void> {
    try {
      const ipKeys = await this.redis.keys('security_events_ip:*');
      const ipCounts: Array<{ ip: string; count: number; events: SecurityEventType[] }> = [];

      for (const ipKey of ipKeys.slice(0, 100)) { // Limit to prevent too many operations
        const ip = ipKey.replace('security_events_ip:', '');
        const eventIds = await this.redis.smembers(ipKey);

        if (eventIds.length > 5) { // Only consider IPs with more than 5 events
          const eventTypes: SecurityEventType[] = [];

          for (const eventId of eventIds) {
            const eventKey = `security_event:${eventId}`;
            const eventData = await this.redis.hgetall(eventKey);
            eventTypes.push(eventData.type as SecurityEventType);
          }

          ipCounts.push({
            ip,
            count: eventIds.length,
            events: [...new Set(eventTypes)] // Unique event types
          });
        }
      }

      metrics.topOffenders = ipCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 offenders
    } catch (error) {
      logger.error('Failed to calculate top offenders', { error });
    }
  }

  /**
   * Get active security alerts
   */
  public async getActiveAlerts(): Promise<any[]> {
    try {
      const activeAlertsKey = 'active_security_alerts';
      const alertIds = await this.redis.smembers(activeAlertsKey);

      const alerts = [];
      for (const alertId of alertIds) {
        const alertKey = `security_alert:${alertId}`;
        const alertData = await this.redis.hgetall(alertKey);

        alerts.push({
          id: alertData.id,
          eventId: alertData.eventId,
          type: alertData.type,
          severity: alertData.severity,
          timestamp: parseInt(alertData.timestamp),
          ip: alertData.ip,
          userId: alertData.userId,
          userRole: alertData.userRole,
          endpoint: alertData.endpoint,
          method: alertData.method,
          details: JSON.parse(alertData.details || '{}'),
          threshold: parseInt(alertData.threshold),
          actualCount: parseInt(alertData.actualCount),
          timeWindow: parseInt(alertData.timeWindow),
          resolved: alertData.resolved === 'true'
        });
      }

      return alerts.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to get active alerts', { error });
      return [];
    }
  }

  /**
   * Resolve security alert
   */
  public async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    try {
      const alertKey = `security_alert:${alertId}`;
      const activeAlertsKey = 'active_security_alerts';

      const pipeline = this.redis.pipeline();
      pipeline.hset(alertKey, 'resolved', 'true');
      pipeline.hset(alertKey, 'resolvedBy', resolvedBy);
      pipeline.hset(alertKey, 'resolvedAt', Date.now().toString());
      pipeline.srem(activeAlertsKey, alertId);

      await pipeline.exec();

      logger.info('Security alert resolved', { alertId, resolvedBy });
      return true;
    } catch (error) {
      logger.error('Failed to resolve alert', { error, alertId });
      return false;
    }
  }

  /**
   * Update alert configuration
   */
  public updateAlertConfig(
    eventType: SecurityEventType,
    config: Partial<AlertConfig>
  ): void {
    const currentConfig = this.alertConfigs.get(eventType);
    if (currentConfig) {
      this.alertConfigs.set(eventType, { ...currentConfig, ...config });
      logger.info('Alert configuration updated', { eventType, config });
    }
  }

  /**
   * Get event history for IP
   */
  public async getEventHistory(
    ip: string,
    timeRange: number = 24 * 60 * 60 * 1000
  ): Promise<SecurityEvent[]> {
    try {
      const ipKey = `security_events_ip:${ip}`;
      const eventIds = await this.redis.smembers(ipKey);

      const events: SecurityEvent[] = [];
      const now = Date.now();
      const startTime = now - timeRange;

      for (const eventId of eventIds) {
        const eventKey = `security_event:${eventId}`;
        const eventData = await this.redis.hgetall(eventKey);

        const timestamp = parseInt(eventData.timestamp);
        if (timestamp >= startTime) {
          events.push({
            id: eventData.id,
            type: eventData.type as SecurityEventType,
            severity: eventData.severity as AlertSeverity,
            timestamp,
            ip: eventData.ip,
            userAgent: eventData.userAgent,
            userId: eventData.userId,
            userRole: eventData.userRole,
            endpoint: eventData.endpoint,
            method: eventData.method,
            details: JSON.parse(eventData.details || '{}'),
            resolved: eventData.resolved === 'true',
            metadata: JSON.parse(eventData.metadata || '{}')
          });
        }
      }

      return events.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to get event history', { error, ip });
      return [];
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log security event
   */
  private logSecurityEvent(event: SecurityEvent): void {
    const logLevel = event.severity === AlertSeverity.CRITICAL ? 'error' :
                    event.severity === AlertSeverity.HIGH ? 'warn' :
                    event.severity === AlertSeverity.MEDIUM ? 'info' : 'debug';

    logger[logLevel]('Security event recorded', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      userId: event.userId,
      userRole: event.userRole,
      endpoint: event.endpoint,
      method: event.method,
      details: event.details
    });
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    setInterval(async () => {
      try {
        // Clean up old cooldowns
        const now = Date.now();
        for (const [key, timestamp] of this.alertCooldowns.entries()) {
          if (now - timestamp > 24 * 60 * 60 * 1000) { // 24 hours
            this.alertCooldowns.delete(key);
          }
        }

        // Clean up memory history
        for (const [key, events] of this.eventHistory.entries()) {
          const recentEvents = events.filter(e => now - e.timestamp < 60 * 60 * 1000); // Keep last hour
          if (recentEvents.length === 0) {
            this.eventHistory.delete(key);
          } else {
            this.eventHistory.set(key, recentEvents);
          }
        }
      } catch (error) {
        logger.error('Security monitoring cleanup failed', { error });
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * FERPA-specific threat detection methods
   */

  /**
   * Detect FERPA data access without proper justification
   */
  public async detectFERPADataAccessWithoutJustification(
    req: Request,
    accessedFields: string[],
    complianceLevel: FERPAComplianceLevel,
    hasJustification: boolean
  ): Promise<void> {
    if (!hasJustification && complianceLevel >= FERPAComplianceLevel.SENSITIVE) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_DATA_ACCESS_WITHOUT_JUSTIFICATION,
        req,
        {
          accessedFields,
          complianceLevel,
          userRole: (req as any).user?.role,
          endpoint: req.path,
          method: req.method
        },
        AlertSeverity.CRITICAL
      );
    }
  }

  /**
   * Detect unauthorized sensitive data access
   */
  public async detectUnauthorizedSensitiveDataAccess(
    req: Request,
    accessedFields: string[],
    userRole: string,
    requiredLevel: FERPAComplianceLevel,
    actualLevel: FERPAComplianceLevel
  ): Promise<void> {
    if (actualLevel < requiredLevel) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_UNAUTHORIZED_SENSITIVE_DATA_ACCESS,
        req,
        {
          accessedFields,
          userRole,
          requiredLevel,
          actualLevel,
          endpoint: req.path,
          method: req.method
        },
        AlertSeverity.CRITICAL
      );
    }
  }

  /**
   * Detect mass data export attempts
   */
  public async detectMassDataExport(
    req: Request,
    recordCount: number,
    dataSensitivity: DataSensitivity[]
  ): Promise<void> {
    const hasHighlySensitiveData = dataSensitivity.some(sensitivity =>
      [DataSensitivity.MEDICAL_INFO, DataSensitivity.DISCIPLINARY, DataSensitivity.SPECIAL_EDUCATION].includes(sensitivity)
    );

    const threshold = hasHighlySensitiveData ? 10 : 100; // Lower threshold for highly sensitive data

    if (recordCount > threshold) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_MASS_DATA_EXPORT,
        req,
        {
          recordCount,
          dataSensitivity,
          hasHighlySensitiveData,
          threshold,
          exportType: req.query.export || 'unknown'
        },
        AlertSeverity.CRITICAL
      );
    }
  }

  /**
   * Detect suspicious search patterns
   */
  public async detectSuspiciousSearchPattern(
    req: Request,
    searchQuery: string,
    resultCount: number
  ): Promise<void> {
    const suspiciousPatterns = [
      /ssn/i,
      /social.*security/i,
      /\d{3}-\d{2}-\d{4}/, // SSN pattern
      /birth.*date/i,
      /medical/i,
      /disciplinary/i,
      /parent.*phone/i,
      /home.*address/i,
      /\d{10}/, // Possible phone number
      /\b\d{5}\b/ // ZIP code
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(searchQuery));

    if (isSuspicious || resultCount > 1000) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_SUSPICIOUS_SEARCH_PATTERN,
        req,
        {
          searchQuery,
          resultCount,
          isSuspicious,
          matchedPatterns: suspiciousPatterns.filter(pattern => pattern.test(searchQuery))
        },
        AlertSeverity.HIGH
      );
    }
  }

  /**
   * Detect unusual office hours access
   */
  public async detectUnusualOfficeHoursAccess(
    req: Request,
    userRole: string
  ): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Define office hours (8 AM - 6 PM, Monday - Friday)
    const isOfficeHours = dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 18;
    const isAdminAccess = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

    if (!isOfficeHours && !isAdminAccess) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_UNUSUAL_OFFICE_HOURS_ACCESS,
        req,
        {
          accessTime: now.toISOString(),
          hour,
          dayOfWeek,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isLateNight: hour < 6 || hour > 22,
          userRole
        },
        AlertSeverity.MEDIUM
      );
    }
  }

  /**
   * Detect multiple student access patterns
   */
  public async detectMultipleStudentAccess(
    req: Request,
    accessedStudentIds: string[],
    timeWindow: number = 10 * 60 * 1000 // 10 minutes
  ): Promise<void> {
    const studentCount = accessedStudentIds.length;
    const threshold = 50; // Access to 50+ students

    if (studentCount > threshold) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_MULTIPLE_STUDENT_ACCESS,
        req,
        {
          studentCount,
          threshold,
          studentIds: accessedStudentIds.slice(0, 10), // Log first 10 for analysis
          timeWindow,
          accessPattern: this.analyzeAccessPattern(accessedStudentIds)
        },
        AlertSeverity.HIGH
      );
    }
  }

  /**
   * Detect data retention violations
   */
  public async detectDataRetentionViolation(
    req: Request,
    dataType: string,
    recordAge: number,
    maxRetentionDays: number
  ): Promise<void> {
    const retentionDays = recordAge / (24 * 60 * 60 * 1000);

    if (retentionDays > maxRetentionDays) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_DATA_RETENTION_VIOLATION,
        req,
        {
          dataType,
          recordAge,
          retentionDays,
          maxRetentionDays,
          violationSeverity: retentionDays > maxRetentionDays * 2 ? 'CRITICAL' : 'WARNING'
        },
        AlertSeverity.HIGH
      );
    }
  }

  /**
   * Detect consent verification issues
   */
  public async detectConsentNotVerified(
    req: Request,
    actionType: string,
    requiresConsent: boolean,
    consentVerified: boolean
  ): Promise<void> {
    if (requiresConsent && !consentVerified) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_CONSENT_NOT_VERIFIED,
        req,
        {
          actionType,
          requiresConsent,
          consentVerified,
          userRole: (req as any).user?.role,
          endpoint: req.path
        },
        AlertSeverity.CRITICAL
      );
    }
  }

  /**
   * Detect potential encryption key compromise
   */
  public async detectEncryptionKeyCompromise(
    req: Request,
    keyAccessAttempts: number,
    unusualKeyUsage: boolean
  ): Promise<void> {
    const threshold = 10; // More than 10 key access attempts

    if (keyAccessAttempts > threshold || unusualKeyUsage) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_ENCRYPTION_KEY_COMPROMISE,
        req,
        {
          keyAccessAttempts,
          threshold,
          unusualKeyUsage,
          userRole: (req as any).user?.role,
          endpoint: req.path
        },
        AlertSeverity.CRITICAL
      );
    }
  }

  /**
   * Detect audit log tampering
   */
  public async detectAuditLogTampering(
    req: Request,
    logModifications: string[],
    suspiciousActivity: boolean
  ): Promise<void> {
    if (logModifications.length > 0 || suspiciousActivity) {
      await this.recordSecurityEvent(
        SecurityEventType.FERPA_AUDIT_LOG_TAMPERING,
        req,
        {
          logModifications,
          modificationCount: logModifications.length,
          suspiciousActivity,
          userRole: (req as any).user?.role,
          endpoint: req.path
        },
        AlertSeverity.CRITICAL
      );
    }
  }

  /**
   * Analyze student ID access patterns
   */
  private analyzeAccessPattern(studentIds: string[]): {
    isSequential: boolean;
    isRandom: boolean;
    isTargeted: boolean;
    pattern: string;
  } {
    if (studentIds.length < 2) {
      return { isSequential: false, isRandom: false, isTargeted: false, pattern: 'INSUFFICIENT_DATA' };
    }

    // Check for sequential IDs
    const numericIds = studentIds.map(id => parseInt(id.replace(/\D/g, ''))).filter(n => !isNaN(n));
    numericIds.sort((a, b) => a - b);

    let isSequential = true;
    for (let i = 1; i < numericIds.length; i++) {
      if (numericIds[i] - numericIds[i-1] !== 1) {
        isSequential = false;
        break;
      }
    }

    // Check for targeted pattern (same grade, section, etc.)
    const hasCommonPrefix = studentIds.some(id =>
      studentIds.filter(otherId => otherId.startsWith(id.substring(0, 3))).length > studentIds.length * 0.8
    );

    return {
      isSequential,
      isRandom: !isSequential && !hasCommonPrefix,
      isTargeted: hasCommonPrefix,
      pattern: isSequential ? 'SEQUENTIAL' : hasCommonPrefix ? 'TARGETED' : 'RANDOM'
    };
  }

  /**
   * Express middleware for automatic security event recording
   */
  public securityEventMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const originalSend = res.send;

      res.send = function(body) {
        // Record events based on response status and request patterns
        SecurityMonitoringService.recordEventFromRequest(req, res, body);
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Static method to record events from request/response
   */
  private static async recordEventFromRequest(
    req: Request,
    res: Response,
    body: any
  ): Promise<void> {
    try {
      // Record authentication failures
      if (res.statusCode === 401) {
        const service = new SecurityMonitoringService(new Redis());
        await service.recordSecurityEvent(
          SecurityEventType.AUTHENTICATION_FAILURE,
          req,
          { statusCode: res.statusCode, responseSize: body?.length || 0 }
        );
      }

      // Record authorization failures
      if (res.statusCode === 403) {
        const service = new SecurityMonitoringService(new Redis());
        await service.recordSecurityEvent(
          SecurityEventType.AUTHORIZATION_FAILURE,
          req,
          { statusCode: res.statusCode, attemptedResource: req.path }
        );
      }

      // Record rate limit exceeded
      if (res.statusCode === 429) {
        const service = new SecurityMonitoringService(new Redis());
        await service.recordSecurityEvent(
          SecurityEventType.RATE_LIMIT_EXCEEDED,
          req,
          {
            retryAfter: res.getHeader('Retry-After'),
            rateLimitInfo: body?.rateLimitInfo
          }
        );
      }

    } catch (error) {
      logger.error('Failed to record event from request', { error });
    }
  }
}

export default SecurityMonitoringService;