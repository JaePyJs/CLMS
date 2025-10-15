"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownLogger = exports.structuredLogger = exports.logError = exports.createRequestLogger = exports.healthLogger = exports.automationLogger = exports.securityLogger = exports.performanceLogger = exports.auditLogger = exports.logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const winston_1 = __importDefault(require("winston"));
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
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
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5_242_880,
            maxFiles: 5,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
        }),
        new winston_1.default.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5_242_880,
            maxFiles: 10,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
        }),
        new winston_1.default.transports.File({
            filename: path.join(logsDir, 'audit.log'),
            level: 'info',
            maxsize: 10_485_760,
            maxFiles: 20,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
        }),
    ],
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
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
    log: (action, entity, entity_id, id, details) => {
        const payload = {
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
        exports.logger.info('AUDIT', payload);
    },
    studentAccess: (student_id, id, action) => {
        exports.auditLogger.log(action, 'Student', student_id, id);
    },
    bookTransaction: (book_id, student_id, id, action) => {
        exports.auditLogger.log(action, 'Book', book_id, id, { student_id });
    },
    equipmentUsage: (equipment_id, student_id, id, action) => {
        exports.auditLogger.log(action, 'Equipment', equipment_id, id, { student_id });
    },
    systemConfig: (configKey, id, oldValue, newValue) => {
        exports.auditLogger.log('CONFIG_UPDATE', 'SystemConfig', configKey, id, {
            oldValue,
            newValue,
        });
    },
    dataImport: (entity_type, id, recordCount, success) => {
        exports.auditLogger.log('DATA_IMPORT', entity_type, 'BULK', id, {
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
    login: (id, success, ip, userAgent) => {
        exports.logger.info('AUTH_LOGIN', { id, success, ip, userAgent });
    },
    logout: (id, ip) => {
        exports.logger.info('AUTH_LOGOUT', { id, ip });
    },
    failedAuth: (identifier, reason, ip) => {
        exports.logger.warn('AUTH_FAILED', { identifier, reason, ip });
    },
    permissionDenied: (id, resource, action, ip) => {
        exports.logger.warn('PERMISSION_DENIED', { id, resource, action, ip });
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
