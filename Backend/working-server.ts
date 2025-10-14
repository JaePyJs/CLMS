console.log('[DEBUG WORKING SERVER] Loading working app module...');
import { workingApp } from './src/working-app';
console.log('[DEBUG WORKING SERVER] Working app module loaded');
import { logger } from './src/utils/logger';
console.log('[DEBUG WORKING SERVER] Logger loaded');

// Start the server
const port = parseInt(process.env.PORT || '3002', 10);
console.log('[DEBUG WORKING SERVER] About to call workingApp.start() with port:', port);

// Use an async IIFE to await the start
(async () => {
  try {
    console.log('[DEBUG WORKING SERVER] Inside async IIFE');
    await workingApp.start(port);
    console.log('[DEBUG WORKING SERVER] workingApp.start() completed');
    // Server is now running, keep process alive
  } catch (error) {
    console.log('[DEBUG WORKING SERVER] Error caught:', error);
    logger.error('Failed to start working server', {
      error: (error as Error).message,
    });
    process.exit(1);
  }
})();
console.log('[DEBUG WORKING SERVER] After IIFE definition');