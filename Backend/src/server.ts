import type { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { env, getAllowedOrigins } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { performanceMonitor } from './middleware/performanceMonitor';
import { apiRoutes } from './routes/index';
import { websocketServer } from './websocket/websocketServer';

const express = require('express');

// Create Express application
const app = express();

// Initialize database connection
connectDatabase().catch(error => {
  logger.error('Failed to connect to database:', error);
  process.exit(1);
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW,
  max: env.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use(requestLogger);

// Performance monitoring middleware
app.use(performanceMonitor);

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env['NODE_ENV'],
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'CLMS Backend API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket server
websocketServer.initialize(httpServer);

// Log server configuration
logger.info(`🚀 Server configured successfully`);
logger.info(`📊 Environment: ${process.env['NODE_ENV'] || 'development'}`);
logger.info(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
logger.info(`📝 Logging: Request logging and error handling configured`);
logger.info(`🔌 WebSocket: Real-time communication enabled`);

// Start server
const PORT = env.PORT || 3001;
const HOST = '0.0.0.0'; // Bind to IPv4 only to avoid port conflicts
httpServer.listen(PORT, HOST, () => {
  logger.info(`✅ CLMS Backend API running on port ${PORT}`);
  logger.info(`🌐 HTTP: http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
});

export { app as server, httpServer };
