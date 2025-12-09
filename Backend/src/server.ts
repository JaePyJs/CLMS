import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env, getAllowedOrigins, isDevelopment } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { performanceMonitor } from './middleware/performanceMonitor';
import { websocketServer } from './websocket/websocketServer';
import { swaggerSpec, swaggerUiOptions } from './config/swagger';
import path from 'path';

// Create Express application
// @ts-expect-error - Express types issue with Application inference
const app = express();

// Initialize database connection
connectDatabase().catch(error => {
  logger.error('Failed to connect to database:', error);
  if (isDevelopment()) {
    logger.warn('Continuing without database connection in development');
  } else {
    process.exit(1);
  }
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

// CORS configuration - allow all origins in development for multi-PC setup
const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cache-Control',
      'X-Correlation-Id',
      'x-correlation-id',
      'X-Request-Id',
      'x-request-id',
      'X-CSRF-Token',
      'CSRF-Token',
    ],
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
// @ts-expect-error - Express middleware methods exist at runtime
app.use(express.json({ limit: '10mb' }));
// @ts-expect-error - Express middleware methods exist at runtime
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the public directory (Frontend build)
const publicPath = path.join(__dirname, '../public');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((express as any).static(publicPath));

// Handle invalid JSON body parse errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (err && err instanceof SyntaxError && (req as any).body === undefined) {
    return res.status(400).json({
      error: {
        message: 'Invalid JSON body',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method,
      },
    });
  }
  next(err);
});

// Compression middleware
app.use(compression());

// Cookie parser (required for CSRF)
app.use(cookieParser());

// CSRF Protection - DISABLED to allow kiosk scanning
// const csrfProtection = csrf({ cookie: true });
logger.info('🔒 CSRF disabled for kiosk scanning');

// Request logging middleware
app.use((req: Request, res: Response, next: express.NextFunction) => {
  try {
    const existing = req.get('x-correlation-id') || req.get('x-request-id');
    const id =
      existing ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).id = id;
    res.setHeader('x-correlation-id', id);
  } catch {
    // Ignore error
  }
  next();
});
app.use(requestLogger);

// Performance monitoring middleware
app.use(performanceMonitor);

// Swagger API Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions),
);
logger.info('📚 Swagger API documentation available at /api-docs');

import { apiRoutes } from './routes/index';

// API routes
app.use('/api', apiRoutes);

// Serve index.html for any unknown routes (SPA fallback)
app.get('*', (req: Request, res: Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'), err => {
    if (err) {
      // If index.html doesn't exist, fall back to 404 handler
      next();
    }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
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

// Server listen is handled in src/index.ts

export { app as server, httpServer };
