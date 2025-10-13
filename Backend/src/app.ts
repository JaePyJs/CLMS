import express, { Application, Request, Response } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import 'express-async-errors';

import { logger, createRequestLogger } from '@/utils/logger';
import {
  requestLogger,
  errorLogger,
  performanceMonitor,
  requestId,
} from '@/middleware/requestLogger';
import {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from '@/utils/errors';
import { enhancedErrorHandler } from '@/middleware/errorMiddleware';
import { selfHealing } from '@/middleware/selfHealingMiddleware';
import { automationService } from '@/services/automation';
import { googleSheetsService } from '@/services/googleSheets';
import { websocketServer } from './websocket/websocketServer';
import { realtimeService } from './websocket/realtimeService';
import { recoveryService } from '@/services/recoveryService';
import { errorNotificationService } from '@/services/errorNotificationService';
import { reportingService } from '@/services/reportingService';
import { swaggerSpec } from '@/config/swagger';
import { TLSMiddleware, SecurityHeaders } from '@/middleware/tls.middleware';

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
import finesRoutes from '@/routes/fines';
import utilitiesRoutes from '@/routes/utilities';
import analyticsRoutes from '@/routes/analytics';
import importRoutes from '@/routes/import.routes';
import settingsRoutes from '@/routes/settings';
import notificationsRoutes from '@/routes/notifications.routes';
import auditRoutes from '@/routes/audit.routes';
import usersRoutes from '@/routes/users.routes';
import backupRoutes from '@/routes/backup.routes';
import selfServiceRoutes from '@/routes/self-service.routes';
import errorsRoutes from '@/routes/errors.routes';
import reportingRoutes from '@/routes/reporting';

// Import middleware
import { authMiddleware } from '@/middleware/auth';

export class CLMSApplication {
  private app: Application;
  private httpServer: HttpServer | null = null;
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

      // Create HTTP server for WebSocket integration
      this.httpServer = createHttpServer(this.app);

      // Initialize WebSocket server
      try {
        websocketServer.initialize(this.httpServer);
        logger.info('WebSocket server initialized successfully');
        
        // Initialize realtime monitoring services
        realtimeService.initialize();
        logger.info('Realtime service initialized successfully');
      } catch (error) {
        logger.warn('Failed to initialize WebSocket server', {
          error: (error as Error).message,
        });
        // Don't throw - app can still work without WebSocket
      }

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
    // TLS enforcement for production
    this.app.use(TLSMiddleware.enforceHTTPS);

    // Enhanced security headers with TLS 1.3 compliance
    this.app.use(TLSMiddleware.securityHeaders);

    // Advanced compression with TLS considerations
    this.app.use(compression(TLSMiddleware.compressionSettings));

    logger.debug('TLS and security middleware configured');
  }

  private setupParsingMiddleware(): void {
    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // URL-encoded body parser
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser (for secure token storage)
    this.app.use(cookieParser());

    logger.debug('Parsing middleware configured');
  }

  private setupLoggingMiddleware(): void {
    // Request ID middleware (must be first)
    this.app.use(requestId);

    // Enhanced request logging with full context
    this.app.use(requestLogger);

    // Performance monitoring
    this.app.use(performanceMonitor);

    logger.debug('Enhanced logging middleware configured');
  }

  private setupRateLimiting(): void {
    // Advanced rate limiting with TLS-aware configuration
    const limiter = rateLimit({
      ...TLSMiddleware.rateLimiting,
      message: {
        ...TLSMiddleware.rateLimiting.message,
        timestamp: new Date().toISOString(),
      },
    });

    this.app.use('/api', limiter);

    // Stricter rate limiting for auth endpoints with TLS security
    const authRateLimitEnabled =
      process.env.RATE_LIMIT_AUTH_ENABLED !== 'false';

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
        keyGenerator: (req: Request) => {
          // Use user ID if available, otherwise IP
          const user = (req as any).user;
          return user?.id || req.ip;
        },
      });

      this.app.use('/api/auth/login', authLimiter);
      this.app.use('/api/auth/register', authLimiter);
      this.app.use('/api/auth/forgot-password', authLimiter);
    }

    logger.debug('Advanced rate limiting middleware configured');
  }

  private setupCORS(): void {
    // TLS-aware CORS configuration
    this.app.use(cors(TLSMiddleware.corsSettings));

    logger.debug('TLS-aware CORS middleware configured');
  }

  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', this.healthCheck.bind(this));

    // Swagger API Documentation (no auth required)
    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'CLMS API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
        },
      }),
    );

    // Swagger JSON endpoint
    this.app.get('/api-docs.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

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
    this.app.use('/api/fines', authMiddleware, finesRoutes);
    this.app.use('/api/utilities', authMiddleware, utilitiesRoutes);
    this.app.use('/api/analytics', authMiddleware, analyticsRoutes);
    this.app.use('/api/import', authMiddleware, importRoutes);
    this.app.use('/api/settings', authMiddleware, settingsRoutes);
    this.app.use('/api/users', usersRoutes); // User management with built-in auth
    this.app.use('/api/notifications', notificationsRoutes); // Notifications with built-in auth
    this.app.use('/api/backups', backupRoutes); // Backup management with built-in auth
    this.app.use('/api/self-service', selfServiceRoutes); // Self-service check-in/out with built-in auth
    this.app.use('/api/errors', authMiddleware, errorsRoutes); // Error reporting and management
    this.app.use('/api/reporting', authMiddleware, reportingRoutes); // Advanced reporting and analytics
    this.app.use('/api/audit', authMiddleware, auditRoutes); // Audit log management and export

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
          fines: '/api/fines',
          utilities: '/api/utilities',
          analytics: '/api/analytics',
          import: '/api/import',
          settings: '/api/settings',
          users: '/api/users',
          notifications: '/api/notifications',
          selfService: '/api/self-service',
          errors: '/api/errors',
          reporting: '/api/reporting',
        },
        timestamp: new Date().toISOString(),
      });
    });

    logger.debug('Routes configured');
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Error logging middleware
    this.app.use(errorLogger);

    // Enhanced error handler with recovery and reporting
    this.app.use(enhancedErrorHandler);

    logger.debug('Enhanced error handling configured');
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

    // Initialize recovery service
    try {
      logger.info('Initializing recovery service...');
      // Recovery service initializes automatically in constructor
      logger.info('Recovery service initialized');
    } catch (error) {
      logger.warn('Failed to initialize recovery service', {
        error: (error as Error).message,
      });
      // Don't throw - app can still work without recovery
    }

    // Initialize error notification service
    try {
      logger.info('Initializing error notification service...');
      // Notification service initializes automatically in constructor
      logger.info('Error notification service initialized');
    } catch (error) {
      logger.warn('Failed to initialize error notification service', {
        error: (error as Error).message,
      });
      // Don't throw - app can still work without notifications
    }

    // Initialize reporting service
    try {
      logger.info('Initializing reporting service...');
      await reportingService.initializeScheduledReports();
      await reportingService.initializeAlertMonitoring();
      logger.info('Reporting service initialized');
    } catch (error) {
      logger.warn('Failed to initialize reporting service', {
        error: (error as Error).message,
      });
      // Don't throw - app can still work without advanced reporting
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
        await recoveryService.shutdown();
        await errorNotificationService.shutdown?.();
        await reportingService.cleanup();

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

      // Check WebSocket server
      const webSocketStatus = webSocketManager.getStatus();

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
          websockets: {
            initialized: webSocketStatus.isInitialized,
            running: webSocketStatus.isRunning,
            connections: webSocketStatus.stats.totalConnections,
            connectionsByRole: webSocketStatus.stats.connectionsByRole,
          },
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
      console.log('[DEBUG] Starting CLMS Application...');
      await this.initialize();
      console.log('[DEBUG] Initialization complete');

      if (!this.httpServer) {
        throw new Error('HTTP server not initialized');
      }

      console.log('[DEBUG] About to call httpServer.listen()...');
      // Wrap listen in a Promise to keep the process alive
      await new Promise<void>(resolve => {
        this.httpServer!.listen(port, () => {
          console.log('[DEBUG] Listen callback fired!');
          logger.info(`🚀 CLMS Backend Server running on port ${port}`);
          logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
          logger.info(`🔗 Health check: http://localhost:${port}/health`);
          logger.info(`🔌 WebSocket: ws://localhost:${port}/ws`);
          logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
          logger.info(
            `⏰ Automation: ${automationService.getSystemHealth().initialized ? 'Enabled' : 'Disabled'}`,
          );
          logger.info(
            `🌐 WebSocket: ${websocketServer.getConnectedClients() >= 0 ? 'Enabled' : 'Disabled'}`,
          );
          resolve();
        });
      });
      console.log('[DEBUG] After listen promise');
    } catch (error) {
      console.log('[DEBUG] Error in start():', error);
      logger.error('Failed to start server', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down CLMS Application...');

    try {
      // Shutdown realtime service
      realtimeService.shutdown();
      logger.info('Realtime service shut down');

      // Close HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close(error => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      // Shutdown other services
      await automationService.shutdown();
      await recoveryService.shutdown();
      await errorNotificationService.shutdown?.();
      await reportingService.cleanup();
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
