import winston from 'winston';
export declare const logger: winston.Logger;
export declare const auditLogger: {
    log: (action: string, entity: string, entityId: string, userId: string, details?: any) => void;
    studentAccess: (studentId: string, userId: string, action: string) => void;
    bookTransaction: (bookId: string, studentId: string, userId: string, action: string) => void;
    equipmentUsage: (equipmentId: string, studentId: string, userId: string, action: string) => void;
    systemConfig: (configKey: string, userId: string, oldValue?: any, newValue?: any) => void;
    dataImport: (entityType: string, userId: string, recordCount: number, success: boolean) => void;
};
export declare const performanceLogger: {
    start: (operation: string, metadata?: any) => number;
    end: (operation: string, startTime: number, metadata?: any) => void;
    database: (query: string, duration: number, rowCount?: number) => void;
    googleSheets: (operation: string, duration: number, rowCount?: number) => void;
};
export declare const securityLogger: {
    login: (userId: string, success: boolean, ip: string, userAgent?: string) => void;
    logout: (userId: string, ip: string) => void;
    failedAuth: (identifier: string, reason: string, ip: string) => void;
    permissionDenied: (userId: string, resource: string, action: string, ip: string) => void;
    suspiciousActivity: (description: string, details: any) => void;
};
export declare const automationLogger: {
    jobStart: (jobName: string, jobId: string, config?: any) => void;
    jobSuccess: (jobName: string, jobId: string, duration: number, result?: any) => void;
    jobFailure: (jobName: string, jobId: string, duration: number, error: Error) => void;
    jobRetry: (jobName: string, jobId: string, attempt: number, maxAttempts: number, error: Error) => void;
    scheduleUpdate: (jobName: string, schedule: string, nextRun: Date) => void;
};
export declare const healthLogger: {
    check: (service: string, status: "UP" | "DOWN", responseTime?: number, details?: any) => void;
    dependencyFailure: (dependency: string, error: Error) => void;
    resourceUsage: (cpu: number, memory: number, disk: number) => void;
};
export declare const createRequestLogger: () => (req: any, res: any, next: any) => void;
export declare const logError: (error: Error, context?: any) => void;
export declare const structuredLogger: {
    event: (eventName: string, data: any) => void;
    metric: (metricName: string, value: number, unit?: string, tags?: Record<string, string>) => void;
    trace: (traceId: string, operation: string, data: any) => void;
};
export declare const shutdownLogger: {
    starting: (signal: string) => void;
    completed: (signal: string, duration: number) => void;
    cleanupTask: (task: string, success: boolean, duration?: number) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map