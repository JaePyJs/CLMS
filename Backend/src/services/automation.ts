import cron from 'node-cron';
import Bull, { Queue, QueueOptions, Job, JobOptions } from 'bull';
import Redis from 'ioredis';
import { PrismaClient, JobType, JobStatus } from '@prisma/client';
import { JobExecutionResult, JobConfig } from '@/types';
import { logger, automationLogger, performanceLogger } from '@/utils/logger';
import { googleSheetsService } from './googleSheets';
import { BaseError } from '@/utils/errors';

export class AutomationService {
  private prisma: PrismaClient;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private isInitialized = false;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Connect to Redis
      await this.redis.connect();
      logger.info('Connected to Redis for automation queues');

      // Initialize job queues
      await this.initializeQueues();

      // Load and schedule jobs from database
      await this.loadScheduledJobs();

      // Setup cleanup interval
      this.setupCleanupInterval();

      this.isInitialized = true;
      logger.info('Automation service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize automation service', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async initializeQueues(): Promise<void> {
    const queueConfigs: Array<{ name: string; options: QueueOptions }> = [
      {
        name: 'backup',
        options: {
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 20,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        },
      },
      {
        name: 'sync',
        options: {
          defaultJobOptions: {
            removeOnComplete: 5,
            removeOnFail: 10,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        },
      },
      {
        name: 'notifications',
        options: {
          defaultJobOptions: {
            removeOnComplete: 5,
            removeOnFail: 10,
            attempts: 3,
            backoff: {
              type: 'fixed',
              delay: 5000,
            },
          },
        },
      },
      {
        name: 'maintenance',
        options: {
          defaultJobOptions: {
            removeOnComplete: 3,
            removeOnFail: 5,
            attempts: 2,
            backoff: {
              type: 'fixed',
              delay: 10000,
            },
          },
        },
      },
    ];

    for (const config of queueConfigs) {
      const queue = new Bull(config.name, {
        redis: this.redis.options,
        ...config.options,
      });

      // Setup job processors
      this.setupJobProcessors(queue, config.name);

      // Setup event listeners
      this.setupQueueEventListeners(queue, config.name);

      this.queues.set(config.name, queue);
      logger.info(`Initialized queue: ${config.name}`);
    }
  }

  private setupJobProcessors(queue: Queue, queueName: string): void {
    switch (queueName) {
      case 'backup':
        queue.process('daily-backup', this.processDailyBackup.bind(this));
        queue.process('database-backup', this.processDatabaseBackup.bind(this));
        break;

      case 'sync':
        queue.process(
          'google-sheets-sync',
          this.processGoogleSheetsSync.bind(this),
        );
        queue.process('activity-sync', this.processActivitySync.bind(this));
        break;

      case 'notifications':
        queue.process(
          'teacher-notifications',
          this.processTeacherNotifications.bind(this),
        );
        queue.process(
          'overdue-notifications',
          this.processOverdueNotifications.bind(this),
        );
        break;

      case 'maintenance':
        queue.process(
          'session-expiry-check',
          this.processSessionExpiryCheck.bind(this),
        );
        queue.process('weekly-cleanup', this.processWeeklyCleanup.bind(this));
        queue.process('integrity-audit', this.processIntegrityAudit.bind(this));
        break;
    }
  }

  private setupQueueEventListeners(queue: Queue, queueName: string): void {
    queue.on('completed', (job: Job, result: any) => {
      automationLogger.jobSuccess(
        job.name,
        job.id.toString(),
        job.finishedOn! - job.timestamp,
        result,
      );
    });

    queue.on('failed', (job: Job, err: Error) => {
      automationLogger.jobFailure(
        job.name,
        job.id.toString(),
        job.finishedOn! - job.timestamp,
        err,
      );
    });

    queue.on('stalled', (job: Job) => {
      logger.warn(`Job stalled: ${job.name} (${job.id})`);
    });

    queue.on('progress', (job: Job, progress: number) => {
      logger.debug(`Job progress: ${job.name} (${job.id}) - ${progress}%`);
    });
  }

  private async loadScheduledJobs(): Promise<void> {
    try {
      const jobs = await this.prisma.automationJob.findMany({
        where: { isEnabled: true },
      });

      for (const job of jobs) {
        await this.scheduleJob(job);
      }

      logger.info(`Loaded ${jobs.length} scheduled jobs`);
    } catch (error) {
      logger.error('Failed to load scheduled jobs', {
        error: (error as Error).message,
      });
    }
  }

  async scheduleJob(job: any): Promise<void> {
    try {
      // Validate cron expression
      if (!cron.validate(job.schedule)) {
        throw new Error(`Invalid cron expression: ${job.schedule}`);
      }

      // Stop existing job if it exists
      if (this.scheduledJobs.has(job.id)) {
        this.scheduledJobs.get(job.id)?.stop();
      }

      // Schedule new job
      const scheduledTask = cron.schedule(
        job.schedule,
        () => {
          this.executeJob(job);
        },
        {
          scheduled: false,
          timezone: process.env.LIBRARY_TIMEZONE || 'Asia/Manila',
        },
      );

      scheduledTask.start();
      this.scheduledJobs.set(job.id, scheduledTask);

      // Update next run time
      const nextRun = this.getNextRunTime(job.schedule);
      await this.prisma.automationJob.update({
        where: { id: job.id },
        data: { nextRunAt: nextRun },
      });

      logger.info(`Scheduled job: ${job.name}`, {
        schedule: job.schedule,
        nextRun: nextRun?.toISOString(),
      });
    } catch (error) {
      logger.error(`Failed to schedule job: ${job.name}`, {
        error: (error as Error).message,
      });
    }
  }

  private async executeJob(job: any): Promise<void> {
    const startTime = performanceLogger.start('job_execution', {
      jobName: job.name,
    });

    try {
      // Update job status
      await this.prisma.automationJob.update({
        where: { id: job.id },
        data: { status: JobStatus.RUNNING, lastRunAt: new Date() },
      });

      automationLogger.jobStart(
        job.name,
        job.id,
        typeof job.config === 'string'
          ? JSON.parse(job.config)
          : job.config || {},
      );

      // Execute job based on type
      let result: JobExecutionResult;

      switch (job.type) {
        case JobType.DAILY_BACKUP:
          result = await this.executeDailyBackup(job);
          break;

        case JobType.TEACHER_NOTIFICATIONS:
          result = await this.executeTeacherNotifications(job);
          break;

        case JobType.GOOGLE_SHEETS_SYNC:
          result = await this.executeGoogleSheetsSync(job);
          break;

        case JobType.SESSION_EXPIRY_CHECK:
          result = await this.executeSessionExpiryCheck(job);
          break;

        case JobType.OVERDUE_NOTIFICATIONS:
          result = await this.executeOverdueNotifications(job);
          break;

        case JobType.WEEKLY_CLEANUP:
          result = await this.executeWeeklyCleanup(job);
          break;

        case JobType.MONTHLY_REPORT:
          result = await this.executeMonthlyReport(job);
          break;

        case JobType.INTEGRITY_AUDIT:
          result = await this.executeIntegrityAudit(job);
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Update job statistics
      await this.prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.IDLE,
          totalRuns: { increment: 1 },
          successCount: { increment: result.success ? 1 : 0 },
          failureCount: { increment: result.success ? 0 : 1 },
          averageDurationMs: result.duration,
        },
      });

      // Log completion
      await this.logJobExecution(job.id, JobStatus.COMPLETED, result);

      // Update next run time
      const nextRun = this.getNextRunTime(job.schedule);
      await this.prisma.automationJob.update({
        where: { id: job.id },
        data: { nextRunAt: nextRun },
      });

      performanceLogger.end('job_execution', startTime, {
        jobName: job.name,
        success: result.success,
      });
      automationLogger.jobSuccess(job.name, job.id, result.duration, result);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update job statistics
      await this.prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.IDLE,
          totalRuns: { increment: 1 },
          failureCount: { increment: 1 },
          averageDurationMs: duration,
        },
      });

      // Log failure
      const result: JobExecutionResult = {
        success: false,
        errorMessage: (error as Error).message,
        duration,
      };

      await this.logJobExecution(job.id, JobStatus.FAILED, result);

      performanceLogger.end('job_execution', startTime, {
        jobName: job.name,
        success: false,
      });
      automationLogger.jobFailure(job.name, job.id, duration, error as Error);
    }
  }

  // Job execution methods
  private async executeDailyBackup(job: any): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      // Add to backup queue
      await this.queues.get('backup')?.add('daily-backup', {
        jobName: job.name,
        jobId: job.id,
        config:
          typeof job.config === 'string'
            ? JSON.parse(job.config)
            : job.config || {},
      });

      return {
        success: true,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
        metadata: { queued: true },
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeTeacherNotifications(
    job: any,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      // Add to notifications queue
      await this.queues.get('notifications')?.add('teacher-notifications', {
        jobName: job.name,
        jobId: job.id,
        config:
          typeof job.config === 'string'
            ? JSON.parse(job.config)
            : job.config || {},
      });

      return {
        success: true,
        duration: Date.now() - startTime,
        metadata: { queued: true },
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeGoogleSheetsSync(job: any): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      // Get unsynced activities
      const activities = await this.prisma.activity.findMany({
        where: { googleSynced: false },
        include: {
          student: true,
          equipment: true,
        },
        take: 1000, // Limit batch size
      });

      if (activities.length === 0) {
        return {
          success: true,
          recordsProcessed: 0,
          duration: Date.now() - startTime,
          metadata: { message: 'No records to sync' },
        };
      }

      // Add to sync queue
      await this.queues.get('sync')?.add('google-sheets-sync', {
        activities: activities,
        jobName: job.name,
        jobId: job.id,
      });

      return {
        success: true,
        recordsProcessed: activities.length,
        duration: Date.now() - startTime,
        metadata: { queued: true },
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeSessionExpiryCheck(
    job: any,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();
    let expiredSessions = 0;

    try {
      // Find expired sessions
      const now = new Date();
      const expiredSessionsData = await this.prisma.equipmentSession.findMany({
        where: {
          status: 'ACTIVE',
          plannedEnd: { lt: now },
        },
        include: {
          student: true,
          equipment: true,
        },
      });

      // Mark sessions as expired
      for (const session of expiredSessionsData) {
        await this.prisma.equipmentSession.update({
          where: { id: session.id },
          data: {
            status: 'EXPIRED',
            sessionEnd: now,
            actualDuration: Math.floor(
              (now.getTime() - session.sessionStart.getTime()) / 60000,
            ),
          },
        });

        // Create activity record
        await this.prisma.activity.create({
          data: {
            studentId: session.studentId,
            activityType: 'COMPUTER_USE', // Adjust based on equipment type
            equipmentId: session.equipmentId,
            startTime: session.sessionStart,
            endTime: now,
            durationMinutes: Math.floor(
              (now.getTime() - session.sessionStart.getTime()) / 60000,
            ),
            status: 'EXPIRED',
            processedBy: 'SYSTEM',
          },
        });

        expiredSessions++;
      }

      // Update equipment availability
      if (expiredSessions > 0) {
        await this.prisma.equipment.updateMany({
          where: {
            id: { in: expiredSessionsData.map(s => s.equipmentId) },
          },
          data: { status: 'AVAILABLE' },
        });
      }

      return {
        success: true,
        recordsProcessed: expiredSessions,
        duration: Date.now() - startTime,
        metadata: { expiredSessions },
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  // Queue processors
  private async processDailyBackup(job: Job): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const { jobName, jobId } = job.data;

    try {
      // Implementation would go here
      // For now, just log to Google Sheets
      await googleSheetsService.logAutomationTask(
        jobName,
        'BACKUP',
        'RUNNING',
        {
          startTime: new Date().toISOString(),
          triggeredBy: 'SCHEDULED',
        },
      );

      await googleSheetsService.logAutomationTask(
        jobName,
        'BACKUP',
        'COMPLETED',
        {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: Date.now() - startTime,
          recordsProcessed: 0,
          triggeredBy: 'SCHEDULED',
        },
      );

      return {
        success: true,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  private async processGoogleSheetsSync(job: Job): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const { jobName, jobId } = job.data;

    try {
      // Sync activities to Google Sheets
      const result = await googleSheetsService.syncStudentActivities();

      // Log sync to Google Sheets
      await googleSheetsService.logAutomationTask(
        jobName,
        'SYNC',
        result.success ? 'COMPLETED' : 'FAILED',
        {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: Date.now() - startTime,
          recordsProcessed: result.recordsProcessed || 0,
          triggeredBy: 'SCHEDULED',
          metadata: { error: result.error },
        },
      );

      const jobResult: JobExecutionResult = {
        success: result.success,
        recordsProcessed: result.recordsProcessed || 0,
        duration: Date.now() - startTime,
      };

      if (result.error) {
        jobResult.errorMessage = result.error;
      }

      return jobResult;
    } catch (error) {
      throw error;
    }
  }

  private async processTeacherNotifications(
    job: Job,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const { jobName } = job.data;

    try {
      // Implementation would generate teacher notifications
      // For now, just log to Google Sheets
      await googleSheetsService.logAutomationTask(
        jobName,
        'NOTIFICATION',
        'COMPLETED',
        {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: Date.now() - startTime,
          recordsProcessed: 0,
          triggeredBy: 'SCHEDULED',
        },
      );

      return {
        success: true,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  private async processSessionExpiryCheck(
    job: Job,
  ): Promise<JobExecutionResult> {
    // This would be similar to executeSessionExpiryCheck
    // Implementation details omitted for brevity
    return {
      success: true,
      recordsProcessed: 0,
      duration: 0,
    };
  }

  private async processOverdueNotifications(
    job: Job,
  ): Promise<JobExecutionResult> {
    // Implementation for overdue notifications
    return {
      success: true,
      recordsProcessed: 0,
      duration: 0,
    };
  }

  private async processWeeklyCleanup(job: Job): Promise<JobExecutionResult> {
    // Implementation for weekly cleanup
    return {
      success: true,
      recordsProcessed: 0,
      duration: 0,
    };
  }

  private async processIntegrityAudit(job: Job): Promise<JobExecutionResult> {
    // Implementation for integrity audit
    return {
      success: true,
      recordsProcessed: 0,
      duration: 0,
    };
  }

  private async processDatabaseBackup(job: Job): Promise<JobExecutionResult> {
    // Implementation for database backup
    return {
      success: true,
      recordsProcessed: 0,
      duration: 0,
    };
  }

  private async processActivitySync(job: Job): Promise<JobExecutionResult> {
    // Implementation for activity sync
    return {
      success: true,
      recordsProcessed: 0,
      duration: 0,
    };
  }

  private async executeOverdueNotifications(
    job: any,
  ): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async executeWeeklyCleanup(job: any): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async executeMonthlyReport(job: any): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async executeIntegrityAudit(job: any): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async logJobExecution(
    jobId: string,
    status: JobStatus,
    result: JobExecutionResult,
  ): Promise<void> {
    try {
      await this.prisma.automationLog.create({
        data: {
          jobId,
          executionId: `${jobId}-${Date.now()}`,
          status,
          startedAt: new Date(Date.now() - result.duration),
          completedAt: new Date(),
          durationMs: result.duration,
          success: result.success,
          recordsProcessed: result.recordsProcessed || 0,
          errorMessage: result.errorMessage || null,
        },
      });
    } catch (error) {
      logger.error('Failed to log job execution', {
        error: (error as Error).message,
        jobId,
        status,
      });
    }
  }

  private getNextRunTime(cronExpression: string): Date | null {
    try {
      // Simple implementation - in production, use a proper cron parser
      const task = cron.schedule(cronExpression, () => {}, {
        scheduled: false,
      });
      // This is a placeholder - actual implementation would calculate next run time
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    } catch {
      return null;
    }
  }

  private setupCleanupInterval(): void {
    // Clean up old logs and completed jobs every hour
    setInterval(
      async () => {
        try {
          // Clean up old automation logs (keep last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          await this.prisma.automationLog.deleteMany({
            where: {
              startedAt: { lt: thirtyDaysAgo },
            },
          });

          logger.debug('Cleaned up old automation logs');
        } catch (error) {
          logger.error('Failed to cleanup old automation logs', {
            error: (error as Error).message,
          });
        }
      },
      60 * 60 * 1000,
    ); // Every hour
  }

  // Public API methods
  async triggerJob(jobId: string, userId: string = 'MANUAL'): Promise<void> {
    try {
      const job = await this.prisma.automationJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new BaseError(`Job not found: ${jobId}`, 404);
      }

      if (!job.isEnabled) {
        throw new BaseError(`Job is disabled: ${job.name}`, 400);
      }

      await this.executeJob({
        ...job,
        config:
          typeof job.config === 'string'
            ? JSON.parse(job.config)
            : job.config || {},
      });

      logger.info(`Manually triggered job: ${job.name}`, { userId });
    } catch (error) {
      logger.error('Failed to trigger job', {
        jobId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.prisma.automationJob.findUnique({
        where: { id: jobId },
        include: {
          AutomationLog: {
            take: 10,
            orderBy: { startedAt: 'desc' },
          },
        },
      });

      return job;
    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getAllJobs(): Promise<any[]> {
    try {
      return await this.prisma.automationJob.findMany({
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get all jobs', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getQueueStatus(): Promise<any> {
    const queueStatus: any = {};

    for (const [name, queue] of this.queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      queueStatus[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    }

    return queueStatus;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down automation service');

    // Stop all scheduled jobs
    for (const [jobId, task] of this.scheduledJobs) {
      task.stop();
    }
    this.scheduledJobs.clear();

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
    }
    this.queues.clear();

    // Close Redis connection
    await this.redis.disconnect();

    // Close Prisma connection
    await this.prisma.$disconnect();

    logger.info('Automation service shutdown complete');
  }

  getSystemHealth(): any {
    return {
      initialized: this.isInitialized,
      scheduledJobs: this.scheduledJobs.size,
      activeQueues: this.queues.size,
      redisConnected: this.redis.status === 'ready',
    };
  }
}

// Singleton instance
export const automationService = new AutomationService();

export default automationService;
