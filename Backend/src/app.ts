import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import 'express-async-errors';

import { logger, createRequestLogger } from '@/utils/logger';
import {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from '@/utils/errors';
import { automationService } from '@/services/automation';
import { googleSheetsService } from '@/services/googleSheets';

// Import routes
import authRoutes from '@/routes/auth';
import studentsRoutes from '@/routes/students';
import booksRoutes from '@/routes/books';
import equipmentRoutes from '@/routes/equipment';
import scanRoutes from '@/routes/scan';
import activitiesRoutes from '@/routes/activities';
import automationRoutes from '@/routes/automation';
import adminRoutes from '@/routes/admin';
import reportsRoutes from '@/routes/reports';
import utilitiesRoutes from '@/routes/utilities';

// Import middleware
import { authMiddleware } from '@/middleware/auth';
import { validationMiddleware } from '@/middleware/validation';

export class CLMSApplication {
  private app: Application;
  private prisma: PrismaClient;
  private isInitialized = false;

  constructor() {
    this.app = express();
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing CLMS Application...');

      // Setup global error handlers
      setupGlobalErrorHandlers();

      // Setup security middleware
      this.setupSecurityMiddleware();

      // Setup parsing middleware
      this.setupParsingMiddleware();

      // Setup logging middleware
      this.setupLoggingMiddleware();

      // Setup rate limiting
      this.setupRateLimiting();

      // Setup CORS
      this.setupCORS();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Initialize services
      await this.initializeServices();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.isInitialized = true;
      logger.info('CLMS Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CLMS Application', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private setupSecurityMiddleware(): void {
    // Helmet for security headers
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
          },
        },
      }),
    );

    // Compression for response bodies
    this.app.use(compression());

    logger.debug('Security middleware configured');
  }

  private setupParsingMiddleware(): void {
    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // URL-encoded body parser
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    logger.debug('Parsing middleware configured');
  }

  private setupLoggingMiddleware(): void {
    // Request logging
    this.app.use(createRequestLogger());

    logger.debug('Logging middleware configured');
  }

  private setupRateLimiting(): void {
    // General rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
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

    // Stricter rate limiting for auth endpoints (if enabled)
    const authRateLimitEnabled = process.env.RATE_LIMIT_AUTH_ENABLED !== 'false';
    
    if (authRateLimitEnabled) {
      const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: {
          success: false,
          error: 'Too many authentication attempts, please try again later.',
          timestamp: new Date().toISOString(),
        },
        skipSuccessfulRequests: true,
      });

      this.app.use('/api/auth/login', authLimiter);
    }

    logger.debug('Rate limiting middleware configured');
  }

  private setupCORS(): void {
    const corsOptions = {
      origin:
        process.env.NODE_ENV === 'production'
          ? [process.env.CORS_ORIGIN || 'http://localhost:3000']
          : [
              'http://localhost:3000',
              'http://localhost:5173', // Vite dev server
              'http://127.0.0.1:3000',
              'http://127.0.0.1:5173',
            ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };

    this.app.use(cors(corsOptions));

    logger.debug('CORS middleware configured');
  }

  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', this.healthCheck.bind(this));

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/students', authMiddleware, studentsRoutes);
    this.app.use('/api/books', authMiddleware, booksRoutes);
    this.app.use('/api/equipment', authMiddleware, equipmentRoutes);
    this.app.use('/api/scan', authMiddleware, scanRoutes);
    this.app.use('/api/activities', authMiddleware, activitiesRoutes);
    this.app.use('/api/automation', authMiddleware, automationRoutes);
    this.app.use('/api/admin', authMiddleware, adminRoutes);
    this.app.use('/api/reports', authMiddleware, reportsRoutes);
    this.app.use('/api/utilities', authMiddleware, utilitiesRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        documentation: '/api/docs',
      });
    });

    // API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
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

    logger.debug('Routes configured');
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    logger.debug('Error handling configured');
  }

  private async initializeServices(): Promise<void> {
    // Test database connection
    try {
      await this.prisma.$connect();
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database', {
        error: (error as Error).message,
      });
      throw error;
    }

    // Initialize automation service
    try {
      await automationService.initialize();
      logger.info('Automation service initialized');
    } catch (error) {
      logger.warn('Failed to initialize automation service', {
        error: (error as Error).message,
      });
      // Don't throw - app can still work without automation
    }

    // Test Google Sheets connection
    try {
      const googleSheetsConnected = await googleSheetsService.testConnection();
      if (googleSheetsConnected) {
        logger.info('Google Sheets connection established');
      } else {
        logger.warn('Google Sheets connection failed');
      }
    } catch (error) {
      logger.warn('Google Sheets initialization failed', {
        error: (error as Error).message,
      });
      // Don't throw - app can still work without Google Sheets
    }

    logger.info('Services initialization completed');
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new requests
        // (Note: Express doesn't have a built-in way to stop accepting requests)

        // Shutdown services
        await automationService.shutdown();

        // Close database connection
        await this.prisma.$disconnect();

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
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.debug('Graceful shutdown handlers configured');
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();

      // Check database
      const databaseHealth = await this.checkDatabaseHealth();

      // Check Google Sheets
      const googleSheetsHealth = await googleSheetsService.healthCheck();

      // Check automation service
      const automationHealth = automationService.getSystemHealth();

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

      // Determine overall health status
      // Only require database and automation to be healthy
      // Google Sheets is optional
      const allServicesHealthy =
        databaseHealth.connected && automationHealth.initialized;

      const statusCode = allServicesHealthy ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  private async checkDatabaseHealth(): Promise<{
    connected: boolean;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  getApp(): Application {
    return this.app;
  }

  async start(port: number = 3001): Promise<void> {
    try {
      await this.initialize();

      this.app.listen(port, () => {
        logger.info(`🚀 CLMS Backend Server running on port ${port}`);
        logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
        logger.info(`🔗 Health check: http://localhost:${port}/health`);
        logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
        logger.info(
          `⏰ Automation: ${automationService.getSystemHealth().initialized ? 'Enabled' : 'Disabled'}`,
        );
      });
    } catch (error) {
      logger.error('Failed to start server', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down CLMS Application...');

    try {
      await automationService.shutdown();
      await this.prisma.$disconnect();
      logger.info('CLMS Application shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown', {
        error: (error as Error).message,
      });
    }
  }
}

// Create and export application instance
export const app = new CLMSApplication();

export default app;
