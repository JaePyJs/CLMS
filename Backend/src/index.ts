import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';

const crashLogPath = path.join(process.cwd(), 'backend_crash.log');

process.on('uncaughtException', error => {
  const msg = `Uncaught Exception: ${error.message}\n${error.stack}\n`;
  fs.appendFileSync(crashLogPath, msg);
  logger.error('Uncaught exception captured, see crash log for details', {
    error,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const msg = `Unhandled Rejection at: ${promise}, reason: ${reason}\n`;
  fs.appendFileSync(crashLogPath, msg);
  logger.error('Unhandled rejection captured, see crash log for details', {
    reason,
    promise,
  });
});

import { httpServer } from './server.js';
import { env } from './config/env';

// Start the server
httpServer.listen(env.PORT, env.HOST, () => {
  logger.info(
    `🚀 Server running on ${env.HOST}:${env.PORT} in ${env['NODE_ENV']} mode`,
  );
  logger.info(`📚 CLMS Backend API is ready!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});
