import dotenv from 'dotenv';
dotenv.config();

console.log('[DEBUG server.ts] Loading full app module...');
import { app } from './app';
console.log('[DEBUG server.ts] App module loaded');
import { logger } from '@/utils/logger';
console.log('[DEBUG server.ts] Logger loaded');

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Shutdown application
    await app.shutdown();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: (error as Error).message,
    });
    process.exit(1);
  }
};

// Handle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the server
const port = parseInt(process.env.PORT || '3001', 10);
console.log('[DEBUG server.ts] About to call app.start() with port:', port);

// Use an async IIFE to await the start
(async () => {
  try {
    console.log('[DEBUG server.ts] Inside async IIFE');
    await app.start(port);
    console.log('[DEBUG server.ts] app.start() completed');
    // Server is now running, keep process alive
  } catch (error) {
    console.log('[DEBUG server.ts] Error caught:', error);
    logger.error('Failed to start server', {
      error: (error as Error).message,
    });
    process.exit(1);
  }
})();
console.log('[DEBUG server.ts] After IIFE definition');
