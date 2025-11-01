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
import { prisma } from '@/utils/prisma';

// Import all routes that actually exist
import authRoutes from '@/routes/auth';
import studentsRoutes from '@/routes/students';
import booksRoutes from '@/routes/books';
import activitiesRoutes from '@/routes/activities';
import analyticsRoutes from '@/routes/analytics';
import equipmentRoutes from '@/routes/equipment';
import fineRoutes from '@/routes/fines';
import reportRoutes from '@/routes/reports';
import usersRoutes from '@/routes/users.routes';
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

// Added imports for extended health aggregation
import { optimizedJobProcessor } from '@/services/optimizedJobProcessor';
import { automationService } from '@/services/automation';
import { healthCheck as redisHealthCheck } from '@/utils/redis';
import { queuesDisabled, disableScheduledTasks, rateLimiterDisabled, emailDisabled } from '@/utils/gates';

export class CLMSApplication {
  private app: Application;
  private httpServer: HttpServer | null = null;
  private prisma = optimizedDatabase.getClient();
  private isInitialized = false;
  private isReady = false;

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

      // Optionally defer database initialization based on env flag
      const deferDbInit = process.env.DEFER_DB_INIT === 'true';
      if (!deferDbInit) {
        await this.testDatabaseConnection();
      } else {
        logger.warn('Database initialization deferred (DEFER_DB_INIT=true)');
      }

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

    // Cookie parser (use imported module to avoid ESM/CJS require issues)
    this.app.use(cookieParser() as any);

    logger.debug('Basic middleware configured');
  }

  private setupBasicRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', this.healthCheck.bind(this));
    // Readiness endpoint (no auth; minimal checks without DB)
    this.app.get('/ready', this.readyCheck.bind(this));
    // Extended health endpoint (aggregated services, gates awareness)
    this.app.get('/health/extended', this.extendedHealthCheck.bind(this));

    // API routes with authentication
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/students', authMiddleware as any, studentsRoutes);
    this.app.use('/api/books', authMiddleware as any, booksRoutes);
    this.app.use('/api/equipment', authMiddleware as any, equipmentRoutes);
    this.app.use('/api/users', authMiddleware as any, usersRoutes);
    this.app.use('/api/analytics', authMiddleware as any, analyticsRoutes);
    this.app.use('/api/audit', authMiddleware as any, auditRoutes);

    logger.debug('Basic routes configured');
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: any, req: any, res: any, next: any) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // 404 handler
    this.app.use((req: any, res: any) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });

    logger.debug('Error handling configured');
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      await prisma.$connect();
      logger.info('Database connection successful');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    logger.debug('Graceful shutdown handlers configured');
  }

  private async readyCheck(req: Request, res: Response): Promise<void> {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const startTime = Date.now();

      // Quick Redis ping for readiness (optional, non-fatal)
      let redis: { connected: boolean; responseTime?: number } = { connected: false };
      try {
        const redisHealth = await redisHealthCheck();
        redis = {
          connected: redisHealth,
          // Don't set responseTime since healthCheck doesn't return it
        };
      } catch {
        redis = { connected: false };
      }

      const responseTime = Date.now() - startTime;

      res.json({
        status: 'OK',
        uptime,
        memory: memoryUsage,
        responseTime,
        redis,
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        message: 'Readiness check failed',
        error: (error as Error).message,
      });
    }
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();

      // Database health
      const dbHealth = await this.checkDatabaseHealth();

      // Simple app health metrics
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;

      res.json({
        status: dbHealth.connected ? 'OK' : 'ERROR',
        db: dbHealth,
        uptime,
        memory: memoryUsage,
        responseTime,
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        message: 'Health check failed',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  // New extended health endpoint implementation
  private async extendedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();

      // Database health (respect DEFER_DB_INIT)
      const deferDbInit = process.env.DEFER_DB_INIT === 'true';
      const dbHealth = deferDbInit
        ? { connected: false, error: 'Initialization deferred' }
        : await this.checkDatabaseHealth();

      // Redis health
      let redis: any = {};
      try {
        const redisConnected = await redisHealthCheck();
        redis = { connected: redisConnected };
      } catch (e) {
        redis = { connected: false, error: (e as Error).message };
      }

      // Job processor health
      let jobs: any = {};
      try {
        jobs = await optimizedJobProcessor.healthCheck();
      } catch (e) {
        jobs = { healthy: false, error: (e as Error).message };
      }

      // Automation health
      let automation: any = {};
      try {
        automation = automationService.getSystemHealth();
      } catch (e) {
        automation = { initialized: false, error: (e as Error).message };
      }

      const gates = {
        queuesDisabled,
        disableScheduledTasks,
        rateLimiterDisabled,
        emailDisabled,
      };

      const uptime = process.uptime();
      const memory = process.memoryUsage();
      const responseTime = Date.now() - startTime;

      const criticalHealthy = dbHealth.connected && redis?.connected !== false;
      const status = criticalHealthy ? 'OK' : 'DEGRADED';

      res.json({
        status,
        environment: process.env.NODE_ENV,
        version: '1.0.0',
        responseTime,
        uptime,
        memory,
        gates,
        db: dbHealth,
        redis,
        jobs,
        automation,
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        message: 'Extended health check failed',
        error: (error as Error).message,
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
      // Robust listen with explicit error handling to avoid silent crashes
      await new Promise<void>((resolve, reject) => {
        const onListening = () => {
          console.log('[DEBUG] Listen event fired (server is listening)');
          this.isReady = true;
          logger.info(`🚀 CLMS Backend Server running on port ${port}`);
          logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
          logger.info(`🔗 Health check: http://localhost:${port}/health`);
          logger.info(`🔎 Readiness: http://localhost:${port}/ready`);
          logger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
          logger.info('✅ Backend started successfully (Simplified)');
          resolve();
        };

        const onError = (err: any) => {
          console.log('[DEBUG] Listen error event fired:', err);
          logger.error('HTTP server listen error', {
            port,
            code: err?.code,
            message: err?.message,
            stack: err?.stack,
          });
          reject(err);
        };

        this.httpServer!.once('listening', onListening);
        this.httpServer!.once('error', onError);

        try {
          // Bind to IPv4 explicitly to avoid platform-specific dual-stack quirks
          this.httpServer!.listen(port, '0.0.0.0');
        } catch (syncError: any) {
          console.log('[DEBUG] Synchronous listen throw:', syncError);
          onError(syncError);
        }
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