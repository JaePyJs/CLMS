import { PrismaClient } from '@prisma/client';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import crypto from 'crypto';
import { simpleEncryption } from '../utils/fieldEncryption';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ACCESS_DENIED = 'ACCESS_DENIED',
}

export enum AuditEntity {
  STUDENT = 'STUDENT',
  EQUIPMENT = 'EQUIPMENT',
  ACTIVITY = 'ACTIVITY',
  BOOK = 'BOOK',
  USER = 'USER',
  REPORT = 'REPORT',
  SETTINGS = 'SETTINGS',
  BACKUP = 'BACKUP',
}

interface AuditLogEntry {
  id?: string;
  userName?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: Array<{ field: string; oldValue: any; newValue: any }>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Service
 * Tracks all data modifications for compliance and debugging
 */
class AuditService {
  /**
   * Log an audit entry to database with encryption
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Generate unique audit ID
      const auditId = entry.id || crypto.randomUUID();

      // Encrypt sensitive fields
      const encryptedIpAddress = entry.ipAddress
        ? simpleEncryption.encrypt(entry.ipAddress)
        : null;

      // Prepare audit data for database
      const auditData = {
        id: auditId,
        entity: entry.entity,
        action: entry.action,
        entity_id: entry.entityId || '',
        performed_by: entry.userName || 'system',
        ip_address: encryptedIpAddress?.encryptedData || null,
        user_agent: entry.userAgent || 'system',
        new_values: entry.newValues ? this.sanitizeValues(entry.newValues) : null,
        old_values: entry.oldValues ? this.sanitizeValues(entry.oldValues) : null,
        created_at: new Date(),
        ip_address_enc: encryptedIpAddress?.metadata || null,
        // Additional metadata stored as JSON
        metadata: {
          success: entry.success,
          error_message: entry.errorMessage,
          request_id: entry.requestId,
          changes: entry.changes,
          ...entry.metadata
        }
      };

      // Write to database
      await prisma.audit_logs.create({
        data: auditData
      });

      // Also log to logger for redundancy
      logger.info('Audit Log Recorded', {
        auditId,
        entity: entry.entity,
        action: entry.action,
        performed_by: entry.userName,
        success: entry.success,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      // Audit logging should never break the application
      logger.error('Failed to log audit entry', {
        error: (error as Error).message,
        entry
      });

      // Fallback to file-based logging
      logger.info('Audit Log (Fallback)', {
        timestamp: new Date().toISOString(),
        ...entry,
      });
    }
  }

  /**
   * Log a CREATE operation
   */
  async logCreate(
    id: string | undefined,
    entity: AuditEntity,
    entity_id: string,
    values: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id,
      action: AuditAction.CREATE,
      entity,
      entity_id,
      new_values: this.sanitizeValues(values),
      success: true,
      metadata,
    });
  }

  /**
   * Log an UPDATE operation
   */
  async logUpdate(
    id: string | undefined,
    entity: AuditEntity,
    entity_id: string,
    old_values: Record<string, any>,
    new_values: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const changes = this.detectChanges(old_values, newValues);
    
    await this.log({
      id,
      action: AuditAction.UPDATE,
      entity,
      entity_id,
      old_values: this.sanitizeValues(oldValues),
      new_values: this.sanitizeValues(newValues),
      changes,
      success: true,
      metadata,
    });
  }

  /**
   * Log a DELETE operation
   */
  async logDelete(
    id: string | undefined,
    entity: AuditEntity,
    entity_id: string,
    values: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id,
      action: AuditAction.DELETE,
      entity,
      entity_id,
      old_values: this.sanitizeValues(values),
      success: true,
      metadata,
    });
  }

  /**
   * Log a VIEW operation (for sensitive data)
   */
  async logView(
    id: string | undefined,
    entity: AuditEntity,
    entity_id: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id,
      action: AuditAction.VIEW,
      entity,
      entity_id,
      success: true,
      metadata,
    });
  }

  /**
   * Log an EXPORT operation
   */
  async logExport(
    id: string | undefined,
    entity: AuditEntity,
    recordCount: number,
    format: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id,
      action: AuditAction.EXPORT,
      entity,
      success: true,
      metadata: { id: crypto.randomUUID(), updated_at: new Date(), 
        ...metadata,
        recordCount,
        format,
      },
    });
  }

  /**
   * Log a LOGIN operation
   */
  async logLogin(
    id: string | undefined,
    userName: string,
    ip_address: string,
    user_agent: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      id,
      userName,
      action: AuditAction.LOGIN,
      entity: AuditEntity.USER,
      ip_address,
      user_agent,
      success,
      error_message,
    });
  }

  /**
   * Log a LOGOUT operation
   */
  async logLogout(
    id: string,
    userName: string,
    ip_address: string,
    user_agent: string
  ): Promise<void> {
    await this.log({
      id,
      userName,
      action: AuditAction.LOGOUT,
      entity: AuditEntity.USER,
      ip_address,
      user_agent,
      success: true,
    });
  }

  /**
   * Log an ACCESS_DENIED operation
   */
  async logAccessDenied(
    id: string | undefined,
    entity: AuditEntity,
    entity_id: string,
    reason: string,
    ip_address: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      id,
      action: AuditAction.ACCESS_DENIED,
      entity,
      entity_id,
      success: false,
      error_message: reason,
      ip_address,
      metadata,
    });
  }

  /**
   * Detect changes between old and new values
   */
  private detectChanges(
    old_values: Record<string, any>,
    new_values: Record<string, any>
  ): Array<{ field: string; oldValue: any; newValue: any }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    // Get all unique keys
    const allKeys = new Set([
      ...Object.keys(oldValues),
      ...Object.keys(newValues),
    ]);

    for (const key of allKeys) {
      const oldValue = oldValues[key];
      const newValue = newValues[key];

      // Skip if values are the same
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }

      changes.push({
        field: key,
        oldValue: this.sanitizeValue(key, oldValue),
        newValue: this.sanitizeValue(key, newValue),
      });
    }

    return changes;
  }

  /**
   * Sanitize sensitive values
   */
  private sanitizeValues(values: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(values)) {
      sanitized[key] = this.sanitizeValue(key, value);
    }

    return sanitized;
  }

  /**
   * Sanitize a single value
   */
  private sanitizeValue(key: string, value: any): any {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
    ];

    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      return '***REDACTED***';
    }

    return value;
  }

  /**
   * Get audit logs for an entity
   */
  async getAuditLogs(
    entity: AuditEntity,
    entity_id: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const logs = await prisma.audit_logs.findMany({
        where: {
          entity: entity,
          entity_id: entity_id,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
      });

      // Decrypt sensitive fields for display
      return logs.map(log => ({
        ...log,
        ip_address: log.ip_address && log.ip_address_enc
          ? simpleEncryption.decrypt({
              encryptedData: log.ip_address,
              metadata: log.ip_address_enc
            })
          : log.ip_address,
      }));
    } catch (error) {
      logger.error('Failed to get audit logs', {
        error: (error as Error).message,
        entity,
        entity_id,
      });
      return [];
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    performed_by: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const logs = await prisma.audit_logs.findMany({
        where: {
          performed_by: performed_by,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
      });

      // Decrypt sensitive fields for display
      return logs.map(log => ({
        ...log,
        ip_address: log.ip_address && log.ip_address_enc
          ? simpleEncryption.decrypt({
              encryptedData: log.ip_address,
              metadata: log.ip_address_enc
            })
          : log.ip_address,
      }));
    } catch (error) {
      logger.error('Failed to get user audit logs', {
        error: (error as Error).message,
        performed_by,
      });
      return [];
    }
  }

  /**
   * Get recent audit logs
   */
  async getRecentAuditLogs(limit: number = 100): Promise<any[]> {
    try {
      const logs = await prisma.audit_logs.findMany({
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
      });

      // Decrypt sensitive fields for display
      return logs.map(log => ({
        ...log,
        ip_address: log.ip_address && log.ip_address_enc
          ? simpleEncryption.decrypt({
              encryptedData: log.ip_address,
              metadata: log.ip_address_enc
            })
          : log.ip_address,
      }));
    } catch (error) {
      logger.error('Failed to get recent audit logs', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(filters: {
    id?: string;
    action?: AuditAction;
    entity?: AuditEntity;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    try {
      const whereClause: any = {};

      if (filters.id) whereClause.id = filters.id;
      if (filters.action) whereClause.action = filters.action;
      if (filters.entity) whereClause.entity = filters.entity;
      if (filters.entityId) whereClause.entity_id = filters.entityId;
      if (filters.startDate || filters.endDate) {
        whereClause.created_at = {};
        if (filters.startDate) whereClause.created_at.gte = filters.startDate;
        if (filters.endDate) whereClause.created_at.lte = filters.endDate;
      }

      const logs = await prisma.audit_logs.findMany({
        where: whereClause,
        orderBy: {
          created_at: 'desc',
        },
        take: filters.limit || 100,
      });

      // Decrypt sensitive fields for display
      return logs.map(log => ({
        ...log,
        ip_address: log.ip_address && log.ip_address_enc
          ? simpleEncryption.decrypt({
              encryptedData: log.ip_address,
              metadata: log.ip_address_enc
            })
          : log.ip_address,
      }));
    } catch (error) {
      logger.error('Failed to search audit logs', {
        error: (error as Error).message,
        filters,
      });
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalLogs: number;
    actionsByType: Record<string, number>;
    entitiesByType: Record<string, number>;
    topUsers: Array<{ user: string; count: number }>;
    securityEvents: number;
  }> {
    try {
      const startDate = new Date();
      switch (timeframe) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const logs = await prisma.audit_logs.findMany({
        where: {
          created_at: {
            gte: startDate,
          },
        },
      });

      // Calculate statistics
      const actionsByType: Record<string, number> = {};
      const entitiesByType: Record<string, number> = {};
      const userCounts: Record<string, number> = {};
      let securityEvents = 0;

      logs.forEach(log => {
        // Count by action
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;

        // Count by entity
        entitiesByType[log.entity] = (entitiesByType[log.entity] || 0) + 1;

        // Count by user
        userCounts[log.performed_by] = (userCounts[log.performed_by] || 0) + 1;

        // Count security events (access denied, etc.)
        if (log.action === 'ACCESS_DENIED' ||
            (log.new_values as any)?.metadata?.success === false) {
          securityEvents++;
        }
      });

      // Get top users
      const topUsers = Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, count }));

      return {
        totalLogs: logs.length,
        actionsByType,
        entitiesByType,
        topUsers,
        securityEvents,
      };
    } catch (error) {
      logger.error('Failed to get audit statistics', {
        error: (error as Error).message,
        timeframe,
      });
      return {
        totalLogs: 0,
        actionsByType: {},
        entitiesByType: {},
        topUsers: [],
        securityEvents: 0,
      };
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();

/**
 * Audit middleware
 * Automatically logs certain operations
 */
export const auditMiddleware = (action: AuditAction, entity: AuditEntity) => {
  return async (req: any, res: any, next: any) => {
    // Store original methods
    const originalJson = res.json;
    const originalSend = res.send;

    // Override response methods to log after successful operation
    res.json = function (data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Log successful operation
        auditService.log({
          id: req.user?.id,
          userName: req.user?.username,
          action,
          entity,
          entity_id: req.params.id || data?.id,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          requestId: req.requestId,
          success: true,
          metadata: { id: crypto.randomUUID(), updated_at: new Date(), 
            method: req.method,
            url: req.originalUrl,
          },
        }).catch((err) => {
          logger.error('Audit middleware error', { error: err });
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

export default auditService;
