import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { analyticsService } from './analyticsService';
import { transporter } from '@/utils/email';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

export interface ReportConfig {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'on_demand';
  recipients: string[];
  includeInsights: boolean;
  includeForecasts: boolean;
  includeHeatMaps: boolean;
  format: 'html' | 'pdf' | 'json';
  is_active: boolean;
  schedule?: string; // Cron expression
  filters?: {
    gradeLevel?: string;
    activityType?: string;
    resourceType?: string;
  };
}

export interface AlertConfig {
  id: string;
  name: string;
  type: 'usage_spike' | 'resource_shortage' | 'anomaly_detected' | 'system_health';
  threshold: number;
  operators: 'greater_than' | 'less_than' | 'equals';
  recipients: string[];
  is_active: boolean;
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
}

export interface GeneratedReport {
  id: string;
  configId: string;
  name: string;
  type: string;
  generated_at: Date;
  filePath?: string;
  summary: string;
  insights: any[];
  metrics: any;
  status: 'generating' | 'completed' | 'failed';
}

class ReportingService {
  private activeReports: Map<string, NodeJS.Timeout> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  /**
   * Initialize scheduled reports
   */
  async initializeScheduledReports(): Promise<void> {
    try {
      const reportConfigs = await this.getReportConfigs();

      for (const config of reportConfigs.filter(c => c.is_active)) {
        if (config.type === 'daily') {
          this.scheduleReport(config, '0 8 * * *'); // 8 AM daily
        } else if (config.type === 'weekly') {
          this.scheduleReport(config, '0 8 * * 1'); // 8 AM Monday
        } else if (config.type === 'monthly') {
          this.scheduleReport(config, '0 8 1 * *'); // 8 AM first day of month
        } else if (config.schedule) {
          this.scheduleReport(config, config.schedule);
        }
      }

      logger.info(`Initialized ${reportConfigs.length} report configurations`);
    } catch (error) {
      logger.error('Failed to initialize scheduled reports', { error: (error as Error).message });
    }
  }

  /**
   * Initialize monitoring for alerts
   */
  async initializeAlertMonitoring(): Promise<void> {
    try {
      const alertConfigs = await this.getAlertConfigs();

      // Set up monitoring every 5 minutes
      setInterval(async () => {
        await this.checkAlerts(alertConfigs.filter(c => c.is_active));
      }, 5 * 60 * 1000);

      logger.info(`Initialized ${alertConfigs.length} alert configurations`);
    } catch (error) {
      logger.error('Failed to initialize alert monitoring', { error: (error as Error).message });
    }
  }

  /**
   * Generate a comprehensive analytics report
   */
  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info(`Generating report: ${config.name} (${reportId})`);

      // Generate analytics data
      const insights = config.includeInsights ? await analyticsService.generatePredictiveInsights('week') : [];
      const forecasts = config.includeForecasts ? await analyticsService.generateResourceForecasts('week') : [];
      const heatMapData = config.includeHeatMaps ? await analyticsService.generateUsageHeatMap('week') : [];

      // Get base metrics
      const metrics = await this.getReportMetrics(config.filters);

      // Generate summary
      const summary = this.generateReportSummary(insights, metrics, forecasts);

      // Create report object
      const report: GeneratedReport = {
        id: reportId,
        configId: config.id,
        name: config.name,
        type: config.type,
        generated_at: new Date(),
        summary,
        insights,
        metrics,
        status: 'completed'
      };

      // Generate file if requested
      if (config.format !== 'json') {
        report.filePath = await this.generateReportFile(report, config.format);
      }

      // Save report to database
      await this.saveReportToDatabase(report);

      // Send email if recipients are configured
      if (config.recipients.length > 0) {
        await this.sendReportEmail(report, config);
      }

      logger.info(`Report generated successfully: ${config.name} (${reportId})`);
      return report;

    } catch (error) {
      logger.error(`Failed to generate report: ${config.name}`, { error: (error as Error).message, reportId });

      const failedReport: GeneratedReport = {
        id: reportId,
        configId: config.id,
        name: config.name,
        type: config.type,
        generated_at: new Date(),
        summary: 'Report generation failed',
        insights: [],
        metrics: {},
        status: 'failed'
      };

      await this.saveReportToDatabase(failedReport);
      throw error;
    }
  }

  /**
   * Check and trigger alerts based on conditions
   */
  async checkAlerts(alertConfigs: AlertConfig[]): Promise<void> {
    const now = new Date();

    for (const alertConfig of alertConfigs) {
      try {
        // Check cooldown period
        const lastTriggered = this.alertCooldowns.get(alertConfig.id);
        if (lastTriggered && (now.getTime() - lastTriggered.getTime()) < alertConfig.cooldownPeriod * 60 * 1000) {
          continue;
        }

        const shouldTrigger = await this.evaluateAlertCondition(alertConfig);

        if (shouldTrigger) {
          await this.triggerAlert(alertConfig);
          this.alertCooldowns.set(alertConfig.id, now);
        }

      } catch (error) {
        logger.error(`Failed to check alert: ${alertConfig.name}`, { error: (error as Error).message });
      }
    }
  }

  /**
   * Create a new report configuration
   */
  async createReportConfig(config: Omit<ReportConfig, 'id'>): Promise<ReportConfig> {
    try {
      const newConfig: ReportConfig = {
        ...config,
        id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      await this.saveReportConfig(newConfig);

      // Schedule if active
      if (newConfig.is_active && newConfig.type !== 'on_demand') {
        if (newConfig.type === 'daily') {
          this.scheduleReport(newConfig, '0 8 * * *');
        } else if (newConfig.type === 'weekly') {
          this.scheduleReport(newConfig, '0 8 * * 1');
        } else if (newConfig.type === 'monthly') {
          this.scheduleReport(newConfig, '0 8 1 * *');
        } else if (newConfig.schedule) {
          this.scheduleReport(newConfig, newConfig.schedule);
        }
      }

      logger.info(`Created report configuration: ${newConfig.name}`);
      return newConfig;

    } catch (error) {
      logger.error('Failed to create report configuration', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create a new alert configuration
   */
  async createAlertConfig(config: Omit<AlertConfig, 'id'>): Promise<AlertConfig> {
    try {
      const newConfig: AlertConfig = {
        ...config,
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      await this.saveAlertConfig(newConfig);
      logger.info(`Created alert configuration: ${newConfig.name}`);
      return newConfig;

    } catch (error) {
      logger.error('Failed to create alert configuration', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get report history
   */
  async getReportHistory(limit: number = 50, offset: number = 0): Promise<GeneratedReport[]> {
    try {
      // This would typically query a database table for reports
      // For now, return a mock implementation
      return [];
    } catch (error) {
      logger.error('Failed to get report history', { error: (error as Error).message });
      throw error;
    }
  }

  // Private helper methods

  private async getReportConfigs(): Promise<ReportConfig[]> {
    // This would typically query a database table for report configurations
    // For now, return default configurations
    return [
      {
        id: 'default_daily',
        name: 'Daily Analytics Summary',
        type: 'daily',
        recipients: ['admin@library.edu'],
        includeInsights: true,
        includeForecasts: false,
        includeHeatMaps: false,
        format: 'html',
        is_active: true
      },
      {
        id: 'default_weekly',
        name: 'Weekly Analytics Report',
        type: 'weekly',
        recipients: ['admin@library.edu', 'manager@library.edu'],
        includeInsights: true,
        includeForecasts: true,
        includeHeatMaps: true,
        format: 'html',
        is_active: true
      }
    ];
  }

  private async getAlertConfigs(): Promise<AlertConfig[]> {
    // This would typically query a database table for alert configurations
    // For now, return default configurations
    return [
      {
        id: 'high_usage_alert',
        name: 'High Usage Alert',
        type: 'usage_spike',
        threshold: 100,
        operators: 'greater_than',
        recipients: ['admin@library.edu'],
        is_active: true,
        cooldownPeriod: 30
      },
      {
        id: 'resource_shortage_alert',
        name: 'Resource Shortage Alert',
        type: 'resource_shortage',
        threshold: 80,
        operators: 'greater_than',
        recipients: ['admin@library.edu'],
        is_active: true,
        cooldownPeriod: 15
      }
    ];
  }

  private scheduleReport(config: ReportConfig, cronExpression: string): void {
    // Simple scheduling implementation - in production, use a proper cron library
    logger.info(`Scheduled report: ${config.name} with cron: ${cronExpression}`);

    // For demo purposes, schedule for next execution based on type
    let delayMs: number;

    switch (config.type) {
      case 'daily':
        delayMs = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'weekly':
        delayMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'monthly':
        delayMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        delayMs = 24 * 60 * 60 * 1000; // Default to daily
    }

    const timeout = setTimeout(async () => {
      try {
        await this.generateReport(config);
        // Reschedule for next execution
        this.scheduleReport(config, cronExpression);
      } catch (error) {
        logger.error(`Scheduled report failed: ${config.name}`, { error: (error as Error).message });
      }
    }, delayMs);

    this.activeReports.set(config.id, timeout);
  }

  private async getReportMetrics(filters?: any): Promise<any> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalStudents, activeStudents, todayActivities, weekActivities] = await Promise.all([
      prisma.students.count(),
      prisma.students.count({ where: { is_active: true } }),
      prisma.student_activities.count({
        where: {
          start_time: { gte: todayStart },
          ...(filters?.activity_type && { activity_type: filters.activity_type })
        }
      }),
      prisma.student_activities.count({
        where: {
          start_time: { gte: weekStart },
          ...(filters?.activity_type && { activity_type: filters.activity_type })
        }
      })
    ]);

    return {
      students: { total: totalStudents, active: activeStudents },
      activities: { today: todayActivities, week: weekActivities },
      generated_at: now.toISOString()
    };
  }

  private generateReportSummary(insights: any[], metrics: any, forecasts: any[]): string {
    const highImpactInsights = insights.filter((i: any) => i.impact === 'high');
    const avgConfidence = insights.reduce((sum: number, i: any) => sum + i.confidence, 0) / insights.length || 0;

    return `
Analytics Report Summary
========================

Generated: ${new Date().toLocaleString()}

Key Metrics:
- Total Students: ${metrics.students?.total || 0}
- Active Students: ${metrics.students?.active || 0}
- Today's Activities: ${metrics.activities?.today || 0}
- Weekly Activities: ${metrics.activities?.week || 0}

Predictive Insights:
- Total Insights: ${insights.length}
- High Priority Items: ${highImpactInsights.length}
- Average Confidence: ${Math.round(avgConfidence * 100)}%

${forecasts.length > 0 ? `
Resource Forecasts:
${forecasts.map((f: any) => `- ${f.resourceType}: ${Math.round(f.currentUtilization)}% → ${Math.round(f.predictedUtilization[f.predictedUtilization.length - 1] || 0)}%`).join('\n')}
` : ''}

${highImpactInsights.length > 0 ? `
High Priority Recommendations:
${highImpactInsights.map((i: any, index: number) => `${index + 1}. ${i.title}: ${i.description}`).join('\n')}
` : ''}

This report was automatically generated by the CLMS Analytics System.
    `.trim();
  }

  private async generateReportFile(report: GeneratedReport, format: 'html' | 'pdf'): Promise<string> {
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const fileName = `${report.name.replace(/\s+/g, '_')}_${report.id}.${format}`;
    const filePath = path.join(reportsDir, fileName);

    if (format === 'html') {
      const htmlContent = this.generateHTMLReport(report);
      await fs.writeFile(filePath, htmlContent, 'utf8');
    } else if (format === 'pdf') {
      // PDF generation would require a library like puppeteer
      // For now, create a placeholder
      await fs.writeFile(filePath, report.summary, 'utf8');
    }

    return filePath;
  }

  private generateHTMLReport(report: GeneratedReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .insight { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #007cba; }
        .high-impact { border-left-color: #d32f2f; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e3f2fd; border-radius: 3px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.name}</h1>
        <p>Generated: ${new Date(report.generated_at).toLocaleString()}</p>
        <p>Status: ${report.status}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px;">${report.summary}</pre>
    </div>

    <div class="section">
        <h2>Key Metrics</h2>
        ${Object.entries(report.metrics).map(([key, value]: [string, any]) =>
          typeof value === 'object'
            ? Object.entries(value).map(([subKey, subValue]) =>
                `<div class="metric"><strong>${key} ${subKey}:</strong> ${subValue}</div>`
              ).join('')
            : `<div class="metric"><strong>${key}:</strong> ${value}</div>`
        ).join('')}
    </div>

    ${report.insights.length > 0 ? `
    <div class="section">
        <h2>Predictive Insights</h2>
        ${report.insights.map((insight: any) => `
            <div class="insight ${insight.impact === 'high' ? 'high-impact' : ''}">
                <h3>${insight.title}</h3>
                <p><strong>Type:</strong> ${insight.type}</p>
                <p><strong>Impact:</strong> ${insight.impact}</p>
                <p><strong>Confidence:</strong> ${Math.round(insight.confidence * 100)}%</p>
                <p>${insight.description}</p>
                ${insight.recommendations.length > 0 ? `
                    <h4>Recommendations:</h4>
                    <ul>
                        ${insight.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="footer">
        <p>This report was automatically generated by the CLMS Analytics System.</p>
        <p>Report ID: ${report.id}</p>
    </div>
</body>
</html>
    `.trim();
  }

  private async saveReportToDatabase(report: GeneratedReport): Promise<void> {
    // This would typically save to a database table
    // For now, just log the report
    logger.info(`Report saved to database: ${report.id}`);
  }

  private async saveReportConfig(config: ReportConfig): Promise<void> {
    // This would typically save to a database table
    // For now, just log the configuration
    logger.info(`Report configuration saved: ${config.id}`);
  }

  private async saveAlertConfig(config: AlertConfig): Promise<void> {
    // This would typically save to a database table
    // For now, just log the configuration
    logger.info(`Alert configuration saved: ${config.id}`);
  }

  private async sendReportEmail(report: GeneratedReport, config: ReportConfig): Promise<void> {
    try {
      const emailContent = {
        from: process.env.EMAIL_FROM || 'noreply@clms.edu',
        to: config.recipients.join(', '),
        subject: `${report.name} - ${new Date(report.generated_at).toLocaleDateString()}`,
        text: report.summary,
        html: config.format === 'html' ? await fs.readFile(report.filePath || '', 'utf8') : null,
        attachments: report.filePath ? [{
          filename: `${report.name}.html`,
          path: report.filePath
        }] : undefined
      };

      await transporter.sendMail(emailContent);
      logger.info(`Report email sent: ${report.name} to ${config.recipients.join(', ')}`);

    } catch (error) {
      logger.error(`Failed to send report email: ${report.name}`, { error: (error as Error).message });
      throw error;
    }
  }

  private async evaluateAlertCondition(alertConfig: AlertConfig): Promise<boolean> {
    try {
      // Validate alertConfig before proceeding
      if (!alertConfig || typeof alertConfig !== 'object') {
        logger.error('Invalid alert configuration provided');
        return false;
      }

      let currentValue: number;

      switch (alertConfig.type) {
        case 'usage_spike':
          // Get today's activity count
          const todayActivities = await prisma.student_activities.count({
            where: {
              start_time: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            }
          });
          currentValue = todayActivities;
          break;

        case 'resource_shortage':
          // Get equipment utilization rate
          const totalEquipment = await prisma.equipment.count();
          const inUseEquipment = await prisma.equipment.count({ where: { status: 'IN_USE' } });
          currentValue = totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;
          break;

        case 'system_health':
          // Get memory usage percentage
          const memoryUsage = process.memoryUsage();
          currentValue = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
          break;

        default:
          return false;
      }

      switch (alertConfig.operators) {
        case 'greater_than':
          return currentValue > alertConfig.threshold;
        case 'less_than':
          return currentValue < alertConfig.threshold;
        case 'equals':
          return Math.abs(currentValue - alertConfig.threshold) < 0.01;
        default:
          return false;
      }

    } catch (error) {
      logger.error(`Failed to evaluate alert condition: ${alertConfig.name}`, { error: (error as Error).message });
      return false;
    }
  }

  private async triggerAlert(alertConfig: AlertConfig): Promise<void> {
    try {
      logger.info(`Triggering alert: ${alertConfig.name}`);

      const alertData = await this.getAlertData(alertConfig);
      const emailContent = {
        from: process.env.EMAIL_FROM || 'noreply@clms.edu',
        to: alertConfig.recipients.join(', '),
        subject: `🚨 Alert: ${alertConfig.name}`,
        html: this.generateAlertEmail(alertConfig, alertData)
      };

      await transporter.sendMail(emailContent);
      logger.info(`Alert email sent: ${alertConfig.name} to ${alertConfig.recipients.join(', ')}`);

    } catch (error) {
      logger.error(`Failed to trigger alert: ${alertConfig.name}`, { error: (error as Error).message });
    }
  }

  private async getAlertData(alertConfig: AlertConfig): Promise<any> {
    const now = new Date();

    switch (alertConfig.type) {
      case 'usage_spike':
        const todayActivities = await prisma.student_activities.count({
          where: {
            start_time: { gte: new Date(now.setHours(0, 0, 0, 0)) }
          }
        });
        return { current: todayActivities, threshold: alertConfig.threshold };

      case 'resource_shortage':
        const totalEquipment = await prisma.equipment.count();
        const inUseEquipment = await prisma.equipment.count({ where: { status: 'IN_USE' } });
        const utilization = totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;
        return { current: utilization, threshold: alertConfig.threshold, inUse: inUseEquipment, total: totalEquipment };

      case 'system_health':
        const memoryUsage = process.memoryUsage();
        const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        return { current: memoryPercent, threshold: alertConfig.threshold, memoryUsage };

      default:
        return {};
    }
  }

  private generateAlertEmail(alertConfig: AlertConfig, alertData: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Alert: ${alertConfig.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .alert { background: #ffebee; border: 1px solid #f44336; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .data { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="alert">
        <h1>🚨 Alert: ${alertConfig.name}</h1>
        <p><strong>Triggered:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Type:</strong> ${alertConfig.type.replace('_', ' ')}</p>
    </div>

    <div class="data">
        <h2>Alert Details</h2>
        <p><strong>Current Value:</strong> ${alertData.current}</p>
        <p><strong>Threshold:</strong> ${alertConfig.threshold}</p>
        <p><strong>Condition:</strong> ${alertConfig.operators.replace('_', ' ')} ${alertConfig.threshold}</p>

        ${alertConfig.type === 'resource_shortage' ? `
            <p><strong>Equipment In Use:</strong> ${alertData.inUse} / ${alertData.total}</p>
        ` : ''}

        ${alertConfig.type === 'system_health' ? `
            <p><strong>Memory Usage:</strong> ${Math.round(alertData.memoryUsage.heapUsed / 1024 / 1024)} MB / ${Math.round(alertData.memoryUsage.heapTotal / 1024 / 1024)} MB</p>
        ` : ''}
    </div>

    <div class="data">
        <h2>Recommended Actions</h2>
        ${this.getAlertRecommendations(alertConfig.type)}
    </div>

    <div class="footer">
        <p>This alert was automatically generated by the CLMS Monitoring System.</p>
        <p>Alert ID: ${alertConfig.id}</p>
    </div>
</body>
</html>
    `.trim();
  }

  private getAlertRecommendations(alertType: string): string {
    switch (alertType) {
      case 'usage_spike':
        return `
            <ul>
                <li>Check if additional staff resources are needed</li>
                <li>Verify all equipment is operational</li>
                <li>Review if this is expected usage or unusual activity</li>
                <li>Consider temporary access controls if resources are limited</li>
            </ul>
        `;

      case 'resource_shortage':
        return `
            <ul>
                <li>Check for equipment that may be stuck in 'in-use' status</li>
                <li>Review if maintenance is needed on any equipment</li>
                <li>Consider implementing time limits if resources are overutilized</li>
                <li>Communicate availability to users</li>
            </ul>
        `;

      case 'system_health':
        return `
            <ul>
                <li>Check system logs for unusual activity</li>
                <li>Restart services if necessary</li>
                <li>Monitor database connections</li>
                <li>Contact system administrator if issues persist</li>
            </ul>
        `;

      default:
        return '<p>Review system status and investigate the trigger condition.</p>';
    }
  }

  /**
   * Clean up scheduled reports
   */
  async cleanup(): Promise<void> {
    for (const [configId, timeout] of this.activeReports) {
      clearTimeout(timeout);
    }
    this.activeReports.clear();
    this.alertCooldowns.clear();
  }
}

export const reportingService = new ReportingService();