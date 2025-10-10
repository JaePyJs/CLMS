import winston from 'winston'
import path from 'path'
import fs from 'fs'

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`
    }

    // Add stack trace if present
    if (stack) {
      log += `\n${stack}`
    }

    return log
  })
)

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'clms-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Separate file for audit logs
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 20,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],

  // Exception handling
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],

  // Rejection handling
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
})

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      customFormat
    )
  }))
}

// Specialized logging functions
export const auditLogger = {
  log: (action: string, entity: string, entityId: string, userId: string, details?: any) => {
    logger.info('AUDIT', {
      type: 'audit',
      action,
      entity,
      entityId,
      userId,
      details,
      timestamp: new Date().toISOString()
    })
  },

  studentAccess: (studentId: string, userId: string, action: string) => {
    auditLogger.log(action, 'Student', studentId, userId)
  },

  bookTransaction: (bookId: string, studentId: string, userId: string, action: string) => {
    auditLogger.log(action, 'Book', bookId, userId, { studentId })
  },

  equipmentUsage: (equipmentId: string, studentId: string, userId: string, action: string) => {
    auditLogger.log(action, 'Equipment', equipmentId, userId, { studentId })
  },

  systemConfig: (configKey: string, userId: string, oldValue?: any, newValue?: any) => {
    auditLogger.log('CONFIG_UPDATE', 'SystemConfig', configKey, userId, { oldValue, newValue })
  },

  dataImport: (entityType: string, userId: string, recordCount: number, success: boolean) => {
    auditLogger.log('DATA_IMPORT', entityType, 'BULK', userId, { recordCount, success })
  }
}

export const performanceLogger = {
  start: (operation: string, metadata?: any) => {
    const startTime = Date.now()
    logger.debug('PERF_START', { operation, startTime, ...metadata })
    return startTime
  },

  end: (operation: string, startTime: number, metadata?: any) => {
    const duration = Date.now() - startTime
    logger.info('PERF_END', { operation, duration, ...metadata })

    // Log slow operations
    if (duration > 5000) { // 5 seconds
      logger.warn('SLOW_OPERATION', { operation, duration, ...metadata })
    }
  },

  database: (query: string, duration: number, rowCount?: number) => {
    logger.debug('DB_QUERY', { query, duration, rowCount })
  },

  googleSheets: (operation: string, duration: number, rowCount?: number) => {
    logger.info('GOOGLE_SHEETS', { operation, duration, rowCount })
  }
}

export const securityLogger = {
  login: (userId: string, success: boolean, ip: string, userAgent?: string) => {
    logger.info('AUTH_LOGIN', { userId, success, ip, userAgent })
  },

  logout: (userId: string, ip: string) => {
    logger.info('AUTH_LOGOUT', { userId, ip })
  },

  failedAuth: (identifier: string, reason: string, ip: string) => {
    logger.warn('AUTH_FAILED', { identifier, reason, ip })
  },

  permissionDenied: (userId: string, resource: string, action: string, ip: string) => {
    logger.warn('PERMISSION_DENIED', { userId, resource, action, ip })
  },

  suspiciousActivity: (description: string, details: any) => {
    logger.error('SECURITY_ALERT', { description, ...details })
  }
}

export const automationLogger = {
  jobStart: (jobName: string, jobId: string, config?: any) => {
    logger.info('JOB_START', { jobName, jobId, config })
  },

  jobSuccess: (jobName: string, jobId: string, duration: number, result?: any) => {
    logger.info('JOB_SUCCESS', { jobName, jobId, duration, result })
  },

  jobFailure: (jobName: string, jobId: string, duration: number, error: Error) => {
    logger.error('JOB_FAILURE', { jobName, jobId, duration, error: error.message, stack: error.stack })
  },

  jobRetry: (jobName: string, jobId: string, attempt: number, maxAttempts: number, error: Error) => {
    logger.warn('JOB_RETRY', { jobName, jobId, attempt, maxAttempts, error: error.message })
  },

  scheduleUpdate: (jobName: string, schedule: string, nextRun: Date) => {
    logger.info('SCHEDULE_UPDATE', { jobName, schedule, nextRun })
  }
}

// Health check logger
export const healthLogger = {
  check: (service: string, status: 'UP' | 'DOWN', responseTime?: number, details?: any) => {
    const level = status === 'UP' ? 'info' : 'error'
    logger[level]('HEALTH_CHECK', { service, status, responseTime, ...details })
  },

  dependencyFailure: (dependency: string, error: Error) => {
    logger.error('DEPENDENCY_FAILURE', { dependency, error: error.message })
  },

  resourceUsage: (cpu: number, memory: number, disk: number) => {
    logger.info('RESOURCE_USAGE', { cpu, memory, disk })
  }
}

// Request logging middleware helper
export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const start = Date.now()
    const { method, url, ip } = req
    const userAgent = req.get('User-Agent')

    // Log request start
    logger.info('REQUEST_START', {
      method,
      url,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    })

    // Override res.end to log response
    const originalEnd = res.end
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - start
      const { statusCode } = res

      logger.info('REQUEST_END', {
        method,
        url,
        ip,
        statusCode,
        duration,
        contentLength: res.get('Content-Length')
      })

      // Log slow requests
      if (duration > 1000) {
        logger.warn('SLOW_REQUEST', {
          method,
          url,
          duration,
          statusCode
        })
      }

      originalEnd.call(this, chunk, encoding)
    }

    next()
  }
}

// Error logging helper
export const logError = (error: Error, context?: any) => {
  logger.error('APPLICATION_ERROR', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  })
}

// Structured logging for monitoring
export const structuredLogger = {
  event: (eventName: string, data: any) => {
    logger.info('EVENT', { eventName, ...data })
  },

  metric: (metricName: string, value: number, unit?: string, tags?: Record<string, string>) => {
    logger.info('METRIC', { metricName, value, unit, ...tags })
  },

  trace: (traceId: string, operation: string, data: any) => {
    logger.debug('TRACE', { traceId, operation, ...data })
  }
}

// Graceful shutdown helper
export const shutdownLogger = {
  starting: (signal: string) => {
    logger.info('SHUTDOWN_START', { signal, timestamp: new Date().toISOString() })
  },

  completed: (signal: string, duration: number) => {
    logger.info('SHUTDOWN_COMPLETE', { signal, duration, timestamp: new Date().toISOString() })
  },

  cleanupTask: (task: string, success: boolean, duration?: number) => {
    logger.info('CLEANUP_TASK', { task, success, duration })
  }
}

export default logger