import { Queue, Worker } from 'bullmq';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import { redis } from '@/utils/redis';
import {
  EquipmentStatus,
  EquipmentMaintenanceType,
  EquipmentMaintenanceStatus,
  EquipmentMaintenancePriority,
  EquipmentConditionRating,
  StudentActivitiesStatus,
} from '@prisma/client';
import { equipmentService } from './enhancedEquipmentService';
import { equipmentWebSocketService } from '@/websocket/equipmentWebSocket';
import { NoopQueue, NoopWorker } from '@/utils/noopQueue';
import { queuesDisabled, disableScheduledTasks } from '@/utils/gates';

// Equipment scheduling service
export class EquipmentSchedulingService {
  private maintenanceQueue: Queue;
  private sessionQueue: Queue;
  private maintenanceWorker: Worker;
  private sessionWorker: Worker;

  constructor() {
    this.initializeQueues();
    if (!queuesDisabled) {
      this.initializeWorkers();
    } else {
      logger.warn('EquipmentSchedulingService workers not initialized: queues disabled');
    }
    if (!queuesDisabled && !disableScheduledTasks) {
      this.setupScheduledJobs();
    } else {
      logger.warn('EquipmentSchedulingService scheduled jobs not initialized: gates active', {
        queuesDisabled,
        disableScheduledTasks,
      });
    }
  }

  private initializeQueues() {
    if (queuesDisabled) {
      this.maintenanceQueue = new NoopQueue() as unknown as Queue;
      this.sessionQueue = new NoopQueue() as unknown as Queue;
      logger.warn('EquipmentSchedulingService using NoopQueue: queues disabled');
      return;
    }

    // Maintenance scheduling queue
    this.maintenanceQueue = new Queue('equipment-maintenance', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Session management queue
    this.sessionQueue = new Queue('equipment-sessions', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  }

  private initializeWorkers() {
    if (queuesDisabled) {
      this.maintenanceWorker = new NoopWorker() as unknown as Worker;
      this.sessionWorker = new NoopWorker() as unknown as Worker;
      return;
    }

    // Maintenance worker
    this.maintenanceWorker = new Worker(
      'equipment-maintenance',
      async (job) => {
        await this.processMaintenanceJob(job);
      },
      {
        connection: redis,
        concurrency: 2,
      }
    );

    this.maintenanceWorker.on('completed', (job) => {
      logger.info('Maintenance job completed', {
        jobId: job.id,
        equipmentId: job.data.equipmentId,
        type: job.data.maintenanceType,
      });
    });

    this.maintenanceWorker.on('failed', (job, err) => {
      logger.error('Maintenance job failed', {
        jobId: job.id,
        equipmentId: job.data.equipmentId,
        error: err.message,
      });
    });

    // Session worker
    this.sessionWorker = new Worker(
      'equipment-sessions',
      async (job) => {
        await this.processSessionJob(job);
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    this.sessionWorker.on('completed', (job) => {
      logger.info('Session job completed', {
        jobId: job.id,
        activityId: job.data.activityId,
        action: job.data.action,
      });
    });

    this.sessionWorker.on('failed', (job, err) => {
      logger.error('Session job failed', {
        jobId: job.id,
        activityId: job.data.activityId,
        error: err.message,
      });
    });
  }

  private setupScheduledJobs() {
    if (queuesDisabled || disableScheduledTasks) {
      return;
    }
    // Schedule routine maintenance checks
    this.scheduleRoutineMaintenance();

    // Schedule session expiry checks
    this.scheduleSessionExpiryChecks();

    // Schedule daily usage statistics
    this.scheduleDailyStatistics();

    // Schedule maintenance reminders
    this.scheduleMaintenanceReminders();

    // Schedule equipment health checks
    this.scheduleHealthChecks();
  }

  // Maintenance scheduling
  public async scheduleMaintenance(
    equipmentId: string,
    maintenanceType: EquipmentMaintenanceType,
    scheduledDate: Date,
    priority: EquipmentMaintenancePriority = EquipmentMaintenancePriority.NORMAL,
    options: {
      estimatedDuration?: number;
      vendor?: string;
      cost?: number;
      description?: string;
      warrantyClaim?: boolean;
    } = {}
  ) {
    const maintenance = await equipmentService.createMaintenance({
      equipmentId,
      maintenanceType,
      description: options.description,
      cost: options.cost,
      vendor: options.vendor,
      scheduledDate,
      priority,
      estimatedDuration: options.estimatedDuration,
      warrantyClaim: options.warrantyClaim || false,
    });

    // Schedule the maintenance job
    await this.maintenanceQueue.add(
      'scheduled-maintenance',
      {
        maintenanceId: maintenance.id,
        equipmentId,
        maintenanceType,
        priority,
        scheduledDate,
      },
      {
        delay: scheduledDate.getTime() - Date.now(),
        priority: this.getPriorityNumber(priority),
      }
    );

    logger.info('Maintenance scheduled', {
      maintenanceId: maintenance.id,
      equipmentId,
      maintenanceType,
      scheduledDate,
    });

    return maintenance;
  }

  private async processMaintenanceJob(job: any) {
    const { maintenanceId, equipmentId, maintenanceType, priority } = job.data;

    try {
      // Update equipment status to maintenance
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: EquipmentStatus.MAINTENANCE },
      });

      // Update maintenance record status
      await prisma.equipment_maintenance.update({
        where: { id: maintenanceId },
        data: {
          status: EquipmentMaintenanceStatus.IN_PROGRESS,
          completed_date: new Date(),
        },
      });

      // Notify WebSocket clients
      equipmentWebSocketService.broadcastMaintenanceUpdate({
        type: 'MAINTENANCE_UPDATE',
        action: 'STARTED',
        data: {
          maintenanceId,
          equipmentId,
          maintenanceType,
          priority,
        },
        equipmentId,
        timestamp: new Date().toISOString(),
      });

      // Simulate maintenance work (in real implementation, this would be actual work)
      const maintenanceDuration = this.getMaintenanceDuration(maintenanceType);
      await this.sleep(maintenanceDuration);

      // Complete the maintenance
      await this.completeMaintenance(maintenanceId, equipmentId, maintenanceType);

    } catch (error) {
      logger.error('Error processing maintenance job', {
        error: (error as Error).message,
        maintenanceId,
        equipmentId,
      });

      // Mark maintenance as failed
      await prisma.equipment_maintenance.update({
        where: { id: maintenanceId },
        data: {
          status: EquipmentMaintenanceStatus.CANCELLED,
        },
      });

      throw error;
    }
  }

  private async completeMaintenance(
    maintenanceId: string,
    equipmentId: string,
    maintenanceType: EquipmentMaintenanceType
  ) {
    // Update maintenance record
    await prisma.equipment_maintenance.update({
      where: { id: maintenanceId },
      data: {
        status: EquipmentMaintenanceStatus.COMPLETED,
        completed_date: new Date(),
      },
    });

    // Update equipment status back to available
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        status: EquipmentStatus.AVAILABLE,
        last_maintenance: new Date(),
        next_maintenance: this.calculateNextMaintenanceDate(maintenanceType),
      },
    });

    // Update equipment condition if it was a repair
    if (maintenanceType === EquipmentMaintenanceType.REPAIR) {
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: {
          condition_rating: EquipmentConditionRating.GOOD,
        },
      });
    }

    // Notify WebSocket clients
    equipmentWebSocketService.broadcastMaintenanceUpdate({
      type: 'MAINTENANCE_UPDATE',
      action: 'COMPLETED',
      data: {
        maintenanceId,
        equipmentId,
        maintenanceType,
      },
      equipmentId,
      timestamp: new Date().toISOString(),
    });

    logger.info('Maintenance completed', {
      maintenanceId,
      equipmentId,
      maintenanceType,
    });
  }

  // Session management
  public async scheduleSessionExpiry(activityId: string, endTime: Date) {
    const delay = endTime.getTime() - Date.now();
    if (delay <= 0) return; // Already expired

    await this.sessionQueue.add(
      'session-expiry',
      {
        activityId,
        action: 'EXPIRE',
      },
      {
        delay,
        priority: 10, // High priority for session expiry
      }
    );

    logger.debug('Session expiry scheduled', {
      activityId,
      endTime,
    });
  }

  public async scheduleSessionExtension(activityId: string, additionalMinutes: number) {
    // Cancel existing expiry job
    await this.cancelSessionExpiry(activityId);

    // Get current session details
    const activity = await prisma.student_activities.findUnique({
      where: { id: activityId },
      include: { equipment: true },
    });

    if (!activity || !activity.end_time) {
      throw new Error('Activity not found or has no end time');
    }

    // Calculate new end time
    const newEndTime = new Date(activity.end_time.getTime() + additionalMinutes * 60000);

    // Update activity
    await prisma.student_activities.update({
      where: { id: activityId },
      data: {
        end_time: newEndTime,
        time_limit_minutes: (activity.time_limit_minutes || 0) + additionalMinutes,
        extensions: { increment: 1 },
      },
    });

    // Schedule new expiry
    await this.scheduleSessionExpiry(activityId, newEndTime);

    // Notify WebSocket clients
    if (activity.equipment_id) {
      equipmentWebSocketService.broadcastSessionUpdate({
        type: 'SESSION_UPDATE',
        action: 'EXTENDED',
        data: {
          activityId,
          equipmentId: activity.equipment_id,
          newEndTime,
          additionalMinutes,
        },
        equipmentId: activity.equipment_id,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Session extended', {
      activityId,
      additionalMinutes,
      newEndTime,
    });

    return newEndTime;
  }

  private async processSessionJob(job: any) {
    const { activityId, action } = job.data;

    try {
      switch (action) {
        case 'EXPIRE':
          await this.expireSession(activityId);
          break;
        case 'REMIND':
          await this.sendSessionReminder(activityId);
          break;
        default:
          logger.warn('Unknown session job action', { action, activityId });
      }
    } catch (error) {
      logger.error('Error processing session job', {
        error: (error as Error).message,
        activityId,
        action,
      });
      throw error;
    }
  }

  private async expireSession(activityId: string) {
    const activity = await prisma.student_activities.findUnique({
      where: { id: activityId },
      include: { equipment: true, student: true },
    });

    if (!activity || activity.status !== StudentActivitiesStatus.ACTIVE) {
      return; // Session already ended or doesn't exist
    }

    const now = new Date();
    const duration = activity.start_time
      ? Math.floor((now.getTime() - activity.start_time.getTime()) / 60000)
      : 0;

    // Update activity record
    await prisma.student_activities.update({
      where: { id: activityId },
      data: {
        end_time: now,
        status: StudentActivitiesStatus.EXPIRED,
        duration_minutes: duration,
        notes: (activity.notes || '') + '\n[Session automatically expired]',
      },
    });

    // Update equipment status
    if (activity.equipment_id) {
      await prisma.equipment.update({
        where: { id: activity.equipment_id },
        data: { status: EquipmentStatus.AVAILABLE },
      });

      // Notify WebSocket clients
      equipmentWebSocketService.broadcastSessionUpdate({
        type: 'SESSION_UPDATE',
        action: 'EXPIRED',
        data: {
          activityId,
          equipmentId: activity.equipment_id,
          studentName: activity.student_name,
          duration,
        },
        equipmentId: activity.equipment_id,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Session expired', {
      activityId,
      equipmentId: activity.equipment_id,
      studentId: activity.student_id,
      duration,
    });
  }

  private async sendSessionReminder(activityId: string) {
    const activity = await prisma.student_activities.findUnique({
      where: { id: activityId },
      include: { equipment: true, student: true },
    });

    if (!activity || activity.status !== StudentActivitiesStatus.ACTIVE) {
      return;
    }

    // Create notification for session reminder
    await prisma.notifications.create({
      data: {
        type: 'SYSTEM_ALERT',
        title: 'Session Ending Soon',
        message: `Your session for ${activity.equipment?.name || 'equipment'} will end in 5 minutes.`,
        priority: 'NORMAL',
        user_id: activity.student_id,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 10 * 60000), // Expire in 10 minutes
        action_url: `/equipment/${activity.equipment_id}`,
      },
    });

    logger.debug('Session reminder sent', {
      activityId,
      studentId: activity.student_id,
      equipmentId: activity.equipment_id,
    });
  }

  // Scheduled jobs
  private scheduleRoutineMaintenance() {
    // Schedule routine maintenance check daily at 2 AM
    this.maintenanceQueue.add(
      'routine-maintenance-check',
      { type: 'DAILY_CHECK' },
      {
        repeat: { pattern: '0 2 * * *' }, // Daily at 2 AM
        priority: 5,
      }
    );
  }

  private scheduleSessionExpiryChecks() {
    // Check for sessions expiring in the next 5 minutes every minute
    this.sessionQueue.add(
      'session-expiry-check',
      { type: 'UPCOMING_EXPIRY_CHECK' },
      {
        repeat: { pattern: '* * * * *' }, // Every minute
        priority: 8,
      }
    );
  }

  private scheduleDailyStatistics() {
    // Generate daily equipment usage statistics at 11:55 PM
    this.sessionQueue.add(
      'generate-daily-stats',
      { type: 'DAILY_STATISTICS' },
      {
        repeat: { pattern: '55 23 * * *' }, // Daily at 11:55 PM
        priority: 3,
      }
    );
  }

  private scheduleMaintenanceReminders() {
    // Check for maintenance reminders every 6 hours
    this.maintenanceQueue.add(
      'maintenance-reminders',
      { type: 'MAINTENANCE_REMINDERS' },
      {
        repeat: { pattern: '0 */6 * * *' }, // Every 6 hours
        priority: 4,
      }
    );
  }

  private scheduleHealthChecks() {
    // Equipment health check every hour
    this.sessionQueue.add(
      'equipment-health-check',
      { type: 'HEALTH_CHECK' },
      {
        repeat: { pattern: '0 * * * *' }, // Every hour
        priority: 2,
      }
    );
  }

  // Utility methods
  private getMaintenanceDuration(maintenanceType: EquipmentMaintenanceType): number {
    const durations = {
      [EquipmentMaintenanceType.ROUTINE]: 30 * 60 * 1000, // 30 minutes
      [EquipmentMaintenanceType.REPAIR]: 120 * 60 * 1000, // 2 hours
      [EquipmentMaintenanceType.INSPECTION]: 15 * 60 * 1000, // 15 minutes
      [EquipmentMaintenanceType.CALIBRATION]: 45 * 60 * 1000, // 45 minutes
      [EquipmentMaintenanceType.UPGRADE]: 180 * 60 * 1000, // 3 hours
      [EquipmentMaintenanceType.CLEANING]: 20 * 60 * 1000, // 20 minutes
    };

    return durations[maintenanceType] || 30 * 60 * 1000;
  }

  private calculateNextMaintenanceDate(maintenanceType: EquipmentMaintenanceType): Date {
    const intervals = {
      [EquipmentMaintenanceType.ROUTINE]: 30, // 30 days
      [EquipmentMaintenanceType.INSPECTION]: 90, // 90 days
      [EquipmentMaintenanceType.CALIBRATION]: 180, // 180 days
      [EquipmentMaintenanceType.CLEANING]: 7, // 7 days
    };

    const days = intervals[maintenanceType] || 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private getPriorityNumber(priority: EquipmentMaintenancePriority): number {
    const priorities = {
      [EquipmentMaintenancePriority.LOW]: 1,
      [EquipmentMaintenancePriority.NORMAL]: 5,
      [EquipmentMaintenancePriority.HIGH]: 8,
      [EquipmentMaintenancePriority.URGENT]: 10,
      [EquipmentMaintenancePriority.CRITICAL]: 12,
    };

    return priorities[priority] || 5;
  }

  private async cancelSessionExpiry(activityId: string) {
    // Find and remove existing expiry job
    const jobs = await this.sessionQueue.getJobs(['delayed', 'waiting']);
    for (const job of jobs) {
      if (job.data.activityId === activityId && job.data.action === 'EXPIRE') {
        await job.remove();
        break;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods
  public async getMaintenanceQueueStatus() {
    const waiting = await this.maintenanceQueue.getWaiting();
    const active = await this.maintenanceQueue.getActive();
    const completed = await this.maintenanceQueue.getCompleted();
    const failed = await this.maintenanceQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  public async getSessionQueueStatus() {
    const waiting = await this.sessionQueue.getWaiting();
    const active = await this.sessionQueue.getActive();
    const completed = await this.sessionQueue.getCompleted();
    const failed = await this.sessionQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  public async shutdown() {
    await this.maintenanceWorker.close();
    await this.sessionWorker.close();
    await this.maintenanceQueue.close();
    await this.sessionQueue.close();
  }
}

// Export singleton instance
export const equipmentSchedulingService = new EquipmentSchedulingService();