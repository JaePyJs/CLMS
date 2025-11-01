import Bull, { Job, JobOptions } from 'bull';
import {
  PrismaClient,
  notifications_type,
  notifications_priority,
} from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import cron from 'node-cron';
import { NoopQueue } from '../utils/noopQueue';

const prisma = new PrismaClient();

const queuesDisabled = process.env.DISABLE_QUEUES === 'true';
const disableScheduledTasks = process.env.DISABLE_SCHEDULED_TASKS === 'true';

// Create notification queues
let notificationQueue: any;
if (queuesDisabled) {
  logger.warn('DISABLE_QUEUES=true; notification queue will not initialize');
  notificationQueue = new NoopQueue();
} else {
  notificationQueue = new Bull('notifications', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
}

let scheduledNotificationQueue: any;
if (queuesDisabled) {
  logger.warn('DISABLE_QUEUES=true; scheduled notification queue will not initialize');
  scheduledNotificationQueue = new NoopQueue();
} else {
  scheduledNotificationQueue = new Bull('scheduled-notifications', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });
}

// Attach error handlers early to avoid process crash on Redis connection errors
notificationQueue.on('error', (error: any) => {
  logger.warn('Notification queue connection error', {
    error: error?.message || String(error),
  });
});

scheduledNotificationQueue.on('error', (error: any) => {
  logger.warn('Scheduled notification queue connection error', {
    error: error?.message || String(error),
  });
});

// Types for different notification jobs
interface DueDateReminderJob {
  studentId: string;
  bookId: string;
  checkoutId: string;
  dueDate: Date;
  daysUntilDue: number;
}

interface OverdueNoticeJob {
  studentId: string;
  checkoutId: string;
  daysOverdue: number;
  fineAmount: number;
}

interface HoldAvailableJob {
  studentId: string;
  bookId: string;
  holdId: string;
}

interface SystemMaintenanceJob {
  title: string;
  message: string;
  scheduledTime: Date;
  affectedUsers?: string[];
}

class NotificationWorker {
  private readonly isEnabled = !queuesDisabled;

  constructor() {
    this.setupEventHandlers();

    if (this.isEnabled) {
      this.setupProcessors();
    } else {
      logger.info('NotificationWorker disabled via DISABLE_QUEUES');
    }

    if (!disableScheduledTasks && this.isEnabled) {
      this.setupScheduledTasks();
    } else {
      logger.info('Scheduled tasks disabled via DISABLE_SCHEDULED_TASKS or queues disabled');
    }
  }

  // Setup queue processors
  private setupProcessors() {
    // Process scheduled notifications
    scheduledNotificationQueue.process(
      'send-scheduled-notification',
      async (job: Job) => {
        return this.processScheduledNotification(job);
      },
    );

    // Process due date reminders
    scheduledNotificationQueue.process(
      'due-date-reminder',
      async (job: Job) => {
        return this.processDueDateReminder(job);
      },
    );

    // Process overdue notices
    scheduledNotificationQueue.process('overdue-notice', async (job: Job) => {
      return this.processOverdueNotice(job);
    });

    // Process hold available notifications
    scheduledNotificationQueue.process('hold-available', async (job: Job) => {
      return this.processHoldAvailable(job);
    });

    // Process system maintenance notifications
    scheduledNotificationQueue.process(
      'system-maintenance',
      async (job: Job) => {
        return this.processSystemMaintenance(job);
      },
    );

    // Process equipment session reminders
    scheduledNotificationQueue.process(
      'equipment-session-reminder',
      async (job: Job) => {
        return this.processEquipmentSessionReminder(job);
      },
    );

    // Process daily digest notifications
    scheduledNotificationQueue.process('daily-digest', async (job: Job) => {
      return this.processDailyDigest(job);
    });
  }

  // Setup scheduled tasks using cron
  private setupScheduledTasks() {
    // Check for due books (every hour at minute 0)
    cron.schedule('0 * * * *', async () => {
      await this.checkDueBooks();
    });

    // Process overdue notices (daily at 9:00 AM)
    cron.schedule('0 9 * * *', async () => {
      await this.processOverdueNotices();
    });

    // Check for available holds (every 30 minutes)
    cron.schedule('*/30 * * * *', async () => {
      await this.checkAvailableHolds();
    });

    // Check expiring equipment sessions (every 10 minutes)
    cron.schedule('*/10 * * * *', async () => {
      await this.checkExpiringSessions();
    });

    // Send daily digest (every day at 8:00 PM)
    cron.schedule('0 20 * * *', async () => {
      await this.sendDailyDigest();
    });

    // Clean up old notifications (weekly on Sunday at 2:00 AM)
    cron.schedule('0 2 * * 0', async () => {
      await this.cleanupOldNotifications();
    });

    logger.info('Scheduled notification tasks initialized');
  }

  // Setup queue event handlers
  private setupEventHandlers() {
    scheduledNotificationQueue.on('completed', (job: Job, result: any) => {
      logger.info('Notification job completed', {
        jobId: job.id,
        type: job.data.type,
        result,
      });
    });

    scheduledNotificationQueue.on('failed', (job: Job, err: Error) => {
      logger.error('Notification job failed', {
        jobId: job.id,
        type: job.data.type,
        error: err.message,
        attemptsMade: job.attemptsMade + 1,
      });
    });

    scheduledNotificationQueue.on('stalled', (job: Job) => {
      logger.warn('Notification job stalled', {
        jobId: job.id,
        type: job.data.type,
      });
    });
  }

  // Process scheduled notification
  private async processScheduledNotification(job: Job): Promise<any> {
    const { notificationData } = job.data;

    try {
      const notification =
        await notificationService.createNotification(notificationData);

      logger.info('Scheduled notification sent', {
        notificationId: notification.id,
        type: notificationData.type,
        userId: notificationData.user_id ?? notificationData.userId,
      });

      return { success: true, notificationId: notification.id };
    } catch (error) {
      logger.error('Failed to send scheduled notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationData,
      });
      throw error;
    }
  }

  // Check for due books and send reminders
  private async checkDueBooks(): Promise<void> {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999);

      // Find books due in 1 day and 3 days
      const upcomingDueBooks = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
        },
        include: {
          books: {
            select: {
              id: true,
              accession_no: true,
              title: true,
              author: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      for (const checkout of upcomingDueBooks) {
        const daysUntilDue = Math.ceil(
          (checkout.due_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        // Send reminder for 3 days and 1 day before due date
        if (daysUntilDue === 3 || daysUntilDue === 1) {
          await this.scheduleDueDateReminder({
            studentId: checkout.student_id,
            bookId: checkout.book_id,
            checkoutId: checkout.id,
            dueDate: checkout.due_date,
            daysUntilDue,
          });
        }
      }

      logger.info('Due book check completed', {
        found: upcomingDueBooks.length,
      });
    } catch (error) {
      logger.error('Failed to check due books', {
        error: (error as Error).message,
      });
    }
  }

  // Schedule due date reminder
  private async scheduleDueDateReminder(
    data: DueDateReminderJob,
  ): Promise<void> {
    const jobData = {
      type: 'due-date-reminder',
      ...data,
    };

    await scheduledNotificationQueue.add('due-date-reminder', jobData, {
      delay: 0, // Send immediately
      priority: 8,
    });
  }

  // Process due date reminder
  private async processDueDateReminder(job: Job): Promise<any> {
    const { studentId, bookId, checkoutId, dueDate, daysUntilDue } =
      job.data as DueDateReminderJob;

    try {
      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: {
          books: {
            select: {
              id: true,
              accession_no: true,
              title: true,
              author: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!checkout || checkout.status !== 'ACTIVE') {
        return { success: false, reason: 'Checkout not found or not active' };
      }

      await notificationService.createNotification({
        user_id: studentId,
        type: 'BOOK_DUE_SOON',
        title: `Book Due in ${daysUntilDue} Day${daysUntilDue > 1 ? 's' : ''}`,
        message: `Your book "${checkout.books.title}" is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''} on ${dueDate.toLocaleDateString()}. Please return it to the library to avoid late fees.`,
        priority: daysUntilDue === 1 ? 'HIGH' : 'NORMAL',
        action_url: `/books/${bookId}`,
        metadata: {
          checkoutId,
          bookId,
          dueDate: dueDate.toISOString(),
          daysUntilDue,
        },
      });

      return { success: true, daysUntilDue };
    } catch (error) {
      logger.error('Failed to process due date reminder', {
        error,
        checkoutId,
      });
      throw error;
    }
  }

  // Process overdue notices
  private async processOverdueNotices(): Promise<void> {
    try {
      const overdueCheckouts = await prisma.book_checkouts.findMany({
        where: {
          status: 'ACTIVE',
          due_date: {
            lt: new Date(),
          },
        },
        include: {
          books: {
            select: {
              id: true,
              accession_no: true,
              title: true,
              author: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      for (const checkout of overdueCheckouts) {
        const daysOverdue = Math.ceil(
          (Date.now() - checkout.due_date.getTime()) / (1000 * 60 * 60 * 24),
        );

        await this.scheduleOverdueNotice({
          studentId: checkout.student_id,
          checkoutId: checkout.id,
          daysOverdue,
          fineAmount: parseFloat(checkout.fine_amount.toString()),
        });
      }

      logger.info('Overdue notice processing completed', {
        found: overdueCheckouts.length,
      });
    } catch (error) {
      logger.error('Failed to process overdue notices', { error });
    }
  }

  // Schedule overdue notice
  private async scheduleOverdueNotice(data: OverdueNoticeJob): Promise<void> {
    const jobData = {
      type: 'overdue-notice',
      ...data,
    };

    await scheduledNotificationQueue.add('overdue-notice', jobData, {
      delay: 0,
      priority: 9, // High priority for overdue notices
    });
  }

  // Process overdue notice
  private async processOverdueNotice(job: Job): Promise<any> {
    const { studentId, checkoutId, daysOverdue, fineAmount } =
      job.data as OverdueNoticeJob;

    try {
      const checkout = await prisma.book_checkouts.findUnique({
        where: { id: checkoutId },
        include: {
          books: {
            select: {
              id: true,
              accession_no: true,
              title: true,
              author: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!checkout) {
        return { success: false, reason: 'Checkout not found' };
      }

      const priority =
        daysOverdue > 7 ? 'URGENT' : daysOverdue > 3 ? 'HIGH' : 'NORMAL';

      await notificationService.createNotification({
        user_id: studentId,
        type: 'OVERDUE_BOOK',
        title: `Book Overdue - ${daysOverdue} Day${daysOverdue > 1 ? 's' : ''}`,
        message: `Your book "${checkout.books.title}" is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Current fine: $${fineAmount.toFixed(2)}. Please return it as soon as possible.`,
        priority,
        action_url: `/books/${checkout.book_id}`,
        metadata: {
          checkoutId,
          bookId: checkout.book_id,
          daysOverdue,
          fineAmount,
        },
      });

      return { success: true, daysOverdue, fineAmount };
    } catch (error) {
      logger.error('Failed to process overdue notice', { error, checkoutId });
      throw error;
    }
  }

  // Check for available holds
  private async checkAvailableHolds(): Promise<void> {
    // This would be implemented when the hold system is added
    // For now, it's a placeholder
  }

  // Process hold available notification
  private async processHoldAvailable(job: Job): Promise<any> {
    const { studentId, bookId, holdId } = job.data as HoldAvailableJob;

    try {
      const book = await prisma.books.findUnique({
        where: { id: bookId },
      });

      if (!book) {
        return { success: false, reason: 'Book not found' };
      }

      await notificationService.createNotification({
        user_id: studentId,
        type: 'INFO',
        title: 'Book Available for Pickup',
        message: `The book "${book.title}" you placed on hold is now available for pickup. Please collect it within 3 days.`,
        priority: 'HIGH',
        action_url: `/books/${bookId}`,
        metadata: {
          holdId,
          bookId,
        },
      });

      return { success: true, bookId, title: book.title };
    } catch (error) {
      logger.error('Failed to process hold available notification', {
        error,
        holdId,
      });
      throw error;
    }
  }

  // Check for expiring equipment sessions
  private async checkExpiringSessions(): Promise<void> {
    try {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

      const expiringSessions = await prisma.equipment_sessions.findMany({
        where: {
          status: 'ACTIVE',
          planned_end: {
            lte: fiveMinutesFromNow,
            gte: new Date(),
          },
        },
        include: {
          equipment: {
            select: {
              id: true,
              equipment_id: true,
              name: true,
              type: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      for (const session of expiringSessions) {
        await this.scheduleEquipmentSessionReminder(session.id);
      }

      logger.info('Expiring session check completed', {
        found: expiringSessions.length,
      });
    } catch (error) {
      logger.error('Failed to check expiring sessions', { error });
    }
  }

  // Schedule equipment session reminder
  private async scheduleEquipmentSessionReminder(
    sessionId: string,
  ): Promise<void> {
    const jobData = {
      type: 'equipment-session-reminder',
      sessionId,
    };

    await scheduledNotificationQueue.add(
      'equipment-session-reminder',
      jobData,
      {
        delay: 0,
        priority: 7,
      },
    );
  }

  // Process equipment session reminder
  private async processEquipmentSessionReminder(job: Job): Promise<any> {
    const { sessionId } = job.data;

    try {
      const session = await prisma.equipment_sessions.findUnique({
        where: { id: sessionId },
        include: {
          equipment: {
            select: {
              id: true,
              equipment_id: true,
              name: true,
              type: true,
            },
          },
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!session || session.status !== 'ACTIVE') {
        return { success: false, reason: 'Session not found or not active' };
      }

      await notificationService.createNotification({
        user_id: session.student_id,
        type: 'EQUIPMENT_EXPIRING',
        title: 'Equipment Session Expiring Soon',
        message: `Your session for ${session.equipment.name} will expire in 5 minutes. Please save your work and prepare to finish.`,
        priority: 'HIGH',
        action_url: `/equipment/${session.equipment_id}`,
        metadata: {
          sessionId,
          equipmentId: session.equipment_id,
        },
      });

      return {
        success: true,
        sessionId,
        equipmentName: session.equipment.name,
      };
    } catch (error) {
      logger.error('Failed to process equipment session reminder', {
        error,
        sessionId,
      });
      throw error;
    }
  }

  // Send daily digest notifications
  private async sendDailyDigest(): Promise<void> {
    try {
      // Get all active users with digest enabled
      const users = await prisma.users.findMany({
        where: {
          is_active: true,
        },
        select: { id: true, email: true, full_name: true },
      });

      for (const user of users) {
        const preferences =
          await notificationService.getUserNotificationPreferences(user.id);

        // Only send digest if user has email notifications enabled
        if (preferences.emailNotifications) {
          await scheduledNotificationQueue.add(
            'daily-digest',
            {
              type: 'daily-digest',
              user_id: user.id,
              user_email: user.email,
              user_name: user.full_name,
            },
            {
              delay: Math.random() * 60000, // Random delay to spread load
              priority: 3,
            },
          );
        }
      }

      logger.info('Daily digest scheduled for all users', {
        count: users.length,
      });
    } catch (error) {
      logger.error('Failed to send daily digest', { error });
    }
  }

  // Process daily digest
  private async processDailyDigest(job: Job): Promise<any> {
    const { user_id: userId, user_email: userEmail } = job.data;

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get user's activities from yesterday
      const activities = await prisma.student_activities.findMany({
        where: {
          created_at: {
            gte: yesterday,
            lt: today,
          },
        },
        include: {
          students: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
            },
          },
          equipment: {
            select: {
              id: true,
              equipment_id: true,
              name: true,
              type: true,
            },
          },
        },
        take: 10,
      });

      // Get unread notifications count
      const unreadCount = await prisma.notifications.count({
        where: {
          user_id: userId,
          read: false,
        },
      });

      if (activities.length === 0 && unreadCount === 0) {
        return { success: true, message: 'No digest content' };
      }

      const digestContent = this.generateDailyDigestContent(
        activities,
        unreadCount,
      );

      await notificationService.createNotification({
        user_id: userId,
        type: 'INFO',
        title: 'Daily Library Activity Digest',
        message: digestContent,
        priority: 'LOW',
        sendEmail: true,
        email_to: userEmail,
        metadata: {
          digestType: 'daily',
          activityCount: activities.length,
          unreadNotifications: unreadCount,
          date: yesterday.toISOString(),
        },
      });

      return { success: true, activityCount: activities.length, unreadCount };
    } catch (error) {
      logger.error('Failed to process daily digest', { error, userId });
      throw error;
    }
  }

  // Generate daily digest content
  private generateDailyDigestContent(
    activities: any[],
    unreadCount: number,
  ): string {
    let content = `Here's your daily library activity summary:\n\n`;

    if (activities.length > 0) {
      content += `📚 Recent Activities (${activities.length}):\n`;
      activities.forEach(activity => {
        content += `• ${activity.students?.first_name || 'Student'} - ${activity.activity_type}\n`;
      });
      content += '\n';
    }

    if (unreadCount > 0) {
      content += `🔔 You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.\n`;
    }

    if (activities.length === 0 && unreadCount === 0) {
      content += 'No new activities or notifications from yesterday.';
    }

    return content;
  }

  // Clean up old notifications
  private async cleanupOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.notifications.deleteMany({
        where: {
          created_at: {
            lt: thirtyDaysAgo,
          },
          read: true,
        },
      });

      logger.info('Old notifications cleanup completed', {
        deleted: result.count,
      });
    } catch (error) {
      logger.error('Failed to cleanup old notifications', { error });
    }
  }

  // Schedule system maintenance notification
  async scheduleSystemMaintenance(data: SystemMaintenanceJob): Promise<string> {
    if (!this.isEnabled) {
      logger.warn('Queues disabled; system maintenance scheduling is a no-op', { data });
      return `noop_${Date.now()}`;
    }

    const jobData = {
      type: 'system-maintenance',
      ...data,
    };

    const job = await scheduledNotificationQueue.add(
      'system-maintenance',
      jobData,
      {
        delay: data.scheduledTime.getTime() - Date.now(),
        priority: 10,
      },
    );

    return job.id?.toString?.() || `noop_${Date.now()}`;
  }

  // Process system maintenance notification
  private async processSystemMaintenance(job: Job): Promise<any> {
    const { title, message, affectedUsers } = job.data as SystemMaintenanceJob;

    try {
      const usersToNotify = affectedUsers || (await this.getAllActiveUsers());

      for (const userId of usersToNotify) {
        await notificationService.createNotification({
          user_id: userId,
          type: 'SYSTEM_ALERT',
          title,
          message,
          priority: 'HIGH',
          metadata: {
            maintenanceType: 'scheduled',
            scheduledTime: job.data.scheduledTime,
          },
        });
      }

      return { success: true, notifiedUsers: usersToNotify.length };
    } catch (error) {
      logger.error('Failed to process system maintenance notification', {
        error,
        title,
      });
      throw error;
    }
  }

  // Get all active users
  private async getAllActiveUsers(): Promise<string[]> {
    const users = await prisma.users.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    return users.map(user => user.id);
  }

  // Get queue statistics
  async getQueueStats(): Promise<{
    scheduledNotifications: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    const [waitingJobs, activeJobs, completedJobs, failedJobs] =
      await Promise.all([
        scheduledNotificationQueue.getWaiting(),
        scheduledNotificationQueue.getActive(),
        scheduledNotificationQueue.getCompleted(),
        scheduledNotificationQueue.getFailed(),
      ]);

    return {
      scheduledNotifications: {
        waiting: waitingJobs.length,
        active: activeJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
      },
    };
  }

  // Pause all queues
  async pauseQueues(): Promise<void> {
    await scheduledNotificationQueue.pause();
  }

  // Resume all queues
  async resumeQueues(): Promise<void> {
    await scheduledNotificationQueue.resume();
  }
}

// Export singleton instance
export const notificationWorker = new NotificationWorker();
export default notificationWorker;
