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
const prisma_1 = require("@/utils/prisma");
const auth_1 = __importDefault(require("@/routes/auth"));
const students_1 = __importDefault(require("@/routes/students"));
const books_1 = __importDefault(require("@/routes/books"));
const analytics_1 = __importDefault(require("@/routes/analytics"));
const equipment_1 = __importDefault(require("@/routes/equipment"));
const users_routes_1 = __importDefault(require("@/routes/users.routes"));
const audit_routes_1 = __importDefault(require("@/routes/audit.routes"));
const auth_2 = require("@/middleware/auth");
const optimizedJobProcessor_1 = require("@/services/optimizedJobProcessor");
const automation_1 = require("@/services/automation");
const redis_1 = require("@/utils/redis");
const gates_1 = require("@/utils/gates");
class CLMSApplication {
    app;
    httpServer = null;
    prisma = database_1.default.getClient();
    isInitialized = false;
    isReady = false;
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
            const deferDbInit = process.env.DEFER_DB_INIT === 'true';
            if (!deferDbInit) {
                await this.testDatabaseConnection();
            }
            else {
                logger_1.logger.warn('Database initialization deferred (DEFER_DB_INIT=true)');
            }
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
        this.app.get('/ready', this.readyCheck.bind(this));
        this.app.get('/health/extended', this.extendedHealthCheck.bind(this));
        this.app.use('/api/auth', auth_1.default);
        this.app.use('/api/students', auth_2.authMiddleware, students_1.default);
        this.app.use('/api/books', auth_2.authMiddleware, books_1.default);
        this.app.use('/api/equipment', auth_2.authMiddleware, equipment_1.default);
        this.app.use('/api/users', auth_2.authMiddleware, users_routes_1.default);
        this.app.use('/api/analytics', auth_2.authMiddleware, analytics_1.default);
        this.app.use('/api/audit', auth_2.authMiddleware, audit_routes_1.default);
        logger_1.logger.debug('Basic routes configured');
    }
    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            logger_1.logger.error('Unhandled error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: `Route ${req.method} ${req.path} not found`
            });
        });
        logger_1.logger.debug('Error handling configured');
    }
    async testDatabaseConnection() {
        try {
            await prisma_1.prisma.$connect();
            logger_1.logger.info('Database connection successful');
        }
        catch (error) {
            logger_1.logger.error('Database connection failed:', error);
            throw error;
        }
    }
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
            try {
                await this.shutdown();
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        logger_1.logger.debug('Graceful shutdown handlers configured');
    }
    async readyCheck(req, res) {
        try {
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();
            const startTime = Date.now();
            let redis = { connected: false };
            try {
                const redisHealth = await (0, redis_1.healthCheck)();
                redis = {
                    connected: redisHealth,
                    responseTime: undefined,
                };
            }
            catch {
                redis = { connected: false };
            }
            const responseTime = Date.now() - startTime;
            res.json({
                status: 'OK',
                uptime,
                memory: memoryUsage,
                responseTime,
                redis,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'ERROR',
                message: 'Readiness check failed',
                error: error.message,
            });
        }
    }
    async healthCheck(req, res) {
        try {
            const startTime = Date.now();
            const dbHealth = await this.checkDatabaseHealth();
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();
            const responseTime = Date.now() - startTime;
            res.json({
                status: dbHealth.connected ? 'OK' : 'ERROR',
                db: dbHealth,
                uptime,
                memory: memoryUsage,
                responseTime,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'ERROR',
                message: 'Health check failed',
                details: process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
            });
        }
    }
    async extendedHealthCheck(req, res) {
        try {
            const startTime = Date.now();
            const deferDbInit = process.env.DEFER_DB_INIT === 'true';
            const dbHealth = deferDbInit
                ? { connected: false, error: 'Initialization deferred' }
                : await this.checkDatabaseHealth();
            let redis = {};
            try {
                redis = await (0, redis_1.healthCheck)();
            }
            catch (e) {
                redis = { connected: false, error: e.message };
            }
            let jobs = {};
            try {
                jobs = await optimizedJobProcessor_1.optimizedJobProcessor.healthCheck();
            }
            catch (e) {
                jobs = { healthy: false, error: e.message };
            }
            let automation = {};
            try {
                automation = automation_1.automationService.getSystemHealth();
            }
            catch (e) {
                automation = { initialized: false, error: e.message };
            }
            const gates = {
                queuesDisabled: gates_1.queuesDisabled,
                disableScheduledTasks: gates_1.disableScheduledTasks,
                rateLimiterDisabled: gates_1.rateLimiterDisabled,
                emailDisabled: gates_1.emailDisabled,
            };
            const uptime = process.uptime();
            const memory = process.memoryUsage();
            const responseTime = Date.now() - startTime;
            const criticalHealthy = dbHealth.connected && redis?.connected !== false;
            const status = criticalHealthy ? 'OK' : 'DEGRADED';
            res.json({
                status,
                environment: process.env.NODE_ENV,
                version: '1.0.0',
                responseTime,
                uptime,
                memory,
                gates,
                db: dbHealth,
                redis,
                jobs,
                automation,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'ERROR',
                message: 'Extended health check failed',
                error: error.message,
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
            await new Promise((resolve, reject) => {
                const onListening = () => {
                    console.log('[DEBUG] Listen event fired (server is listening)');
                    this.isReady = true;
                    logger_1.logger.info(`🚀 CLMS Backend Server running on port ${port}`);
                    logger_1.logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
                    logger_1.logger.info(`🔗 Health check: http://localhost:${port}/health`);
                    logger_1.logger.info(`🔎 Readiness: http://localhost:${port}/ready`);
                    logger_1.logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
                    logger_1.logger.info('✅ Backend started successfully (Simplified)');
                    resolve();
                };
                const onError = (err) => {
                    console.log('[DEBUG] Listen error event fired:', err);
                    logger_1.logger.error('HTTP server listen error', {
                        port,
                        code: err?.code,
                        message: err?.message,
                        stack: err?.stack,
                    });
                    reject(err);
                };
                this.httpServer.once('listening', onListening);
                this.httpServer.once('error', onError);
                try {
                    this.httpServer.listen(port, '0.0.0.0');
                }
                catch (syncError) {
                    console.log('[DEBUG] Synchronous listen throw:', syncError);
                    onError(syncError);
                }
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
