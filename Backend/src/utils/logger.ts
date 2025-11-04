import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
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
        winston.format.json()
      ),
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
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
      format: consoleFormat,
    })
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
  public error(message: string, meta?: any): void {
    this.winston.error(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  public info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  // HTTP request logging
  public httpRequest(req: any, res: any, responseTime: number): void {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      this.error('HTTP Request Error', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  // Database operation logging
  public dbOperation(operation: string, table: string, duration: number, meta?: any): void {
    this.debug('Database Operation', {
      operation,
      table,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  // Authentication logging
  public authEvent(event: string, userId?: string, meta?: any): void {
    this.info('Authentication Event', {
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  // Security event logging
  public securityEvent(event: string, severity: 'low' | 'medium' | 'high', meta?: any): void {
    const logMethod = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    
    this[logMethod]('Security Event', {
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  // Performance logging
  public performance(operation: string, duration: number, meta?: any): void {
    const level = duration > 1000 ? 'warn' : 'info';
    
    this[level]('Performance Metric', {
      operation,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  // Business logic logging
  public business(event: string, meta?: any): void {
    this.info('Business Event', {
      event,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  // Error with context
  public errorWithContext(error: Error, context: string, meta?: any): void {
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
  public apiResponse(req: any, res: any, data?: any): void {
    this.info('API Response', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      userId: req.user?.id,
      responseData: data ? JSON.stringify(data).substring(0, 200) : undefined,
    });
  }
}

// Export singleton instance
export const loggerInstance = Logger.getInstance();

// Export default logger for backward compatibility
export default logger;