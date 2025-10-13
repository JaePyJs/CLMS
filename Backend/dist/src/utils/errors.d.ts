import type { RequestHandler, ErrorRequestHandler } from 'express';
import { AppError, ValidationErrorDetail } from '@/types';
export declare class BaseError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly code?: string;
    readonly details?: unknown;
    constructor(message: string, statusCode?: number, isOperational?: boolean, code?: string, details?: unknown);
    protected log(): void;
    toJSON(): AppError;
}
export declare class ValidationError extends BaseError {
    readonly validationErrors: ValidationErrorDetail[];
    constructor(message: string, validationErrors: ValidationErrorDetail[]);
}
export declare class NotFoundError extends BaseError {
    constructor(resource: string, identifier?: string);
}
export declare class AuthenticationError extends BaseError {
    constructor(message?: string);
}
export declare class AuthorizationError extends BaseError {
    constructor(resource: string, action: string);
}
export declare class ConflictError extends BaseError {
    constructor(resource: string, field: string, value: unknown);
}
export declare class BusinessLogicError extends BaseError {
    constructor(message: string, code?: string, details?: unknown);
}
export declare class DatabaseError extends BaseError {
    constructor(message: string, originalError?: Error, query?: string);
}
export declare class ExternalServiceError extends BaseError {
    constructor(service: string, message: string, statusCode?: number);
}
export declare class GoogleSheetsError extends ExternalServiceError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class BarcodeGenerationError extends BaseError {
    constructor(message: string, format?: string, data?: string);
}
export declare class ImportError extends BaseError {
    readonly importErrors: Array<{
        row: number;
        field?: string;
        message: string;
        value?: unknown;
    }>;
    readonly partialSuccess: boolean;
    constructor(message: string, importErrors: Array<{
        row: number;
        field?: string;
        message: string;
        value?: unknown;
    }>, partialSuccess?: boolean);
}
export declare class ConfigurationError extends BaseError {
    constructor(configKey: string, message?: string);
}
export declare class RateLimitError extends BaseError {
    constructor(limit: number, windowMs: number);
}
export declare class SessionExpiredError extends BusinessLogicError {
    constructor(sessionType: string, expiryTime: Date);
}
export declare class TimeLimitExceededError extends BusinessLogicError {
    constructor(resource: string, timeLimit: number, currentTime: number);
}
export declare class EquipmentUnavailableError extends BusinessLogicError {
    constructor(equipment_id: string, currentStatus: string);
}
export declare class ConcurrentSessionError extends BusinessLogicError {
    constructor(student_id: string, equipmentType: string);
}
export declare class StudentInactiveError extends BusinessLogicError {
    constructor(student_id: string);
}
export declare class GradeRestrictionError extends BusinessLogicError {
    constructor(studentGrade: string, requiredGrade: string, resource: string);
}
export declare const createValidationError: (field: string, message: string, value?: unknown) => ValidationError;
export declare const createNotFoundError: (resource: string, identifier?: string) => NotFoundError;
export declare const createConflictError: (resource: string, field: string, value: unknown) => ConflictError;
export declare const isOperationalError: (error: Error) => boolean;
export declare const getErrorStatusCode: (error: Error) => number;
export declare const getErrorMessage: (error: Error) => string;
export declare const asyncErrorHandler: (fn: RequestHandler) => RequestHandler;
export declare const errorHandler: ErrorRequestHandler;
export declare const notFoundHandler: RequestHandler;
export declare const setupGlobalErrorHandlers: () => void;
export default BaseError;
//# sourceMappingURL=errors.d.ts.map