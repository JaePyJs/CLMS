import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response, NextFunction } from 'express';
import type { TransformableInfo } from 'logform';
import * as winston from 'winston';
import { buildLogEntry, getCurrentTimestamp } from './common';

type Metadata = Record<string, unknown>;

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(buildLogEntry),
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: customFormat,
  defaultMeta: {
    service: 'clms-backend',
    environment: process.env.NODE_ENV ?? 'development',
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5_242_880,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5_242_880,
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 10_485_760,
      maxFiles: 20,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        customFormat,
      ),
    }),
  );
}

const withTimestamp = (): string => getCurrentTimestamp();

export const auditLogger = {
  log: (
    action: string,
    entity: string,
    entity_id: string,
    id: string,
    details?: Metadata,
  ): void => {
    const payload: Metadata = {
      type: 'audit',
      action,
      entity,
      entity_id,
      id,
      timestamp: withTimestamp(),
    };

    if (details) {
      payload.details = details;
    }

    logger.info('AUDIT', payload);
  },
  studentAccess: (student_id: string, id: string, action: string): void => {
    auditLogger.log(action, 'Student', student_id, id);
  },
  bookTransaction: (
    book_id: string,
    student_id: string,
    id: string,
    action: string,
  ): void => {
    auditLogger.log(action, 'Book', book_id, id, { student_id });
  },
  equipmentUsage: (
    equipment_id: string,
    student_id: string,
    id: string,
    action: string,
  ): void => {
    auditLogger.log(action, 'Equipment', equipment_id, id, { student_id });
  },
  systemConfig: (
    configKey: string,
    id: string,
    oldValue?: unknown,
    newValue?: unknown,
  ): void => {
    auditLogger.log('CONFIG_UPDATE', 'SystemConfig', configKey, id, {
      oldValue,
      newValue,
    });
  },
  dataImport: (
    entity_type: string,
    id: string,
    recordCount: number,
    success: boolean,
  ): void => {
    auditLogger.log('DATA_IMPORT', entity_type, 'BULK', id, {
      recordCount,
      success,
    });
  },
};

export const performanceLogger = {
  start: (operation: string, metadata?: Metadata): number => {
    const startTime = Date.now();
    logger.debug('PERF_START', { operation, startTime, ...(metadata ?? {}) });
    return startTime;
  },
  end: (operation: string, startTime: number, metadata?: Metadata): void => {
    const duration = Date.now() - startTime;
    logger.info('PERF_END', { operation, duration, ...(metadata ?? {}) });

    if (duration > 5_000) {
      logger.warn('SLOW_OPERATION', {
        operation,
        duration,
        ...(metadata ?? {}),
      });
    }
  },
  database: (query: string, duration: number, rowCount?: number): void => {
    logger.debug('DB_QUERY', { query, duration, rowCount });
  },
  googleSheets: (
    operation: string,
    duration: number,
    rowCount?: number,
  ): void => {
    logger.info('GOOGLE_SHEETS', { operation, duration, rowCount });
  },
};

export const securityLogger = {
  login: (
    id: string,
    success: boolean,
    ip: string,
    userAgent?: string,
  ): void => {
    logger.info('AUTH_LOGIN', { id, success, ip, userAgent });
  },
  logout: (id: string, ip: string): void => {
    logger.info('AUTH_LOGOUT', { id, ip });
  },
  failedAuth: (identifier: string, reason: string, ip: string): void => {
    logger.warn('AUTH_FAILED', { identifier, reason, ip });
  },
  permissionDenied: (
    id: string,
    resource: string,
    action: string,
    ip: string,
  ): void => {
    logger.warn('PERMISSION_DENIED', { id, resource, action, ip });
  },
  suspiciousActivity: (description: string, details: Metadata): void => {
    logger.error('SECURITY_ALERT', { description, ...details });
  },
};

export const automationLogger = {
  jobStart: (jobName: string, jobId: string, config?: Metadata): void => {
    logger.info('JOB_START', { jobName, jobId, ...(config ? { config } : {}) });
  },
  jobSuccess: (
    jobName: string,
    jobId: string,
    duration: number,
    result?: unknown,
  ): void => {
    logger.info('JOB_SUCCESS', { jobName, jobId, duration, result });
  },
  jobFailure: (
    jobName: string,
    jobId: string,
    duration: number,
    error: Error,
  ): void => {
    logger.error('JOB_FAILURE', {
      jobName,
      jobId,
      duration,
      error: error.message,
      stack: error.stack,
    });
  },
  jobRetry: (
    jobName: string,
    jobId: string,
    attempt: number,
    maxAttempts: number,
    error: Error,
  ): void => {
    logger.warn('JOB_RETRY', {
      jobName,
      jobId,
      attempt,
      maxAttempts,
      error: error.message,
    });
  },
  scheduleUpdate: (jobName: string, schedule: string, nextRun: Date): void => {
    logger.info('SCHEDULE_UPDATE', { jobName, schedule, nextRun });
  },
};

export const healthLogger = {
  check: (
    service: string,
    status: 'UP' | 'DOWN',
    responseTime?: number,
    details?: Metadata,
  ): void => {
    const level: 'info' | 'error' = status === 'UP' ? 'info' : 'error';
    const payload: Metadata = {
      service,
      status,
      responseTime,
      ...(details ?? {}),
    };
    logger[level]('HEALTH_CHECK', payload);
  },
  dependencyFailure: (dependency: string, error: Error): void => {
    logger.error('DEPENDENCY_FAILURE', { dependency, error: error.message });
  },
  resourceUsage: (cpu: number, memory: number, disk: number): void => {
    logger.info('RESOURCE_USAGE', { cpu, memory, disk });
  },
};

export const createRequestLogger = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent');

    logger.info('REQUEST_START', {
      method,
      url,
      ip,
      userAgent,
      timestamp: withTimestamp(),
    });

    res.once('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const contentLength = res.get('Content-Length');

      logger.info('REQUEST_END', {
        method,
        url,
        ip,
        statusCode,
        duration,
        contentLength,
      });

      if (duration > 1_000) {
        logger.warn('SLOW_REQUEST', {
          method,
          url,
          duration,
          statusCode,
        });
      }
    });

    next();
  };
};

export const logError = (error: Error, context?: Metadata): void => {
  logger.error('APPLICATION_ERROR', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...(context ?? {}),
  });
};

export const structuredLogger = {
  event: (eventName: string, data: Metadata): void => {
    logger.info('EVENT', { eventName, ...data });
  },
  metric: (
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number | boolean | undefined>,
  ): void => {
    logger.info('METRIC', { metricName, value, unit, ...(tags ?? {}) });
  },
  trace: (traceId: string, operation: string, data: Metadata): void => {
    logger.debug('TRACE', { traceId, operation, ...data });
  },
};

export const shutdownLogger = {
  starting: (signal: string): void => {
    logger.info('SHUTDOWN_START', { signal, timestamp: withTimestamp() });
  },
  completed: (signal: string, duration: number): void => {
    logger.info('SHUTDOWN_COMPLETE', {
      signal,
      duration,
      timestamp: withTimestamp(),
    });
  },
  cleanupTask: (task: string, success: boolean, duration?: number): void => {
    logger.info('CLEANUP_TASK', { task, success, duration });
  },
};

export default logger;
