import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { BaseError } from '@/utils/errors';
import {
  categorizeError,
  ErrorSeverity,
  ErrorCategory,
} from '@/middleware/errorMiddleware';
import type { ErrorContextData } from '@/services/errorReportingService';

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS' | 'PUSH';
  enabled: boolean;
  config: Record<string, unknown>;
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
  context: ErrorContextData;
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
    categories: Partial<Record<ErrorCategory, number>>;
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

type ErrorMetadata = {
  severity: ErrorSeverity;
  category: ErrorCategory;
};

const ERROR_CATEGORY_VALUES = new Set<ErrorCategory>(
  Object.values(ErrorCategory) as ErrorCategory[],
);
const ERROR_SEVERITY_VALUES = new Set<ErrorSeverity>(
  Object.values(ErrorSeverity) as ErrorSeverity[],
);

const isErrorCategoryValue = (value: unknown): value is ErrorCategory =>
  typeof value === 'string' &&
  ERROR_CATEGORY_VALUES.has(value as ErrorCategory);

const isErrorSeverityValue = (value: unknown): value is ErrorSeverity =>
  typeof value === 'string' &&
  ERROR_SEVERITY_VALUES.has(value as ErrorSeverity);

const asJsonObject = (
  value: Prisma.JsonValue | null | undefined,
): Prisma.JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Prisma.JsonObject;
};

const getStringFromJson = (
  obj: Prisma.JsonObject | null,
  key: string,
): string | undefined => {
  if (!obj) {
    return undefined;
  }

  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

interface ErrorReportDetails {
  message?: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
}

const parseErrorReportDetails = (
  value: Prisma.JsonValue | null,
): ErrorReportDetails => {
  const root = asJsonObject(value);
  if (!root) {
    return {};
  }

  const details: ErrorReportDetails = {};
  const errorJson = asJsonObject(root['error']);

  const directMessage = getStringFromJson(root, 'message');
  if (directMessage) {
    details.message = directMessage;
  } else {
    const nestedMessage = getStringFromJson(errorJson, 'message');
    if (nestedMessage) {
      details.message = nestedMessage;
    }
  }

  const severityValue = getStringFromJson(root, 'severity');
  if (isErrorSeverityValue(severityValue)) {
    details.severity = severityValue;
  } else {
    const nestedSeverity = getStringFromJson(errorJson, 'severity');
    if (isErrorSeverityValue(nestedSeverity)) {
      details.severity = nestedSeverity;
    }
  }

  const categoryValue = getStringFromJson(root, 'category');
  if (isErrorCategoryValue(categoryValue)) {
    details.category = categoryValue;
  } else {
    const nestedCategory = getStringFromJson(errorJson, 'category');
    if (isErrorCategoryValue(nestedCategory)) {
      details.category = nestedCategory;
    }
  }

  return details;
};

const extractMetadataFromRecord = (
  value: unknown,
): Partial<ErrorMetadata> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const metadata: Partial<ErrorMetadata> = {};

  const severityValue = record['severity'];
  if (isErrorSeverityValue(severityValue)) {
    metadata.severity = severityValue;
  }

  const categoryValue = record['category'];
  if (isErrorCategoryValue(categoryValue)) {
    metadata.category = categoryValue;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
};

const deriveErrorMetadata = (error: BaseError): ErrorMetadata => {
  const directMetadata = extractMetadataFromRecord(error);
  const detailsMetadata = extractMetadataFromRecord(error.details);
  const categorized = categorizeError(error);

  return {
    severity:
      directMetadata?.severity ??
      detailsMetadata?.severity ??
      categorized.severity,
    category:
      directMetadata?.category ??
      detailsMetadata?.category ??
      categorized.category,
  };
};

const jsonPath = (...segments: string[]): string => `$.${segments.join('.')}`;

const toInputJson = (value: unknown): Prisma.InputJsonValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch (error) {
    logger.debug('Failed to convert value to JSON input', { value, error });
    return String(value) as Prisma.InputJsonValue;
  }
};

const jsonEquals = (segments: string[], value: unknown): Prisma.JsonFilter => ({
  path: jsonPath(...segments),
  equals: toInputJson(value),
});

const serializeContext = (
  context: ErrorContextData,
): Record<string, unknown> => {
  const serialized: Record<string, unknown> = {
    requestId: context.requestId,
    ip: context.ip,
    userAgent: context.userAgent,
    method: context.method,
    url: context.url,
    timestamp: context.timestamp.toISOString(),
    duration: context.duration,
  };

  if (context.userId) {
    serialized.userId = context.userId;
  }
  if (context.body !== undefined) {
    serialized.body = context.body;
  }
  if (context.query !== undefined) {
    serialized.query = context.query;
  }
  if (context.params !== undefined) {
    serialized.params = context.params;
  }

  return serialized;
};

const serializeNotification = (
  notification: ErrorNotification,
): Record<string, unknown> => {
  const serialized: Record<string, unknown> = {
    id: notification.id,
    errorId: notification.errorId,
    channelId: notification.channelId,
    type: notification.type,
    severity: notification.severity,
    category: notification.category,
    title: notification.title,
    message: notification.message,
    sent: notification.sent,
    attempts: notification.attempts,
    createdAt: notification.created_at.toISOString(),
    context: serializeContext(notification.context),
  };

  if (notification.ruleId) {
    serialized.ruleId = notification.ruleId;
  }
  if (notification.sentAt) {
    serialized.sentAt = notification.sentAt.toISOString();
  }
  if (notification.lastAttempt) {
    serialized.lastAttempt = notification.lastAttempt.toISOString();
  }
  if (notification.error) {
    serialized.error = notification.error;
  }

  return serialized;
};

const deserializeContext = (
  value: Prisma.JsonValue | null | undefined,
): ErrorContextData | null => {
  const obj = asJsonObject(value);
  if (!obj) {
    return null;
  }

  const requestId = getStringFromJson(obj, 'requestId');
  const method = getStringFromJson(obj, 'method');
  const url = getStringFromJson(obj, 'url');

  if (!requestId || !method || !url) {
    return null;
  }

  const timestampValue = obj['timestamp'];
  const durationValue = obj['duration'];

  const context: ErrorContextData = {
    requestId,
    ip: getStringFromJson(obj, 'ip') ?? '',
    userAgent: getStringFromJson(obj, 'userAgent') ?? '',
    method,
    url,
    timestamp:
      typeof timestampValue === 'string'
        ? new Date(timestampValue)
        : new Date(),
    duration: typeof durationValue === 'number' ? durationValue : 0,
  };

  const userId = getStringFromJson(obj, 'userId');
  if (userId) {
    context.userId = userId;
  }

  if (obj['body'] !== undefined) {
    context.body = obj['body'];
  }
  if (obj['query'] !== undefined) {
    context.query = obj['query'];
  }
  if (obj['params'] !== undefined) {
    context.params = obj['params'];
  }

  return context;
};

const deserializeNotification = (
  value: Prisma.JsonValue | null,
): ErrorNotification | null => {
  const root = asJsonObject(value);
  if (!root) {
    return null;
  }

  const notificationJson = asJsonObject(root['notification']) ?? root;

  const id = getStringFromJson(notificationJson, 'id');
  if (!id) {
    return null;
  }

  const typeValue = getStringFromJson(notificationJson, 'type');
  const type: ErrorNotification['type'] =
    typeValue === 'DIGEST' || typeValue === 'ESCALATION'
      ? typeValue
      : 'IMMEDIATE';

  const severityValue = getStringFromJson(notificationJson, 'severity');
  const severity = isErrorSeverityValue(severityValue)
    ? severityValue
    : ErrorSeverity.MEDIUM;

  const categoryValue = getStringFromJson(notificationJson, 'category');
  const category = isErrorCategoryValue(categoryValue)
    ? categoryValue
    : ErrorCategory.SYSTEM;

  const context = deserializeContext(notificationJson['context']);
  if (!context) {
    return null;
  }

  const createdAtValue = notificationJson['createdAt'];
  const attemptsValue = notificationJson['attempts'];
  const sentValue = notificationJson['sent'];
  const sentAtValue = notificationJson['sentAt'];
  const lastAttemptValue = notificationJson['lastAttempt'];
  const errorValue = notificationJson['error'];

  const notification: ErrorNotification = {
    id,
    errorId:
      getStringFromJson(notificationJson, 'errorId') ?? context.requestId,
    channelId: getStringFromJson(notificationJson, 'channelId') ?? 'unknown',
    type,
    severity,
    category,
    title: getStringFromJson(notificationJson, 'title') ?? '',
    message: getStringFromJson(notificationJson, 'message') ?? '',
    context,
    sent: typeof sentValue === 'boolean' ? sentValue : Boolean(sentValue),
    attempts: typeof attemptsValue === 'number' ? attemptsValue : 0,
    created_at:
      typeof createdAtValue === 'string'
        ? new Date(createdAtValue)
        : new Date(),
  };

  const ruleId = getStringFromJson(notificationJson, 'ruleId');
  if (ruleId) {
    notification.ruleId = ruleId;
  }

  if (typeof sentAtValue === 'string') {
    notification.sentAt = new Date(sentAtValue);
  }
  if (typeof lastAttemptValue === 'string') {
    notification.lastAttempt = new Date(lastAttemptValue);
  }
  if (typeof errorValue === 'string') {
    notification.error = errorValue;
  }

  return notification;
};

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

  async processError(
    error: BaseError,
    context: ErrorContextData,
  ): Promise<void> {
    try {
      const metadata = deriveErrorMetadata(error);
      const matchingRules = await this.findMatchingRules(
        error,
        metadata,
        context,
      );

      for (const rule of matchingRules) {
        if (this.shouldNotify(rule, metadata)) {
          await this.createNotifications(rule, error, metadata, context);
        }
      }

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
    metadata: ErrorMetadata,
    context: ErrorContextData,
  ): Promise<NotificationRule[]> {
    const matchingRules: NotificationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      let matches = true;

      if (rule.conditions.severity) {
        matches =
          matches && rule.conditions.severity.includes(metadata.severity);
      }

      if (rule.conditions.category) {
        matches =
          matches && rule.conditions.category.includes(metadata.category);
      }

      if (rule.conditions.keywords) {
        const message = error.message.toLowerCase();
        matches =
          matches &&
          rule.conditions.keywords.some(keyword =>
            message.includes(keyword.toLowerCase()),
          );
      }

      if (rule.conditions.endpoints) {
        matches =
          matches &&
          rule.conditions.endpoints.some(endpoint =>
            context.url.includes(endpoint),
          );
      }

      if (rule.conditions.threshold && rule.conditions.timePeriod) {
        matches = matches && (await this.checkThreshold(rule));
      }

      if (matches) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  private async checkThreshold(rule: NotificationRule): Promise<boolean> {
    const threshold = rule.conditions.threshold;
    const timePeriod = rule.conditions.timePeriod;

    if (!threshold || !timePeriod) {
      return true;
    }

    try {
      const startTime = new Date(Date.now() - timePeriod * 60 * 1000);
      const where: Prisma.audit_logsWhereInput = {
        action: 'ERROR_REPORT',
        created_at: { gte: startTime },
      };

      const andConditions: Prisma.audit_logsWhereInput[] = [];

      if (rule.conditions.severity?.length) {
        andConditions.push({
          OR: rule.conditions.severity.map(severity => ({
            new_values: jsonEquals(['error', 'severity'], severity),
          })),
        });
      }

      if (rule.conditions.category?.length) {
        andConditions.push({
          OR: rule.conditions.category.map(category => ({
            new_values: jsonEquals(['error', 'category'], category),
          })),
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      const errorCount = await this.prisma.audit_logs.count({ where });

      return errorCount >= threshold;
    } catch (error) {
      logger.error('Failed to check notification threshold', { error });
      return false;
    }
  }

  private shouldNotify(
    rule: NotificationRule,
    metadata: ErrorMetadata,
  ): boolean {
    if (!rule.cooldown) {
      return true;
    }

    const cooldownKey = `${rule.id}-${metadata.category}-${metadata.severity}`;
    const lastNotification = this.getLastNotificationTime(cooldownKey);

    if (
      lastNotification &&
      Date.now() - lastNotification.getTime() < rule.cooldown * 60 * 1000
    ) {
      return false;
    }

    return true;
  }

  private getLastNotificationTime(_key: string): Date | null {
    // In a real implementation, this would check a cache or database
    // For now, return null to always allow notifications
    return null;
  }

  private async createNotifications(
    rule: NotificationRule,
    error: BaseError,
    metadata: ErrorMetadata,
    context: ErrorContextData,
  ): Promise<void> {
    for (const channelId of rule.channels) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }

      const notification: ErrorNotification = {
        id: `notif_${randomUUID()}`,
        errorId: context.requestId,
        ruleId: rule.id,
        channelId,
        type: 'IMMEDIATE',
        severity: metadata.severity,
        category: metadata.category,
        title: this.generateNotificationTitle(error, metadata, rule),
        message: this.generateNotificationMessage(
          error,
          metadata,
          context,
          rule,
        ),
        context,
        sent: false,
        attempts: 0,
        created_at: new Date(),
      };

      this.notificationQueue.push(notification);

      await this.prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          entity: 'ERROR_NOTIFICATION',
          entity_id: notification.id,
          action: 'ERROR_NOTIFICATION_CREATED',
          performed_by: 'SYSTEM',
          ip_address: context.ip || null,
          user_agent: context.userAgent || null,
          new_values: toInputJson({
            notification: serializeNotification(notification),
            metadata: {
              ruleId: rule.id,
              channelId,
            },
            error: {
              message: error.message,
              severity: metadata.severity,
              category: metadata.category,
            },
          }),
        },
      });
    }

    if (rule.escalation) {
      setTimeout(
        () => {
          void this.createEscalationNotifications(
            rule,
            error,
            metadata,
            context,
          );
        },
        rule.escalation.delay * 60 * 1000,
      );
    }
  }

  private async createEscalationNotifications(
    rule: NotificationRule,
    error: BaseError,
    metadata: ErrorMetadata,
    context: ErrorContextData,
  ): Promise<void> {
    const wasResolved = await this.checkIfErrorResolved(context.requestId);
    if (wasResolved) {
      return;
    }

    for (const channelId of rule.escalation!.channels) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }

      const notification: ErrorNotification = {
        id: `escal_${randomUUID()}`,
        errorId: context.requestId,
        ruleId: rule.id,
        channelId,
        type: 'ESCALATION',
        severity: metadata.severity,
        category: metadata.category,
        title: `ESCALATED: ${this.generateNotificationTitle(error, metadata, rule)}`,
        message: this.generateEscalationMessage(error, metadata, context, rule),
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
          new_values: jsonEquals(['errorId'], errorId),
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
    metadata: ErrorMetadata,
    rule: NotificationRule,
  ): string {
    const severityEmoji: Record<ErrorSeverity, string> = {
      [ErrorSeverity.CRITICAL]: '🚨',
      [ErrorSeverity.HIGH]: '⚠️',
      [ErrorSeverity.MEDIUM]: '⚡',
      [ErrorSeverity.LOW]: 'ℹ️',
    };

    return `${severityEmoji[metadata.severity]} ${rule.name}: ${metadata.category}`;
  }

  private generateNotificationMessage(
    error: BaseError,
    metadata: ErrorMetadata,
    context: ErrorContextData,
    rule: NotificationRule,
  ): string {
    return `
Error Details:
- Message: ${error.message}
- Category: ${metadata.category}
- Severity: ${metadata.severity}
- Endpoint: ${context.method} ${context.url}
- User ID: ${context.userId ?? 'Anonymous'}
- Timestamp: ${context.timestamp.toISOString()}
- Request ID: ${context.requestId}

${error.stack ? `\nStack Trace:\n${error.stack}` : ''}

${rule.escalation ? '\n⚠️ This error will escalate if not resolved.' : ''}
    `.trim();
  }

  private generateEscalationMessage(
    error: BaseError,
    metadata: ErrorMetadata,
    context: ErrorContextData,
    rule: NotificationRule,
  ): string {
    return `
🚨 ESCALATED ERROR ALERT 🚨

This error has not been resolved and has been escalated.

${this.generateNotificationMessage(error, metadata, context, rule)}

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
      notification.error =
        error instanceof Error ? error.message : String(error);

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
      const webhookUrlValue = channel.config.webhook;
      if (typeof webhookUrlValue !== 'string' || webhookUrlValue.length === 0) {
        throw new Error('Slack webhook URL not configured');
      }

      const slackChannel = channel.config.channel;
      if (typeof slackChannel !== 'string' || slackChannel.length === 0) {
        throw new Error('Slack channel not configured');
      }

      const webhookUrl = webhookUrlValue;

      const payload = {
        channel: slackChannel,
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
      const webhookUrlValue = channel.config.url;
      if (typeof webhookUrlValue !== 'string' || webhookUrlValue.length === 0) {
        throw new Error('Webhook URL not configured');
      }

      const webhookUrl = webhookUrlValue;

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
        data: {
          id: randomUUID(),
          entity: 'ERROR_NOTIFICATION',
          entity_id: notification.id,
          action: notification.sent
            ? 'ERROR_NOTIFICATION_SENT'
            : 'ERROR_NOTIFICATION_FAILED',
          performed_by: 'SYSTEM',
          ip_address: notification.context.ip || null,
          user_agent: notification.context.userAgent || null,
          new_values: toInputJson({
            notification: serializeNotification(notification),
          }),
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
    errorLogs: Array<{ new_values: Prisma.JsonValue | null; created_at: Date }>,
  ): Promise<NotificationDigest> {
    const digestId = `digest_${type.toLowerCase()}_${Date.now()}`;
    const reports = errorLogs.map(log =>
      parseErrorReportDetails(log.new_values),
    );

    const summary = {
      totalErrors: errorLogs.length,
      criticalErrors: reports.filter(
        report => report.severity === ErrorSeverity.CRITICAL,
      ).length,
      highErrors: reports.filter(
        report => report.severity === ErrorSeverity.HIGH,
      ).length,
      categories: {} as Partial<Record<ErrorCategory, number>>,
      topErrors: [] as Array<{
        message: string;
        count: number;
        severity: ErrorSeverity;
      }>,
    };

    const errorGroups = new Map<
      string,
      { message: string; count: number; severity: ErrorSeverity }
    >();

    for (const report of reports) {
      if (report.category) {
        summary.categories[report.category] =
          (summary.categories[report.category] ?? 0) + 1;
      }

      if (report.message) {
        const severity = report.severity ?? ErrorSeverity.MEDIUM;
        const key = `${report.message}::${severity}`;
        const existing = errorGroups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          errorGroups.set(key, {
            message: report.message,
            count: 1,
            severity,
          });
        }
      }
    }

    summary.topErrors = Array.from(errorGroups.values())
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
              userAgent: 'system',
              method: 'DIGEST',
              url: '/digest',
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

      const notifications = logs
        .map(log => {
          const notification = deserializeNotification(log.new_values);
          if (!notification) {
            return null;
          }

          notification.sent = log.action === 'ERROR_NOTIFICATION_SENT';
          if (notification.sent && !notification.sentAt) {
            notification.sentAt = log.created_at;
          }
          notification.lastAttempt = notification.lastAttempt ?? log.created_at;
          notification.created_at = notification.created_at ?? log.created_at;

          return notification;
        })
        .filter(
          (notification): notification is ErrorNotification =>
            notification !== null,
        );

      return notifications;
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
          userAgent: 'test-client',
          method: 'GET',
          url: '/test',
          timestamp: new Date(),
          duration: 0,
        },
        sent: false,
        attempts: 0,
        created_at: new Date(),
      };

      await this.sendNotification(testNotification);
      return testNotification.sent;
    } catch (error) {
      logger.error('Failed to test notification channel', { channelId, error });
      return false;
    }
  }
}

export const errorNotificationService = new ErrorNotificationService();
