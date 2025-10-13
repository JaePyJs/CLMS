"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.CLMSApplication = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
require("express-async-errors");
const logger_1 = require("@/utils/logger");
const requestLogger_1 = require("@/middleware/requestLogger");
const errors_1 = require("@/utils/errors");
const errorMiddleware_1 = require("@/middleware/errorMiddleware");
const automation_1 = require("@/services/automation");
const googleSheets_1 = require("@/services/googleSheets");
const websocketServer_1 = require("@/websocket/websocketServer");
const recoveryService_1 = require("@/services/recoveryService");
const errorNotificationService_1 = require("@/services/errorNotificationService");
const reportingService_1 = require("@/services/reportingService");
const auth_1 = __importDefault(require("@/routes/auth"));
const students_1 = __importDefault(require("@/routes/students"));
const books_1 = __importDefault(require("@/routes/books"));
const equipment_1 = __importDefault(require("@/routes/equipment"));
const scan_1 = __importDefault(require("@/routes/scan"));
const activities_1 = __importDefault(require("@/routes/activities"));
const automation_2 = __importDefault(require("@/routes/automation"));
const admin_1 = __importDefault(require("@/routes/admin"));
const reports_1 = __importDefault(require("@/routes/reports"));
const fines_1 = __importDefault(require("@/routes/fines"));
const utilities_1 = __importDefault(require("@/routes/utilities"));
const analytics_1 = __importDefault(require("@/routes/analytics"));
const import_routes_1 = __importDefault(require("@/routes/import.routes"));
const settings_1 = __importDefault(require("@/routes/settings"));
const notifications_routes_1 = __importDefault(require("@/routes/notifications.routes"));
const users_routes_1 = __importDefault(require("@/routes/users.routes"));
const backup_routes_1 = __importDefault(require("@/routes/backup.routes"));
const self_service_routes_1 = __importDefault(require("@/routes/self-service.routes"));
const errors_routes_1 = __importDefault(require("@/routes/errors.routes"));
const reporting_1 = __importDefault(require("@/routes/reporting"));
const auth_2 = require("@/middleware/auth");
class CLMSApplication {
    app;
    httpServer = null;
    prisma;
    isInitialized = false;
    constructor() {
        this.app = (0, express_1.default)();
        this.prisma = new client_1.PrismaClient();
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            logger_1.logger.info('Initializing CLMS Application...');
            (0, errors_1.setupGlobalErrorHandlers)();
            this.setupSecurityMiddleware();
            this.setupParsingMiddleware();
            this.setupLoggingMiddleware();
            this.setupRateLimiting();
            this.setupCORS();
            this.setupRoutes();
            this.setupErrorHandling();
            await this.initializeServices();
            this.httpServer = (0, http_1.createServer)(this.app);
            try {
                await websocketServer_1.webSocketManager.initialize(this.httpServer);
                logger_1.logger.info('WebSocket server initialized successfully');
            }
            catch (error) {
                logger_1.logger.warn('Failed to initialize WebSocket server', {
                    error: error.message,
                });
            }
            this.setupGracefulShutdown();
            this.isInitialized = true;
            logger_1.logger.info('CLMS Application initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize CLMS Application', {
                error: error.message,
            });
            throw error;
        }
    }
    setupSecurityMiddleware() {
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'"],
                },
            },
        }));
        this.app.use((0, compression_1.default)());
        logger_1.logger.debug('Security middleware configured');
    }
    setupParsingMiddleware() {
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        logger_1.logger.debug('Parsing middleware configured');
    }
    setupLoggingMiddleware() {
        this.app.use(requestLogger_1.requestId);
        this.app.use(requestLogger_1.requestLogger);
        this.app.use(requestLogger_1.performanceMonitor);
        logger_1.logger.debug('Enhanced logging middleware configured');
    }
    setupRateLimiting() {
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
            message: {
                success: false,
                error: 'Too many requests from this IP, please try again later.',
                timestamp: new Date().toISOString(),
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/api', limiter);
        const authRateLimitEnabled = process.env.RATE_LIMIT_AUTH_ENABLED !== 'false';
        if (authRateLimitEnabled) {
            const authLimiter = (0, express_rate_limit_1.default)({
                windowMs: 15 * 60 * 1000,
                max: 5,
                message: {
                    success: false,
                    error: 'Too many authentication attempts, please try again later.',
                    timestamp: new Date().toISOString(),
                },
                skipSuccessfulRequests: true,
            });
            this.app.use('/api/auth/login', authLimiter);
        }
        logger_1.logger.debug('Rate limiting middleware configured');
    }
    setupCORS() {
        const corsOptions = {
            origin: process.env.NODE_ENV === 'production'
                ? [process.env.CORS_ORIGIN || 'http://localhost:3000']
                : [
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'http://127.0.0.1:3000',
                    'http://127.0.0.1:5173',
                ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        };
        this.app.use((0, cors_1.default)(corsOptions));
        logger_1.logger.debug('CORS middleware configured');
    }
    setupRoutes() {
        this.app.get('/health', this.healthCheck.bind(this));
        this.app.use('/api/auth', auth_1.default);
        this.app.use('/api/students', auth_2.authMiddleware, students_1.default);
        this.app.use('/api/books', auth_2.authMiddleware, books_1.default);
        this.app.use('/api/equipment', auth_2.authMiddleware, equipment_1.default);
        this.app.use('/api/scan', auth_2.authMiddleware, scan_1.default);
        this.app.use('/api/activities', auth_2.authMiddleware, activities_1.default);
        this.app.use('/api/automation', auth_2.authMiddleware, automation_2.default);
        this.app.use('/api/admin', auth_2.authMiddleware, admin_1.default);
        this.app.use('/api/reports', auth_2.authMiddleware, reports_1.default);
        this.app.use('/api/fines', auth_2.authMiddleware, fines_1.default);
        this.app.use('/api/utilities', auth_2.authMiddleware, utilities_1.default);
        this.app.use('/api/analytics', auth_2.authMiddleware, analytics_1.default);
        this.app.use('/api/import', auth_2.authMiddleware, import_routes_1.default);
        this.app.use('/api/settings', auth_2.authMiddleware, settings_1.default);
        this.app.use('/api/users', users_routes_1.default);
        this.app.use('/api/notifications', notifications_routes_1.default);
        this.app.use('/api/backups', backup_routes_1.default);
        this.app.use('/api/self-service', self_service_routes_1.default);
        this.app.use('/api/errors', auth_2.authMiddleware, errors_routes_1.default);
        this.app.use('/api/reporting', auth_2.authMiddleware, reporting_1.default);
        this.app.get('/', (req, res) => {
            res.json({
                success: true,
                message: 'CLMS API is running',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                documentation: '/api/docs',
            });
        });
        this.app.get('/api', (req, res) => {
            res.json({
                success: true,
                message: 'CLMS API v1.0.0',
                endpoints: {
                    auth: '/api/auth',
                    students: '/api/students',
                    books: '/api/books',
                    equipment: '/api/equipment',
                    scan: '/api/scan',
                    activities: '/api/activities',
                    automation: '/api/automation',
                    admin: '/api/admin',
                    reports: '/api/reports',
                    fines: '/api/fines',
                    utilities: '/api/utilities',
                    analytics: '/api/analytics',
                    import: '/api/import',
                    settings: '/api/settings',
                    users: '/api/users',
                    notifications: '/api/notifications',
                    selfService: '/api/self-service',
                    errors: '/api/errors',
                    reporting: '/api/reporting',
                },
                timestamp: new Date().toISOString(),
            });
        });
        logger_1.logger.debug('Routes configured');
    }
    setupErrorHandling() {
        this.app.use(errors_1.notFoundHandler);
        this.app.use(requestLogger_1.errorLogger);
        this.app.use(errorMiddleware_1.enhancedErrorHandler);
        logger_1.logger.debug('Enhanced error handling configured');
    }
    async initializeServices() {
        try {
            await this.prisma.$connect();
            logger_1.logger.info('Database connection established');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to database', {
                error: error.message,
            });
            throw error;
        }
        try {
            await automation_1.automationService.initialize();
            logger_1.logger.info('Automation service initialized');
        }
        catch (error) {
            logger_1.logger.warn('Failed to initialize automation service', {
                error: error.message,
            });
        }
        try {
            logger_1.logger.info('Initializing recovery service...');
            logger_1.logger.info('Recovery service initialized');
        }
        catch (error) {
            logger_1.logger.warn('Failed to initialize recovery service', {
                error: error.message,
            });
        }
        try {
            logger_1.logger.info('Initializing error notification service...');
            logger_1.logger.info('Error notification service initialized');
        }
        catch (error) {
            logger_1.logger.warn('Failed to initialize error notification service', {
                error: error.message,
            });
        }
        try {
            logger_1.logger.info('Initializing reporting service...');
            await reportingService_1.reportingService.initializeScheduledReports();
            await reportingService_1.reportingService.initializeAlertMonitoring();
            logger_1.logger.info('Reporting service initialized');
        }
        catch (error) {
            logger_1.logger.warn('Failed to initialize reporting service', {
                error: error.message,
            });
        }
        try {
            const googleSheetsConnected = await googleSheets_1.googleSheetsService.testConnection();
            if (googleSheetsConnected) {
                logger_1.logger.info('Google Sheets connection established');
            }
            else {
                logger_1.logger.warn('Google Sheets connection failed');
            }
        }
        catch (error) {
            logger_1.logger.warn('Google Sheets initialization failed', {
                error: error.message,
            });
        }
        logger_1.logger.info('Services initialization completed');
    }
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
            try {
                await automation_1.automationService.shutdown();
                await recoveryService_1.recoveryService.shutdown();
                await errorNotificationService_1.errorNotificationService.shutdown?.();
                await reportingService_1.reportingService.cleanup();
                await this.prisma.$disconnect();
                logger_1.logger.info('Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during graceful shutdown', {
                    error: error.message,
                });
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        logger_1.logger.debug('Graceful shutdown handlers configured');
    }
    async healthCheck(req, res) {
        try {
            const startTime = Date.now();
            const databaseHealth = await this.checkDatabaseHealth();
            const googleSheetsHealth = await googleSheets_1.googleSheetsService.healthCheck();
            const automationHealth = automation_1.automationService.getSystemHealth();
            const webSocketStatus = websocketServer_1.webSocketManager.getStatus();
            const memoryUsage = process.memoryUsage();
            const totalMemory = memoryUsage.heapTotal;
            const usedMemory = memoryUsage.heapUsed;
            const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
            const uptime = process.uptime();
            const health = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: Math.floor(uptime),
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                services: {
                    database: databaseHealth,
                    googleSheets: googleSheetsHealth,
                    automation: automationHealth,
                    websockets: {
                        initialized: webSocketStatus.isInitialized,
                        running: webSocketStatus.isRunning,
                        connections: webSocketStatus.stats.totalConnections,
                        connectionsByRole: webSocketStatus.stats.connectionsByRole,
                    },
                },
                system: {
                    memory: {
                        used: usedMemory,
                        total: totalMemory,
                        percentage: memoryUsagePercent,
                    },
                    platform: process.platform,
                    nodeVersion: process.version,
                },
                responseTime: Date.now() - startTime,
            };
            const allServicesHealthy = databaseHealth.connected && automationHealth.initialized;
            const statusCode = allServicesHealthy ? 200 : 503;
            res.status(statusCode).json(health);
        }
        catch (error) {
            logger_1.logger.error('Health check failed', { error: error.message });
            res.status(503).json({
                status: 'ERROR',
                timestamp: new Date().toISOString(),
                error: 'Health check failed',
                details: process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
            });
        }
    }
    async checkDatabaseHealth() {
        try {
            const startTime = Date.now();
            await this.prisma.$queryRaw `SELECT 1`;
            const responseTime = Date.now() - startTime;
            return {
                connected: true,
                responseTime,
            };
        }
        catch (error) {
            return {
                connected: false,
                error: error.message,
            };
        }
    }
    getApp() {
        return this.app;
    }
    async start(port = 3001) {
        try {
            console.log('[DEBUG] Starting CLMS Application...');
            await this.initialize();
            console.log('[DEBUG] Initialization complete');
            if (!this.httpServer) {
                throw new Error('HTTP server not initialized');
            }
            console.log('[DEBUG] About to call httpServer.listen()...');
            await new Promise(resolve => {
                this.httpServer.listen(port, () => {
                    console.log('[DEBUG] Listen callback fired!');
                    logger_1.logger.info(`🚀 CLMS Backend Server running on port ${port}`);
                    logger_1.logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
                    logger_1.logger.info(`🔗 Health check: http://localhost:${port}/health`);
                    logger_1.logger.info(`🔌 WebSocket: ws://localhost:${port}/ws`);
                    logger_1.logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
                    logger_1.logger.info(`⏰ Automation: ${automation_1.automationService.getSystemHealth().initialized ? 'Enabled' : 'Disabled'}`);
                    logger_1.logger.info(`🌐 WebSocket: ${websocketServer_1.webSocketManager.getStatus().isRunning ? 'Enabled' : 'Disabled'}`);
                    resolve();
                });
            });
            console.log('[DEBUG] After listen promise');
        }
        catch (error) {
            console.log('[DEBUG] Error in start():', error);
            logger_1.logger.error('Failed to start server', {
                error: error.message,
            });
            process.exit(1);
        }
    }
    async shutdown() {
        logger_1.logger.info('Shutting down CLMS Application...');
        try {
            await websocketServer_1.webSocketManager.shutdown();
            if (this.httpServer) {
                await new Promise((resolve, reject) => {
                    this.httpServer.close(error => {
                        if (error) {
                            reject(error);
                        }
                        else {
                            resolve();
                        }
                    });
                });
            }
            await automation_1.automationService.shutdown();
            await recoveryService_1.recoveryService.shutdown();
            await errorNotificationService_1.errorNotificationService.shutdown?.();
            await reportingService_1.reportingService.cleanup();
            await this.prisma.$disconnect();
            logger_1.logger.info('CLMS Application shutdown complete');
        }
        catch (error) {
            logger_1.logger.error('Error during shutdown', {
                error: error.message,
            });
        }
    }
}
exports.CLMSApplication = CLMSApplication;
exports.app = new CLMSApplication();
exports.default = exports.app;
//# sourceMappingURL=app.js.map