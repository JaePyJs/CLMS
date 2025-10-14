import { Application } from 'express';
import 'express-async-errors';
export declare class CLMSApplication {
    private app;
    private httpServer;
    private prisma;
    private isInitialized;
    constructor();
    initialize(): Promise<void>;
    private setupSecurityMiddleware;
    private setupParsingMiddleware;
    private setupPerformanceMiddleware;
    private setupLoggingMiddleware;
    private setupRateLimiting;
    private setupCORS;
    private setupRoutes;
    private setupErrorHandling;
    private initializeServices;
    private setupGracefulShutdown;
    private healthCheck;
    private checkDatabaseHealth;
    getApp(): Application;
    start(port?: number): Promise<void>;
    shutdown(): Promise<void>;
}
export declare const app: CLMSApplication;
export default app;
//# sourceMappingURL=app.d.ts.map