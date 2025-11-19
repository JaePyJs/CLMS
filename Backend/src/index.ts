import { httpServer } from './server.js';
import { logger } from './utils/logger';
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
