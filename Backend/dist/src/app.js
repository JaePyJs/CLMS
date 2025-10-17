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
const cookie_parser_1 = __importDefault(require("cookie-parser"));
require("express-async-errors");
const logger_1 = require("@/utils/logger");
const errors_1 = require("@/utils/errors");
const database_1 = __importDefault(require("@/config/database"));
const auth_1 = __importDefault(require("@/routes/auth"));
const students_1 = __importDefault(require("@/routes/students"));
const books_1 = __importDefault(require("@/routes/books"));
const activities_1 = __importDefault(require("@/routes/activities"));
const analytics_1 = __importDefault(require("@/routes/analytics"));
const equipment_1 = __importDefault(require("@/routes/equipment"));
const fines_1 = __importDefault(require("@/routes/fines"));
const reports_1 = __importDefault(require("@/routes/reports"));
const users_routes_1 = __importDefault(require("@/routes/users.routes"));
const audit_routes_1 = __importDefault(require("@/routes/audit.routes"));
const notifications_routes_1 = __importDefault(require("@/routes/notifications.routes"));
const settings_1 = __importDefault(require("@/routes/settings"));
const backup_routes_1 = __importDefault(require("@/routes/backup.routes"));
const import_routes_1 = __importDefault(require("@/routes/import.routes"));
const self_service_routes_1 = __importDefault(require("@/routes/self-service.routes"));
const scanner_1 = __importDefault(require("@/routes/scanner"));
const performance_1 = __importDefault(require("@/routes/performance"));
const utilities_1 = __importDefault(require("@/routes/utilities"));
const automation_1 = __importDefault(require("@/routes/automation"));
const admin_1 = __importDefault(require("@/routes/admin"));
const enhancedEquipment_1 = __importDefault(require("@/routes/enhancedEquipment"));
const enhancedSearch_1 = __importDefault(require("@/routes/enhancedSearch"));
const errors_routes_1 = __importDefault(require("@/routes/errors.routes"));
const securityMonitoring_routes_1 = __importDefault(require("@/routes/securityMonitoring.routes"));
const reporting_1 = __importDefault(require("@/routes/reporting"));
const scan_1 = __importDefault(require("@/routes/scan"));
const scannerTesting_1 = __importDefault(require("@/routes/scannerTesting"));
const auth_2 = require("@/middleware/auth");
class CLMSApplication {
    app;
    httpServer = null;
    prisma = database_1.default.getClient();
    isInitialized = false;
    constructor() {
        this.app = (0, express_1.default)();
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            logger_1.logger.info('Initializing CLMS Application (Simplified)...');
            (0, errors_1.setupGlobalErrorHandlers)();
            this.setupBasicMiddleware();
            this.setupBasicRoutes();
            this.setupErrorHandling();
            await this.testDatabaseConnection();
            this.httpServer = (0, http_1.createServer)(this.app);
            this.setupGracefulShutdown();
            this.isInitialized = true;
            logger_1.logger.info('CLMS Application initialized successfully (Simplified)');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize CLMS Application', {
                error: error.message,
            });
            throw error;
        }
    }
    setupBasicMiddleware() {
        this.app.use((0, helmet_1.default)());
        this.app.use((0, cors_1.default)({
            origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
            credentials: true,
        }));
        this.app.use((0, compression_1.default)());
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((0, cookie_parser_1.default)());
        logger_1.logger.debug('Basic middleware configured');
    }
    setupBasicRoutes() {
        this.app.get('/health', this.healthCheck.bind(this));
        this.app.get('/', (req, res) => {
            res.json({
                success: true,
                message: 'CLMS API is running (Simplified)',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                documentation: '/api-docs',
            });
        });
        this.app.get('/api', (req, res) => {
            res.json({
                success: true,
                message: 'CLMS API v1.0.0 (Complete)',
                endpoints: {
                    auth: '/api/auth',
                    students: '/api/students',
                    books: '/api/books',
                    activities: '/api/activities',
                    analytics: '/api/analytics',
                    equipment: '/api/equipment',
                    fines: '/api/fines',
                    reports: '/api/reports',
                    users: '/api/users',
                    audit: '/api/audit',
                    notifications: '/api/notifications',
                    settings: '/api/settings',
                    backup: '/api/backup',
                    import: '/api/import',
                    'self-service': '/api/self-service',
                    scanner: '/api/scanner',
                    performance: '/api/performance',
                    utilities: '/api/utilities',
                    automation: '/api/automation',
                    admin: '/api/admin',
                    'enhanced-equipment': '/api/enhanced-equipment',
                    'enhanced-search': '/api/enhanced-search',
                    errors: '/api/errors',
                    'security-monitoring': '/api/security-monitoring',
                    reporting: '/api/reporting',
                    scan: '/api/scan',
                    'scanner-testing': '/api/scanner-testing',
                },
                timestamp: new Date().toISOString(),
            });
        });
        this.app.use('/api/auth', auth_1.default);
        this.app.use('/api/students', auth_2.authMiddleware, students_1.default);
        this.app.use('/api/books', auth_2.authMiddleware, books_1.default);
        this.app.use('/api/activities', auth_2.authMiddleware, activities_1.default);
        this.app.use('/api/analytics', auth_2.authMiddleware, analytics_1.default);
        this.app.use('/api/equipment', auth_2.authMiddleware, equipment_1.default);
        this.app.use('/api/fines', auth_2.authMiddleware, fines_1.default);
        this.app.use('/api/reports', auth_2.authMiddleware, reports_1.default);
        this.app.use('/api/users', auth_2.authMiddleware, users_routes_1.default);
        this.app.use('/api/audit', auth_2.authMiddleware, audit_routes_1.default);
        this.app.use('/api/notifications', auth_2.authMiddleware, notifications_routes_1.default);
        this.app.use('/api/settings', auth_2.authMiddleware, settings_1.default);
        this.app.use('/api/backup', auth_2.authMiddleware, backup_routes_1.default);
        this.app.use('/api/import', auth_2.authMiddleware, import_routes_1.default);
        this.app.use('/api/self-service', auth_2.authMiddleware, self_service_routes_1.default);
        this.app.use('/api/scanner', auth_2.authMiddleware, scanner_1.default);
        this.app.use('/api/performance', auth_2.authMiddleware, performance_1.default);
        this.app.use('/api/utilities', auth_2.authMiddleware, utilities_1.default);
        this.app.use('/api/automation', auth_2.authMiddleware, automation_1.default);
        this.app.use('/api/admin', auth_2.authMiddleware, admin_1.default);
        this.app.use('/api/enhanced-equipment', auth_2.authMiddleware, enhancedEquipment_1.default);
        this.app.use('/api/enhanced-search', auth_2.authMiddleware, enhancedSearch_1.default);
        this.app.use('/api/errors', auth_2.authMiddleware, errors_routes_1.default);
        this.app.use('/api/security-monitoring', auth_2.authMiddleware, securityMonitoring_routes_1.default);
        this.app.use('/api/reporting', auth_2.authMiddleware, reporting_1.default);
        this.app.use('/api/scan', auth_2.authMiddleware, scan_1.default);
        this.app.use('/api/scanner-testing', auth_2.authMiddleware, scannerTesting_1.default);
        logger_1.logger.debug('All routes configured');
    }
    setupErrorHandling() {
        this.app.use(errors_1.notFoundHandler);
        this.app.use(errors_1.errorHandler);
        logger_1.logger.debug('Error handling configured');
    }
    async testDatabaseConnection() {
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
    }
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
            try {
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
            const allServicesHealthy = databaseHealth.connected;
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
            console.log('[DEBUG] Starting CLMS Application (Simplified)...');
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
                    logger_1.logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
                    logger_1.logger.info('✅ Backend started successfully (Simplified)');
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
