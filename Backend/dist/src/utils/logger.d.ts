import type { Request, Response, NextFunction } from 'express';
import winston from 'winston';
type Metadata = Record<string, unknown>;
export declare const logger: winston.Logger;
export declare const auditLogger: {
    log: (action: string, entity: string, entity_id: string, id: string, details?: Metadata) => void;
    studentAccess: (student_id: string, id: string, action: string) => void;
    bookTransaction: (book_id: string, student_id: string, id: string, action: string) => void;
    equipmentUsage: (equipment_id: string, student_id: string, id: string, action: string) => void;
    systemConfig: (configKey: string, id: string, oldValue?: unknown, newValue?: unknown) => void;
    dataImport: (entity_type: string, id: string, recordCount: number, success: boolean) => void;
};
export declare const performanceLogger: {
    start: (operation: string, metadata?: Metadata) => number;
    end: (operation: string, startTime: number, metadata?: Metadata) => void;
    database: (query: string, duration: number, rowCount?: number) => void;
    googleSheets: (operation: string, duration: number, rowCount?: number) => void;
};
export declare const securityLogger: {
    login: (id: string, success: boolean, ip: string, userAgent?: string) => void;
    logout: (id: string, ip: string) => void;
    failedAuth: (identifier: string, reason: string, ip: string) => void;
    permissionDenied: (id: string, resource: string, action: string, ip: string) => void;
    suspiciousActivity: (description: string, details: Metadata) => void;
};
export declare const automationLogger: {
    jobStart: (jobName: string, jobId: string, config?: Metadata) => void;
    jobSuccess: (jobName: string, jobId: string, duration: number, result?: unknown) => void;
    jobFailure: (jobName: string, jobId: string, duration: number, error: Error) => void;
    jobRetry: (jobName: string, jobId: string, attempt: number, maxAttempts: number, error: Error) => void;
    scheduleUpdate: (jobName: string, schedule: string, nextRun: Date) => void;
};
export declare const healthLogger: {
    check: (service: string, status: "UP" | "DOWN", responseTime?: number, details?: Metadata) => void;
    dependencyFailure: (dependency: string, error: Error) => void;
    resourceUsage: (cpu: number, memory: number, disk: number) => void;
};
export declare const createRequestLogger: () => (req: Request, res: Response, next: NextFunction) => void;
export declare const logError: (error: Error, context?: Metadata) => void;
export declare const structuredLogger: {
    event: (eventName: string, data: Metadata) => void;
    metric: (metricName: string, value: number, unit?: string, tags?: Record<string, string | number | boolean | undefined>) => void;
    trace: (traceId: string, operation: string, data: Metadata) => void;
};
export declare const shutdownLogger: {
    starting: (signal: string) => void;
    completed: (signal: string, duration: number) => void;
    cleanupTask: (task: string, success: boolean, duration?: number) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map