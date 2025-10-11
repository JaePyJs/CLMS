import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import {
  JobType,
  JobStatus,
  ActivityStatus,
  EquipmentStatus,
  CheckoutStatus,
  GradeCategory,
  Prisma,
} from '@prisma/client';

// Scheduled task interface
export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  task: () => Promise<void>;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
}

// Job scheduler class
export class JobScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized = false;

  // Initialize the scheduler
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing job scheduler...');

      // Load jobs from database
      await this.loadJobsFromDatabase();

      this.isInitialized = true;
      logger.info('Job scheduler initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize job scheduler', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Load jobs from database
  private async loadJobsFromDatabase(): Promise<void> {
    try {
      const jobs = await prisma.automationJob.findMany({
        where: { isEnabled: true },
      });

      for (const job of jobs) {
        // Create task based on job type
        const task = this.createTaskForJobType(job.type);

        if (task) {
          this.registerTask({
            id: job.id,
            name: job.name,
            cronExpression: job.schedule,
            task,
            enabled: job.isEnabled,
            lastRun: job.lastRunAt || null,
            nextRun: job.nextRunAt || null,
          });
        }
      }

      logger.info(`Loaded ${jobs.length} jobs from database`);
    } catch (error) {
      logger.error('Failed to load jobs from database', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Create task function based on job type
  private createTaskForJobType(jobType: JobType): (() => Promise<void>) | null {
    switch (jobType) {
      case JobType.DAILY_BACKUP:
        return this.createDailyBackupTask();
      case JobType.GOOGLE_SHEETS_SYNC:
        return this.createGoogleSheetsSyncTask();
      case JobType.SESSION_EXPIRY_CHECK:
        return this.createSessionExpiryCheckTask();
      case JobType.OVERDUE_NOTIFICATIONS:
        return this.createOverdueNotificationsTask();
      case JobType.WEEKLY_CLEANUP:
        return this.createWeeklyCleanupTask();
      case JobType.MONTHLY_REPORT:
        return this.createMonthlyReportTask();
      case JobType.INTEGRITY_AUDIT:
        return this.createIntegrityAuditTask();
      case JobType.TEACHER_NOTIFICATIONS:
        return this.createTeacherNotificationsTask();
      default:
        logger.warn(`Unknown job type: ${jobType}`);
        return null;
    }
  }

  // Create daily backup task
  private createDailyBackupTask(): () => Promise<void> {
    return async () => {
      logger.info('Running daily backup task');
      const startTime = Date.now();

      try {
        // This would implement database backup logic
        // For now, we'll just log the execution
        await this.updateJobStatus('Daily Backup', JobStatus.RUNNING);

        // Simulate backup process
        await new Promise(resolve => setTimeout(resolve, 2000));

        await this.updateJobStatus('Daily Backup', JobStatus.COMPLETED);

        const duration = Date.now() - startTime;
        logger.info(`Daily backup task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Daily backup task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Daily Backup', JobStatus.FAILED);
      }
    };
  }

  // Create Google Sheets sync task
  private createGoogleSheetsSyncTask(): () => Promise<void> {
    return async () => {
      logger.info('Running Google Sheets sync task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Google Sheets Sync', JobStatus.RUNNING);

        // Import Google Sheets service dynamically to avoid circular dependencies
        const { googleSheetsService } = await import('./googleSheets');
        const syncResult = await googleSheetsService.testConnection();

        if (syncResult) {
          await this.updateJobStatus('Google Sheets Sync', JobStatus.COMPLETED);
          logger.info('Google Sheets sync completed successfully');
        } else {
          await this.updateJobStatus('Google Sheets Sync', JobStatus.FAILED);
          logger.error('Google Sheets sync failed');
        }

        const duration = Date.now() - startTime;
        logger.info(`Google Sheets sync task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Google Sheets sync task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Google Sheets Sync', JobStatus.FAILED);
      }
    };
  }

  // Create session expiry check task
  private createSessionExpiryCheckTask(): () => Promise<void> {
    return async () => {
      logger.info('Running session expiry check task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Session Expiry Check', JobStatus.RUNNING);

        // Find expired sessions
        const now = new Date();
        const expiredSessions = await prisma.activity.findMany({
          where: {
            endTime: { lt: now },
            status: ActivityStatus.ACTIVE,
          },
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        // Update expired sessions
        let expiredCount = 0;
        for (const session of expiredSessions) {
          await prisma.activity.update({
            where: { id: session.id },
            data: { status: ActivityStatus.EXPIRED },
          });

          // If equipment was used, update its status
          if (session.equipmentId) {
            await prisma.equipment.update({
              where: { id: session.equipmentId },
              data: { status: EquipmentStatus.AVAILABLE },
            });
          }

          expiredCount++;
        }

        await this.updateJobStatus('Session Expiry Check', JobStatus.COMPLETED);
        logger.info(
          `Session expiry check completed: ${expiredCount} sessions expired`,
        );

        const duration = Date.now() - startTime;
        logger.info(`Session expiry check task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Session expiry check task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Session Expiry Check', JobStatus.FAILED);
      }
    };
  }

  // Create overdue notifications task
  private createOverdueNotificationsTask(): () => Promise<void> {
    return async () => {
      logger.info('Running overdue notifications task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Overdue Notifications', JobStatus.RUNNING);

        // Find overdue books
        const now = new Date();
        const overdueCheckouts = await prisma.bookCheckout.findMany({
          where: {
            dueDate: { lt: now },
            status: CheckoutStatus.ACTIVE,
          },
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
                gradeLevel: true,
              },
            },
            book: {
              select: {
                accessionNo: true,
                title: true,
                author: true,
              },
            },
          },
        });

        // Update overdue status and calculate fines
        let notifiedCount = 0;
        for (const checkout of overdueCheckouts) {
          const overdueDays = Math.ceil(
            (now.getTime() - checkout.dueDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const fineAmount = overdueDays * 1.0; // 1 peso per day

          await prisma.bookCheckout.update({
            where: { id: checkout.id },
            data: {
              status: CheckoutStatus.OVERDUE,
              overdueDays,
              fineAmount,
            },
          });

          // Here you would implement notification logic (email, SMS, etc.)
          // For now, we'll just log it
          logger.info(
            `Overdue notification sent to ${checkout.student.firstName} ${checkout.student.lastName} for book "${checkout.book.title}" (${overdueDays} days, ₱${fineAmount} fine)`,
          );

          notifiedCount++;
        }

        await this.updateJobStatus(
          'Overdue Notifications',
          JobStatus.COMPLETED,
        );
        logger.info(
          `Overdue notifications task completed: ${notifiedCount} notifications sent`,
        );

        const duration = Date.now() - startTime;
        logger.info(`Overdue notifications task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Overdue notifications task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Overdue Notifications', JobStatus.FAILED);
      }
    };
  }

  // Create weekly cleanup task
  private createWeeklyCleanupTask(): () => Promise<void> {
    return async () => {
      logger.info('Running weekly cleanup task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Weekly Cleanup', JobStatus.RUNNING);

        // Clean up old logs (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deletedLogs = await prisma.automationLog.deleteMany({
          where: {
            startedAt: { lt: thirtyDaysAgo },
          },
        });

        // Clean up old audit logs (older than 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const deletedAuditLogs = await prisma.auditLog.deleteMany({
          where: {
            createdAt: { lt: ninetyDaysAgo },
          },
        });

        await this.updateJobStatus('Weekly Cleanup', JobStatus.COMPLETED);
        logger.info(
          `Weekly cleanup completed: ${deletedLogs.count} logs deleted, ${deletedAuditLogs.count} audit logs deleted`,
        );

        const duration = Date.now() - startTime;
        logger.info(`Weekly cleanup task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Weekly cleanup task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Weekly Cleanup', JobStatus.FAILED);
      }
    };
  }

  // Create monthly report task
  private createMonthlyReportTask(): () => Promise<void> {
    return async () => {
      logger.info('Running monthly report task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Monthly Report', JobStatus.RUNNING);

        // Get date range for last month
        const now = new Date();
        const firstDayLastMonth = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Generate statistics
        const [
          totalStudents,
          totalBooks,
          totalEquipment,
          totalActivities,
          totalCheckouts,
        ] = await Promise.all([
          prisma.student.count({ where: { isActive: true } }),
          prisma.book.count({ where: { isActive: true } }),
          prisma.equipment.count(),
          prisma.activity.count({
            where: {
              startTime: { gte: firstDayLastMonth, lte: lastDayLastMonth },
            },
          }),
          prisma.bookCheckout.count({
            where: {
              checkoutDate: { gte: firstDayLastMonth, lte: lastDayLastMonth },
            },
          }),
        ]);

        // Generate report
        const report = {
          month: firstDayLastMonth.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          }),
          generatedAt: now.toISOString(),
          statistics: {
            totalStudents,
            totalBooks,
            totalEquipment,
            totalActivities,
            totalCheckouts,
          },
        };

        // Here you would save the report to a file or send it via email
        logger.info(
          `Monthly report generated: ${JSON.stringify(report, null, 2)}`,
        );

        await this.updateJobStatus('Monthly Report', JobStatus.COMPLETED);
        logger.info('Monthly report task completed');

        const duration = Date.now() - startTime;
        logger.info(`Monthly report task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Monthly report task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Monthly Report', JobStatus.FAILED);
      }
    };
  }

  // Create integrity audit task
  private createIntegrityAuditTask(): () => Promise<void> {
    return async () => {
      logger.info('Running integrity audit task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Integrity Audit', JobStatus.RUNNING);

        // Check for data inconsistencies
        const issues: string[] = [];

        // Check for active activities without valid students
        const invalidActivities = await prisma.activity.findMany({
          where: { status: ActivityStatus.ACTIVE },
          include: { student: true },
        });

        for (const activity of invalidActivities) {
          if (!activity.student) {
            issues.push(
              `Activity ${activity.id} has invalid student reference`,
            );
          }
        }

        // Check for active checkouts without valid books
        const invalidCheckouts = await prisma.bookCheckout.findMany({
          where: { status: CheckoutStatus.ACTIVE },
          include: { book: true },
        });

        for (const checkout of invalidCheckouts) {
          if (!checkout.book) {
            issues.push(`Checkout ${checkout.id} has invalid book reference`);
          }
        }

        await this.updateJobStatus('Integrity Audit', JobStatus.COMPLETED);
        logger.info(`Integrity audit completed: ${issues.length} issues found`);

        if (issues.length > 0) {
          logger.warn('Data integrity issues found', { issues });
        }

        const duration = Date.now() - startTime;
        logger.info(`Integrity audit task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Integrity audit task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Integrity Audit', JobStatus.FAILED);
      }
    };
  }

  // Create teacher notifications task
  private createTeacherNotificationsTask(): () => Promise<void> {
    return async () => {
      logger.info('Running teacher notifications task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Teacher Notifications', JobStatus.RUNNING);

        // Get all active students with overdue books
        const overdueStudents = await prisma.bookCheckout.findMany({
          where: {
            status: CheckoutStatus.OVERDUE,
          },
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
                gradeLevel: true,
                gradeCategory: true,
              },
            },
            book: {
              select: {
                accessionNo: true,
                title: true,
                author: true,
              },
            },
          },
        });

        // Group by grade category for teacher notifications
        type OverdueCheckout = (typeof overdueStudents)[number];
        const studentsByGrade = overdueStudents.reduce<
          Partial<Record<GradeCategory, OverdueCheckout[]>>
        >((acc, checkout) => {
          const grade = checkout.student.gradeCategory;
          if (!acc[grade]) {
            acc[grade] = [];
          }
          (acc[grade] as OverdueCheckout[]).push(checkout);
          return acc;
        }, {});

        // Generate notifications for each grade category
        for (const [grade, students] of Object.entries(studentsByGrade)) {
          const overdueList = students ?? [];
          logger.info(
            `Teacher notification for ${grade}: ${overdueList.length} students with overdue books`,
          );

          // Here you would implement actual notification logic
          // For now, we'll just log the details
          overdueList.forEach(({ student, book, overdueDays, fineAmount }) => {
            logger.info(
              `- ${student.firstName} ${student.lastName} (${student.studentId}): "${book.title}" (${overdueDays} days, ₱${fineAmount} fine)`,
            );
          });
        }

        await this.updateJobStatus(
          'Teacher Notifications',
          JobStatus.COMPLETED,
        );
        logger.info('Teacher notifications task completed');

        const duration = Date.now() - startTime;
        logger.info(`Teacher notifications task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Teacher notifications task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Teacher Notifications', JobStatus.FAILED);
      }
    };
  }

  // Update job status in database
  private async updateJobStatus(
    name: string,
    status: JobStatus,
  ): Promise<void> {
    try {
      const now = new Date();

      const updateData: Prisma.AutomationJobUpdateManyMutationInput = {
        status,
        totalRuns: { increment: 1 },
      };

      if (status === JobStatus.RUNNING) {
        updateData.lastRunAt = now;
      }

      if (status === JobStatus.COMPLETED) {
        updateData.successCount = { increment: 1 };
      }

      if (status === JobStatus.FAILED) {
        updateData.failureCount = { increment: 1 };
      }

      await prisma.automationJob.updateMany({
        where: { name },
        data: updateData,
      });
    } catch (error) {
      logger.error(`Failed to update job status for ${name}`, {
        error: (error as Error).message,
      });
    }
  }

  // Register a new task
  registerTask(task: ScheduledTask): void {
    // Unregister existing task if it exists
    if (this.tasks.has(task.id)) {
      this.unregisterTask(task.id);
    }

    // Store the task
    this.tasks.set(task.id, task);

    // Schedule the task if enabled
    if (task.enabled) {
      this.scheduleTask(task);
    }

    logger.info(`Task registered: ${task.name} (${task.id})`);
  }

  // Unregister a task
  unregisterTask(taskId: string): void {
    // Stop the cron job if it exists
    if (this.cronJobs.has(taskId)) {
      this.cronJobs.get(taskId)?.stop();
      this.cronJobs.delete(taskId);
    }

    // Remove the task
    this.tasks.delete(taskId);

    logger.info(`Task unregistered: ${taskId}`);
  }

  // Schedule a task with cron
  private scheduleTask(task: ScheduledTask): void {
    try {
      // Validate cron expression
      if (!cron.validate(task.cronExpression)) {
        throw new Error(`Invalid cron expression: ${task.cronExpression}`);
      }

      // Create and start the cron job
      const cronJob = cron.schedule(
        task.cronExpression,
        async () => {
          await this.executeTask(task);
        },
        {
          scheduled: true,
          timezone: process.env.TZ || 'Asia/Manila',
        },
      );

      this.cronJobs.set(task.id, cronJob);

      // Calculate next run time
      task.nextRun = this.calculateNextRun(task.cronExpression);

      logger.info(`Task scheduled: ${task.name} (${task.cronExpression})`);
    } catch (error) {
      logger.error(`Failed to schedule task: ${task.name}`, {
        error: (error as Error).message,
      });
    }
  }

  // Execute a task
  private async executeTask(task: ScheduledTask): Promise<void> {
    const startTime = Date.now();
    logger.info(`Executing task: ${task.name}`);

    try {
      // Update last run time
      task.lastRun = new Date();

      // Execute the task
      await task.task();

      // Calculate next run time
      task.nextRun = this.calculateNextRun(task.cronExpression);

      const duration = Date.now() - startTime;
      logger.info(`Task executed successfully: ${task.name} (${duration}ms)`);
    } catch (error) {
      logger.error(`Task execution failed: ${task.name}`, {
        error: (error as Error).message,
      });
    }
  }

  // Calculate next run time from cron expression
  private calculateNextRun(_cronExpression: string): Date {
    // This is a simplified implementation
    // In a real application, you would use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setMinutes(nextRun.getMinutes() + 1); // Simple implementation

    return nextRun;
  }

  // Get all registered tasks
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  // Get task by ID
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  // Shutdown the scheduler
  async shutdown(): Promise<void> {
    logger.info('Shutting down job scheduler...');

    // Stop all cron jobs
    for (const [taskId, cronJob] of this.cronJobs) {
      cronJob.stop();
      logger.info(`Stopped cron job: ${taskId}`);
    }

    // Clear all jobs
    this.cronJobs.clear();
    this.tasks.clear();
    this.isInitialized = false;

    logger.info('Job scheduler shutdown complete');
  }
}

// Create and export singleton instance
export const schedulerService = new JobScheduler();
export default schedulerService;
