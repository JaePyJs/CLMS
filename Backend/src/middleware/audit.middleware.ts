import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogEntry {
  userId?: string;
  userRole?: string;
  action: string;
  endpoint: string;
  method: string;
  ip: string;
  userAgent?: string;
  requestData: any;
  timestamp: Date;
  statusCode?: number;
  duration?: number;
  success: boolean;
}

class AuditLogger {
  private static instance: AuditLogger;

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private sanitizeForLogging(data: any): any {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'jwt',
      'socialSecurityNumber', 'creditCard', 'bankAccount'
    ];

    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  async logAccess(entry: Omit<AuditLogEntry, 'timestamp' | 'success'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date(),
      success: true
    };

    try {
      await prisma.audit_logs.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          entity: auditEntry.endpoint || 'unknown',
          action: auditEntry.action,
          entity_id: auditEntry.userId || 'system',
          performed_by: auditEntry.userRole || 'system',
          ip_address: auditEntry.ip,
          user_agent: auditEntry.userAgent || null,
          old_values: this.sanitizeForLogging(auditEntry.requestData),
          created_at: auditEntry.timestamp,
          new_values: {
            success: auditEntry.success,
            statusCode: auditEntry.statusCode,
            duration: auditEntry.duration
          }
        }
      });

      // Log to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${auditEntry.action} by ${auditEntry.userId} at ${auditEntry.endpoint}`);
      }
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging failure shouldn't break the app
    }
  }

  async logCompletion(entry: Partial<AuditLogEntry>): Promise<void> {
    const updateData = {
      statusCode: entry.statusCode,
      duration: entry.duration,
      success: entry.success
    };

    try {
      await prisma.audit_logs.updateMany({
        where: {
          ...(entry.userId && { entity_id: entry.userId }),
          ...(entry.action && { action: entry.action }),
          created_at: {
            gte: new Date(Date.now() - 60000) // Last minute
          }
        },
        data: {
          new_values: updateData
        }
      });
    } catch (error) {
      console.error('Failed to update audit entry:', error);
    }
  }

  async logSecurityEvent(eventType: string, details: any): Promise<void> {
    try {
      await prisma.audit_logs.create({
        data: {
          id: `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          entity: 'system',
          action: `SECURITY_${eventType.toUpperCase()}`,
          entity_id: 'system',
          performed_by: 'SYSTEM',
          ip_address: details.ip || 'system',
          old_values: this.sanitizeForLogging(details),
          created_at: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

export const auditMiddleware = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const endpoint = req.route?.path || req.path;
    const method = req.method;

    // Log initial access
    const auditLogger = AuditLogger.getInstance();
    
    await auditLogger.logAccess({
      userId,
      userRole,
      action,
      endpoint,
      method,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestData: {
        body: req.body,
        query: req.query,
        params: req.params
      }
    });

    // Intercept response to capture completion details
    const originalSend = res.send;
    res.send = function(body) {
      res.send = originalSend;
      const duration = Date.now() - startTime;
      
      auditLogger.logCompletion({
        userId,
        action,
        method,
        statusCode: res.statusCode,
        duration,
        success: res.statusCode < 400
      });

      return res.send(body);
    };

    next();
  };
};

export const auditLogger = AuditLogger.getInstance();
