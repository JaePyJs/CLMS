"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log('[DEBUG server.ts] Loading full app module...');
const app_1 = require("./app");
console.log('[DEBUG server.ts] App module loaded');
const logger_1 = require("@/utils/logger");
console.log('[DEBUG server.ts] Logger loaded');
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
    try {
        await app_1.app.shutdown();
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
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', error => {
    logger_1.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});
const port = parseInt(process.env.PORT || '3001', 10);
console.log('[DEBUG server.ts] About to call app.start() with port:', port);
(async () => {
    try {
        console.log('[DEBUG server.ts] Inside async IIFE');
        await app_1.app.start(port);
        console.log('[DEBUG server.ts] app.start() completed');
    }
    catch (error) {
        console.log('[DEBUG server.ts] Error caught:', error);
        logger_1.logger.error('Failed to start server', {
            error: error.message,
        });
        process.exit(1);
    }
})();
console.log('[DEBUG server.ts] After IIFE definition');
