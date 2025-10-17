import express, { Application, Request, Response } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import 'express-async-errors';

import { logger } from '@/utils/logger';
import {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from '@/utils/errors';
import optimizedDatabase from '@/config/database';

// Import all routes that actually exist
import authRoutes from '@/routes/auth';
import studentsRoutes from '@/routes/students';
import booksRoutes from '@/routes/books';
import activitiesRoutes from '@/routes/activities';
import analyticsRoutes from '@/routes/analytics';
import equipmentRoutes from '@/routes/equipment';
import fineRoutes from '@/routes/fines';
import reportRoutes from '@/routes/reports';
import userRoutes from '@/routes/users.routes';
import auditRoutes from '@/routes/audit.routes';
import notificationRoutes from '@/routes/notifications.routes';
import settingsRoutes from '@/routes/settings';
import backupRoutes from '@/routes/backup.routes';
import importRoutes from '@/routes/import.routes';
import selfServiceRoutes from '@/routes/self-service.routes';
import scannerRoutes from '@/routes/scanner';
import performanceRoutes from '@/routes/performance';
import utilitiesRoutes from '@/routes/utilities';
import automationRoutes from '@/routes/automation';
import adminRoutes from '@/routes/admin';
import enhancedEquipmentRoutes from '@/routes/enhancedEquipment';
import enhancedSearchRoutes from '@/routes/enhancedSearch';
import errorRoutes from '@/routes/errors.routes';
import securityMonitoringRoutes from '@/routes/securityMonitoring.routes';
import reportingRoutes from '@/routes/reporting';
import scanRoutes from '@/routes/scan';
import scannerTestingRoutes from '@/routes/scannerTesting';

// Import essential middleware
import { authMiddleware } from '@/middleware/auth';

export class CLMSApplication {
  private app: Application;
  private httpServer: HttpServer | null = null;
  private prisma = optimizedDatabase.getClient();
  private isInitialized = false;

  constructor() {
    this.app = express();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing CLMS Application (Simplified)...');

      // Setup global error handlers
      setupGlobalErrorHandlers();

      // Setup basic middleware
      this.setupBasicMiddleware();

      // Setup basic routes
      this.setupBasicRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Test database connection
      await this.testDatabaseConnection();

      // Create HTTP server
      this.httpServer = createHttpServer(this.app);

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.isInitialized = true;
      logger.info('CLMS Application initialized successfully (Simplified)');
    } catch (error) {
      logger.error('Failed to initialize CLMS Application', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private setupBasicMiddleware(): void {
    // Security headers
    this.app.use(helmet());

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // URL-encoded body parser
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser
    this.app.use(require('cookie-parser')());

    logger.debug('Basic middleware configured');
  }

  private setupBasicRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', this.healthCheck.bind(this));

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS API is running (Simplified)',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        documentation: '/api-docs',
      });
    });

    // API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS API v1.0.0 (Complete)',
        endpoints: {
          auth: '/api/auth',
          students: '/api/students',
          books: '/api/books',
          activities: '/api/activities',
          analytics: '/api/analytics',
          equipment: '/api/equipment',
          fines: '/api/fines',
          reports: '/api/reports',
          users: '/api/users',
          audit: '/api/audit',
          notifications: '/api/notifications',
          settings: '/api/settings',
          backup: '/api/backup',
          import: '/api/import',
          'self-service': '/api/self-service',
          scanner: '/api/scanner',
          performance: '/api/performance',
          utilities: '/api/utilities',
          automation: '/api/automation',
          admin: '/api/admin',
          'enhanced-equipment': '/api/enhanced-equipment',
          'enhanced-search': '/api/enhanced-search',
          errors: '/api/errors',
          'security-monitoring': '/api/security-monitoring',
          reporting: '/api/reporting',
          scan: '/api/scan',
          'scanner-testing': '/api/scanner-testing',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // API routes (only existing routes)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/students', authMiddleware, studentsRoutes);
    this.app.use('/api/books', authMiddleware, booksRoutes);
    this.app.use('/api/activities', authMiddleware, activitiesRoutes);
    this.app.use('/api/analytics', authMiddleware, analyticsRoutes);
    this.app.use('/api/equipment', authMiddleware, equipmentRoutes);
    this.app.use('/api/fines', authMiddleware, fineRoutes);
    this.app.use('/api/reports', authMiddleware, reportRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/audit', authMiddleware, auditRoutes);
    this.app.use('/api/notifications', authMiddleware, notificationRoutes);
    this.app.use('/api/settings', authMiddleware, settingsRoutes);
    this.app.use('/api/backup', authMiddleware, backupRoutes);
    this.app.use('/api/import', authMiddleware, importRoutes);
    this.app.use('/api/self-service', authMiddleware, selfServiceRoutes);
    this.app.use('/api/scanner', authMiddleware, scannerRoutes);
    this.app.use('/api/performance', authMiddleware, performanceRoutes);
    this.app.use('/api/utilities', authMiddleware, utilitiesRoutes);
    this.app.use('/api/automation', authMiddleware, automationRoutes);
    this.app.use('/api/admin', authMiddleware, adminRoutes);
    this.app.use('/api/enhanced-equipment', authMiddleware, enhancedEquipmentRoutes);
    this.app.use('/api/enhanced-search', authMiddleware, enhancedSearchRoutes);
    this.app.use('/api/errors', authMiddleware, errorRoutes);
    this.app.use('/api/security-monitoring', authMiddleware, securityMonitoringRoutes);
    this.app.use('/api/reporting', authMiddleware, reportingRoutes);
    this.app.use('/api/scan', authMiddleware, scanRoutes);
    this.app.use('/api/scanner-testing', authMiddleware, scannerTestingRoutes);

    logger.debug('All routes configured');
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Error handler
    this.app.use(errorHandler);

    logger.debug('Error handling configured');
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
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
      const allServicesHealthy = databaseHealth.connected;
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
      console.log('[DEBUG] Starting CLMS Application (Simplified)...');
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
          logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
          logger.info('✅ Backend started successfully (Simplified)');
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

      // Close database connection
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