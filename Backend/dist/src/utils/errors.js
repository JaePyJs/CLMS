"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGlobalErrorHandlers = exports.notFoundHandler = exports.errorHandler = exports.asyncErrorHandler = exports.getErrorMessage = exports.getErrorStatusCode = exports.isOperationalError = exports.createConflictError = exports.createNotFoundError = exports.createValidationError = exports.GradeRestrictionError = exports.StudentInactiveError = exports.ConcurrentSessionError = exports.EquipmentUnavailableError = exports.TimeLimitExceededError = exports.SessionExpiredError = exports.RateLimitError = exports.ConfigurationError = exports.ImportError = exports.BarcodeGenerationError = exports.GoogleSheetsError = exports.ExternalServiceError = exports.DatabaseError = exports.BusinessLogicError = exports.ConflictError = exports.AuthorizationError = exports.AuthenticationError = exports.NotFoundError = exports.ValidationError = exports.BaseError = void 0;
const logger_1 = require("./logger");
class BaseError extends Error {
    statusCode;
    isOperational;
    code;
    details;
    constructor(message, statusCode = 500, isOperational = true, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (code !== undefined) {
            this.code = code;
        }
        if (details !== undefined) {
            this.details = details;
        }
        Error.captureStackTrace(this, this.constructor);
        this.log();
    }
    log() {
        if (this.isOperational) {
            logger_1.logger.warn('OPERATIONAL_ERROR', {
                message: this.message,
                statusCode: this.statusCode,
                code: this.code,
                details: this.details,
                stack: this.stack
            });
        }
        else {
            logger_1.logger.error('PROGRAM_ERROR', {
                message: this.message,
                statusCode: this.statusCode,
                code: this.code,
                details: this.details,
                stack: this.stack
            });
        }
    }
    toJSON() {
        const result = {
            name: this.constructor.name,
            message: this.message,
            statusCode: this.statusCode,
            isOperational: this.isOperational
        };
        if (this.code !== undefined) {
            result.code = this.code;
        }
        if (this.details !== undefined) {
            result.details = this.details;
        }
        if (process.env.NODE_ENV === 'development' && this.stack !== undefined) {
            result.stack = this.stack;
        }
        return result;
    }
}
exports.BaseError = BaseError;
class ValidationError extends BaseError {
    validationErrors;
    constructor(message, validationErrors) {
        super(message, 400, true, 'VALIDATION_ERROR', { validationErrors });
        this.validationErrors = validationErrors;
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends BaseError {
    constructor(resource, identifier) {
        const message = identifier ? `${resource} with identifier '${identifier}' not found` : `${resource} not found`;
        super(message, 404, true, 'NOT_FOUND', { resource, identifier });
    }
}
exports.NotFoundError = NotFoundError;
class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends BaseError {
    constructor(resource, action) {
        super(`You are not authorized to ${action} ${resource}`, 403, true, 'AUTHORIZATION_ERROR', { resource, action });
    }
}
exports.AuthorizationError = AuthorizationError;
class ConflictError extends BaseError {
    constructor(resource, field, value) {
        super(`${resource} with ${field} '${value}' already exists`, 409, true, 'CONFLICT', { resource, field, value });
    }
}
exports.ConflictError = ConflictError;
class BusinessLogicError extends BaseError {
    constructor(message, code, details) {
        super(message, 422, true, code || 'BUSINESS_LOGIC_ERROR', details);
    }
}
exports.BusinessLogicError = BusinessLogicError;
class DatabaseError extends BaseError {
    constructor(message, originalError, query) {
        super(message, 500, false, 'DATABASE_ERROR', {
            originalError: originalError?.message,
            query
        });
    }
}
exports.DatabaseError = DatabaseError;
class ExternalServiceError extends BaseError {
    constructor(service, message, statusCode = 503) {
        super(`${service} error: ${message}`, statusCode, true, 'EXTERNAL_SERVICE_ERROR', { service });
    }
}
exports.ExternalServiceError = ExternalServiceError;
class GoogleSheetsError extends ExternalServiceError {
    constructor(message, details) {
        super('Google Sheets', message, 503);
        if (details && this.details) {
            Object.assign(this.details, details);
        }
    }
}
exports.GoogleSheetsError = GoogleSheetsError;
class BarcodeGenerationError extends BaseError {
    constructor(message, format, data) {
        super(`Barcode generation failed: ${message}`, 500, true, 'BARCODE_GENERATION_ERROR', { format, data });
    }
}
exports.BarcodeGenerationError = BarcodeGenerationError;
class ImportError extends BaseError {
    importErrors;
    partialSuccess;
    constructor(message, importErrors, partialSuccess = false) {
        super(message, 400, true, 'IMPORT_ERROR', { importErrors, partialSuccess });
        this.importErrors = importErrors;
        this.partialSuccess = partialSuccess;
    }
}
exports.ImportError = ImportError;
class ConfigurationError extends BaseError {
    constructor(configKey, message) {
        super(message || `Configuration error for key: ${configKey}`, 500, true, 'CONFIGURATION_ERROR', { configKey });
    }
}
exports.ConfigurationError = ConfigurationError;
class RateLimitError extends BaseError {
    constructor(limit, windowMs) {
        super(`Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds allowed.`, 429, true, 'RATE_LIMIT_ERROR', { limit, windowMs });
    }
}
exports.RateLimitError = RateLimitError;
class SessionExpiredError extends BusinessLogicError {
    constructor(sessionType, expiryTime) {
        super(`${sessionType} session has expired. Session expired at ${expiryTime.toISOString()}`, 'SESSION_EXPIRED', { sessionType, expiryTime });
    }
}
exports.SessionExpiredError = SessionExpiredError;
class TimeLimitExceededError extends BusinessLogicError {
    constructor(resource, timeLimit, currentTime) {
        super(`Time limit exceeded for ${resource}. Maximum allowed: ${timeLimit} minutes, current: ${currentTime} minutes`, 'TIME_LIMIT_EXCEEDED', { resource, timeLimit, currentTime });
    }
}
exports.TimeLimitExceededError = TimeLimitExceededError;
class EquipmentUnavailableError extends BusinessLogicError {
    constructor(equipmentId, currentStatus) {
        super(`Equipment ${equipmentId} is not available. Current status: ${currentStatus}`, 'EQUIPMENT_UNAVAILABLE', { equipmentId, currentStatus });
    }
}
exports.EquipmentUnavailableError = EquipmentUnavailableError;
class ConcurrentSessionError extends BusinessLogicError {
    constructor(studentId, equipmentType) {
        super(`Student ${studentId} already has an active ${equipmentType} session`, 'CONCURRENT_SESSION', { studentId, equipmentType });
    }
}
exports.ConcurrentSessionError = ConcurrentSessionError;
class StudentInactiveError extends BusinessLogicError {
    constructor(studentId) {
        super(`Student ${studentId} is inactive and cannot use library facilities`, 'STUDENT_INACTIVE', { studentId });
    }
}
exports.StudentInactiveError = StudentInactiveError;
class GradeRestrictionError extends BusinessLogicError {
    constructor(studentGrade, requiredGrade, resource) {
        super(`${resource} requires ${requiredGrade} grade level. Student is in ${studentGrade}`, 'GRADE_RESTRICTION', { studentGrade, requiredGrade, resource });
    }
}
exports.GradeRestrictionError = GradeRestrictionError;
const createValidationError = (field, message, value) => {
    return new ValidationError('Validation failed', [{ field, message, value }]);
};
exports.createValidationError = createValidationError;
const createNotFoundError = (resource, identifier) => {
    return new NotFoundError(resource, identifier);
};
exports.createNotFoundError = createNotFoundError;
const createConflictError = (resource, field, value) => {
    return new ConflictError(resource, field, value);
};
exports.createConflictError = createConflictError;
const isOperationalError = (error) => {
    if (error instanceof BaseError) {
        return error.isOperational;
    }
    return false;
};
exports.isOperationalError = isOperationalError;
const getErrorStatusCode = (error) => {
    if (error instanceof BaseError) {
        return error.statusCode;
    }
    return 500;
};
exports.getErrorStatusCode = getErrorStatusCode;
const getErrorMessage = (error) => {
    if (error instanceof BaseError) {
        return error.message;
    }
    return 'An unexpected error occurred';
};
exports.getErrorMessage = getErrorMessage;
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncErrorHandler = asyncErrorHandler;
const errorHandler = (error, req, res, next) => {
    if (!(error instanceof BaseError)) {
        logger_1.logger.error('UNHANDLED_ERROR', {
            message: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    }
    const statusCode = (0, exports.getErrorStatusCode)(error);
    const message = (0, exports.getErrorMessage)(error);
    const errorResponse = {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
    };
    if (error instanceof ValidationError) {
        errorResponse.validationErrors = error.validationErrors;
    }
    if (error instanceof BaseError && error.code) {
        errorResponse.code = error.code;
    }
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
        if (error instanceof BaseError && error.details) {
            errorResponse.details = error.details;
        }
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    const error = new NotFoundError('Route', `${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
    });
};
exports.notFoundHandler = notFoundHandler;
const setupGlobalErrorHandlers = () => {
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('UNCAUGHT_EXCEPTION', {
            message: error.message,
            stack: error.stack
        });
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.logger.error('UNHANDLED_REJECTION', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise.toString()
        });
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('warning', (warning) => {
        logger_1.logger.warn('PROCESS_WARNING', {
            name: warning.name,
            message: warning.message,
            stack: warning.stack
        });
    });
};
exports.setupGlobalErrorHandlers = setupGlobalErrorHandlers;
exports.default = BaseError;
//# sourceMappingURL=errors.js.map