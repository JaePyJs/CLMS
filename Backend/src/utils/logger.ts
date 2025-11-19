import * as winston from 'winston';
import type { TransformableInfo } from 'logform';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

const dedupeCache = new Map<string, number>();
const dedupeWindowMs = Number(process.env['LOG_DEDUPE_MS'] || 2000);
const dedupeFormat = winston.format((info: TransformableInfo) => {
  try {
    const level = String(info.level ?? '');
    const messageStr = typeof info.message === 'string' ? String(info.message) : JSON.stringify(info.message);
    const key = `${level}:${messageStr}`;
    const now = Date.now();
    const last = dedupeCache.get(key) || 0;
    if (now - last < dedupeWindowMs) {
      return false;
    }
    dedupeCache.set(key, now);
    return info;
  } catch (_e) {
    return info;
  }
});

const redactKeys = new Set([
  'password',
  'token',
  'authorization',
  'Authorization',
  'apiKey',
  'secret',
  'client_secret',
  'access_token',
  'refresh_token',
]);
const redactFormat = winston.format((info: TransformableInfo) => {
  const scrub = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    const rec = obj as Record<string, unknown>;
    for (const k of Object.keys(rec)) {
      if (redactKeys.has(k)) {
        const v = rec[k];
        rec[k] = typeof v === 'string' ? '***' : '[REDACTED]';
      } else {
        scrub(rec[k]);
      }
    }
  };
  scrub(info);
  return info;
});

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  dedupeFormat(),
  redactFormat(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format((info: TransformableInfo) => {
    const MAX_STR = 500;
    const prune = (v: unknown): unknown => {
      if (typeof v === 'string') {
        return v.length > MAX_STR ? `${v.slice(0, MAX_STR)}…` : v;
      }
      if (Array.isArray(v)) {
        return `[Array(${v.length})]`;
      }
      if (v && typeof v === 'object') {
        const input = v as Record<string, unknown>;
        const o: Record<string, unknown> = {};
        let i = 0;
        for (const k of Object.keys(input)) {
          if (i++ >= 20) { o['__truncated'] = true; break; }
          o[k] = prune(input[k]);
        }
        return o;
      }
      return v;
    };
    const pv = prune(info.message);
    info.message = typeof pv === 'string' ? pv : JSON.stringify(pv);
    return info;
  })(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  }),
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'clms-backend',
    environment: process.env['NODE_ENV'] || 'development',
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],

  // Handle exceptions and rejections
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

// Add console transport in development
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(redactFormat(), consoleFormat),
    }),
  );
}

// Logger utility functions
export class Logger {
  private static instance: Logger;
  private winston: winston.Logger;

  private constructor() {
    this.winston = logger;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Standard logging methods
  public error(message: string, meta?: Record<string, unknown>): void {
    this.winston.error(message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.winston.warn(message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.winston.info(message, meta);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.winston.debug(message, meta);
  }

  // HTTP request logging
  public httpRequest(req: Request, res: Response, responseTime: number): void {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.socket?.remoteAddress,
      userId: (req as unknown as { user?: { id?: string } }).user?.id,
      correlationId: (req.get('x-correlation-id') || req.get('x-request-id') || (req as unknown as { id?: string }).id || undefined),
    };

    if (res.statusCode >= 400) {
      this.error('HTTP Request Error', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  // Database operation logging
  public dbOperation(
    operation: string,
    table: string,
    duration: number,
    meta?: Record<string, unknown>,
  ): void {
    this.debug('Database Operation', {
      operation,
      table,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  // Authentication logging
  public authEvent(event: string, userId?: string, meta?: Record<string, unknown>): void {
    this.info('Authentication Event', {
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  // Security event logging
  public securityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high',
    meta?: Record<string, unknown>,
  ): void {
    const payload = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    if (severity === 'high') {
      this.error('Security Event', payload);
    } else if (severity === 'medium') {
      this.warn('Security Event', payload);
    } else {
      this.info('Security Event', payload);
    }
  }

  // Performance logging
  public performance(operation: string, duration: number, meta?: Record<string, unknown>): void {
    const payload = {
      operation,
      duration: `${duration}ms`,
      ...meta,
    };
    if (duration > 1000) {
      this.warn('Performance Metric', payload);
    } else {
      this.info('Performance Metric', payload);
    }
  }

  // Business logic logging
  public business(event: string, meta?: Record<string, unknown>): void {
    this.info('Business Event', {
      event,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  // Error with context
  public errorWithContext(error: Error, context: string, meta?: Record<string, unknown>): void {
    this.error(`${context}: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      ...meta,
    });
  }

  // Structured logging for API responses
  public apiResponse(req: Request, res: Response, data?: unknown): void {
    this.info('API Response', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      userId: (req as unknown as { user?: { id?: string } }).user?.id,
      responseData: data ? JSON.stringify(data).substring(0, 200) : undefined,
    });
  }
}

// Export singleton instance
export const loggerInstance = Logger.getInstance();

// Export default logger for backward compatibility
export default logger;
