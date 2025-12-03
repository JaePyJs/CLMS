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

      // Clear active sessions on startup for clean slate
      await clearActiveSessionsOnStartup();
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
      // SQLite version query (not MySQL's SELECT version())
      const result = await this.client.$queryRaw<
        Array<{ sqlite_version: string }>
      >`
        SELECT sqlite_version() as sqlite_version
      `;

      return {
        isConnected: this.isConnected,
        version: result[0]?.sqlite_version
          ? `SQLite ${result[0].sqlite_version}`
          : null,
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

/**
 * Clear all active sessions on server startup
 * This ensures a clean slate when the server restarts
 */
export async function clearActiveSessionsOnStartup(): Promise<void> {
  try {
    // Clear all student activity sessions that are ACTIVE
    const result = await prisma.student_activities.updateMany({
      where: {
        status: 'ACTIVE',
      },
      data: {
        status: 'COMPLETED',
        end_time: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info(`🧹 Cleared ${result.count} active sessions on startup`);
    } else {
      logger.info('✅ No active sessions to clear on startup');
    }

    // Also clear any equipment that is stuck in IN_USE status
    const equipmentResult = await prisma.equipment.updateMany({
      where: {
        status: 'IN_USE',
      },
      data: {
        status: 'AVAILABLE',
      },
    });

    if (equipmentResult.count > 0) {
      logger.info(
        `🧹 Reset ${equipmentResult.count} equipment from IN_USE to AVAILABLE on startup`,
      );
    }

    // Ensure default library sections exist
    await ensureDefaultLibrarySections();
  } catch (error) {
    logger.error('Failed to clear active sessions on startup:', error);
    // Don't throw - server should continue even if cleanup fails
  }
}

/**
 * Ensure default library sections exist
 * Creates LIBRARY, COMPUTER, and STUDY sections if they don't exist
 */
async function ensureDefaultLibrarySections(): Promise<void> {
  const defaults = [
    { code: 'LIBRARY', name: 'Library', description: 'Main library area' },
    {
      code: 'COMPUTER',
      name: 'Computer Area',
      description: 'Computer lab section',
    },
    { code: 'STUDY', name: 'Study Area', description: 'Quiet study section' },
  ];

  for (const section of defaults) {
    try {
      const existing = await prisma.library_sections.findUnique({
        where: { code: section.code },
      });
      if (!existing) {
        await prisma.library_sections.create({
          data: {
            code: section.code,
            name: section.name,
            description: section.description,
            is_active: true,
          },
        });
        logger.info(`📚 Created default library section: ${section.name}`);
      }
    } catch (error) {
      logger.error(`Failed to ensure section ${section.code}:`, error);
    }
  }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Received SIGINT, closing database connection...');
  void config.disconnect().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, closing database connection...');
  void config.disconnect().then(() => process.exit(0));
});

export default config;
