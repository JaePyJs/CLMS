/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './env';
import { logger } from '../utils/logger';

// Prisma client configuration
const prismaConfig: any = {
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
  log: isDevelopment() ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
};

// Global Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with singleton pattern
const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient(prismaConfig);

  // Add query logging in development
  if (isDevelopment()) {
    (client as any).$on('query', (e: any) => {
      logger.debug('Prisma Query:', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  }

  return client;
};

// Use global instance in development to prevent multiple connections
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (isDevelopment()) {
  globalThis.__prisma = prisma;
}

// Database configuration class
export class DatabaseConfig {
  private static instance: DatabaseConfig;
  private client: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.client = prisma;
  }

  public static getInstance(): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig();
    }
    return DatabaseConfig.instance;
  }

  public getClient(): PrismaClient {
    return this.client;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.$connect();
      this.isConnected = true;
      logger.info('✅ Database connected successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Database connection failed:', error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.$disconnect();
      this.isConnected = false;
      logger.info('🔌 Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      this.isConnected = true;
      logger.info('🔍 Database connection test successful');
      return true;
    } catch (error) {
      this.isConnected = false;
      logger.error('🔍 Database connection test failed:', error);
      return false;
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async getStats(): Promise<{
    isConnected: boolean;
    version: string | null;
    uptime: number;
  }> {
    try {
      const result = await this.client.$queryRaw<Array<{ version: string }>>`
        SELECT version() as version
      `;

      return {
        isConnected: this.isConnected,
        version: result[0]?.version || null,
        uptime: process.uptime(),
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {
        isConnected: false,
        version: null,
        uptime: process.uptime(),
      };
    }
  }

  // Transaction helper
  public async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.client.$transaction(fn);
  }

  // Health check for monitoring
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      responseTime: number;
      error?: string;
    };
  }> {
    const startTime = Date.now();

    try {
      await this.client.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        details: {
          connected: true,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'unhealthy',
        details: {
          connected: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

// Export singleton instance
export const config = DatabaseConfig.getInstance();

// Export a simple connect function for backward compatibility
export const connectDatabase = async (): Promise<void> => {
  await DatabaseConfig.getInstance().connect();
};

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Received SIGINT, closing database connection...');
  void config.disconnect().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, closing database connection...');
  void config.disconnect().then(() => process.exit(0));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  void config.disconnect().then(() => process.exit(1));
});

export default config;
