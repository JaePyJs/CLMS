import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';
import ExcelJS from 'exceljs';

const router = Router();
const prisma = new PrismaClient();

interface AuditLogFilters {
  userId?: string;
  userRole?: string;
  action?: string;
  entity?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  ipAddress?: string;
}

interface AuditLogQuery {
  page?: string;
  limit?: string;
  userId?: string;
  userRole?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  success?: string;
  ipAddress?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * GET /api/audit - Search and filter audit logs
 * Requires: SUPER_ADMIN or ADMIN role
 */
router.get(
  '/',
  requirePermission(Permission.AUDIT_LOGS_VIEW),
  async (req: Request<{}, {}, {}, AuditLogQuery>, res: Response) => {
    try {
      const {
        page = '1',
        limit = '50',
        userId,
        userRole,
        action,
        entity,
        startDate,
        endDate,
        success,
        ipAddress,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build filter conditions
      const where: any = {};

      if (userId) where.userId = userId;
      if (userRole) where.userRole = userRole;
      if (action) where.action = { contains: action };
      if (entity) where.entity = { contains: entity };
      if (ipAddress) where.ipAddress = { contains: ipAddress };
      
      if (success !== undefined) {
        where.success = success === 'true';
      }

      // Date range filter
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      // Execute query with pagination
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limitNum,
          select: {
            id: true,
            userId: true,
            userRole: true,
            action: true,
            entity: true,
            entityId: true,
            ipAddress: true,
            userAgent: true,
            requestData: true,
            success: true,
            statusCode: true,
            duration: true,
            created_at: true,
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching audit logs', {
        error: (error as Error).message,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/audit/:id - Get specific audit log entry
 * Requires: SUPER_ADMIN or ADMIN role
 */
router.get(
  '/:id',
  requirePermission(Permission.AUDIT_LOGS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const log = await prisma.auditLog.findUnique({
        where: { id },
      });

      if (!log) {
        return res.status(404).json({
          success: false,
          error: 'Audit log not found',
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse = {
        success: true,
        data: log,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching audit log', {
        error: (error as Error).message,
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/audit/export/csv - Export audit logs to CSV
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/export/csv',
  requirePermission(Permission.AUDIT_LOGS_EXPORT),
  async (req: Request<{}, {}, {}, AuditLogQuery>, res: Response) => {
    try {
      const { userId, userRole, action, entity, startDate, endDate } = req.query;

      // Build filter conditions
      const where: any = {};
      if (userId) where.userId = userId;
      if (userRole) where.userRole = userRole;
      if (action) where.action = { contains: action };
      if (entity) where.entity = { contains: entity };
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      // Fetch all matching logs (limit to 10,000 for export)
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 10000,
      });

      // Create CSV content
      const headers = [
        'ID',
        'User ID',
        'User Role',
        'Action',
        'Entity',
        'Entity ID',
        'IP Address',
        'Success',
        'Status Code',
        'Duration (ms)',
        'Timestamp',
      ];

      const rows = logs.map(log => [
        log.id,
        log.userId || '',
        log.userRole || '',
        log.action,
        log.entity || '',
        log.entityId || '',
        log.ipAddress || '',
        log.success ? 'Yes' : 'No',
        log.statusCode || '',
        log.duration || '',
        log.created_at.toISOString(),
      ]);

      // Generate CSV
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      // Set headers for file download
      const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(csv);
    } catch (error) {
      logger.error('Error exporting audit logs to CSV', {
        error: (error as Error).message,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/audit/export/excel - Export audit logs to Excel
 * Requires: SUPER_ADMIN role
 */
router.get(
  '/export/excel',
  requirePermission(Permission.AUDIT_LOGS_EXPORT),
  async (req: Request<{}, {}, {}, AuditLogQuery>, res: Response) => {
    try {
      const { userId, userRole, action, entity, startDate, endDate } = req.query;

      // Build filter conditions
      const where: any = {};
      if (userId) where.userId = userId;
      if (userRole) where.userRole = userRole;
      if (action) where.action = { contains: action };
      if (entity) where.entity = { contains: entity };
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      // Fetch all matching logs (limit to 10,000 for export)
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 10000,
      });

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Audit Logs');

      // Define columns
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'User ID', key: 'userId', width: 36 },
        { header: 'User Role', key: 'userRole', width: 15 },
        { header: 'Action', key: 'action', width: 30 },
        { header: 'Entity', key: 'entity', width: 20 },
        { header: 'Entity ID', key: 'entityId', width: 36 },
        { header: 'IP Address', key: 'ipAddress', width: 15 },
        { header: 'Success', key: 'success', width: 10 },
        { header: 'Status Code', key: 'statusCode', width: 12 },
        { header: 'Duration (ms)', key: 'duration', width: 15 },
        { header: 'Timestamp', key: 'created_at', width: 20 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data rows
      logs.forEach(log => {
        worksheet.addRow({
          id: log.id,
          userId: log.userId || '',
          userRole: log.userRole || '',
          action: log.action,
          entity: log.entity || '',
          entityId: log.entityId || '',
          ipAddress: log.ipAddress || '',
          success: log.success ? 'Yes' : 'No',
          statusCode: log.statusCode || '',
          duration: log.duration || '',
          created_at: log.created_at.toISOString(),
        });
      });

      // Set headers for file download
      const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('Error exporting audit logs to Excel', {
        error: (error as Error).message,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/audit/stats - Get audit statistics
 * Requires: SUPER_ADMIN or ADMIN role
 */
router.get(
  '/stats/summary',
  requirePermission(Permission.AUDIT_LOGS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const where: any = {};
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate as string);
        if (endDate) where.created_at.lte = new Date(endDate as string);
      }

      // Get statistics
      const [
        totalLogs,
        successfulActions,
        failedActions,
        uniqueUsers,
        actionsByType,
        recentUnauthorized,
      ] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.count({ where: { ...where, success: true } }),
        prisma.auditLog.count({ where: { ...where, success: false } }),
        prisma.auditLog.groupBy({
          by: ['userId'],
          where,
          _count: true,
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
        prisma.auditLog.findMany({
          where: {
            ...where,
            action: { contains: 'UNAUTHORIZED' },
          },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            id: true,
            userId: true,
            action: true,
            ipAddress: true,
            created_at: true,
          },
        }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          totalLogs,
          successfulActions,
          failedActions,
          successRate: totalLogs > 0 ? (successfulActions / totalLogs) * 100 : 0,
          uniqueUsers: uniqueUsers.length,
          topActions: actionsByType.map(a => ({
            action: a.action,
            count: a._count,
          })),
          recentUnauthorizedAttempts: recentUnauthorized,
        },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching audit statistics', {
        error: (error as Error).message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
