import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { requirePermission } from '@/middleware/authorization.middleware';
import { Permission } from '@/config/permissions';
import ExcelJS from 'exceljs';
import { auditService, AuditAction, AuditEntity } from '@/services/auditService';

const router = Router();
const prisma = new PrismaClient();

interface AuditLogFilters {
  performed_by?: string;
  action?: string;
  entity?: string;
  startDate?: Date;
  endDate?: Date;
  ip_address?: string;
}

interface AuditLogQuery {
  page?: string;
  limit?: string;
  performed_by?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  ip_address?: string;
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
        performed_by,
        action,
        entity,
        startDate,
        endDate,
        ip_address,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build filter conditions
      const where: any = {};

      if (performed_by) where.performed_by = performed_by;
      if (action) where.action = { contains: action };
      if (entity) where.entity = { contains: entity };
      if (ip_address) where.ip_address = { contains: ip_address };

      // Date range filter
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      // Execute query with pagination
      const [logs, total] = await Promise.all([
        prisma.audit_logs.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limitNum,
          select: {
            id: true,
            performed_by: true,
            action: true,
            entity: true,
            entity_id: true,
            ip_address: true,
            user_agent: true,
            new_values: true,
            old_values: true,
            created_at: true,
          },
        }),
        prisma.audit_logs.count({ where }),
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

      // Handle exactOptionalPropertyTypes by ensuring id is not undefined
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID parameter is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const log = await prisma.audit_logs.findUnique({
        where: { id },
      });

      if (!log) {
        res.status(404).json({
          success: false,
          error: 'Audit log not found',
          timestamp: new Date().toISOString(),
        });
        return;
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
      return;
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
      const { performed_by, action, entity, startDate, endDate } = req.query;

      // Build filter conditions
      const where: any = {};
      if (performed_by) where.performed_by = performed_by;
      if (action) where.action = { contains: action };
      if (entity) where.entity = { contains: entity };
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      // Fetch all matching logs (limit to 10,000 for export)
      const logs = await prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 10000,
      });

      // Create CSV content
      const headers = [
        'ID',
        'Performed By',
        'Action',
        'Entity',
        'Entity ID',
        'IP Address',
        'User Agent',
        'Timestamp',
      ];

      const rows = logs.map(log => [
        log.id,
        log.performed_by || '',
        log.action,
        log.entity || '',
        log.entity_id || '',
        log.ip_address || '',
        log.user_agent || '',
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
      const { performed_by, action, entity, startDate, endDate } = req.query;

      // Build filter conditions
      const where: any = {};
      if (performed_by) where.performed_by = performed_by;
      if (action) where.action = { contains: action };
      if (entity) where.entity = { contains: entity };
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      // Fetch all matching logs (limit to 10,000 for export)
      const logs = await prisma.audit_logs.findMany({
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
        { header: 'Performed By', key: 'performed_by', width: 36 },
        { header: 'Action', key: 'action', width: 30 },
        { header: 'Entity', key: 'entity', width: 20 },
        { header: 'Entity ID', key: 'entity_id', width: 36 },
        { header: 'IP Address', key: 'ip_address', width: 15 },
        { header: 'User Agent', key: 'user_agent', width: 30 },
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
          performed_by: log.performed_by || '',
          action: log.action,
          entity: log.entity || '',
          entity_id: log.entity_id || '',
          ip_address: log.ip_address || '',
          user_agent: log.user_agent || '',
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
        uniqueUsers,
        actionsByType,
        recentUnauthorized,
      ] = await Promise.all([
        prisma.audit_logs.count({ where }),
        prisma.audit_logs.groupBy({
          by: ['performed_by'],
          where,
          _count: true,
        }),
        prisma.audit_logs.groupBy({
          by: ['action'],
          where,
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
        prisma.audit_logs.findMany({
          where: {
            ...where,
            action: { contains: 'UNAUTHORIZED' },
          },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            id: true,
            performed_by: true,
            action: true,
            ip_address: true,
            created_at: true,
          },
        }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          totalLogs,
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

/**
 * GET /api/audit/stats/enhanced - Get enhanced audit statistics
 * Requires: SUPER_ADMIN or ADMIN role
 */
router.get(
  '/stats/enhanced',
  requirePermission(Permission.AUDIT_LOGS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const { timeframe = '24h' } = req.query;

      // Get enhanced statistics from audit service
      const stats = await auditService.getAuditStatistics(timeframe as '24h' | '7d' | '30d');

      const response: ApiResponse = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching enhanced audit statistics', {
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

/**
 * GET /api/audit/recent - Get recent audit logs using enhanced service
 * Requires: SUPER_ADMIN or ADMIN role
 */
router.get(
  '/recent',
  requirePermission(Permission.AUDIT_LOGS_VIEW),
  async (req: Request, res: Response) => {
    try {
      const { limit = '50' } = req.query;
      const limitNum = parseInt(limit as string);

      const logs = await auditService.getRecentAuditLogs(limitNum);

      const response: ApiResponse = {
        success: true,
        data: logs,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching recent audit logs', {
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

/**
 * POST /api/audit/log - Manual audit log entry (for special events)
 * Requires: SUPER_ADMIN role
 */
router.post(
  '/log',
  requirePermission(Permission.AUDIT_LOGS_VIEW), // Using existing permission since CREATE doesn't exist
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        action,
        entity,
        entity_id,
        details,
        metadata
      } = req.body;

      // Validate required fields
      if (!action || !entity) {
        res.status(400).json({
          success: false,
          error: 'Action and entity are required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Create audit entry
      await auditService.log({
        action,
        entity,
        entityId: entity_id,
        userName: req.user?.username || 'system',
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
        requestId: (req as any).id,
        success: true,
        newValues: details,
        metadata
      });

      const response: ApiResponse = {
        success: true,
        message: 'Audit log entry created successfully',
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error creating manual audit log', {
        error: (error as Error).message,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
);

export default router;