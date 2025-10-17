import express, { Application, Request, Response } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import 'express-async-errors';

// Simple console logger to avoid potential logger issues
const simpleLogger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  debug: (message: string, meta?: any) => {
    console.log(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
  }
};

// Simple error handler
const simpleErrorHandler = (error: any, req: Request, res: Response, next: any) => {
  simpleLogger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
};

// Simple 404 handler
const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    timestamp: new Date().toISOString(),
  });
};

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
      simpleLogger.info('Initializing CLMS Application (Minimal)...');

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
      simpleLogger.info('CLMS Application initialized successfully (Minimal)');
    } catch (error) {
      simpleLogger.error('Failed to initialize CLMS Application', {
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
    this.app.use(cookieParser());

    simpleLogger.debug('Basic middleware configured');
  }

  private setupBasicRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', this.healthCheck.bind(this));

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS API is running (Minimal)',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'CLMS API v1.0.0 (Minimal)',
        endpoints: {
          health: '/health',
          auth: '/api/auth',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Simple authentication endpoint (minimal implementation)
    this.app.post('/api/auth/login', (req: Request, res: Response) => {
      const { username, password } = req.body;

      // Basic hardcoded authentication for testing
      if (username === 'admin' && password === 'librarian123') {
        res.json({
          success: true,
          data: {
            token: 'mock-jwt-token-for-testing',
            user: {
              id: '1',
              username: 'admin',
              role: 'ADMIN',
              isActive: true,
              lastLoginAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            }
          },
          message: 'Login successful',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Simple auth me endpoint
    this.app.get('/api/auth/me', (req: Request, res: Response) => {
      // For now, return mock user data
      res.json({
        success: true,
        data: {
          user: {
            id: '1',
            username: 'admin',
            role: 'ADMIN',
            isActive: true,
            lastLoginAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Add analytics endpoints for dashboard
    this.app.get('/api/analytics/metrics', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          totalStudents: 0,
          totalBooks: 0,
          totalActivities: 0,
          activeEquipment: 0,
          systemLoad: 0,
          criticalAlerts: 0
        },
        timestamp: new Date().toISOString(),
      });
    });

    this.app.get('/api/analytics/timeline', (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 10;
      res.json({
        success: true,
        data: [],
        message: `No timeline data available - using minimal backend`,
        timestamp: new Date().toISOString(),
      });
    });

    // Add self-service statistics endpoint
    this.app.get('/api/self-service/statistics', (req: Request, res: Response) => {
      const { startDate, endDate } = req.query;
      res.json({
        success: true,
        data: {
          totalStudents: 0,
          activeUsers: 0,
          totalBorrowed: 0,
          totalReturned: 0,
          overdueItems: 0,
          newRegistrations: 0
        },
        message: `No self-service statistics available - using minimal backend`,
        period: { startDate, endDate },
        timestamp: new Date().toISOString(),
      });
    });

    simpleLogger.debug('Basic routes configured');
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Error handler
    this.app.use(simpleErrorHandler);

    simpleLogger.debug('Error handling configured');
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      await this.prisma.$connect();
      simpleLogger.info('Database connection established');
    } catch (error) {
      simpleLogger.error('Failed to connect to database', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      simpleLogger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Close database connection
        await this.prisma.$disconnect();

        simpleLogger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        simpleLogger.error('Error during graceful shutdown', {
          error: (error as Error).message,
        });
        process.exit(1);
      }
    };

    // Handle signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    simpleLogger.debug('Graceful shutdown handlers configured');
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
      simpleLogger.error('Health check failed', { error: (error as Error).message });
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
      console.log('[DEBUG] Starting CLMS Application (Minimal)...');
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
          simpleLogger.info(`🚀 CLMS Backend Server running on port ${port}`);
          simpleLogger.info(`📝 Environment: ${process.env.NODE_ENV}`);
          simpleLogger.info(`🔗 Health check: http://localhost:${port}/health`);
          simpleLogger.info(`📚 Library: ${process.env.LIBRARY_NAME}`);
          simpleLogger.info('✅ Backend started successfully (Minimal)');
          resolve();
        });
      });
      console.log('[DEBUG] After listen promise');
    } catch (error) {
      console.log('[DEBUG] Error in start():', error);
      simpleLogger.error('Failed to start server', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    simpleLogger.info('Shutting down CLMS Application...');

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
      simpleLogger.info('CLMS Application shutdown complete');
    } catch (error) {
      simpleLogger.error('Error during shutdown', {
        error: (error as Error).message,
      });
    }
  }
}

// Create and export application instance
export const app = new CLMSApplication();

export default app;

// Start server if this file is run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3005', 10);
  app.start(port).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}