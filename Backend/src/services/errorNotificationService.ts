import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { BaseError } from '@/utils/errors';
import { ErrorSeverity, ErrorCategory } from '@/middleware/errorMiddleware';
import { ErrorContext } from '@/middleware/errorMiddleware';

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS' | 'PUSH';
  enabled: boolean;
  config: Record<string, any>;
  filters: {
    severity?: ErrorSeverity[];
    category?: ErrorCategory[];
    frequency?: 'IMMEDIATE' | 'HOURLY' | 'DAILY';
    cooldown?: number; // minutes
  };
}

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    severity?: ErrorSeverity[];
    category?: ErrorCategory[];
    threshold?: number; // errors per time period
    timePeriod?: number; // minutes
    keywords?: string[];
    endpoints?: string[];
  };
  channels: string[]; // channel IDs
  cooldown?: number; // minutes
  escalation?: {
    delay: number; // minutes
    channels: string[]; // additional channels for escalation
  };
}

export interface ErrorNotification {
  id: string;
  errorId: string;
  ruleId?: string;
  channelId: string;
  type: 'IMMEDIATE' | 'DIGEST' | 'ESCALATION';
  severity: ErrorSeverity;
  category: ErrorCategory;
  title: string;
  message: string;
  context: ErrorContext;
  sent: boolean;
  sentAt?: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  created_at: Date;
}

export interface NotificationDigest {
  id: string;
  type: 'HOURLY' | 'DAILY' | 'WEEKLY';
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalErrors: number;
    criticalErrors: number;
    highErrors: number;
    categories: Record<ErrorCategory, number>;
    topErrors: Array<{
      message: string;
      count: number;
      severity: ErrorSeverity;
    }>;
  };
  channels: string[];
  sent: boolean;
  sentAt?: Date;
  created_at: Date;
}

export class ErrorNotificationService {
  private prisma: PrismaClient;
  private channels: Map<string, NotificationChannel> = new Map();
  private rules: Map<string, NotificationRule> = new Map();
  private notificationQueue: ErrorNotification[] = [];
  private processingQueue = false;
  private digestInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.prisma = new PrismaClient();
    this.initializeDefaultChannels();
    this.initializeDefaultRules();
    this.startDigestProcessor();
  }

  private initializeDefaultChannels(): void {
    // Default email channel
    this.channels.set('email-admins', {
      id: 'email-admins',
      name: 'Email Administrators',
      type: 'EMAIL',
      enabled: true,
      config: {
        recipients: ['admin@clms.com'],
        template: 'default-error',
      },
      filters: {
        severity: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL],
        frequency: 'IMMEDIATE',
        cooldown: 15, // 15 minutes
      },
    });

    // Default Slack channel
    this.channels.set('slack-alerts', {
      id: 'slack-alerts',
      name: 'Slack Alerts',
      type: 'SLACK',
      enabled: true,
      config: {
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: '#system-alerts',
      },
      filters: {
        severity: [ErrorSeverity.CRITICAL],
        frequency: 'IMMEDIATE',
        cooldown: 5, // 5 minutes
      },
    });
  }

  private initializeDefaultRules(): void {
    // Critical error rule
    this.rules.set('critical-errors', {
      id: 'critical-errors',
      name: 'Critical Errors',
      enabled: true,
      conditions: {
        severity: [ErrorSeverity.CRITICAL],
      },
      channels: ['email-admins', 'slack-alerts'],
      cooldown: 5,
      escalation: {
        delay: 15,
        channels: ['email-admins'],
      },
    });

    // High volume errors rule
    this.rules.set('high-volume-errors', {
      id: 'high-volume-errors',
      name: 'High Volume Errors',
      enabled: true,
      conditions: {
        threshold: 10,
        timePeriod: 5, // 5 minutes
      },
      channels: ['email-admins'],
      cooldown: 30,
    });

    // Database errors rule
    this.rules.set('database-errors', {
      id: 'database-errors',
      name: 'Database Errors',
      enabled: true,
      conditions: {
        category: [ErrorCategory.DATABASE],
        severity: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL],
      },
      channels: ['email-admins', 'slack-alerts'],
      cooldown: 10,
    });

    // External service errors rule
    this.rules.set('external-service-errors', {
      id: 'external-service-errors',
      name: 'External Service Errors',
      enabled: true,
      conditions: {
        category: [ErrorCategory.EXTERNAL_SERVICE],
      },
      channels: ['email-admins'],
      cooldown: 30,
    });
  }

  async processError(error: BaseError, context: ErrorContext): Promise<void> {
    try {
      const matchingRules = await this.findMatchingRules(error, context);

      for (const rule of matchingRules) {
        if (this.shouldNotify(rule, error, context)) {
          await this.createNotifications(rule, error, context);
        }
      }

      // Process notification queue
      this.processNotificationQueue();
    } catch (notificationError) {
      logger.error('Failed to process error notification', {
        error: notificationError,
        originalError: error.message,
      });
    }
  }

  private async findMatchingRules(
    error: BaseError,
    context: ErrorContext,
  ): Promise<NotificationRule[]> {
    const matchingRules: NotificationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      let matches = true;

      // Check severity
      if (rule.conditions.severity) {
        matches = matches && rule.conditions.severity.includes(error.severity!);
      }

      // Check category
      if (rule.conditions.category) {
        matches = matches && rule.conditions.category.includes(error.category!);
      }

      // Check keywords
      if (rule.conditions.keywords) {
        matches =
          matches &&
          rule.conditions.keywords.some(keyword =>
            error.message.toLowerCase().includes(keyword.toLowerCase()),
          );
      }

      // Check endpoints
      if (rule.conditions.endpoints) {
        matches =
          matches &&
          rule.conditions.endpoints.some(endpoint =>
            context.url.includes(endpoint),
          );
      }

      // Check threshold
      if (rule.conditions.threshold && rule.conditions.timePeriod) {
        matches = matches && (await this.checkThreshold(rule, context));
      }

      if (matches) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  private async checkThreshold(
    rule: NotificationRule,
    context: ErrorContext,
  ): Promise<boolean> {
    try {
      const timePeriod = rule.conditions.timePeriod! * 60 * 1000; // convert to milliseconds
      const startTime = new Date(Date.now() - timePeriod);

      const errorCount = await this.prisma.audit_logs.count({
        where: {
          action: 'ERROR_REPORT',
          created_at: { gte: start_time },
          details: {
            path: ['error', 'severity'],
            in: rule.conditions.severity,
          },
        },
      });

      return errorCount >= rule.conditions.threshold!;
    } catch (error) {
      logger.error('Failed to check notification threshold', { error });
      return false;
    }
  }

  private shouldNotify(
    rule: NotificationRule,
    error: BaseError,
    context: ErrorContext,
  ): boolean {
    // Check cooldown
    if (rule.cooldown) {
      const cooldownKey = `${rule.id}-${error.category}-${error.severity}`;
      const lastNotification = this.getLastNotificationTime(cooldownKey);

      if (
        lastNotification &&
        Date.now() - lastNotification.getTime() < rule.cooldown * 60 * 1000
      ) {
        return false;
      }
    }

    return true;
  }

  private getLastNotificationTime(key: string): Date | null {
    // In a real implementation, this would check a cache or database
    // For now, return null to always allow notifications
    return null;
  }

  private async createNotifications(
    rule: NotificationRule,
    error: BaseError,
    context: ErrorContext,
  ): Promise<void> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    for (const channelId of rule.channels) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) continue;

      const notification: ErrorNotification = {
        id: notificationId,
        errorId: context.requestId,
        ruleId: rule.id,
        channelId,
        type: 'IMMEDIATE',
        severity: error.severity!,
        category: error.category!,
        title: this.generateNotificationTitle(error, rule),
        message: this.generateNotificationMessage(error, context, rule),
        context,
        sent: false,
        attempts: 0,
        created_at: new Date(),
      };

      this.notificationQueue.push(notification);

      // Store in database for tracking
      await this.prisma.audit_logs.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          action: 'ERROR_NOTIFICATION_CREATED',
          details: {
            notificationId: notification.id,
            ruleId: rule.id,
            channelId,
            severity: error.severity,
            category: error.category,
          },
        },
      });
    }

    // Schedule escalation if configured
    if (rule.escalation) {
      setTimeout(
        () => {
          this.createEscalationNotifications(rule, error, context);
        },
        rule.escalation.delay * 60 * 1000,
      );
    }
  }

  private async createEscalationNotifications(
    rule: NotificationRule,
    error: BaseError,
    context: ErrorContext,
  ): Promise<void> {
    // Check if original error was resolved
    const wasResolved = await this.checkIfErrorResolved(context.requestId);
    if (wasResolved) return;

    const notificationId = `escal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    for (const channelId of rule.escalation!.channels) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) continue;

      const notification: ErrorNotification = {
        id: notificationId,
        errorId: context.requestId,
        ruleId: rule.id,
        channelId,
        type: 'ESCALATION',
        severity: error.severity!,
        category: error.category!,
        title: `ESCALATED: ${this.generateNotificationTitle(error, rule)}`,
        message: this.generateEscalationMessage(error, context, rule),
        context,
        sent: false,
        attempts: 0,
        created_at: new Date(),
      };

      this.notificationQueue.push(notification);
    }

    this.processNotificationQueue();
  }

  private async checkIfErrorResolved(errorId: string): Promise<boolean> {
    try {
      const log = await this.prisma.audit_logs.findFirst({
        where: {
          action: 'ERROR_RESOLVED',
          details: {
            path: ['errorId'],
            equals: errorId,
          },
        },
      });

      return !!log;
    } catch (error) {
      logger.error('Failed to check if error was resolved', { error });
      return false;
    }
  }

  private generateNotificationTitle(
    error: BaseError,
    rule: NotificationRule,
  ): string {
    const severityEmoji = {
      [ErrorSeverity.CRITICAL]: '🚨',
      [ErrorSeverity.HIGH]: '⚠️',
      [ErrorSeverity.MEDIUM]: '⚡',
      [ErrorSeverity.LOW]: 'ℹ️',
    };

    return `${severityEmoji[error.severity!]} ${rule.name}: ${error.category}`;
  }

  private generateNotificationMessage(
    error: BaseError,
    context: ErrorContext,
    rule: NotificationRule,
  ): string {
    return `
Error Details:
- Message: ${error.message}
- Category: ${error.category}
- Severity: ${error.severity}
- Endpoint: ${context.method} ${context.url}
- User ID: ${context.id || 'Anonymous'}
- Timestamp: ${context.timestamp.toISOString()}
- Request ID: ${context.requestId}

${error.stack ? `\nStack Trace:\n${error.stack}` : ''}

${rule.escalation ? '\n⚠️ This error will escalate if not resolved.' : ''}
    `.trim();
  }

  private generateEscalationMessage(
    error: BaseError,
    context: ErrorContext,
    rule: NotificationRule,
  ): string {
    return `
🚨 ESCALATED ERROR ALERT 🚨

This error has not been resolved and has been escalated.

${this.generateNotificationMessage(error, context, rule)}

IMMEDIATE ATTENTION REQUIRED
    `.trim();
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.processingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift()!;
        await this.sendNotification(notification);
      }
    } catch (error) {
      logger.error('Failed to process notification queue', { error });
    } finally {
      this.processingQueue = false;
    }
  }

  private async sendNotification(
    notification: ErrorNotification,
  ): Promise<void> {
    try {
      notification.attempts++;
      notification.lastAttempt = new Date();

      const channel = this.channels.get(notification.channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${notification.channelId}`);
      }

      let sent = false;

      switch (channel.type) {
        case 'EMAIL':
          sent = await this.sendEmailNotification(channel, notification);
          break;
        case 'SLACK':
          sent = await this.sendSlackNotification(channel, notification);
          break;
        case 'WEBHOOK':
          sent = await this.sendWebhookNotification(channel, notification);
          break;
        default:
          logger.warn('Unsupported notification channel type', {
            type: channel.type,
          });
      }

      if (sent) {
        notification.sent = true;
        notification.sentAt = new Date();

        logger.info('Notification sent successfully', {
          notificationId: notification.id,
          channelId: notification.channelId,
          type: notification.type,
        });
      } else {
        throw new Error('Notification delivery failed');
      }
    } catch (error) {
      notification.error = error.message;

      logger.error('Failed to send notification', {
        notificationId: notification.id,
        error,
        attempts: notification.attempts,
      });

      // Retry logic for failed notifications
      if (notification.attempts < 3) {
        setTimeout(
          () => {
            this.notificationQueue.unshift(notification);
            this.processNotificationQueue();
          },
          Math.pow(2, notification.attempts) * 1000,
        ); // Exponential backoff
      }
    }

    // Update notification status in database
    await this.updateNotificationStatus(notification);
  }

  private async sendEmailNotification(
    channel: NotificationChannel,
    notification: ErrorNotification,
  ): Promise<boolean> {
    try {
      // Implementation would use email service
      logger.info('Sending email notification', {
        recipients: channel.config.recipients,
        subject: notification.title,
      });

      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      logger.error('Failed to send email notification', { error });
      return false;
    }
  }

  private async sendSlackNotification(
    channel: NotificationChannel,
    notification: ErrorNotification,
  ): Promise<boolean> {
    try {
      const webhookUrl = channel.config.webhook;
      if (!webhookUrl) {
        throw new Error('Slack webhook URL not configured');
      }

      const payload = {
        channel: channel.config.channel,
        username: 'CLMS Error Bot',
        icon_emoji: ':warning:',
        text: notification.title,
        attachments: [
          {
            color:
              notification.severity === ErrorSeverity.CRITICAL
                ? 'danger'
                : notification.severity === ErrorSeverity.HIGH
                  ? 'warning'
                  : 'good',
            text: notification.message,
            fields: [
              {
                title: 'Severity',
                value: notification.severity,
                short: true,
              },
              {
                title: 'Category',
                value: notification.category,
                short: true,
              },
              {
                title: 'Endpoint',
                value: `${notification.context.method} ${notification.context.url}`,
                short: true,
              },
              {
                title: 'Request ID',
                value: notification.context.requestId,
                short: true,
              },
            ],
            ts: Math.floor(notification.created_at.getTime() / 1000),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      logger.error('Failed to send Slack notification', { error });
      return false;
    }
  }

  private async sendWebhookNotification(
    channel: NotificationChannel,
    notification: ErrorNotification,
  ): Promise<boolean> {
    try {
      const webhookUrl = channel.config.url;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }

      const payload = {
        id: notification.id,
        type: notification.type,
        severity: notification.severity,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        context: notification.context,
        timestamp: notification.created_at.toISOString(),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      logger.error('Failed to send webhook notification', { error });
      return false;
    }
  }

  private async updateNotificationStatus(
    notification: ErrorNotification,
  ): Promise<void> {
    try {
      await this.prisma.audit_logs.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          action: notification.sent
            ? 'ERROR_NOTIFICATION_SENT'
            : 'ERROR_NOTIFICATION_FAILED',
          details: {
            notificationId: notification.id,
            channelId: notification.channelId,
            sent: notification.sent,
            attempts: notification.attempts,
            error: notification.error,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification status', { error });
    }
  }

  private startDigestProcessor(): void {
    // Generate daily digest at 9 AM
    const scheduleDigest = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const timeUntilDigest = tomorrow.getTime() - now.getTime();

      setTimeout(() => {
        this.generateDailyDigest();
        scheduleDigest(); // Schedule next digest
      }, timeUntilDigest);
    };

    scheduleDigest();
  }

  private async generateDailyDigest(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const errorLogs = await this.prisma.audit_logs.findMany({
        where: {
          action: 'ERROR_REPORT',
          created_at: { gte: yesterday, lt: today },
        },
      });

      if (errorLogs.length === 0) {
        return; // No errors to report
      }

      const digest = await this.createDigest(
        'DAILY',
        yesterday,
        today,
        errorLogs,
      );
      await this.sendDigest(digest);

      logger.info('Daily digest generated and sent', {
        errorCount: errorLogs.length,
        digestId: digest.id,
      });
    } catch (error) {
      logger.error('Failed to generate daily digest', { error });
    }
  }

  private async createDigest(
    type: 'HOURLY' | 'DAILY' | 'WEEKLY',
    start: Date,
    end: Date,
    errorLogs: any[],
  ): Promise<NotificationDigest> {
    const digestId = `digest_${type.toLowerCase()}_${Date.now()}`;

    const summary = {
      totalErrors: errorLogs.length,
      criticalErrors: errorLogs.filter(
        log => log.details?.error?.severity === ErrorSeverity.CRITICAL,
      ).length,
      highErrors: errorLogs.filter(
        log => log.details?.error?.severity === ErrorSeverity.HIGH,
      ).length,
      categories: {} as Record<ErrorCategory, number>,
      topErrors: [] as Array<{
        message: string;
        count: number;
        severity: ErrorSeverity;
      }>,
    };

    // Count by category
    errorLogs.forEach(log => {
      const category = log.details?.error?.category;
      if (category) {
        summary.categories[category] = (summary.categories[category] || 0) + 1;
      }
    });

    // Group by message to find top errors
    const errorGroups = errorLogs.reduce((groups, log) => {
      const message = log.details?.error?.message;
      if (message) {
        if (!groups[message]) {
          groups[message] = {
            message,
            count: 0,
            severity: log.details?.error?.severity,
          };
        }
        groups[message].count++;
      }
      return groups;
    }, {});

    summary.topErrors = Object.values(errorGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      id: digestId,
      type,
      period: { start, end },
      summary,
      channels: ['email-admins'], // Default to email for digests
      sent: false,
      created_at: new Date(),
    };
  }

  private async sendDigest(digest: NotificationDigest): Promise<void> {
    try {
      const message = `
Error Digest Report - ${digest.type}
Period: ${digest.period.start.toISOString()} to ${digest.period.end.toISOString()}

Summary:
- Total Errors: ${digest.summary.totalErrors}
- Critical Errors: ${digest.summary.criticalErrors}
- High Errors: ${digest.summary.highErrors}

Categories:
${Object.entries(digest.summary.categories)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

Top Errors:
${digest.summary.topErrors
  .map(
    error =>
      `- ${error.message} (${error.count} occurrences, ${error.severity})`,
  )
  .join('\n')}
      `.trim();

      // Send to configured channels
      for (const channelId of digest.channels) {
        const channel = this.channels.get(channelId);
        if (channel && channel.enabled) {
          const notification: ErrorNotification = {
            id: `digest_${digest.id}`,
            errorId: digest.id,
            channelId,
            type: 'DIGEST',
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.SYSTEM,
            title: `${digest.type} Error Digest`,
            message,
            context: {
              requestId: digest.id,
              ip: '',
              user_agent: '',
              method: '',
              url: '',
              timestamp: digest.created_at,
              duration: 0,
            },
            sent: false,
            attempts: 0,
            created_at: digest.created_at,
          };

          await this.sendNotification(notification);
        }
      }

      digest.sent = true;
      digest.sentAt = new Date();
    } catch (error) {
      logger.error('Failed to send digest', { digestId: digest.id, error });
    }
  }

  // Public methods
  async addChannel(channel: NotificationChannel): Promise<void> {
    this.channels.set(channel.id, channel);
    logger.info('Notification channel added', {
      channelId: channel.id,
      name: channel.name,
    });
  }

  async updateChannel(
    channelId: string,
    updates: Partial<NotificationChannel>,
  ): Promise<void> {
    const channel = this.channels.get(channelId);
    if (channel) {
      Object.assign(channel, updates);
      logger.info('Notification channel updated', { channelId });
    }
  }

  async addRule(rule: NotificationRule): Promise<void> {
    this.rules.set(rule.id, rule);
    logger.info('Notification rule added', {
      ruleId: rule.id,
      name: rule.name,
    });
  }

  async updateRule(
    ruleId: string,
    updates: Partial<NotificationRule>,
  ): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      logger.info('Notification rule updated', { ruleId });
    }
  }

  async getNotificationHistory(
    limit: number = 100,
  ): Promise<ErrorNotification[]> {
    try {
      const logs = await this.prisma.audit_logs.findMany({
        where: {
          action: {
            in: ['ERROR_NOTIFICATION_SENT', 'ERROR_NOTIFICATION_FAILED'],
          },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });

      return logs.map(log => ({
        id: log.details?.notificationId,
        errorId: log.details?.errorId,
        channelId: log.details?.channelId,
        type: 'IMMEDIATE',
        severity: log.details?.severity,
        category: log.details?.category,
        title: '',
        message: '',
        context: {} as ErrorContext,
        sent: log.action === 'ERROR_NOTIFICATION_SENT',
        sentAt: log.created_at,
        attempts: log.details?.attempts || 1,
        lastAttempt: log.created_at,
        error: log.details?.error,
        created_at: log.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get notification history', { error });
      return [];
    }
  }

  async testChannel(channelId: string): Promise<boolean> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const testNotification: ErrorNotification = {
        id: `test_${Date.now()}`,
        errorId: 'test-error',
        channelId,
        type: 'IMMEDIATE',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.SYSTEM,
        title: 'Test Notification',
        message:
          'This is a test notification to verify the channel is working correctly.',
        context: {
          requestId: 'test-request',
          ip: '127.0.0.1',
          user_agent: 'test-client',
          method: 'GET',
          url: '/test',
          timestamp: new Date(),
          duration: 0,
        },
        sent: false,
        attempts: 0,
        created_at: new Date(),
      };

      return await this.sendNotification(testNotification);
    } catch (error) {
      logger.error('Failed to test notification channel', { channelId, error });
      return false;
    }
  }
}

export const errorNotificationService = new ErrorNotificationService();
