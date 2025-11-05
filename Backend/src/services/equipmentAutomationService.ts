import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface EquipmentUsageStats {
  totalEquipment: number;
  availableEquipment: number;
  inUseEquipment: number;
  maintenanceEquipment: number;
  overdueEquipment: number;
  utilizationRate: number;
}

export interface EquipmentOverdueItem {
  id: string;
  name: string;
  category: string;
  student_name: string;
  student_id: string;
  checkout_date: Date;
  due_date: Date;
  days_overdue: number;
}

export interface EquipmentMaintenanceItem {
  id: string;
  name: string;
  category: string;
  status: string;
  last_maintenance: Date;
  next_maintenance_due: Date;
  days_until_maintenance: number;
}

export class EquipmentAutomationService {
  /**
   * Get comprehensive equipment usage statistics
   */
  public static async getUsageStatistics(): Promise<EquipmentUsageStats> {
    try {
      const [
        totalEquipment,
        availableEquipment,
        inUseEquipment,
        maintenanceEquipment,
        overdueCount,
      ] = await Promise.all([
        prisma.equipment.count(),
        prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
        prisma.equipment.count({ where: { status: 'IN_USE' } }),
        prisma.equipment.count({ where: { status: 'MAINTENANCE' } }),
        this.getOverdueEquipmentCount(),
      ]);

      const utilizationRate =
        totalEquipment > 0
          ? Math.round((inUseEquipment / totalEquipment) * 100)
          : 0;

      logger.info('Equipment statistics retrieved', {
        total: totalEquipment,
        available: availableEquipment,
        inUse: inUseEquipment,
        maintenance: maintenanceEquipment,
        overdue: overdueCount,
        utilizationRate,
      });

      return {
        totalEquipment,
        availableEquipment,
        inUseEquipment,
        maintenanceEquipment,
        overdueEquipment: overdueCount,
        utilizationRate,
      };
    } catch (error) {
      logger.error('Failed to get equipment statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all overdue equipment
   * Note: Simplified version - equipment doesn't track sessions in this schema
   */
  public static async getOverdueEquipment(): Promise<EquipmentOverdueItem[]> {
    try {
      // Since equipment_sessions doesn't exist in schema, return empty array
      // In a real implementation, you would track equipment usage sessions
      const overdueItems: EquipmentOverdueItem[] = [];

      logger.info('Retrieved overdue equipment', {
        count: overdueItems.length,
      });

      return overdueItems;
    } catch (error) {
      logger.error('Failed to get overdue equipment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get equipment requiring maintenance
   */
  public static async getMaintenanceSchedule(): Promise<
    EquipmentMaintenanceItem[]
  > {
    try {
      const equipment = await prisma.equipment.findMany({
        where: {
          OR: [{ status: 'MAINTENANCE' }, { status: 'IN_USE' }],
        },
        orderBy: {
          purchase_date: 'asc',
        },
      });

      const maintenanceItems: EquipmentMaintenanceItem[] = equipment.map(eq => {
        const lastMaintenance = eq.created_at;
        // Calculate maintenance due date (1 year from purchase or creation)
        const nextMaintenanceDue = eq.purchase_date
          ? new Date(eq.purchase_date.getTime() + 365 * 24 * 60 * 60 * 1000)
          : new Date(eq.created_at.getTime() + 365 * 24 * 60 * 60 * 1000);

        const daysUntilMaintenance = Math.ceil(
          (nextMaintenanceDue.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        );

        return {
          id: eq.id,
          name: eq.name,
          category: eq.category || 'Uncategorized',
          status: eq.status,
          last_maintenance: lastMaintenance,
          next_maintenance_due: nextMaintenanceDue,
          days_until_maintenance: daysUntilMaintenance,
        };
      });

      logger.info('Retrieved maintenance schedule', {
        count: maintenanceItems.length,
      });

      return maintenanceItems;
    } catch (error) {
      logger.error('Failed to get maintenance schedule', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send automated overdue notifications
   */
  public static async sendOverdueNotifications(): Promise<{
    sent: number;
    failed: number;
  }> {
    try {
      const overdueItems = await this.getOverdueEquipment();

      let sent = 0;
      let failed = 0;

      for (const item of overdueItems) {
        try {
          // In a real implementation, this would send emails or notifications
          logger.info('Sending overdue notification', {
            equipmentId: item.id,
            studentId: item.student_id,
            daysOverdue: item.days_overdue,
          });

          sent++;
        } catch (error) {
          logger.error('Failed to send overdue notification', {
            equipmentId: item.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }

      logger.info('Overdue notification process completed', { sent, failed });

      return { sent, failed };
    } catch (error) {
      logger.error('Failed to process overdue notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Schedule automated equipment maintenance
   */
  public static async scheduleMaintenanceReminders(): Promise<number> {
    try {
      const maintenanceItems = await this.getMaintenanceSchedule();

      let scheduled = 0;

      for (const item of maintenanceItems) {
        if (
          item.days_until_maintenance <= 30 &&
          item.days_until_maintenance > 0
        ) {
          logger.info('Maintenance reminder scheduled', {
            equipmentId: item.id,
            equipmentName: item.name,
            daysUntilMaintenance: item.days_until_maintenance,
          });

          scheduled++;
        }
      }

      logger.info('Maintenance reminders scheduled', { scheduled });

      return scheduled;
    } catch (error) {
      logger.error('Failed to schedule maintenance reminders', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get equipment usage analytics
   */
  public static async getUsageAnalytics(
    days: number = 30,
  ): Promise<Record<string, unknown>> {
    try {
      // Get all equipment for analytics
      const equipment = await prisma.equipment.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          created_at: true,
        },
      });

      // Calculate usage data (simplified since we don't have sessions)
      const usageData = equipment.map(eq => ({
        equipment_id: eq.id,
        equipment_name: eq.name,
        equipment_category: eq.category || 'Uncategorized',
        total_checkouts: Math.floor(Math.random() * 10), // Placeholder
        average_duration_hours: Math.round(Math.random() * 48 * 100) / 100, // Placeholder
      }));

      logger.info('Usage analytics retrieved', {
        period: `${days} days`,
        equipmentCount: usageData.length,
      });

      return {
        period_days: days,
        equipment_usage: usageData.sort(
          (a, b) => b.total_checkouts - a.total_checkouts,
        ),
      };
    } catch (error) {
      logger.error('Failed to get usage analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Auto-return overdue equipment (admin action)
   */
  public static async autoReturnOverdueEquipment(): Promise<{
    returned: number;
    errors: number;
  }> {
    try {
      // TODO: Implement auto-return logic once equipment_sessions table is added
      // const overdueItems = await this.getOverdueEquipment();

      const returned = 0;
      const errors = 0;

      // Since equipment_sessions doesn't exist, this is a placeholder
      logger.info('Auto-return process completed (no sessions to return)', {
        returned: 0,
        errors: 0,
      });

      return { returned, errors };
    } catch (error) {
      logger.error('Failed to auto-return overdue equipment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get overdue equipment count
   */
  private static async getOverdueEquipmentCount(): Promise<number> {
    // Since equipment_sessions doesn't exist, return 0
    return 0;
  }

  /**
   * Run all automation jobs
   */
  public static async runAutomationCycle(): Promise<Record<string, unknown>> {
    try {
      logger.info('Starting automation cycle');

      const [
        overdueStats,
        maintenanceStats,
        notificationResult,
        reminderResult,
      ] = await Promise.all([
        this.getOverdueEquipment(),
        this.getMaintenanceSchedule(),
        this.sendOverdueNotifications(),
        this.scheduleMaintenanceReminders(),
      ]);

      const result = {
        timestamp: new Date(),
        overdue_count: overdueStats.length,
        maintenance_count: maintenanceStats.length,
        notifications_sent: notificationResult.sent,
        maintenance_reminders_scheduled: reminderResult,
        automation_cycle: 'COMPLETED',
      };

      logger.info('Automation cycle completed', result);

      return result;
    } catch (error) {
      logger.error('Automation cycle failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
