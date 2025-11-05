import http from 'http';
import { server as app } from './server';
import { logger } from './utils/logger';
import { env } from './config/env';

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(env.PORT, env.HOST, () => {
  logger.info(
    `🚀 Server running on ${env.HOST}:${env.PORT} in ${env['NODE_ENV']} mode`,
  );
  logger.info(`📚 CLMS Backend API is ready!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});
