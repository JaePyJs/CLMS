/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ErrorLogInput {
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  stack?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class ErrorLogService {
  /**
   * Log an error to the database
   */
  async logError(data: ErrorLogInput): Promise<void> {
    try {
      await prisma.error_logs.create({
        data: {
          level: data.level,
          message: data.message,
          stack: data.stack,
          userId: data.userId,
          endpoint: data.endpoint,
          method: data.method,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
        },
      });
    } catch (error) {
      logger.error('Failed to log error to database:', error);
    }
  }

  /**
   * Get all error logs with optional filtering
   */
  async getErrorLogs(options?: {
    level?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const where: any = {};

      if (options?.level && options.level !== 'ALL') {
        where.level = options.level;
      }

      const logs = await prisma.error_logs.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
        take: options?.limit || 1000,
      });

      return logs.map(log => ({
        id: log.id,
        timestamp: log.created_at,
        level: log.level,
        message: log.message,
        stack: log.stack,
        userId: log.userId,
        endpoint: log.endpoint,
        method: log.method,
        userAgent: log.userAgent,
      }));
    } catch (error) {
      logger.error('Failed to retrieve error logs:', error);
      return [];
    }
  }

  /**
   * Clear all error logs
   */
  async clearLogs(): Promise<{ count: number }> {
    try {
      const result = await prisma.error_logs.deleteMany({});
      logger.info(`Cleared ${result.count} error logs`);
      return { count: result.count };
    } catch (error) {
      logger.error('Failed to clear error logs:', error);
      throw error;
    }
  }

  /**
   * Get error statistics
   */
  async getStatistics() {
    try {
      const [total, errorCount, warnCount, infoCount] = await Promise.all([
        prisma.error_logs.count(),
        prisma.error_logs.count({ where: { level: 'ERROR' } }),
        prisma.error_logs.count({ where: { level: 'WARN' } }),
        prisma.error_logs.count({ where: { level: 'INFO' } }),
      ]);

      return {
        total,
        error: errorCount,
        warn: warnCount,
        info: infoCount,
      };
    } catch (error) {
      logger.error('Failed to get error statistics:', error);
      return {
        total: 0,
        error: 0,
        warn: 0,
        info: 0,
      };
    }
  }
}

export const errorLogService = new ErrorLogService();
