console.log('[DEBUG WORKING APP] Starting working app...');

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

// Import only essential utilities
import { logger } from '@/utils/logger';
import {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from '@/utils/errors';

// Import only essential routes
import authRoutes from '@/routes/auth';

console.log('[DEBUG WORKING APP] All imports completed');

export class WorkingCLMSApplication {
  private app: Application;
  private httpServer: HttpServer | null = null;
  private prisma: PrismaClient;
  private isInitialized = false;

  constructor() {
    console.log('[DEBUG WORKING APP] Constructor called');
    this.app = express();
    this.prisma = new PrismaClient();
    console.log('[DEBUG WORKING APP] Constructor completed');
  }

  async initialize(): Promise<void> {
    console.log('[DEBUG WORKING APP] initialize() called');
    if (this.isInitialized) {
      console.log('[DEBUG WORKING APP] Already initialized');
      return;
    }

    try {
      console.log('[DEBUG WORKING APP] Starting initialization...');
      logger.info('Initializing Working CLMS Application...');

      // Setup global error handlers
      console.log('[DEBUG WORKING APP] Setting up global error handlers');
      setupGlobalErrorHandlers();

      // Setup basic middleware
      console.log('[DEBUG WORKING APP] Setting up basic middleware');
      this.setupBasicMiddleware();

      // Setup rate limiting
      console.log('[DEBUG WORKING APP] Setting up rate limiting');
      this.setupRateLimiting();

      // Setup CORS
      console.log('[DEBUG WORKING APP] Setting up CORS');
      this.setupCORS();

      // Setup routes
      console.log('[DEBUG WORKING APP] Setting up routes');
      this.setupRoutes();

      // Setup error handling
      console.log('[DEBUG WORKING APP] Setting up error handling');
      this.setupErrorHandling();

      // Test database connection
      console.log('[DEBUG WORKING APP] Testing database connection');
      await this.prisma.$connect();
      logger.info('Database connection established');

      // Create HTTP server
      console.log('[DEBUG WORKING APP] Creating HTTP server');
      this.httpServer = createHttpServer(this.app);

      // Setup graceful shutdown
      console.log('[DEBUG WORKING APP] Setting up graceful shutdown');
      this.setupGracefulShutdown();

      this.isInitialized = true;
      console.log('[DEBUG WORKING APP] Initialization completed');
      logger.info('Working CLMS Application initialized successfully');
    } catch (error) {
      console.log('[DEBUG WORKING APP] Error in initialization:', error);
      logger.error('Failed to initialize Working CLMS Application', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private setupBasicMiddleware(): void {
    // Basic security middleware
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
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    console.log('[DEBUG WORKING APP] Basic middleware configured');
  }

  private setupRateLimiting(): void {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use('/api', limiter);
    console.log('[DEBUG WORKING APP] Rate limiting configured');
  }

  private setupCORS(): void {
    // CORS is already set up in setupBasicMiddleware
    console.log('[DEBUG WORKING APP] CORS configured');
  }

  private setupRoutes(): void {
    console.log('[DEBUG WORKING APP] setupRoutes() called');

    // Health check endpoint
    this.app.get('/health', this.healthCheck.bind(this));

    // Basic API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS API v1.0.0 - Working Version',
        endpoints: {
          auth: '/api/auth',
          health: '/health',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS Working API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        documentation: '/api-docs',
      });
    });

    // Auth routes
    this.app.use('/api/auth', authRoutes);

    console.log('[DEBUG WORKING APP] Routes setup completed');
  }

  private setupErrorHandling(): void {
    console.log('[DEBUG WORKING APP] setupErrorHandling() called');
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
    console.log('[DEBUG WORKING APP] Error handling setup completed');
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: 'connected',
        },
        system: {
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
        },
      };

      res.json(health);
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }

  private setupGracefulShutdown(): void {
    console.log('[DEBUG WORKING APP] setupGracefulShutdown() called');
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      try {
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

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    console.log('[DEBUG WORKING APP] Graceful shutdown setup completed');
  }

  getApp(): Application {
    return this.app;
  }

  async start(port: number = 3001): Promise<void> {
    console.log('[DEBUG WORKING APP] start() called with port:', port);
    try {
      console.log('[DEBUG WORKING APP] About to call initialize()');
      await this.initialize();
      console.log('[DEBUG WORKING APP] Initialization complete');

      if (!this.httpServer) {
        throw new Error('HTTP server not initialized');
      }

      console.log('[DEBUG WORKING APP] About to call httpServer.listen()');
      await new Promise<void>((resolve) => {
        this.httpServer!.listen(port, () => {
          console.log('[DEBUG WORKING APP] Listen callback fired!');
          logger.info(`🚀 CLMS Working Backend Server running on port ${port}`);
          logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
          logger.info(`🔗 Health check: http://localhost:${port}/health`);
          logger.info(`📚 Library: ${process.env.LIBRARY_NAME || 'CLMS Library'}`);
          resolve();
        });
      });
      console.log('[DEBUG WORKING APP] After listen promise');
    } catch (error) {
      console.log('[DEBUG WORKING APP] Error in start():', error);
      logger.error('Failed to start working server', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Working CLMS Application...');
    try {
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }
      await this.prisma.$disconnect();
      logger.info('Working CLMS Application shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown', {
        error: (error as Error).message,
      });
    }
  }
}

// Create and export application instance
export const workingApp = new WorkingCLMSApplication();

export default workingApp;