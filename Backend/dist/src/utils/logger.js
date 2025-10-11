"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownLogger = exports.structuredLogger = exports.logError = exports.createRequestLogger = exports.healthLogger = exports.automationLogger = exports.securityLogger = exports.performanceLogger = exports.auditLogger = exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
const buildLogEntry = (info) => {
    const { level, message, stack, ...meta } = info;
    const timestamp = typeof info.timestamp === 'string'
        ? info.timestamp
        : new Date().toISOString();
    const levelLabel = typeof level === 'string' ? level.toUpperCase() : String(level);
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    let log = `${timestamp} [${levelLabel}]: ${text}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
        const stackTrace = typeof stack === 'string' ? stack : JSON.stringify(stack, null, 2);
        log += `\n${stackTrace}`;
    }
    return log;
};
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(buildLogEntry));
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: customFormat,
    defaultMeta: {
        service: 'clms-backend',
        environment: process.env.NODE_ENV ?? 'development',
    },
    transports: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5_242_880,
            maxFiles: 5,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'combined.log'),
            maxsize: 5_242_880,
            maxFiles: 10,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'audit.log'),
            level: 'info',
            maxsize: 10_485_760,
            maxFiles: 20,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
        }),
    ],
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'exceptions.log'),
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'rejections.log'),
        }),
    ],
});
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple(), customFormat),
    }));
}
const withTimestamp = () => new Date().toISOString();
exports.auditLogger = {
    log: (action, entity, entityId, userId, details) => {
        const payload = {
            type: 'audit',
            action,
            entity,
            entityId,
            userId,
            timestamp: withTimestamp(),
        };
        if (details) {
            payload.details = details;
        }
        exports.logger.info('AUDIT', payload);
    },
    studentAccess: (studentId, userId, action) => {
        exports.auditLogger.log(action, 'Student', studentId, userId);
    },
    bookTransaction: (bookId, studentId, userId, action) => {
        exports.auditLogger.log(action, 'Book', bookId, userId, { studentId });
    },
    equipmentUsage: (equipmentId, studentId, userId, action) => {
        exports.auditLogger.log(action, 'Equipment', equipmentId, userId, { studentId });
    },
    systemConfig: (configKey, userId, oldValue, newValue) => {
        exports.auditLogger.log('CONFIG_UPDATE', 'SystemConfig', configKey, userId, {
            oldValue,
            newValue,
        });
    },
    dataImport: (entityType, userId, recordCount, success) => {
        exports.auditLogger.log('DATA_IMPORT', entityType, 'BULK', userId, {
            recordCount,
            success,
        });
    },
};
exports.performanceLogger = {
    start: (operation, metadata) => {
        const startTime = Date.now();
        exports.logger.debug('PERF_START', { operation, startTime, ...(metadata ?? {}) });
        return startTime;
    },
    end: (operation, startTime, metadata) => {
        const duration = Date.now() - startTime;
        exports.logger.info('PERF_END', { operation, duration, ...(metadata ?? {}) });
        if (duration > 5_000) {
            exports.logger.warn('SLOW_OPERATION', {
                operation,
                duration,
                ...(metadata ?? {}),
            });
        }
    },
    database: (query, duration, rowCount) => {
        exports.logger.debug('DB_QUERY', { query, duration, rowCount });
    },
    googleSheets: (operation, duration, rowCount) => {
        exports.logger.info('GOOGLE_SHEETS', { operation, duration, rowCount });
    },
};
exports.securityLogger = {
    login: (userId, success, ip, userAgent) => {
        exports.logger.info('AUTH_LOGIN', { userId, success, ip, userAgent });
    },
    logout: (userId, ip) => {
        exports.logger.info('AUTH_LOGOUT', { userId, ip });
    },
    failedAuth: (identifier, reason, ip) => {
        exports.logger.warn('AUTH_FAILED', { identifier, reason, ip });
    },
    permissionDenied: (userId, resource, action, ip) => {
        exports.logger.warn('PERMISSION_DENIED', { userId, resource, action, ip });
    },
    suspiciousActivity: (description, details) => {
        exports.logger.error('SECURITY_ALERT', { description, ...details });
    },
};
exports.automationLogger = {
    jobStart: (jobName, jobId, config) => {
        exports.logger.info('JOB_START', { jobName, jobId, ...(config ? { config } : {}) });
    },
    jobSuccess: (jobName, jobId, duration, result) => {
        exports.logger.info('JOB_SUCCESS', { jobName, jobId, duration, result });
    },
    jobFailure: (jobName, jobId, duration, error) => {
        exports.logger.error('JOB_FAILURE', {
            jobName,
            jobId,
            duration,
            error: error.message,
            stack: error.stack,
        });
    },
    jobRetry: (jobName, jobId, attempt, maxAttempts, error) => {
        exports.logger.warn('JOB_RETRY', {
            jobName,
            jobId,
            attempt,
            maxAttempts,
            error: error.message,
        });
    },
    scheduleUpdate: (jobName, schedule, nextRun) => {
        exports.logger.info('SCHEDULE_UPDATE', { jobName, schedule, nextRun });
    },
};
exports.healthLogger = {
    check: (service, status, responseTime, details) => {
        const level = status === 'UP' ? 'info' : 'error';
        const payload = {
            service,
            status,
            responseTime,
            ...(details ?? {}),
        };
        exports.logger[level]('HEALTH_CHECK', payload);
    },
    dependencyFailure: (dependency, error) => {
        exports.logger.error('DEPENDENCY_FAILURE', { dependency, error: error.message });
    },
    resourceUsage: (cpu, memory, disk) => {
        exports.logger.info('RESOURCE_USAGE', { cpu, memory, disk });
    },
};
const createRequestLogger = () => {
    return (req, res, next) => {
        const start = Date.now();
        const { method, url, ip } = req;
        const userAgent = req.get('User-Agent');
        exports.logger.info('REQUEST_START', {
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
            exports.logger.info('REQUEST_END', {
                method,
                url,
                ip,
                statusCode,
                duration,
                contentLength,
            });
            if (duration > 1_000) {
                exports.logger.warn('SLOW_REQUEST', {
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
exports.createRequestLogger = createRequestLogger;
const logError = (error, context) => {
    exports.logger.error('APPLICATION_ERROR', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...(context ?? {}),
    });
};
exports.logError = logError;
exports.structuredLogger = {
    event: (eventName, data) => {
        exports.logger.info('EVENT', { eventName, ...data });
    },
    metric: (metricName, value, unit, tags) => {
        exports.logger.info('METRIC', { metricName, value, unit, ...(tags ?? {}) });
    },
    trace: (traceId, operation, data) => {
        exports.logger.debug('TRACE', { traceId, operation, ...data });
    },
};
exports.shutdownLogger = {
    starting: (signal) => {
        exports.logger.info('SHUTDOWN_START', { signal, timestamp: withTimestamp() });
    },
    completed: (signal, duration) => {
        exports.logger.info('SHUTDOWN_COMPLETE', {
            signal,
            duration,
            timestamp: withTimestamp(),
        });
    },
    cleanupTask: (task, success, duration) => {
        exports.logger.info('CLEANUP_TASK', { task, success, duration });
    },
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map