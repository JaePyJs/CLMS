"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.CLMSApplication = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
require("express-async-errors");
const logger_1 = require("@/utils/logger");
const errors_1 = require("@/utils/errors");
const automation_1 = require("@/services/automation");
const googleSheets_1 = require("@/services/googleSheets");
const auth_1 = __importDefault(require("@/routes/auth"));
const students_1 = __importDefault(require("@/routes/students"));
const books_1 = __importDefault(require("@/routes/books"));
const equipment_1 = __importDefault(require("@/routes/equipment"));
const scan_1 = __importDefault(require("@/routes/scan"));
const activities_1 = __importDefault(require("@/routes/activities"));
const automation_2 = __importDefault(require("@/routes/automation"));
const admin_1 = __importDefault(require("@/routes/admin"));
const reports_1 = __importDefault(require("@/routes/reports"));
const utilities_1 = __importDefault(require("@/routes/utilities"));
const auth_2 = require("@/middleware/auth");
class CLMSApplication {
    app;
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
        this.app.use((0, logger_1.createRequestLogger)());
        logger_1.logger.debug('Logging middleware configured');
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
        this.app.use('/api/utilities', auth_2.authMiddleware, utilities_1.default);
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
                    utilities: '/api/utilities',
                },
                timestamp: new Date().toISOString(),
            });
        });
        logger_1.logger.debug('Routes configured');
    }
    setupErrorHandling() {
        this.app.use(errors_1.notFoundHandler);
        this.app.use(errors_1.errorHandler);
        logger_1.logger.debug('Error handling configured');
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
            await this.initialize();
            this.app.listen(port, () => {
                logger_1.logger.info(`🚀 CLMS Backend Server running on port ${port}`);
                logger_1.logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
                logger_1.logger.info(`🔗 Health check: http://localhost:${port}/health`);
                logger_1.logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
                logger_1.logger.info(`⏰ Automation: ${automation_1.automationService.getSystemHealth().initialized ? 'Enabled' : 'Disabled'}`);
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to start server', {
                error: error.message,
            });
            process.exit(1);
        }
    }
    async shutdown() {
        logger_1.logger.info('Shutting down CLMS Application...');
        try {
            await automation_1.automationService.shutdown();
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