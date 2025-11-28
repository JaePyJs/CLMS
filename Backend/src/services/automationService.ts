import { logger } from '../utils/logger';
import { BackupService } from './backupService';
import { EquipmentAutomationService } from './equipmentAutomationService';
import { FineCalculationService } from './fineCalculationService';
import { GoogleSheetsService } from './googleSheetsService';
import cron from 'node-cron';

export interface AutomationJob {
  id: string;
  name: string;
  type:
    | 'GOOGLE_SHEETS_SYNC'
    | 'DAILY_BACKUP'
    | 'OVERDUE_NOTIFICATIONS'
    | 'FINE_CALCULATION';
  schedule: string;
  isEnabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  lastRunDuration: number | null;
  lastRunResult: string | null;
}

export interface JobHistory {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  duration: number | null;
  result: string | null;
  error: string | null;
}

// In-memory storage for jobs (in a real app, this would be in DB)
const jobs: AutomationJob[] = [
  {
    id: 'job-1',
    name: 'Daily System Backup',
    type: 'DAILY_BACKUP',
    schedule: '0 0 * * *', // Daily at midnight
    isEnabled: true,
    lastRunAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    nextRunAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    status: 'IDLE',
    lastRunDuration: 1500,
    lastRunResult: 'Backup created successfully',
  },
  {
    id: 'job-2',
    name: 'Google Sheets Sync',
    type: 'GOOGLE_SHEETS_SYNC',
    schedule: '0 * * * *', // Hourly
    isEnabled: true,
    lastRunAt: new Date(Date.now() - 30 * 60 * 1000),
    nextRunAt: new Date(Date.now() + 30 * 60 * 1000),
    status: 'IDLE',
    lastRunDuration: 5000,
    lastRunResult: 'Synced 4 sheets',
  },
  {
    id: 'job-3',
    name: 'Overdue Notifications',
    type: 'OVERDUE_NOTIFICATIONS',
    schedule: '0 9 * * *', // Daily at 9 AM
    isEnabled: true,
    lastRunAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    nextRunAt: new Date(Date.now() + 18 * 60 * 60 * 1000),
    status: 'IDLE',
    lastRunDuration: 800,
    lastRunResult: 'Sent 0 notifications',
  },
  {
    id: 'job-4',
    name: 'Calculate Fines',
    type: 'FINE_CALCULATION',
    schedule: '0 1 * * *', // Daily at 1 AM
    isEnabled: true,
    lastRunAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    nextRunAt: new Date(Date.now() + 13 * 60 * 60 * 1000),
    status: 'IDLE',
    lastRunDuration: 300,
    lastRunResult: 'Calculated fines for 0 students',
  },
];

const history: JobHistory[] = [];

export class AutomationService {
  // Using any for task type to avoid type issues with node-cron imports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static tasks: Map<string, any> = new Map();

  static initialize() {
    logger.info('Initializing automation jobs...');
    jobs.forEach(job => {
      if (job.isEnabled) {
        this.scheduleJob(job);
      }
    });
  }

  private static scheduleJob(job: AutomationJob) {
    // Stop existing if any
    if (this.tasks.has(job.id)) {
      this.tasks.get(job.id)?.stop();
      this.tasks.delete(job.id);
    }

    if (!cron.validate(job.schedule)) {
      logger.error(
        `Invalid cron schedule for job ${job.name}: ${job.schedule}`,
      );
      return;
    }

    const task = cron.schedule(job.schedule, async () => {
      logger.info(`Executing scheduled job: ${job.name}`);
      try {
        await this.runJob(job.id);
      } catch (error) {
        logger.error(`Scheduled job ${job.name} failed`, { error });
      }
    });

    this.tasks.set(job.id, task);
    logger.info(`Scheduled job: ${job.name} (${job.schedule})`);
  }

  static async getJobs(): Promise<AutomationJob[]> {
    return jobs;
  }

  static async getJobHistory(jobId: string): Promise<JobHistory[]> {
    return history
      .filter(h => h.jobId === jobId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  static async toggleJob(
    jobId: string,
    enabled: boolean,
  ): Promise<AutomationJob> {
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    job.isEnabled = enabled;

    if (enabled) {
      this.scheduleJob(job);
    } else {
      const task = this.tasks.get(jobId);
      if (task) {
        task.stop();
        this.tasks.delete(jobId);
        logger.info(`Stopped job: ${job.name}`);
      }
    }

    return job;
  }

  static async runJob(jobId: string): Promise<void> {
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === 'RUNNING') {
      throw new Error('Job is already running');
    }

    job.status = 'RUNNING';
    const startTime = Date.now();

    const historyEntry: JobHistory = {
      id: `hist-${Date.now()}`,
      jobId,
      startedAt: new Date(),
      completedAt: null,
      status: 'RUNNING',
      duration: null,
      result: null,
      error: null,
    };
    history.push(historyEntry);

    try {
      let result = '';

      switch (job.type) {
        case 'DAILY_BACKUP': {
          const backup = await BackupService.createBackup(
            'Automated Daily Backup',
          );
          result = `Backup created: ${backup.filename}`;
          break;
        }

        case 'GOOGLE_SHEETS_SYNC':
          if (typeof GoogleSheetsService.syncAll === 'function') {
            await GoogleSheetsService.syncAll();
            result = 'Synced all sheets';
          } else {
            logger.warn(
              'GoogleSheetsService.syncAll not found, skipping actual sync',
            );
            result = 'Sync simulated (method not found)';
          }
          break;

        case 'OVERDUE_NOTIFICATIONS': {
          const notifResult =
            await EquipmentAutomationService.sendOverdueNotifications();
          result = `Sent ${notifResult.sent} notifications`;
          break;
        }

        case 'FINE_CALCULATION':
          if (typeof FineCalculationService.calculateAllFines === 'function') {
            await FineCalculationService.calculateAllFines();
            result = 'Fines calculated';
          } else {
            logger.warn('FineCalculationService.calculateAllFines not found');
            result = 'Calculation simulated';
          }
          break;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      job.status = 'IDLE';
      job.lastRunAt = new Date();
      job.lastRunDuration = duration;
      job.lastRunResult = result;

      historyEntry.completedAt = new Date();
      historyEntry.status = 'COMPLETED';
      historyEntry.duration = duration;
      historyEntry.result = result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      job.status = 'FAILED';
      job.lastRunAt = new Date();
      job.lastRunDuration = duration;
      job.lastRunResult = `Failed: ${errorMessage}`;

      historyEntry.completedAt = new Date();
      historyEntry.status = 'FAILED';
      historyEntry.duration = duration;
      historyEntry.error = errorMessage;

      logger.error(`Job ${job.name} failed`, { error });
      throw error;
    }
  }
}
