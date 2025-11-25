import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import { CacheService } from '../services/cacheService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check endpoint
 *     description: Returns system health status including database, cache, and memory metrics
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     responseTime:
 *                       type: number
 *                 cache:
 *                   type: object
 *                 memory:
 *                   type: object
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    // Check database connectivity
    let dbConnected = false;
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStart;
      dbConnected = true;
    } catch (error) {
      logger.error('Health check: Database connection failed', error);
    }

    // Check cache connectivity
    const cacheStats = await CacheService.getStats();

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memory = {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    };

    const health = {
      status: dbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      responseTime: Date.now() - startTime,
      database: {
        connected: dbConnected,
        responseTime: dbResponseTime,
      },
      cache: cacheStats,
      memory,
      version: process.env.npm_package_version || '1.0.3',
      environment: process.env.NODE_ENV || 'development',
    };

    const statusCode = dbConnected ? 200 : 503;
    res.status(statusCode).json(health);
  }),
);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     tags: [System]
 *     summary: Readiness check
 *     description: Check if system is ready to accept traffic
 *     responses:
 *       200:
 *         description: System is ready
 *       503:
 *         description: System is not ready
 */
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      logger.error('Readiness check failed', error);
      res
        .status(503)
        .json({ status: 'not ready', error: 'Database not available' });
    }
  }),
);

/**
 * @swagger
 * /health/live:
 *   get:
 *     tags: [System]
 *     summary: Liveness check
 *     description: Check if application is alive (always returns 200)
 *     responses:
 *       200:
 *         description: Application is alive
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
