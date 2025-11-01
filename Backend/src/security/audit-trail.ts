import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuditEvent {
  id?: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security' | 'compliance';
  outcome: 'success' | 'failure' | 'partial';
  source: 'api' | 'web' | 'cli' | 'system' | 'integration';
  correlationId?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  affectedFields?: string[];
  metadata?: Record<string, any>;
}

export interface AuditFilter {
  userId?: string;
  action?: string | string[];
  resourceType?: string;
  resourceId?: string;
  category?: string | string[];
  severity?: string | string[];
  outcome?: string;
  source?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  sessionId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'action' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditConfig {
  retentionDays: number;
  bufferSize: number;
  batchSize: number;
  flushInterval: number;
  enableRealTimeLogging: boolean;
  enableComplianceMode: boolean;
  sensitiveDataMasking: boolean;
  compressionEnabled: boolean;
  archiveAfterDays: number;
}

export class AuditTrail {
  private redis: Redis;
  private config: AuditConfig;
  private eventBuffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(redis: Redis, config: Partial<AuditConfig> = {}) {
    this.redis = redis;
    this.config = {
      retentionDays: 365, // 1 year
      bufferSize: 1000,
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      enableRealTimeLogging: true,
      enableComplianceMode: process.env.NODE_ENV === 'production',
      sensitiveDataMasking: true,
      compressionEnabled: true,
      archiveAfterDays: 90,
      ...config
    };

    this.startFlushTimer();
    this.setupGracefulShutdown();
  }

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date(),
        correlationId: event.correlationId || this.generateCorrelationId()
      };

      // Apply sensitive data masking if enabled
      if (this.config.sensitiveDataMasking) {
        auditEvent.details = this.maskSensitiveData(auditEvent.details);
        auditEvent.previousValues = auditEvent.previousValues
          ? this.maskSensitiveData(auditEvent.previousValues)
          : undefined;
        auditEvent.newValues = auditEvent.newValues
          ? this.maskSensitiveData(auditEvent.newValues)
          : undefined;
      }

      // Add to buffer
      this.eventBuffer.push(auditEvent);

      // Log to Redis for real-time access
      if (this.config.enableRealTimeLogging) {
        await this.logToRedis(auditEvent);
      }

      // Flush buffer if it exceeds batch size
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flushBuffer();
      }

      // Log to application logger for critical events
      if (auditEvent.severity === 'critical') {
        logger.error('Critical audit event', {
          eventId: auditEvent.id,
          action: auditEvent.action,
          userId: auditEvent.userId,
          resourceType: auditEvent.resourceType,
          resourceId: auditEvent.resourceId,
          severity: auditEvent.severity,
          outcome: auditEvent.outcome
        });
      }

      return auditEvent.id;

    } catch (error) {
      logger.error('Failed to log audit event', {
        error: (error as Error).message,
        action: event.action,
        userId: event.userId
      });
      throw error;
    }
  }

  async queryEvents(filter: AuditFilter): Promise<{
    events: AuditEvent[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const whereClause: any = {};

      // Build where clause from filter
      if (filter.userId) {
        whereClause.userId = filter.userId;
      }

      if (filter.action) {
        if (Array.isArray(filter.action)) {
          whereClause.action = { in: filter.action };
        } else {
          whereClause.action = filter.action;
        }
      }

      if (filter.resourceType) {
        whereClause.details = {
          path: ['resourceType'],
          equals: filter.resourceType
        };
      }

      if (filter.resourceId) {
        whereClause.details = {
          path: ['resourceId'],
          equals: filter.resourceId
        };
      }

      if (filter.category) {
        if (Array.isArray(filter.category)) {
          whereClause.details = {
            path: ['category'],
            in: filter.category
          };
        } else {
          whereClause.details = {
            path: ['category'],
            equals: filter.category
          };
        }
      }

      if (filter.severity) {
        if (Array.isArray(filter.severity)) {
          whereClause.details = {
            path: ['severity'],
            in: filter.severity
          };
        } else {
          whereClause.details = {
            path: ['severity'],
            equals: filter.severity
          };
        }
      }

      if (filter.outcome) {
        whereClause.details = {
          path: ['outcome'],
          equals: filter.outcome
        };
      }

      if (filter.source) {
        whereClause.details = {
          path: ['source'],
          equals: filter.source
        };
      }

      if (filter.startDate || filter.endDate) {
        whereClause.timestamp = {};
        if (filter.startDate) {
          whereClause.timestamp.gte = filter.startDate;
        }
        if (filter.endDate) {
          whereClause.timestamp.lte = filter.endDate;
        }
      }

      if (filter.ipAddress) {
        whereClause.details = {
          path: ['ipAddress'],
          equals: filter.ipAddress
        };
      }

      if (filter.sessionId) {
        whereClause.details = {
          path: ['sessionId'],
          equals: filter.sessionId
        };
      }

      if (filter.correlationId) {
        whereClause.details = {
          path: ['correlationId'],
          equals: filter.correlationId
        };
      }

      // Query with pagination
      const [events, totalCount] = await Promise.all([
        prisma.audit_logs.findMany({
          where: whereClause,
          orderBy: {
            timestamp: filter.sortOrder === 'asc' ? 'asc' : 'desc'
          },
          take: filter.limit || 100,
          skip: filter.offset || 0
        }),
        prisma.audit_logs.count({ where: whereClause })
      ]);

      // Transform database records to audit events
      const auditEvents: AuditEvent[] = events.map(log => {
        const details = log.details as any;
        return {
          id: log.id,
          userId: log.userId,
          action: log.action,
          resourceType: details?.resourceType,
          resourceId: details?.resourceId,
          details: details || {},
          ipAddress: details?.ipAddress,
          userAgent: details?.userAgent,
          timestamp: log.timestamp,
          severity: details?.severity || 'medium',
          category: details?.category || 'system',
          outcome: details?.outcome || 'success',
          source: details?.source || 'api',
          correlationId: details?.correlationId,
          previousValues: details?.previousValues,
          newValues: details?.newValues,
          affectedFields: details?.affectedFields,
          metadata: details?.metadata
        };
      });

      const limit = filter.limit || 100;
      const offset = filter.offset || 0;
      const hasMore = offset + auditEvents.length < totalCount;

      return {
        events: auditEvents,
        totalCount,
        hasMore
      };

    } catch (error) {
      logger.error('Failed to query audit events', {
        error: (error as Error).message,
        filter
      });
      return {
        events: [],
        totalCount: 0,
        hasMore: false
      };
    }
  }

  async getEventById(eventId: string): Promise<AuditEvent | null> {
    try {
      const log = await prisma.audit_logs.findUnique({
        where: { id: eventId }
      });

      if (!log) {
        return null;
      }

      const details = log.details as any;
      return {
        id: log.id,
        userId: log.userId,
        action: log.action,
        resourceType: details?.resourceType,
        resourceId: details?.resourceId,
        details: details || {},
        ipAddress: details?.ipAddress,
        userAgent: details?.userAgent,
        timestamp: log.timestamp,
        severity: details?.severity || 'medium',
        category: details?.category || 'system',
        outcome: details?.outcome || 'success',
        source: details?.source || 'api',
        correlationId: details?.correlationId,
        previousValues: details?.previousValues,
        newValues: details?.newValues,
        affectedFields: details?.affectedFields,
        metadata: details?.metadata
      };

    } catch (error) {
      logger.error('Failed to get audit event by ID', {
        error: (error as Error).message,
        eventId
      });
      return null;
    }
  }

  async getUserActivityTimeline(userId: string, days: number = 30): Promise<AuditEvent[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await this.queryEvents({
        userId,
        startDate,
        sortBy: 'timestamp',
        sortOrder: 'desc',
        limit: 1000
      });

      return result.events;

    } catch (error) {
      logger.error('Failed to get user activity timeline', {
        error: (error as Error).message,
        userId,
        days
      });
      return [];
    }
  }

  async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditEvent[]> {
    try {
      const result = await this.queryEvents({
        resourceType,
        resourceId,
        sortBy: 'timestamp',
        sortOrder: 'desc',
        limit: 500
      });

      return result.events;

    } catch (error) {
      logger.error('Failed to get resource history', {
        error: (error as Error).message,
        resourceType,
        resourceId
      });
      return [];
    }
  }

  async getSecurityEvents(hours: number = 24): Promise<AuditEvent[]> {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const result = await this.queryEvents({
        category: ['security', 'authentication', 'authorization'],
        startDate,
        sortBy: 'timestamp',
        sortOrder: 'desc',
        limit: 1000
      });

      return result.events;

    } catch (error) {
      logger.error('Failed to get security events', {
        error: (error as Error).message,
        hours
      });
      return [];
    }
  }

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<{
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    eventsByUser: Record<string, number>;
    securityIncidents: AuditEvent[];
    dataAccessEvents: AuditEvent[];
    failedAuthentications: AuditEvent[];
  }> {
    try {
      const result = await this.queryEvents({
        startDate,
        endDate,
        limit: 10000
      });

      const events = result.events;

      // Analyze events
      const eventsByCategory: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      const eventsByUser: Record<string, number> = {};
      const securityIncidents: AuditEvent[] = [];
      const dataAccessEvents: AuditEvent[] = [];
      const failedAuthentications: AuditEvent[] = [];

      for (const event of events) {
        // Count by category
        eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;

        // Count by severity
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

        // Count by user
        if (event.userId) {
          eventsByUser[event.userId] = (eventsByUser[event.userId] || 0) + 1;
        }

        // Categorize events
        if (event.category === 'security' || event.severity === 'critical') {
          securityIncidents.push(event);
        }

        if (event.action.includes('access') || event.action.includes('view')) {
          dataAccessEvents.push(event);
        }

        if (event.action.includes('login') && event.outcome === 'failure') {
          failedAuthentications.push(event);
        }
      }

      return {
        totalEvents: events.length,
        eventsByCategory,
        eventsBySeverity,
        eventsByUser,
        securityIncidents,
        dataAccessEvents,
        failedAuthentications
      };

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        error: (error as Error).message,
        startDate,
        endDate
      });

      return {
        totalEvents: 0,
        eventsByCategory: {},
        eventsBySeverity: {},
        eventsByUser: {},
        securityIncidents: [],
        dataAccessEvents: [],
        failedAuthentications: []
      };
    }
  }

  async archiveOldEvents(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAfterDays);

      const archivedCount = await prisma.audit_logs.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      logger.info('Audit events archived', {
        archivedCount: archivedCount.count,
        cutoffDate: cutoffDate.toISOString()
      });

      return archivedCount.count;

    } catch (error) {
      logger.error('Failed to archive old audit events', {
        error: (error as Error).message
      });
      return 0;
    }
  }

  // Middleware for automatic request logging
  auditMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Store original send method
      const originalSend = res.send;

      // Override send method to capture response
      res.send = function(this: Response, ...args: any[]) {
        // Log audit event after response is sent
        setImmediate(async () => {
          try {
            await auditTrail.logEvent({
              userId: (req as any).user?.id,
              sessionId: (req as any).sessionId,
              action: `${req.method}_${req.route?.path || req.path}`,
              resourceType: this.getRouteResourceType(req),
              resourceId: this.getResourceId(req),
              details: {
                method: req.method,
                path: req.path,
                query: req.query,
                statusCode: res.statusCode,
                responseTime: Date.now() - req.startTime,
                contentLength: res.get('Content-Length')
              },
              ipAddress: this.getClientIP(req),
              userAgent: req.get('User-Agent') || 'unknown',
              severity: this.getSeverityFromStatusCode(res.statusCode),
              category: this.getCategoryFromRequest(req),
              outcome: res.statusCode < 400 ? 'success' : 'failure',
              source: 'api'
            });
          } catch (error) {
            logger.error('Failed to log audit middleware event', {
              error: (error as Error).message
            });
          }
        });

        // Call original send method
        return originalSend.apply(this, args);
      };

      // Add start time to request
      req.startTime = Date.now();

      next();
    };
  }

  private async logToRedis(event: AuditEvent): Promise<void> {
    try {
      const eventKey = `audit_event:${event.id}`;
      await this.redis.hset(eventKey, {
        ...event,
        timestamp: event.timestamp.toISOString(),
        details: JSON.stringify(event.details)
      });
      await this.redis.expire(eventKey, this.config.retentionDays * 24 * 60 * 60);

      // Add to recent events list
      await this.redis.lpush('recent_audit_events', event.id);
      await this.redis.ltrim('recent_audit_events', 0, 9999);

    } catch (error) {
      logger.error('Failed to log audit event to Redis', {
        error: (error as Error).message,
        eventId: event.id
      });
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0 || this.isShuttingDown) {
      return;
    }

    try {
      const eventsToFlush = this.eventBuffer.splice(0, this.config.batchSize);

      // Batch insert to database
      await prisma.audit_logs.createMany({
        data: eventsToFlush.map(event => ({
          id: event.id,
          userId: event.userId,
          action: event.action,
          details: {
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            ...event.details,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            severity: event.severity,
            category: event.category,
            outcome: event.outcome,
            source: event.source,
            correlationId: event.correlationId,
            previousValues: event.previousValues,
            newValues: event.newValues,
            affectedFields: event.affectedFields,
            metadata: event.metadata
          },
          timestamp: event.timestamp
        }))
      });

      logger.debug('Audit events flushed to database', {
        eventCount: eventsToFlush.length
      });

    } catch (error) {
      logger.error('Failed to flush audit events to database', {
        error: (error as Error).message,
        eventCount: this.eventBuffer.length
      });
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushBuffer();
    }, this.config.flushInterval);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      this.isShuttingDown = true;

      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      await this.flushBuffer();
      logger.info('Audit trail shutdown complete');
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  private maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'creditCard',
      'ssn', 'socialSecurityNumber', 'bankAccount', 'privateKey',
      'apiKey', 'accessToken', 'refreshToken', 'sessionToken'
    ];

    const mask = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(mask);
      }

      if (obj && typeof obj === 'object') {
        const masked: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

          if (isSensitive) {
            masked[key] = '[REDACTED]';
          } else if (typeof value === 'object' && value !== null) {
            masked[key] = mask(value);
          } else if (typeof value === 'string' && value.length > 100) {
            masked[key] = value.substring(0, 100) + '...';
          } else {
            masked[key] = value;
          }
        }
        return masked;
      }

      return obj;
    };

    return mask(data);
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  private getRouteResourceType(req: Request): string {
    const path = req.path;
    if (path.includes('/students')) return 'student';
    if (path.includes('/books')) return 'book';
    if (path.includes('/equipment')) return 'equipment';
    if (path.includes('/users')) return 'user';
    if (path.includes('/reports')) return 'report';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/settings')) return 'setting';
    if (path.includes('/backup')) return 'backup';
    return 'unknown';
  }

  private getResourceId(req: Request): string | undefined {
    return req.params.id || req.body?.id || req.query?.id;
  }

  private getSeverityFromStatusCode(statusCode: number): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode >= 500) return 'critical';
    if (statusCode >= 400) return 'high';
    if (statusCode >= 300) return 'medium';
    return 'low';
  }

  private getCategoryFromRequest(req: Request): AuditEvent['category'] {
    const path = req.path;
    if (path.includes('/auth')) return 'authentication';
    if (path.includes('/users') || path.includes('/roles')) return 'authorization';
    if (path.includes('/security')) return 'security';
    if (path.includes('/system') || path.includes('/backup')) return 'system';
    if (['GET', 'HEAD'].includes(req.method)) return 'data_access';
    return 'data_modification';
  }
}

// Export singleton instance
export const auditTrail = new AuditTrail(new Redis(process.env.REDIS_URL || 'redis://localhost:6379'));

// Export convenience functions
export const logAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp'>) => auditTrail.logEvent(event);
export const auditMiddleware = () => auditTrail.auditMiddleware();