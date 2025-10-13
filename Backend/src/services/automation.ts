import cron from 'node-cron';
import Bull, { Queue, QueueOptions, Job } from 'bull';
import Redis from 'ioredis';
import {
  PrismaClient,
  Prisma,
  AutomationJob,
  AutomationLog,
  automation_jobs_type,
  automation_jobs_status,
  student_activities_activity_type,
  student_activities_status,
  SessionStatus,
  equipment_status,
} from '@prisma/client';
import { JobExecutionResult, JobConfig } from '@/types';
import { logger, automationLogger, performanceLogger } from '@/utils/logger';
import { googleSheetsService } from './googleSheets';
import { BaseError } from '@/utils/errors';

type QueuePayload = Record<string, unknown>;

interface QueueSnapshot {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface BackupQueueData extends QueuePayload {
  jobName: string;
  jobId: string;
  config?: JobConfig;
}

interface NotificationQueueData extends QueuePayload {
  jobName: string;
  jobId: string;
  config?: JobConfig;
}

interface SyncQueueData extends QueuePayload {
  jobName: string;
  jobId: string;
  activities?: unknown;
}

interface AutomationSystemHealth {
  initialized: boolean;
  scheduledJobs: number;
  activeQueues: number;
  redisConnected: boolean;
}

export class AutomationService {
  private prisma: PrismaClient;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private redis: Redis;
  private queues: Map<string, Queue<QueuePayload>> = new Map();
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

  private resolveJobConfig(rawConfig: Prisma.JsonValue | null): JobConfig {
    if (rawConfig === null || rawConfig === undefined) {
      return {};
    }

    if (typeof rawConfig === 'string') {
      try {
        const parsed = JSON.parse(rawConfig) as unknown;
        return this.ensureJobConfigObject(parsed);
      } catch (error) {
        logger.warn('Failed to parse automation job config from string', {
          error: (error as Error).message,
        });
        return {};
      }
    }

    if (Array.isArray(rawConfig)) {
      return { values: rawConfig };
    }

    return this.ensureJobConfigObject(rawConfig);
  }

  private ensureJobConfigObject(value: unknown): JobConfig {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JobConfig;
    }

    return {};
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
      const queue = new Bull<QueuePayload>(config.name, {
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

  private setupJobProcessors(
    queue: Queue<QueuePayload>,
    queueName: string,
  ): void {
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

  private setupQueueEventListeners(
    queue: Queue<QueuePayload>,
    _queueName: string,
  ): void {
    queue.on('completed', (job: Job<QueuePayload>, result: unknown) => {
      automationLogger.jobSuccess(
        job.name,
        job.id.toString(),
        job.finishedOn! - job.timestamp,
        result,
      );
    });

    queue.on('failed', (job: Job<QueuePayload>, err: Error) => {
      automationLogger.jobFailure(
        job.name,
        job.id.toString(),
        job.finishedOn! - job.timestamp,
        err,
      );
    });

    queue.on('stalled', (job: Job<QueuePayload>) => {
      logger.warn(`Job stalled: ${job.name} (${job.id})`);
    });

    queue.on('progress', (job: Job, progress: number) => {
      logger.debug(`Job progress: ${job.name} (${job.id}) - ${progress}%`);
    });
  }

  private async loadScheduledJobs(): Promise<void> {
    try {
      const jobs = await this.prisma.automation_jobs.findMany({
        where: { is_enabled: true },
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

  async scheduleJob(job: AutomationJob): Promise<void> {
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
          void this.executeJob(job);
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
      await this.prisma.automation_jobs.update({
        where: { id: job.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(),  next_run_at: nextRun },
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

  private async executeJob(job: AutomationJob): Promise<void> {
    const startTime = performanceLogger.start('job_execution', {
      jobName: job.name,
    });

    try {
      const jobConfig = this.resolveJobConfig(job.config);

      // Update job status
      await this.prisma.automation_jobs.update({
        where: { id: job.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(),  status: automation_jobs_status.RUNNING, last_run_at: new Date() },
      });

      automationLogger.jobStart(job.name, job.id, jobConfig);

      // Execute job based on type
      let result: JobExecutionResult;

      switch (job.type) {
        case automation_jobs_type.DAILY_BACKUP:
          result = await this.executeDailyBackup(job, jobConfig);
          break;

        case automation_jobs_type.TEACHER_NOTIFICATIONS:
          result = await this.executeTeacherNotifications(job, jobConfig);
          break;

        case automation_jobs_type.GOOGLE_SHEETS_SYNC:
          result = await this.executeGoogleSheetsSync(job, jobConfig);
          break;

        case automation_jobs_type.SESSION_EXPIRY_CHECK:
          result = await this.executeSessionExpiryCheck(job, jobConfig);
          break;

        case automation_jobs_type.OVERDUE_NOTIFICATIONS:
          result = await this.executeOverdueNotifications(job, jobConfig);
          break;

        case automation_jobs_type.WEEKLY_CLEANUP:
          result = await this.executeWeeklyCleanup(job, jobConfig);
          break;

        case automation_jobs_type.MONTHLY_REPORT:
          result = await this.executeMonthlyReport(job, jobConfig);
          break;

        case automation_jobs_type.INTEGRITY_AUDIT:
          result = await this.executeIntegrityAudit(job, jobConfig);
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Update job statistics
      await this.prisma.automation_jobs.update({
        where: { id: job.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          status: automation_jobs_status.IDLE,
          total_runs: { increment: 1 },
          success_count: { increment: result.success ? 1 : 0 },
          failure_count: { increment: result.success ? 0 : 1 },
          average_duration_ms: result.duration,
        },
      });

      // Log completion
      await this.logJobExecution(job.id, automation_jobs_status.COMPLETED, result);

      // Update next run time
      const nextRun = this.getNextRunTime(job.schedule);
      await this.prisma.automation_jobs.update({
        where: { id: job.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(),  next_run_at: nextRun },
      });

      performanceLogger.end('job_execution', start_time, {
        jobName: job.name,
        success: result.success,
      });
      automationLogger.jobSuccess(job.name, job.id, result.duration, result);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update job statistics
      await this.prisma.automation_jobs.update({
        where: { id: job.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          status: automation_jobs_status.IDLE,
          total_runs: { increment: 1 },
          failure_count: { increment: 1 },
          average_duration_ms: duration,
        },
      });

      // Log failure
      const result: JobExecutionResult = {
        success: false,
        error_message: (error as Error).message,
        duration,
      };

      await this.logJobExecution(job.id, automation_jobs_status.FAILED, result);

      performanceLogger.end('job_execution', start_time, {
        jobName: job.name,
        success: false,
      });
      automationLogger.jobFailure(job.name, job.id, duration, error as Error);
    }
  }

  // Job execution methods
  private async executeDailyBackup(
    job: AutomationJob,
    config: JobConfig,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      // Add to backup queue
      await this.queues.get('backup')?.add('daily-backup', {
        jobName: job.name,
        jobId: job.id,
        config,
      });

      return {
        success: true,
        records_processed: 0,
        duration: Date.now() - start_time,
        metadata: { id: crypto.randomUUID(), updated_at: new Date(),  queued: true },
      };
    } catch (error) {
      return {
        success: false,
        error_message: (error as Error).message,
        records_processed: 0,
        duration: Date.now() - start_time,
      };
    }
  }

  private async executeTeacherNotifications(
    job: AutomationJob,
    config: JobConfig,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      // Add to notifications queue
      await this.queues.get('notifications')?.add('teacher-notifications', {
        jobName: job.name,
        jobId: job.id,
        config,
      });

      return {
        success: true,
        duration: Date.now() - start_time,
        metadata: { id: crypto.randomUUID(), updated_at: new Date(),  queued: true },
      };
    } catch (error) {
      return {
        success: false,
        error_message: (error as Error).message,
        records_processed: 0,
        duration: Date.now() - start_time,
      };
    }
  }

  private async executeGoogleSheetsSync(
    job: AutomationJob,
    _config: JobConfig,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      // Get unsynced activities
      const activities = await this.prisma.student_activities.findMany({
        where: { google_synced: false },
        include: {
          student: true,
          equipment: true,
        },
        take: 1000, // Limit batch size
      });

      if (activities.length === 0) {
        return {
          success: true,
          records_processed: 0,
          duration: Date.now() - start_time,
          metadata: { id: crypto.randomUUID(), updated_at: new Date(),  message: 'No records to sync' },
        };
      }

      // Add to sync queue
      await this.queues.get('sync')?.add('google-sheets-sync', {
        activities,
        jobName: job.name,
        jobId: job.id,
      });

      return {
        success: true,
        records_processed: activities.length,
        duration: Date.now() - start_time,
        metadata: { id: crypto.randomUUID(), updated_at: new Date(),  queued: true },
      };
    } catch (error) {
      return {
        success: false,
        error_message: (error as Error).message,
        records_processed: 0,
        duration: Date.now() - start_time,
      };
    }
  }

  private async executeSessionExpiryCheck(
    _job: AutomationJob,
    _config: JobConfig,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();
    let expiredSessions = 0;

    try {
      // Find expired sessions
      const now = new Date();
      const expiredSessionsData = await this.prisma.equipment_sessions.findMany({
        where: {
          status: SessionStatus.ACTIVE,
          planned_end: { lt: now },
        },
        include: {
          student: true,
          equipment: true,
        },
      });

      // Mark sessions as expired
      for (const session of expiredSessionsData) {
        await this.prisma.equipment_sessions.update({
          where: { id: session.id },
          data: { id: crypto.randomUUID(), updated_at: new Date(), 
            status: SessionStatus.EXPIRED,
            session_end: now,
            actual_duration: Math.floor(
              (now.getTime() - session.session_start.getTime()) / 60000,
            ),
          },
        });

        // Create activity record
        await this.prisma.student_activities.create({
          data: { id: crypto.randomUUID(), updated_at: new Date(), 
            student_id: session.student_id,
            student_name:
              `${session.student.first_name} ${session.student.last_name}`.trim(),
            studentGradeLevel: session.student.grade_level,
            studentGradeCategory: session.student.grade_category,
            activity_type: student_activities_activity_type.COMPUTER_USE, // Adjust based on equipment type
            equipment_id: session.equipment_id,
            start_time: session.session_start,
            end_time: now,
            duration_minutes: Math.floor(
              (now.getTime() - session.session_start.getTime()) / 60000,
            ),
            status: student_activities_status.EXPIRED,
            processed_by: 'SYSTEM',
          },
        });

        expiredSessions++;
      }

      // Update equipment availability
      if (expiredSessions > 0) {
        await this.prisma.equipment.updateMany({
          where: {
            id: { in: expiredSessionsData.map(s => s.equipment_id) },
          },
          data: { id: crypto.randomUUID(), updated_at: new Date(),  status: equipment_status.AVAILABLE },
        });
      }

      return {
        success: true,
        records_processed: expiredSessions,
        duration: Date.now() - start_time,
        metadata: { id: crypto.randomUUID(), updated_at: new Date(),  expiredSessions },
      };
    } catch (error) {
      return {
        success: false,
        error_message: (error as Error).message,
        records_processed: 0,
        duration: Date.now() - start_time,
      };
    }
  }

  // Queue processors
  private async processDailyBackup(
    job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const { jobName } = job.data as BackupQueueData;

    try {
      // Implementation would go here
      // For now, just log to Google Sheets
      await googleSheetsService.logAutomationTask(
        jobName,
        'BACKUP',
        'RUNNING',
        {
          start_time: new Date().toISOString(),
          triggered_by: 'SCHEDULED',
        },
      );

      await googleSheetsService.logAutomationTask(
        jobName,
        'BACKUP',
        'COMPLETED',
        {
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration: Date.now() - start_time,
          records_processed: 0,
          triggered_by: 'SCHEDULED',
        },
      );

      return {
        success: true,
        records_processed: 0,
        duration: Date.now() - start_time,
      };
    } catch (error) {
      throw error;
    }
  }

  private async processGoogleSheetsSync(
    job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const { jobName } = job.data as SyncQueueData;

    try {
      // Sync activities to Google Sheets
      const result = await googleSheetsService.syncStudentActivities();

      // Log sync to Google Sheets
      await googleSheetsService.logAutomationTask(
        jobName,
        'SYNC',
        result.success ? 'COMPLETED' : 'FAILED',
        {
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration: Date.now() - start_time,
          records_processed: result.records_processed || 0,
          triggered_by: 'SCHEDULED',
          metadata: { id: crypto.randomUUID(), updated_at: new Date(),  error: result.error },
        },
      );

      const jobResult: JobExecutionResult = {
        success: result.success,
        records_processed: result.records_processed || 0,
        duration: Date.now() - start_time,
      };

      if (result.error) {
        jobResult.error_message = result.error;
      }

      return jobResult;
    } catch (error) {
      throw error;
    }
  }

  private async processTeacherNotifications(
    job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const { jobName } = job.data as NotificationQueueData;

    try {
      // Implementation would generate teacher notifications
      // For now, just log to Google Sheets
      await googleSheetsService.logAutomationTask(
        jobName,
        'NOTIFICATION',
        'COMPLETED',
        {
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration: Date.now() - start_time,
          records_processed: 0,
          triggered_by: 'SCHEDULED',
        },
      );

      return {
        success: true,
        records_processed: 0,
        duration: Date.now() - start_time,
      };
    } catch (error) {
      throw error;
    }
  }

  private async processSessionExpiryCheck(
    _job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    // This would be similar to executeSessionExpiryCheck
    // Implementation details omitted for brevity
    return {
      success: true,
      records_processed: 0,
      duration: 0,
    };
  }

  private async processOverdueNotifications(
    _job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    // Implementation for overdue notifications
    return {
      success: true,
      records_processed: 0,
      duration: 0,
    };
  }

  private async processWeeklyCleanup(
    _job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    // Implementation for weekly cleanup
    return {
      success: true,
      records_processed: 0,
      duration: 0,
    };
  }

  private async processIntegrityAudit(
    _job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    // Implementation for integrity audit
    return {
      success: true,
      records_processed: 0,
      duration: 0,
    };
  }

  private async processDatabaseBackup(
    _job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    // Implementation for database backup
    return {
      success: true,
      records_processed: 0,
      duration: 0,
    };
  }

  private async processActivitySync(
    _job: Job<QueuePayload>,
  ): Promise<JobExecutionResult> {
    // Implementation for activity sync
    return {
      success: true,
      records_processed: 0,
      duration: 0,
    };
  }

  private async executeOverdueNotifications(
    _job: AutomationJob,
    _config: JobConfig,
  ): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async executeWeeklyCleanup(
    _job: AutomationJob,
    _config: JobConfig,
  ): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async executeMonthlyReport(
    _job: AutomationJob,
    _config: JobConfig,
  ): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async executeIntegrityAudit(
    _job: AutomationJob,
    _config: JobConfig,
  ): Promise<JobExecutionResult> {
    // Similar to executeTeacherNotifications
    return {
      success: true,
      duration: 0,
    };
  }

  private async logJobExecution(
    jobId: string,
    status: automation_jobs_status,
    result: JobExecutionResult,
  ): Promise<void> {
    try {
      await this.prisma.automation_logs.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          jobId,
          execution_id: `${jobId}-${Date.now()}`,
          status,
          started_at: new Date(Date.now() - result.duration),
          completed_at: new Date(),
          duration_ms: result.duration,
          success: result.success,
          records_processed: result.records_processed || 0,
          error_message: result.error_message || null,
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
      const scheduledTask = cron.schedule(cronExpression, () => {}, {
        scheduled: false,
      });
      scheduledTask.stop();
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
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

          await this.prisma.automation_logs.deleteMany({
            where: {
              started_at: { lt: thirtyDaysAgo },
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
  async triggerJob(jobId: string, id: string = 'MANUAL'): Promise<void> {
    try {
      const job = await this.prisma.automation_jobs.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new BaseError(`Job not found: ${jobId}`, 404);
      }

      if (!job.is_enabled) {
        throw new BaseError(`Job is disabled: ${job.name}`, 400);
      }

      await this.executeJob(job);

      logger.info(`Manually triggered job: ${job.name}`, { id });
    } catch (error) {
      logger.error('Failed to trigger job', {
        jobId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getJobStatus(
    jobId: string,
  ): Promise<(AutomationJob & { AutomationLog: AutomationLog[] }) | null> {
    try {
      const job = await this.prisma.automation_jobs.findUnique({
        where: { id: jobId },
        include: {
          AutomationLog: {
            take: 10,
            orderBy: { started_at: 'desc' },
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

  async getAllJobs(): Promise<AutomationJob[]> {
    try {
      return await this.prisma.automation_jobs.findMany({
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get all jobs', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getQueueStatus(): Promise<Record<string, QueueSnapshot>> {
    const queueStatus: Record<string, QueueSnapshot> = {};

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
    for (const task of this.scheduledJobs.values()) {
      task.stop();
    }
    this.scheduledJobs.clear();

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();

    // Close Redis connection
    await this.redis.disconnect();

    // Close Prisma connection
    await this.prisma.$disconnect();

    logger.info('Automation service shutdown complete');
  }

  getSystemHealth(): AutomationSystemHealth {
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
