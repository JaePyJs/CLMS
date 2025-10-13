import { PrismaClient } from '@prisma/client';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

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
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // In a production app, this would write to a dedicated audit table
      // For now, we'll use the logger
      logger.info('Audit Log', {
        timestamp: new Date().toISOString(),
        ...entry,
      });

      // You could also write to database:
      // await prisma.audit_logs.create({ data: entry });
      
      // Or send to external audit service:
      // await this.sendToAuditService(entry);
    } catch (error) {
      // Audit logging should never break the application
      logger.error('Failed to log audit entry', { error, entry });
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
    // In production, this would query the audit log table
    // For now, return empty array
    return [];
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    id: string,
    limit: number = 50
  ): Promise<any[]> {
    // In production, this would query the audit log table
    return [];
  }

  /**
   * Get recent audit logs
   */
  async getRecentAuditLogs(limit: number = 100): Promise<any[]> {
    // In production, this would query the audit log table
    return [];
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
    // In production, this would query the audit log table with filters
    return [];
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
