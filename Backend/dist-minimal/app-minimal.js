"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.CLMSApplication = void 0;
const express_1 = require("express");
const http_1 = require("http");
const cors_1 = require("cors");
const helmet_1 = require("helmet");
const compression_1 = require("compression");
const client_1 = require("@prisma/client");
const cookie_parser_1 = require("cookie-parser");
require("express-async-errors");
// Simple console logger to avoid potential logger issues
const simpleLogger = {
    info: (message, meta) => {
        console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message, meta) => {
        console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    debug: (message, meta) => {
        console.log(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
};
// Simple error handler
const simpleErrorHandler = (error, req, res, next) => {
    simpleLogger.error('Unhandled error', { error: error.message, stack: error.stack });
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
    });
};
// Simple 404 handler
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        timestamp: new Date().toISOString(),
    });
};
class CLMSApplication {
    constructor() {
        this.httpServer = null;
        this.isInitialized = false;
        this.app = (0, express_1.default)();
        this.prisma = new client_1.PrismaClient();
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            simpleLogger.info('Initializing CLMS Application (Minimal)...');
            // Setup basic middleware
            this.setupBasicMiddleware();
            // Setup basic routes
            this.setupBasicRoutes();
            // Setup error handling
            this.setupErrorHandling();
            // Test database connection
            await this.testDatabaseConnection();
            // Create HTTP server
            this.httpServer = (0, http_1.createServer)(this.app);
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            this.isInitialized = true;
            simpleLogger.info('CLMS Application initialized successfully (Minimal)');
        }
        catch (error) {
            simpleLogger.error('Failed to initialize CLMS Application', {
                error: error.message,
            });
            throw error;
        }
    }
    setupBasicMiddleware() {
        // Security headers
        this.app.use((0, helmet_1.default)());
        // CORS
        this.app.use((0, cors_1.default)({
            origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
            credentials: true,
        }));
        // Compression
        this.app.use((0, compression_1.default)());
        // JSON body parser
        this.app.use(express_1.default.json({ limit: '10mb' }));
        // URL-encoded body parser
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        // Cookie parser
        this.app.use((0, cookie_parser_1.default)());
        simpleLogger.debug('Basic middleware configured');
    }
    setupBasicRoutes() {
        // Health check endpoint (no auth required)
        this.app.get('/health', this.healthCheck.bind(this));
        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                success: true,
                message: 'CLMS API is running (Minimal)',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
            });
        });
        // API info endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                success: true,
                message: 'CLMS API v1.0.0 (Minimal)',
                endpoints: {
                    health: '/health',
                },
                timestamp: new Date().toISOString(),
            });
        });
        simpleLogger.debug('Basic routes configured');
    }
    setupErrorHandling() {
        // 404 handler
        this.app.use(notFoundHandler);
        // Error handler
        this.app.use(simpleErrorHandler);
        simpleLogger.debug('Error handling configured');
    }
    async testDatabaseConnection() {
        try {
            await this.prisma.$connect();
            simpleLogger.info('Database connection established');
        }
        catch (error) {
            simpleLogger.error('Failed to connect to database', {
                error: error.message,
            });
            throw error;
        }
    }
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            simpleLogger.info(`Received ${signal}, starting graceful shutdown...`);
            try {
                // Close database connection
                await this.prisma.$disconnect();
                simpleLogger.info('Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                simpleLogger.error('Error during graceful shutdown', {
                    error: error.message,
                });
                process.exit(1);
            }
        };
        // Handle signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        simpleLogger.debug('Graceful shutdown handlers configured');
    }
    async healthCheck(req, res) {
        try {
            const startTime = Date.now();
            // Check database
            const databaseHealth = await this.checkDatabaseHealth();
            // Check memory usage
            const memoryUsage = process.memoryUsage();
            const totalMemory = memoryUsage.heapTotal;
            const usedMemory = memoryUsage.heapUsed;
            const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
            // Check uptime
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
            // Determine overall health status
            const allServicesHealthy = databaseHealth.connected;
            const statusCode = allServicesHealthy ? 200 : 503;
            res.status(statusCode).json(health);
        }
        catch (error) {
            simpleLogger.error('Health check failed', { error: error.message });
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
            console.log('[DEBUG] Starting CLMS Application (Minimal)...');
            await this.initialize();
            console.log('[DEBUG] Initialization complete');
            if (!this.httpServer) {
                throw new Error('HTTP server not initialized');
            }
            console.log('[DEBUG] About to call httpServer.listen()...');
            // Wrap listen in a Promise to keep the process alive
            await new Promise(resolve => {
                this.httpServer.listen(port, () => {
                    console.log('[DEBUG] Listen callback fired!');
                    simpleLogger.info(`🚀 CLMS Backend Server running on port ${port}`);
                    simpleLogger.info(`📝 Environment: ${process.env.NODE_ENV}`);
                    simpleLogger.info(`🔗 Health check: http://localhost:${port}/health`);
                    simpleLogger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
                    simpleLogger.info('✅ Backend started successfully (Minimal)');
                    resolve();
                });
            });
            console.log('[DEBUG] After listen promise');
        }
        catch (error) {
            console.log('[DEBUG] Error in start():', error);
            simpleLogger.error('Failed to start server', {
                error: error.message,
            });
            process.exit(1);
        }
    }
    async shutdown() {
        simpleLogger.info('Shutting down CLMS Application...');
        try {
            // Close HTTP server
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
            // Close database connection
            await this.prisma.$disconnect();
            simpleLogger.info('CLMS Application shutdown complete');
        }
        catch (error) {
            simpleLogger.error('Error during shutdown', {
                error: error.message,
            });
        }
    }
}
exports.CLMSApplication = CLMSApplication;
// Create and export application instance
exports.app = new CLMSApplication();
exports.default = exports.app;
