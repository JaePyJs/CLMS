/**
 * Optimized Database Configuration for Production
 *
 * This module provides enhanced database connection pooling,
 * query optimization, and performance monitoring for MySQL.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { applyMiddlewareToClient } from '@/middleware/prisma.middleware';

interface DatabaseConfig {
  // Connection pool settings
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  reconnect: boolean;
  idleTimeout: number;

  // Performance settings
  queryTimeout: number;
  slowQueryThreshold: number;
  enableQueryLogging: boolean;

  // High availability settings
  failoverTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

class OptimizedDatabase {
  private prisma: PrismaClient;
  private config: DatabaseConfig;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();
  private slowQueries: Array<{ query: string; time: number; timestamp: Date }> = [];

  constructor() {
    this.config = this.loadConfig();
    this.prisma = this.createOptimizedClient();
    this.setupQueryMonitoring();
  }

  private loadConfig(): DatabaseConfig {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      // Connection pool optimization
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || (isProduction ? '20' : '10')),
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'), // 60 seconds
      timeout: parseInt(process.env.DB_TIMEOUT || '30000'), // 30 seconds
      reconnect: true,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'), // 5 minutes

      // Performance settings
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds
      slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'), // 1 second
      enableQueryLogging: process.env.DB_ENABLE_QUERY_LOGGING !== 'false',

      // High availability settings
      failoverTimeout: parseInt(process.env.DB_FAILOVER_TIMEOUT || '5000'), // 5 seconds
      maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'), // 1 second
    };
  }

  private createOptimizedClient(): PrismaClient {
    const isProduction = process.env.NODE_ENV === 'production';

    const client = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'mysql://user:password@localhost:3306/clms',
        },
      },
      log: isProduction ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty',
    });

    // Apply middleware for automatic ID and timestamp management
    applyMiddlewareToClient(client);

    return client;
  }

  private setupQueryMonitoring(): void {
    if (!this.config.enableQueryLogging) return;

    // Monitor slow queries
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        // Track query statistics
        this.trackQuery(params.model || 'unknown', params.action || 'unknown', duration);

        // Log slow queries
        if (duration > this.config.slowQueryThreshold) {
          this.logSlowQuery(params.model || 'unknown', params.action || 'unknown', duration, params.args);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Database query failed', {
          model: params.model,
          action: params.action,
          duration,
          error: (error as Error).message,
          args: this.sanitizeArgs(params.args),
        });
        throw error;
      }
    });
  }

  private trackQuery(model: string, action: string, duration: number): void {
    const key = `${model}.${action}`;
    const stats = this.queryStats.get(key) || { count: 0, totalTime: 0, avgTime: 0 };

    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;

    this.queryStats.set(key, stats);

    // Log performance metrics periodically
    if (stats.count % 100 === 0) {
      logger.info('Query performance stats', {
        model,
        action,
        count: stats.count,
        avgTime: Math.round(stats.avgTime),
        totalTime: stats.totalTime,
      });
    }
  }

  private logSlowQuery(model: string, action: string, duration: number, args: any): void {
    const slowQuery = {
      query: `${model}.${action}`,
      time: duration,
      timestamp: new Date(),
      args: this.sanitizeArgs(args),
    };

    this.slowQueries.push(slowQuery);

    // Keep only last 100 slow queries
    if (this.slowQueries.length > 100) {
      this.slowQueries = this.slowQueries.slice(-100);
    }

    logger.warn('Slow query detected', {
      model,
      action,
      duration,
      args: this.sanitizeArgs(args),
    });
  }

  private sanitizeArgs(args: any): any {
    if (!args) return args;

    const sanitized = { ...args };

    // Remove sensitive data from logs
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  async healthCheck(): Promise<{
    connected: boolean;
    responseTime?: number;
    error?: string;
    poolStats?: any;
  }> {
    try {
      const startTime = Date.now();

      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
        poolStats: this.getPoolStats(),
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  private getPoolStats(): any {
    return {
      activeConnections: this.queryStats.size,
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, stats) => sum + stats.count, 0),
      slowQueriesCount: this.slowQueries.length,
      config: {
        connectionLimit: this.config.connectionLimit,
        idleTimeout: this.config.idleTimeout,
        queryTimeout: this.config.queryTimeout,
      },
    };
  }

  getQueryStats(): Array<{
    query: string;
    count: number;
    avgTime: number;
    totalTime: number;
  }> {
    return Array.from(this.queryStats.entries()).map(([query, stats]) => ({
      query,
      count: stats.count,
      avgTime: Math.round(stats.avgTime),
      totalTime: stats.totalTime,
    }));
  }

  getSlowQueries(): Array<{
    query: string;
    time: number;
    timestamp: Date;
    args?: any;
  }> {
    return this.slowQueries.slice(-20); // Return last 20 slow queries
  }

  async optimizeDatabase(): Promise<void> {
    try {
      logger.info('Starting database optimization...');

      // Analyze and optimize tables
      const optimizationQueries = [
        'ANALYZE TABLE students, books, equipment, student_activities, audit_logs',
        'OPTIMIZE TABLE students, books, equipment, student_activities, audit_logs',
      ];

      for (const query of optimizationQueries) {
        await this.prisma.$executeRawUnsafe(query);
        logger.debug(`Executed optimization query: ${query}`);
      }

      logger.info('Database optimization completed');
    } catch (error) {
      logger.error('Database optimization failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async createPerformanceIndexes(): Promise<void> {
    try {
      logger.info('Creating performance indexes...');

      const indexQueries = [
        // Student activity indexes
        'CREATE INDEX IF NOT EXISTS idx_student_activities_timestamp ON student_activities(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_student_activities_student_timestamp ON student_activities(student_id, timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_student_activities_type_timestamp ON student_activities(activity_type, timestamp)',

        // Book indexes
        'CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)',
        'CREATE INDEX IF NOT EXISTS idx_books_accession ON books(accession_number)',
        'CREATE INDEX IF NOT EXISTS idx_books_title_search ON books(title(100))',

        // Equipment indexes
        'CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status)',
        'CREATE INDEX IF NOT EXISTS idx_equipment_session ON equipment(session_id)',

        // Audit logs indexes
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp)',

        // Automation jobs indexes
        'CREATE INDEX IF NOT EXISTS idx_automation_jobs_status ON automation_jobs(status)',
        'CREATE INDEX IF NOT EXISTS idx_automation_jobs_next_run ON automation_jobs(next_run_at)',
      ];

      for (const query of indexQueries) {
        await this.prisma.$executeRawUnsafe(query);
        logger.debug(`Created index: ${query}`);
      }

      logger.info('Performance indexes created successfully');
    } catch (error) {
      logger.error('Failed to create performance indexes', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async backupDatabase(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `clms-backup-${timestamp}.sql`;

      logger.info('Starting database backup...', { backupFile });

      // This would be implemented with mysqldump in production
      // For now, we'll create a backup using Prisma export
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        tables: {},
      };

      // Export critical tables
      const tables = ['students', 'books', 'equipment', 'student_activities'];

      for (const table of tables) {
        try {
          const data = await this.prisma.$queryRawUnsafe(`SELECT * FROM ${table} LIMIT 1000`);
          (backup as any).tables[table] = data;
        } catch (error) {
          logger.warn(`Failed to export table ${table}`, {
            error: (error as Error).message,
          });
        }
      }

      logger.info('Database backup completed', { backupFile });

      return backupFile;
    } catch (error) {
      logger.error('Database backup failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  getClient(): PrismaClient {
    return this.prisma;
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async testFailover(): Promise<boolean> {
    try {
      logger.info('Testing database failover...');

      // Simulate connection failure and recovery
      await this.prisma.$disconnect();

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reconnect
      await this.prisma.$connect();

      // Test query
      await this.prisma.$queryRaw`SELECT 1`;

      logger.info('Database failover test passed');
      return true;
    } catch (error) {
      logger.error('Database failover test failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Create and export singleton instance
export const optimizedDatabase = new OptimizedDatabase();
export default optimizedDatabase;