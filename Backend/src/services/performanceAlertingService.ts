import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger';
import { performanceMonitoringService, PerformanceAlert } from '@/services/performanceMonitoringService';

// Alert types and interfaces
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  duration?: number; // Seconds to maintain condition before alerting
  cooldown?: number; // Seconds to wait before re-alerting
  notifications: {
    email?: boolean;
    slack?: boolean;
    webhook?: boolean;
    log?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  ruleId: string;
  timestamp: number;
  sent: boolean;
  channel: 'email' | 'slack' | 'webhook' | 'log';
  recipient?: string;
  message: string;
  error?: string;
}

export interface AlertEscalationPolicy {
  id: string;
  name: string;
  description: string;
  rules: {
    delay: number; // Seconds before escalation
    severity: 'medium' | 'high' | 'critical';
    notifications: {
      email?: boolean;
      slack?: boolean;
      webhook?: boolean;
      sms?: boolean;
      call?: boolean;
    };
  }[];
  enabled: boolean;
}

/**
 * Performance Alerting Service
 * 
 * Manages alert rules, notifications, and escalation policies for
 * performance issues detected by the monitoring service.
 */
export class PerformanceAlertingService extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private escalationPolicies: Map<string, AlertEscalationPolicy> = new Map();
  private notifications: AlertNotification[] = [];
  private activeAlerts: Map<string, { alert: PerformanceAlert; ruleId: string; startTime: number }> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private isRunning: boolean = false;
  private alertsDir: string;

  constructor(alertsDir?: string) {
    super();
    this.alertsDir = alertsDir || join(process.cwd(), 'performance-alerts');
    
    // Ensure alerts directory exists
    if (!existsSync(this.alertsDir)) {
      mkdirSync(this.alertsDir, { recursive: true });
    }

    // Load existing rules and policies
    this.loadRules();
    this.loadEscalationPolicies();

    // Set up default rules
    this.setupDefaultRules();

    // Listen for performance alerts
    performanceMonitoringService.on('alert', (alert) => {
      this.handlePerformanceAlert(alert);
    });
  }

  /**
   * Start the alerting service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Performance alerting service is already running');
      return;
    }

    this.isRunning = true;

    // Check for rule violations every 30 seconds
    const ruleCheckInterval = setInterval(() => {
      this.checkRuleViolations();
    }, 30000);
    this.intervals.push(ruleCheckInterval);

    // Check for alert escalation every minute
    const escalationInterval = setInterval(() => {
      this.checkAlertEscalation();
    }, 60000);
    this.intervals.push(escalationInterval);

    // Clean up old notifications every hour
    const cleanupInterval = setInterval(() => {
      this.cleanupOldNotifications();
    }, 3600000);
    this.intervals.push(cleanupInterval);

    logger.info('Performance alerting service started');
    this.emit('started');
  }

  /**
   * Stop the alerting service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Performance alerting service is not running');
      return;
    }

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isRunning = false;

    logger.info('Performance alerting service stopped');
    this.emit('stopped');
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.saveRules();
    this.emit('ruleAdded', rule);
    logger.info(`Alert rule added: ${rule.name}`);
  }

  /**
   * Update an alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.saveRules();
    this.emit('ruleUpdated', updatedRule);
    logger.info(`Alert rule updated: ${updatedRule.name}`);
    return true;
  }

  /**
   * Delete an alert rule
   */
  deleteRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    this.rules.delete(ruleId);
    this.saveRules();
    this.emit('ruleDeleted', rule);
    logger.info(`Alert rule deleted: ${rule.name}`);
    return true;
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get an alert rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Add an escalation policy
   */
  addEscalationPolicy(policy: AlertEscalationPolicy): void {
    this.escalationPolicies.set(policy.id, policy);
    this.saveEscalationPolicies();
    this.emit('escalationPolicyAdded', policy);
    logger.info(`Escalation policy added: ${policy.name}`);
  }

  /**
   * Get all escalation policies
   */
  getEscalationPolicies(): AlertEscalationPolicy[] {
    return Array.from(this.escalationPolicies.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Array<{ alert: PerformanceAlert; ruleId: string; startTime: number }> {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get notification history
   */
  getNotifications(limit?: number): AlertNotification[] {
    const notifications = this.notifications.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? notifications.slice(0, limit) : notifications;
  }

  /**
   * Manually trigger an alert
   */
  triggerAlert(ruleId: string, message?: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const alert: PerformanceAlert = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity: rule.severity,
      category: rule.category,
      message: message || `Manual alert triggered for rule: ${rule.name}`,
      metric: rule.metric,
      value: rule.threshold,
      threshold: rule.threshold,
      resolved: false
    };

    this.handleAlert(alert, ruleId);
    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert) {
      return false;
    }

    activeAlert.alert.resolved = true;
    activeAlert.alert.resolvedAt = Date.now();
    this.activeAlerts.delete(alertId);

    // Update the alert in the monitoring service
    performanceMonitoringService.resolveAlert(alertId);

    // Send resolution notification
    this.sendNotification({
      id: `resolve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId,
      ruleId: activeAlert.ruleId,
      timestamp: Date.now(),
      sent: false,
      channel: 'log',
      message: `Alert resolved: ${activeAlert.alert.message}`
    });

    this.emit('alertResolved', activeAlert.alert);
    logger.info(`Alert resolved: ${activeAlert.alert.message}`);
    return true;
  }

  /**
   * Handle performance alerts from the monitoring service
   */
  private handlePerformanceAlert(alert: PerformanceAlert): void {
    // Find matching rules
    const matchingRules = Array.from(this.rules.values()).filter(rule => 
      rule.enabled &&
      rule.category === alert.category &&
      rule.metric === alert.metric &&
      this.evaluateCondition(alert.value, rule.condition, rule.threshold)
    );

    // Process each matching rule
    matchingRules.forEach(rule => {
      this.handleAlert(alert, rule.id);
    });
  }

  /**
   * Handle an alert based on a rule
   */
  private handleAlert(alert: PerformanceAlert, ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return;
    }

    const alertKey = `${rule.id}_${alert.category}_${alert.metric}`;
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;

    // Check cooldown
    if (rule.cooldown && (now - lastAlertTime) < (rule.cooldown * 1000)) {
      return;
    }

    // Check if alert is already active
    const existingAlert = this.activeAlerts.get(alert.id);
    if (existingAlert) {
      return;
    }

    // Add to active alerts
    this.activeAlerts.set(alert.id, {
      alert: { ...alert },
      ruleId,
      startTime: now
    });

    // Update last alert time
    this.lastAlertTimes.set(alertKey, now);

    // Send notifications based on rule
    if (rule.notifications.log) {
      this.sendNotification({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        ruleId,
        timestamp: now,
        sent: false,
        channel: 'log',
        message: `[${rule.severity.toUpperCase()}] ${alert.message} (Value: ${alert.value}, Threshold: ${rule.threshold})`
      });
    }

    if (rule.notifications.email) {
      this.sendNotification({
        id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        ruleId,
        timestamp: now,
        sent: false,
        channel: 'email',
        message: `[${rule.severity.toUpperCase()}] ${alert.message} (Value: ${alert.value}, Threshold: ${rule.threshold})`
      });
    }

    if (rule.notifications.slack) {
      this.sendNotification({
        id: `slack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        ruleId,
        timestamp: now,
        sent: false,
        channel: 'slack',
        message: `[${rule.severity.toUpperCase()}] ${alert.message} (Value: ${alert.value}, Threshold: ${rule.threshold})`
      });
    }

    if (rule.notifications.webhook) {
      this.sendNotification({
        id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        ruleId,
        timestamp: now,
        sent: false,
        channel: 'webhook',
        message: `[${rule.severity.toUpperCase()}] ${alert.message} (Value: ${alert.value}, Threshold: ${rule.threshold})`
      });
    }

    this.emit('alertTriggered', { alert, rule });
  }

  /**
   * Check for rule violations against current metrics
   */
  private checkRuleViolations(): void {
    const metrics = performanceMonitoringService.getMetrics();
    const systemMetrics = performanceMonitoringService.getSystemMetrics();

    // Group metrics by category and metric name
    const metricGroups: Record<string, number[]> = {};
    
    metrics.forEach(metric => {
      const key = `${metric.category}.${metric.operation}`;
      if (!metricGroups[key]) {
        metricGroups[key] = [];
      }
      metricGroups[key].push(metric.duration);
    });

    // Add system metrics
    if (systemMetrics.length > 0) {
      const latestSystemMetric = systemMetrics[systemMetrics.length - 1];
      metricGroups['memory.usage'] = [latestSystemMetric.memory.percentage];
      metricGroups['cpu.usage'] = [latestSystemMetric.cpu.usage];
    }

    // Check each rule
    this.rules.forEach(rule => {
      if (!rule.enabled) {
        return;
      }

      const metricKey = `${rule.category}.${rule.metric}`;
      const values = metricGroups[metricKey];

      if (!values || values.length === 0) {
        return;
      }

      // Calculate average value
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;

      // Check if condition is met
      if (this.evaluateCondition(avgValue, rule.condition, rule.threshold)) {
        // Check if we've already alerted for this rule recently
        const alertKey = `${rule.id}_${rule.category}_${rule.metric}`;
        const now = Date.now();
        const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;

        if (!rule.cooldown || (now - lastAlertTime) >= (rule.cooldown * 1000)) {
          // Create alert
          const alert: PerformanceAlert = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: now,
            severity: rule.severity,
            category: rule.category,
            message: `Rule violation: ${rule.name}`,
            metric: rule.metric,
            value: avgValue,
            threshold: rule.threshold,
            resolved: false
          };

          this.handleAlert(alert, rule.id);
        }
      }
    });
  }

  /**
   * Check for alert escalation
   */
  private checkAlertEscalation(): void {
    const now = Date.now();

    this.activeAlerts.forEach(({ alert, ruleId, startTime }) => {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return;
      }

      // Find applicable escalation policies
      const policies = Array.from(this.escalationPolicies.values()).filter(policy => policy.enabled);

      policies.forEach(policy => {
        policy.rules.forEach(escalationRule => {
          // Check if it's time to escalate
          if ((now - startTime) >= (escalationRule.delay * 1000)) {
            // Check if we've already sent this escalation
            const escalationKey = `${alert.id}_${policy.id}_${escalationRule.severity}`;
            const lastEscalation = this.lastAlertTimes.get(escalationKey) || 0;

            if ((now - lastEscalation) >= 60000) { // Don't escalate more than once per minute
              // Send escalation notifications
              if (escalationRule.notifications.email) {
                this.sendNotification({
                  id: `escalate_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  alertId: alert.id,
                  ruleId,
                  timestamp: now,
                  sent: false,
                  channel: 'email',
                  message: `[ESCALATED - ${escalationRule.severity.toUpperCase()}] ${alert.message}`
                });
              }

              if (escalationRule.notifications.slack) {
                this.sendNotification({
                  id: `escalate_slack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  alertId: alert.id,
                  ruleId,
                  timestamp: now,
                  sent: false,
                  channel: 'slack',
                  message: `[ESCALATED - ${escalationRule.severity.toUpperCase()}] ${alert.message}`
                });
              }

              if (escalationRule.notifications.webhook) {
                this.sendNotification({
                  id: `escalate_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  alertId: alert.id,
                  ruleId,
                  timestamp: now,
                  sent: false,
                  channel: 'webhook',
                  message: `[ESCALATED - ${escalationRule.severity.toUpperCase()}] ${alert.message}`
                });
              }

              // Update last escalation time
              this.lastAlertTimes.set(escalationKey, now);

              this.emit('alertEscalated', { alert, policy, escalationRule });
              logger.warn(`Alert escalated: ${alert.message} to ${escalationRule.severity}`);
            }
          }
        });
      });
    });
  }

  /**
   * Send a notification
   */
  private async sendNotification(notification: AlertNotification): Promise<void> {
    try {
      switch (notification.channel) {
        case 'log':
          logger.warn(notification.message);
          notification.sent = true;
          break;
          
        case 'email':
          // TODO: Implement email notification
          logger.info(`Email notification (not implemented): ${notification.message}`);
          notification.sent = true;
          break;
          
        case 'slack':
          // TODO: Implement Slack notification
          logger.info(`Slack notification (not implemented): ${notification.message}`);
          notification.sent = true;
          break;
          
        case 'webhook':
          // TODO: Implement webhook notification
          logger.info(`Webhook notification (not implemented): ${notification.message}`);
          notification.sent = true;
          break;
      }

      // Add to notifications history
      this.notifications.push(notification);

      // Keep notifications history within bounds
      if (this.notifications.length > 10000) {
        this.notifications = this.notifications.slice(-10000);
      }

      this.emit('notificationSent', notification);
    } catch (error) {
      notification.sent = false;
      notification.error = (error as Error).message;
      logger.error('Failed to send notification', {
        channel: notification.channel,
        message: notification.message,
        error: (error as Error).message
      });
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Set up default alert rules
   */
  private setupDefaultRules(): void {
    // Only add default rules if no rules exist
    if (this.rules.size > 0) {
      return;
    }

    const defaultRules: AlertRule[] = [
      {
        id: 'db-slow-query',
        name: 'Slow Database Query',
        description: 'Alert when database queries are slow',
        category: 'database',
        metric: 'complexQuery',
        condition: 'gt',
        threshold: 500,
        severity: 'medium',
        enabled: true,
        duration: 60,
        cooldown: 300,
        notifications: {
          email: true,
          slack: false,
          webhook: false,
          log: true
        }
      },
      {
        id: 'api-slow-response',
        name: 'Slow API Response',
        description: 'Alert when API responses are slow',
        category: 'api',
        metric: 'studentList',
        condition: 'gt',
        threshold: 200,
        severity: 'medium',
        enabled: true,
        duration: 60,
        cooldown: 300,
        notifications: {
          email: false,
          slack: false,
          webhook: false,
          log: true
        }
      },
      {
        id: 'memory-high-usage',
        name: 'High Memory Usage',
        description: 'Alert when memory usage is high',
        category: 'memory',
        metric: 'usage',
        condition: 'gt',
        threshold: 85,
        severity: 'high',
        enabled: true,
        duration: 120,
        cooldown: 600,
        notifications: {
          email: true,
          slack: false,
          webhook: false,
          log: true
        }
      },
      {
        id: 'cache-slow-operation',
        name: 'Slow Cache Operation',
        description: 'Alert when cache operations are slow',
        category: 'cache',
        metric: 'setOperation',
        condition: 'gt',
        threshold: 20,
        severity: 'low',
        enabled: true,
        duration: 60,
        cooldown: 300,
        notifications: {
          email: false,
          slack: false,
          webhook: false,
          log: true
        }
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    this.saveRules();
    logger.info(`Default alert rules configured: ${defaultRules.length} rules`);
  }

  /**
   * Clean up old notifications
   */
  private cleanupOldNotifications(): void {
    const oneWeekAgo = Date.now() - 604800000;
    const originalCount = this.notifications.length;
    
    this.notifications = this.notifications.filter(n => n.timestamp > oneWeekAgo);
    
    logger.info('Old notifications cleaned up', {
      removed: originalCount - this.notifications.length,
      remaining: this.notifications.length
    });
  }

  /**
   * Save rules to disk
   */
  private saveRules(): void {
    try {
      const rulesFile = join(this.alertsDir, 'alert-rules.json');
      writeFileSync(rulesFile, JSON.stringify(Array.from(this.rules.entries()), null, 2));
      logger.debug('Alert rules saved to disk');
    } catch (error) {
      logger.error('Failed to save alert rules', { error: (error as Error).message });
    }
  }

  /**
   * Save escalation policies to disk
   */
  private saveEscalationPolicies(): void {
    try {
      const policiesFile = join(this.alertsDir, 'escalation-policies.json');
      writeFileSync(policiesFile, JSON.stringify(Array.from(this.escalationPolicies.entries()), null, 2));
      logger.debug('Escalation policies saved to disk');
    } catch (error) {
      logger.error('Failed to save escalation policies', { error: (error as Error).message });
    }
  }

  /**
   * Load rules from disk
   */
  private loadRules(): void {
    try {
      const rulesFile = join(this.alertsDir, 'alert-rules.json');
      if (existsSync(rulesFile)) {
        const rulesData = JSON.parse(require('fs').readFileSync(rulesFile, 'utf8'));
        rulesData.forEach(([id, rule]: [string, AlertRule]) => {
          this.rules.set(id, rule);
        });
        logger.info('Alert rules loaded from disk', { count: this.rules.size });
      }
    } catch (error) {
      logger.error('Failed to load alert rules', { error: (error as Error).message });
    }
  }

  /**
   * Load escalation policies from disk
   */
  private loadEscalationPolicies(): void {
    try {
      const policiesFile = join(this.alertsDir, 'escalation-policies.json');
      if (existsSync(policiesFile)) {
        const policiesData = JSON.parse(require('fs').readFileSync(policiesFile, 'utf8'));
        policiesData.forEach(([id, policy]: [string, AlertEscalationPolicy]) => {
          this.escalationPolicies.set(id, policy);
        });
        logger.info('Escalation policies loaded from disk', { count: this.escalationPolicies.size });
      }
    } catch (error) {
      logger.error('Failed to load escalation policies', { error: (error as Error).message });
    }
  }
}

// Singleton instance
export const performanceAlertingService = new PerformanceAlertingService();