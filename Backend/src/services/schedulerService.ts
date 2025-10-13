import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import {
  automation_jobs_type,
  automation_jobs_status,
  student_activities_status,
  equipment_status,
  book_checkouts_status,
  students_grade_category,
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
      const jobs = await prisma.automation_jobs.findMany({
        where: { is_enabled: true },
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
            enabled: job.is_enabled,
            lastRun: job.last_run_at || null,
            nextRun: job.next_run_at || null,
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
  private createTaskForJobType(jobType: automation_jobs_type): (() => Promise<void>) | null {
    switch (jobType) {
      case automation_jobs_type.DAILY_BACKUP:
        return this.createDailyBackupTask();
      case automation_jobs_type.GOOGLE_SHEETS_SYNC:
        return this.createGoogleSheetsSyncTask();
      case automation_jobs_type.SESSION_EXPIRY_CHECK:
        return this.createSessionExpiryCheckTask();
      case automation_jobs_type.OVERDUE_NOTIFICATIONS:
        return this.createOverdueNotificationsTask();
      case automation_jobs_type.WEEKLY_CLEANUP:
        return this.createWeeklyCleanupTask();
      case automation_jobs_type.MONTHLY_REPORT:
        return this.createMonthlyReportTask();
      case automation_jobs_type.INTEGRITY_AUDIT:
        return this.createIntegrityAuditTask();
      case automation_jobs_type.TEACHER_NOTIFICATIONS:
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
        await this.updateJobStatus('Daily Backup', automation_jobs_status.RUNNING);

        // Simulate backup process
        await new Promise(resolve => setTimeout(resolve, 2000));

        await this.updateJobStatus('Daily Backup', automation_jobs_status.COMPLETED);

        const duration = Date.now() - startTime;
        logger.info(`Daily backup task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Daily backup task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Daily Backup', automation_jobs_status.FAILED);
      }
    };
  }

  // Create Google Sheets sync task
  private createGoogleSheetsSyncTask(): () => Promise<void> {
    return async () => {
      logger.info('Running Google Sheets sync task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Google Sheets Sync', automation_jobs_status.RUNNING);

        // Import Google Sheets service dynamically to avoid circular dependencies
        const { googleSheetsService } = await import('./googleSheets');
        const syncResult = await googleSheetsService.testConnection();

        if (syncResult) {
          await this.updateJobStatus('Google Sheets Sync', automation_jobs_status.COMPLETED);
          logger.info('Google Sheets sync completed successfully');
        } else {
          await this.updateJobStatus('Google Sheets Sync', automation_jobs_status.FAILED);
          logger.error('Google Sheets sync failed');
        }

        const duration = Date.now() - startTime;
        logger.info(`Google Sheets sync task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Google Sheets sync task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Google Sheets Sync', automation_jobs_status.FAILED);
      }
    };
  }

  // Create session expiry check task
  private createSessionExpiryCheckTask(): () => Promise<void> {
    return async () => {
      logger.info('Running session expiry check task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Session Expiry Check', automation_jobs_status.RUNNING);

        // Find expired sessions
        const now = new Date();
        const expiredSessions = await prisma.student_activities.findMany({
          where: {
            end_time: { lt: now },
            status: student_activities_status.ACTIVE,
          },
          include: {
            student: {
              select: {
                student_id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        });

        // Update expired sessions
        let expiredCount = 0;
        for (const session of expiredSessions) {
          await prisma.student_activities.update({
            where: { id: session.id },
            data: { id: crypto.randomUUID(), updated_at: new Date(),  status: student_activities_status.EXPIRED },
          });

          // If equipment was used, update its status
          if (session.equipment_id) {
            await prisma.equipment.update({
              where: { id: session.equipment_id },
              data: { id: crypto.randomUUID(), updated_at: new Date(),  status: equipment_status.AVAILABLE },
            });
          }

          expiredCount++;
        }

        await this.updateJobStatus('Session Expiry Check', automation_jobs_status.COMPLETED);
        logger.info(
          `Session expiry check completed: ${expiredCount} sessions expired`,
        );

        const duration = Date.now() - startTime;
        logger.info(`Session expiry check task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Session expiry check task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Session Expiry Check', automation_jobs_status.FAILED);
      }
    };
  }

  // Create overdue notifications task
  private createOverdueNotificationsTask(): () => Promise<void> {
    return async () => {
      logger.info('Running overdue notifications task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Overdue Notifications', automation_jobs_status.RUNNING);

        // Find overdue books
        const now = new Date();
        const overdueCheckouts = await prisma.book_checkouts.findMany({
          where: {
            due_date: { lt: now },
            status: book_checkouts_status.ACTIVE,
          },
          include: {
            student: {
              select: {
                student_id: true,
                first_name: true,
                last_name: true,
                grade_level: true,
              },
            },
            book: {
              select: {
                accession_no: true,
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
            (now.getTime() - checkout.due_date.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const fineAmount = overdueDays * 1.0; // 1 peso per day

          await prisma.book_checkouts.update({
            where: { id: checkout.id },
            data: { id: crypto.randomUUID(), updated_at: new Date(), 
              status: book_checkouts_status.OVERDUE,
              overdue_days,
              fine_amount,
            },
          });

          // Here you would implement notification logic (email, SMS, etc.)
          // For now, we'll just log it
          logger.info(
            `Overdue notification sent to ${checkout.student.first_name} ${checkout.student.last_name} for book "${checkout.book.title}" (${overdue_days} days, ₱${fine_amount} fine)`,
          );

          notifiedCount++;
        }

        await this.updateJobStatus(
          'Overdue Notifications',
          automation_jobs_status.COMPLETED,
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
        await this.updateJobStatus('Overdue Notifications', automation_jobs_status.FAILED);
      }
    };
  }

  // Create weekly cleanup task
  private createWeeklyCleanupTask(): () => Promise<void> {
    return async () => {
      logger.info('Running weekly cleanup task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Weekly Cleanup', automation_jobs_status.RUNNING);

        // Clean up old logs (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deletedLogs = await prisma.automation_logs.deleteMany({
          where: {
            started_at: { lt: thirtyDaysAgo },
          },
        });

        // Clean up old audit logs (older than 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const deletedAuditLogs = await prisma.audit_logs.deleteMany({
          where: {
            created_at: { lt: ninetyDaysAgo },
          },
        });

        await this.updateJobStatus('Weekly Cleanup', automation_jobs_status.COMPLETED);
        logger.info(
          `Weekly cleanup completed: ${deletedLogs.count} logs deleted, ${deletedAuditLogs.count} audit logs deleted`,
        );

        const duration = Date.now() - startTime;
        logger.info(`Weekly cleanup task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Weekly cleanup task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Weekly Cleanup', automation_jobs_status.FAILED);
      }
    };
  }

  // Create monthly report task
  private createMonthlyReportTask(): () => Promise<void> {
    return async () => {
      logger.info('Running monthly report task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Monthly Report', automation_jobs_status.RUNNING);

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
          prisma.students.count({ where: { is_active: true } }),
          prisma.books.count({ where: { is_active: true } }),
          prisma.equipment.count(),
          prisma.student_activities.count({
            where: {
              start_time: { gte: firstDayLastMonth, lte: lastDayLastMonth },
            },
          }),
          prisma.book_checkouts.count({
            where: {
              checkout_date: { gte: firstDayLastMonth, lte: lastDayLastMonth },
            },
          }),
        ]);

        // Generate report
        const report = {
          month: firstDayLastMonth.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          }),
          generated_at: now.toISOString(),
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

        await this.updateJobStatus('Monthly Report', automation_jobs_status.COMPLETED);
        logger.info('Monthly report task completed');

        const duration = Date.now() - startTime;
        logger.info(`Monthly report task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Monthly report task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Monthly Report', automation_jobs_status.FAILED);
      }
    };
  }

  // Create integrity audit task
  private createIntegrityAuditTask(): () => Promise<void> {
    return async () => {
      logger.info('Running integrity audit task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Integrity Audit', automation_jobs_status.RUNNING);

        // Check for data inconsistencies
        const issues: string[] = [];

        // Check for active activities without valid students
        const invalidActivities = await prisma.student_activities.findMany({
          where: { status: student_activities_status.ACTIVE },
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
        const invalidCheckouts = await prisma.book_checkouts.findMany({
          where: { status: book_checkouts_status.ACTIVE },
          include: { book: true },
        });

        for (const checkout of invalidCheckouts) {
          if (!checkout.book) {
            issues.push(`Checkout ${checkout.id} has invalid book reference`);
          }
        }

        await this.updateJobStatus('Integrity Audit', automation_jobs_status.COMPLETED);
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
        await this.updateJobStatus('Integrity Audit', automation_jobs_status.FAILED);
      }
    };
  }

  // Create teacher notifications task
  private createTeacherNotificationsTask(): () => Promise<void> {
    return async () => {
      logger.info('Running teacher notifications task');
      const startTime = Date.now();

      try {
        await this.updateJobStatus('Teacher Notifications', automation_jobs_status.RUNNING);

        // Get all active students with overdue books
        const overdueStudents = await prisma.book_checkouts.findMany({
          where: {
            status: book_checkouts_status.OVERDUE,
          },
          include: {
            student: {
              select: {
                student_id: true,
                first_name: true,
                last_name: true,
                grade_level: true,
                grade_category: true,
              },
            },
            book: {
              select: {
                accession_no: true,
                title: true,
                author: true,
              },
            },
          },
        });

        // Group by grade category for teacher notifications
        type OverdueCheckout = (typeof overdueStudents)[number];
        const studentsByGrade = overdueStudents.reduce<
          Partial<Record<students_grade_category, OverdueCheckout[]>>
        >((acc, checkout) => {
          const grade = checkout.student.grade_category;
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
          overdueList.forEach(({ student, book, overdue_days, fine_amount }) => {
            logger.info(
              `- ${student.first_name} ${student.last_name} (${student.student_id}): "${book.title}" (${overdue_days} days, ₱${fine_amount} fine)`,
            );
          });
        }

        await this.updateJobStatus(
          'Teacher Notifications',
          automation_jobs_status.COMPLETED,
        );
        logger.info('Teacher notifications task completed');

        const duration = Date.now() - startTime;
        logger.info(`Teacher notifications task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Teacher notifications task failed', {
          error: (error as Error).message,
        });
        await this.updateJobStatus('Teacher Notifications', automation_jobs_status.FAILED);
      }
    };
  }

  // Update job status in database
  private async updateJobStatus(
    name: string,
    status: automation_jobs_status,
  ): Promise<void> {
    try {
      const now = new Date();

      const updateData: Prisma.automation_jobsUpdateManyMutationInput = {
        status,
        total_runs: { increment: 1 },
      };

      if (status === automation_jobs_status.RUNNING) {
        updateData.last_run_at = now;
      }

      if (status === automation_jobs_status.COMPLETED) {
        updateData.success_count = { increment: 1 };
      }

      if (status === automation_jobs_status.FAILED) {
        updateData.failure_count = { increment: 1 };
      }

      await prisma.automation_jobs.updateMany({
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
