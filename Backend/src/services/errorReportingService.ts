import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { BaseError } from '@/utils/errors';
import {
  ErrorSeverity,
  ErrorCategory,
  getErrorMetrics,
  getErrorTrends,
  ErrorContext
} from '@/middleware/errorMiddleware';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  statusCode?: number;
  code?: string;
  stack?: string;
  context: ErrorContext;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  assignee?: string;
  tags: string[];
  similarErrors: number;
  impact: {
    usersAffected: number;
    requestsAffected: number;
    downtimeMinutes?: number;
  };
}

export interface ErrorReportFilter {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  resolved?: boolean;
  assignee?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  tags?: string[];
}

export interface ErrorTrend {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  categories: Record<ErrorCategory, number>;
}

export interface ErrorDashboard {
  overview: {
    totalErrors: number;
    unresolvedErrors: number;
    criticalErrors: number;
    errorsLast24h: number;
    errorRate: number;
    uptime: number;
  };
  trends: ErrorTrend[];
  topErrors: Array<{
    id: string;
    message: string;
    count: number;
    severity: ErrorSeverity;
    lastOccurred: Date;
  }>;
  categoryBreakdown: Array<{
    category: ErrorCategory;
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  severityBreakdown: Array<{
    severity: ErrorSeverity;
    count: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'new_error' | 'resolved' | 'assigned';
    message: string;
    timestamp: Date;
    user?: string;
  }>;
}

export class ErrorReportingService {
  private prisma: PrismaClient;
  private alertThresholds = {
    criticalErrorsPerHour: 5,
    errorRateThreshold: 0.05, // 5%
    duplicateErrorThreshold: 10,
  };

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createErrorReport(error: BaseError, context: ErrorContext): Promise<ErrorReport> {
    try {
      const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const similarErrors = await this.findSimilarErrors(error.message, error.category!);

      const report: ErrorReport = {
        id: errorId,
        timestamp: context.timestamp,
        message: error.message,
        category: error.category!,
        severity: error.severity!,
        statusCode: error.statusCode,
        code: error.code,
        stack: error.stack,
        context,
        resolved: false,
        tags: this.generateErrorTags(error, context),
        similarErrors: similarErrors.length,
        impact: await this.calculateErrorImpact(error, context),
      };

      // Store in database
      await this.prisma.audit_logs.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          action: 'ERROR_REPORT',
          id: context.id,
          details: {
            errorId: report.id,
            error: report,
            context,
          },
          severity: this.mapSeverityToAuditSeverity(report.severity),
        },
      });

      // Check for alert conditions
      await this.checkAlertConditions(report);

      logger.info('Error report created', { errorId, category: report.category, severity: report.severity });

      return report;
    } catch (reportingError) {
      logger.error('Failed to create error report', { error: reportingError });
      throw new Error(`Error reporting failed: ${reportingError.message}`);
    }
  }

  async getErrorReports(filter: ErrorReportFilter = {}): Promise<ErrorReport[]> {
    try {
      const whereClause: Prisma.AuditLogWhereInput = {
        action: 'ERROR_REPORT',
      };

      if (filter.startDate || filter.endDate) {
        whereClause.created_at = {};
        if (filter.startDate) {
          whereClause.created_at.gte = filter.startDate;
        }
        if (filter.endDate) {
          whereClause.created_at.lte = filter.endDate;
        }
      }

      if (filter.search) {
        whereClause.details = {
          path: ['error', 'message'],
          string_contains: filter.search,
        };
      }

      const logs = await this.prisma.audit_logs.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        take: 1000, // Limit for performance
      });

      return logs
        .map(log => log.details?.error as ErrorReport)
        .filter(Boolean)
        .filter(error => {
          if (filter.category && error.category !== filter.category) return false;
          if (filter.severity && error.severity !== filter.severity) return false;
          if (filter.resolved !== undefined && error.resolved !== filter.resolved) return false;
          if (filter.assignee && error.assignee !== filter.assignee) return false;
          if (filter.tags && !filter.tags.some(tag => error.tags.includes(tag))) return false;
          return true;
        });
    } catch (error) {
      logger.error('Failed to get error reports', { error });
      throw new Error('Failed to retrieve error reports');
    }
  }

  async getErrorDashboard(timeframe: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<ErrorDashboard> {
    try {
      const now = new Date();
      const startDate = this.getStartDateFromTimeframe(timeframe, now);

      const reports = await this.getErrorReports({
        startDate,
        endDate: now,
      });

      const metrics = getErrorMetrics();
      const trends = getErrorTrends();

      return {
        overview: {
          totalErrors: metrics.totalErrors,
          unresolvedErrors: reports.filter(r => !r.resolved).length,
          criticalErrors: reports.filter(r => r.severity === ErrorSeverity.CRITICAL).length,
          errorsLast24h: this.getErrorsInLastHours(reports, 24),
          errorRate: this.calculateErrorRate(metrics),
          uptime: this.calculateUptime(reports, timeframe),
        },
        trends: this.generateTrendData(reports, timeframe),
        topErrors: this.getTopErrors(reports),
        categoryBreakdown: trends.categoryBreakdown.map(cat => ({
          ...cat,
          trend: this.calculateTrend(cat.category, reports),
        })),
        severityBreakdown: trends.severityBreakdown,
        recentActivity: await this.getRecentActivity(startDate, now),
      };
    } catch (error) {
      logger.error('Failed to generate error dashboard', { error });
      throw new Error('Failed to generate error dashboard');
    }
  }

  async resolveError(
    errorId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<void> {
    try {
      const log = await this.prisma.audit_logs.findFirst({
        where: {
          action: 'ERROR_REPORT',
          details: {
            path: ['error', 'id'],
            equals: errorId,
          },
        },
      });

      if (!log) {
        throw new Error(`Error report ${errorId} not found`);
      }

      const error = log.details?.error as ErrorReport;
      error.resolved = true;
      error.resolvedAt = new Date();
      error.resolvedBy = resolvedBy;
      error.resolutionNotes = resolutionNotes;

      await this.prisma.audit_logs.update({
        where: { id: log.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          details: log.details,
        },
      });

      // Create resolution activity log
      await this.prisma.audit_logs.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          action: 'ERROR_RESOLVED',
          id: resolvedBy,
          details: {
            errorId,
            resolutionNotes,
          },
        },
      });

      logger.info('Error resolved', { errorId, resolvedBy });
    } catch (error) {
      logger.error('Failed to resolve error', { errorId, error });
      throw new Error('Failed to resolve error');
    }
  }

  async assignError(errorId: string, assignee: string): Promise<void> {
    try {
      const log = await this.prisma.audit_logs.findFirst({
        where: {
          action: 'ERROR_REPORT',
          details: {
            path: ['error', 'id'],
            equals: errorId,
          },
        },
      });

      if (!log) {
        throw new Error(`Error report ${errorId} not found`);
      }

      const error = log.details?.error as ErrorReport;
      error.assignee = assignee;

      await this.prisma.audit_logs.update({
        where: { id: log.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          details: log.details,
        },
      });

      // Create assignment activity log
      await this.prisma.audit_logs.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          action: 'ERROR_ASSIGNED',
          id: assignee,
          details: {
            errorId,
            assignee,
          },
        },
      });

      logger.info('Error assigned', { errorId, assignee });
    } catch (error) {
      logger.error('Failed to assign error', { errorId, error });
      throw new Error('Failed to assign error');
    }
  }

  async exportErrorReports(
    filter: ErrorReportFilter = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const reports = await this.getErrorReports(filter);

      if (format === 'csv') {
        return this.convertToCSV(reports);
      }

      return JSON.stringify(reports, null, 2);
    } catch (error) {
      logger.error('Failed to export error reports', { error });
      throw new Error('Failed to export error reports');
    }
  }

  private async findSimilarErrors(message: string, category: ErrorCategory): Promise<ErrorReport[]> {
    try {
      const logs = await this.prisma.audit_logs.findMany({
        where: {
          action: 'ERROR_REPORT',
          details: {
            path: ['error', 'category'],
            equals: category,
          },
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        take: 100,
      });

      const reports = logs
        .map(log => log.details?.error as ErrorReport)
        .filter(Boolean);

      // Simple similarity check based on message keywords
      return reports.filter(report => {
        const messageWords = message.toLowerCase().split(' ');
        const reportWords = report.message.toLowerCase().split(' ');
        const commonWords = messageWords.filter(word => reportWords.includes(word));
        return commonWords.length >= 2; // At least 2 common words
      });
    } catch (error) {
      logger.error('Failed to find similar errors', { error });
      return [];
    }
  }

  private generateErrorTags(error: BaseError, context: ErrorContext): string[] {
    const tags: string[] = [];

    // Add category tag
    tags.push(error.category!.toLowerCase());

    // Add severity tag
    tags.push(error.severity!.toLowerCase());

    // Add endpoint tag
    if (context.url) {
      tags.push(`endpoint:${context.method.toLowerCase()}:${context.url.split('/')[1] || 'root'}`);
    }

    // Add user agent tags
    if (context.user_agent) {
      if (context.user_agent.includes('Chrome')) tags.push('browser:chrome');
      if (context.user_agent.includes('Firefox')) tags.push('browser:firefox');
      if (context.user_agent.includes('Mobile')) tags.push('mobile');
    }

    return tags;
  }

  private async calculateErrorImpact(error: BaseError, context: ErrorContext): Promise<{
    usersAffected: number;
    requestsAffected: number;
    downtimeMinutes?: number;
  }> {
    try {
      // Calculate unique users affected by similar errors in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const similarErrorLogs = await this.prisma.audit_logs.findMany({
        where: {
          action: 'ERROR_REPORT',
          created_at: { gte: oneHourAgo },
          details: {
            path: ['error', 'category'],
            equals: error.category,
          },
        },
      });

      const uniqueUsers = new Set(
        similarErrorLogs
          .map(log => log.details?.context?.id)
          .filter(Boolean)
      );

      return {
        usersAffected: uniqueUsers.size,
        requestsAffected: similarErrorLogs.length,
      };
    } catch (error) {
      logger.error('Failed to calculate error impact', { error });
      return {
        usersAffected: 1,
        requestsAffected: 1,
      };
    }
  }

  private async checkAlertConditions(report: ErrorReport): Promise<void> {
    // Check for critical error threshold
    if (report.severity === ErrorSeverity.CRITICAL) {
      const recentCriticalErrors = await this.getErrorsInLastHoursBySeverity(
        ErrorSeverity.CRITICAL,
        1
      );

      if (recentCriticalErrors >= this.alertThresholds.criticalErrorsPerHour) {
        await this.sendAlert('CRITICAL_ERROR_THRESHOLD', {
          count: recentCriticalErrors,
          threshold: this.alertThresholds.criticalErrorsPerHour,
        });
      }
    }

    // Check for duplicate errors
    if (report.similarErrors >= this.alertThresholds.duplicateErrorThreshold) {
      await this.sendAlert('DUPLICATE_ERROR_THRESHOLD', {
        message: report.message,
        count: report.similarErrors,
      });
    }
  }

  private async sendAlert(type: string, data: any): Promise<void> {
    try {
      logger.warn('Error alert triggered', { type, data });
      // Here you would integrate with your notification system
      // For example: send email, Slack notification, etc.
    } catch (error) {
      logger.error('Failed to send error alert', { type, error });
    }
  }

  private getStartDateFromTimeframe(timeframe: string, now: Date): Date {
    const timeframes = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - timeframes[timeframe as keyof typeof timeframes]);
  }

  private getErrorsInLastHours(reports: ErrorReport[], hours: number): number {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return reports.filter(r => r.timestamp >= cutoff).length;
  }

  private async getErrorsInLastHoursBySeverity(severity: ErrorSeverity, hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const logs = await this.prisma.audit_logs.findMany({
      where: {
        action: 'ERROR_REPORT',
        created_at: { gte: cutoff },
        details: {
          path: ['error', 'severity'],
          equals: severity,
        },
      },
    });

    return logs.length;
  }

  private calculateErrorRate(metrics: any): number {
    // This would ideally be calculated based on total requests
    // For now, return a mock calculation
    return metrics.totalErrors > 0 ? Math.min(metrics.totalErrors / 1000, 1) : 0;
  }

  private calculateUptime(reports: ErrorReport[], timeframe: string): number {
    const totalMinutes = {
      '1h': 60,
      '24h': 24 * 60,
      '7d': 7 * 24 * 60,
      '30d': 30 * 24 * 60,
    };

    const criticalErrors = reports.filter(r => r.severity === ErrorSeverity.CRITICAL);
    const downtimeMinutes = criticalErrors.length * 5; // Assume 5 minutes per critical error

    const total = totalMinutes[timeframe as keyof typeof totalMinutes];
    const uptime = total > 0 ? Math.max(0, (total - downtimeMinutes) / total) : 1;

    return Math.round(uptime * 100);
  }

  private generateTrendData(reports: ErrorReport[], timeframe: string): ErrorTrend[] {
    const trends: ErrorTrend[] = [];
    const startDate = this.getStartDateFromTimeframe(timeframe, new Date());

    // Generate hourly or daily trends based on timeframe
    const isHourly = timeframe === '1h' || timeframe === '24h';
    const interval = isHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    for (let date = startDate.getTime(); date < Date.now(); date += interval) {
      const periodStart = new Date(date);
      const periodEnd = new Date(date + interval);

      const periodReports = reports.filter(r =>
        r.timestamp >= periodStart && r.timestamp < periodEnd
      );

      trends.push({
        date: periodStart.toISOString(),
        total: periodReports.length,
        critical: periodReports.filter(r => r.severity === ErrorSeverity.CRITICAL).length,
        high: periodReports.filter(r => r.severity === ErrorSeverity.HIGH).length,
        medium: periodReports.filter(r => r.severity === ErrorSeverity.MEDIUM).length,
        low: periodReports.filter(r => r.severity === ErrorSeverity.LOW).length,
        categories: this.getCategoryCounts(periodReports),
      });
    }

    return trends;
  }

  private getCategoryCounts(reports: ErrorReport[]): Record<ErrorCategory, number> {
    const counts: Record<string, number> = {};

    Object.values(ErrorCategory).forEach(category => {
      counts[category] = reports.filter(r => r.category === category).length;
    });

    return counts as Record<ErrorCategory, number>;
  }

  private getTopErrors(reports: ErrorReport[]): Array<{
    id: string;
    message: string;
    count: number;
    severity: ErrorSeverity;
    lastOccurred: Date;
  }> {
    const errorGroups = reports.reduce((groups, report) => {
      const key = report.message;
      if (!groups[key]) {
        groups[key] = {
          id: report.id,
          message: report.message,
          count: 0,
          severity: report.severity,
          lastOccurred: report.timestamp,
        };
      }
      groups[key].count++;
      if (report.timestamp > groups[key].lastOccurred) {
        groups[key].lastOccurred = report.timestamp;
      }
      return groups;
    }, {} as Record<string, any>);

    return Object.values(errorGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateTrend(category: ErrorCategory, reports: ErrorReport[]): 'up' | 'down' | 'stable' {
    const now = new Date();
    const midPoint = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

    const recent = reports.filter(r => r.timestamp >= midPoint && r.category === category);
    const older = reports.filter(r => r.timestamp < midPoint && r.category === category);

    if (recent.length > older.length * 1.2) return 'up';
    if (recent.length < older.length * 0.8) return 'down';
    return 'stable';
  }

  private async getRecentActivity(startDate: Date, endDate: Date): Promise<Array<{
    id: string;
    type: 'new_error' | 'resolved' | 'assigned';
    message: string;
    timestamp: Date;
    user?: string;
  }>> {
    try {
      const logs = await this.prisma.audit_logs.findMany({
        where: {
          action: { in: ['ERROR_REPORT', 'ERROR_RESOLVED', 'ERROR_ASSIGNED'] },
          created_at: { gte: startDate, lte: endDate },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      return logs.map(log => {
        const details = log.details as any;

        if (log.action === 'ERROR_REPORT') {
          return {
            id: log.id,
            type: 'new_error' as const,
            message: `New error: ${details.error?.message || 'Unknown error'}`,
            timestamp: log.created_at,
            user: details.context?.id,
          };
        } else if (log.action === 'ERROR_RESOLVED') {
          return {
            id: log.id,
            type: 'resolved' as const,
            message: `Error resolved: ${details.errorId}`,
            timestamp: log.created_at,
            user: log.id,
          };
        } else if (log.action === 'ERROR_ASSIGNED') {
          return {
            id: log.id,
            type: 'assigned' as const,
            message: `Error assigned: ${details.errorId}`,
            timestamp: log.created_at,
            user: log.id,
          };
        }

        return null;
      }).filter(Boolean);
    } catch (error) {
      logger.error('Failed to get recent activity', { error });
      return [];
    }
  }

  private mapSeverityToAuditSeverity(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'CRITICAL';
      case ErrorSeverity.HIGH:
        return 'HIGH';
      case ErrorSeverity.MEDIUM:
        return 'MEDIUM';
      case ErrorSeverity.LOW:
        return 'LOW';
      default:
        return 'LOW';
    }
  }

  private convertToCSV(reports: ErrorReport[]): string {
    const headers = [
      'ID', 'Timestamp', 'Message', 'Category', 'Severity', 'Status',
      'Endpoint', 'User ID', 'Assignee', 'Similar Errors'
    ];

    const rows = reports.map(report => [
      report.id,
      report.timestamp.toISOString(),
      `"${report.message.replace(/"/g, '""')}"`,
      report.category,
      report.severity,
      report.resolved ? 'Resolved' : 'Open',
      report.context.url,
      report.context.id || '',
      report.assignee || '',
      report.similarErrors.toString(),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const errorReportingService = new ErrorReportingService();