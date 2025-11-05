import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import authRoutes from './auth';
import userRoutes from './users';
import bookRoutes from './books';
import borrowRoutes from './borrows';
import studentRoutes from './students';
import equipmentRoutes from './equipment';
import equipmentAutomationRoutes from './equipmentAutomation';
import analyticsRoutes from './analytics';
import importRoutes from './import';
import updateRoutes from './update';
import selfServiceRoutes from './selfService';
import settingsRoutes from './settings';
import attendanceExportRoutes from './attendanceExport';
import errorLogsRoutes from './errorLogs';
import notificationsRoutes from './notifications';

const router = Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/equipment/automation', equipmentAutomationRoutes);
router.use('/borrows', borrowRoutes);
router.use('/students', studentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/import', importRoutes);
router.use('/update', updateRoutes);
router.use('/self-service', selfServiceRoutes);
router.use('/settings', settingsRoutes);
router.use('/attendance-export', attendanceExportRoutes);
router.use('/logs', errorLogsRoutes);
router.use('/notifications', notificationsRoutes);

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API information endpoint
router.get('/info', (_req: Request, res: Response) => {
  return res.status(200).json({
    name: 'CLMS Backend API',
    description: 'Comprehensive Library Management System Backend',
    version: process.env['npm_package_version'] || '1.0.0',
    environment: env['NODE_ENV'],
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      books: '/api/books',
      borrows: '/api/borrows',
      students: '/api/students',
      equipment: '/api/equipment',
      analytics: '/api/analytics',
      import: '/api/import',
      update: '/api/update',
      selfService: '/api/self-service',
      settings: '/api/settings',
      attendanceExport: '/api/attendance-export',
      logs: '/api/logs',
      notifications: '/api/notifications',
    },
    features: {
      authentication: 'JWT-based auth with RBAC',
      database: 'Prisma ORM with MySQL',
      websocket: 'Real-time communication',
      updates: 'One-click auto-update system',
      import: 'CSV import/export functionality',
      analytics: 'Comprehensive reporting',
      errorLogging: 'Real-time error monitoring and logging',
    },
  });
});

export { router as apiRoutes };
