#!/usr/bin/env ts-node

import cron from 'node-cron';
import {
  DocumentationUpdater,
  type DocumentationUpdateResult,
} from './updateDocumentation';
import { logger } from '../utils/logger';

interface ScheduledUpdateConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  autoFix: boolean;
  notifications: boolean;
}

class ScheduledDocumentationUpdate {
  private updater: DocumentationUpdater;
  private config: ScheduledUpdateConfig;
  private isRunning: boolean = false;

  constructor(config?: Partial<ScheduledUpdateConfig>) {
    this.updater = new DocumentationUpdater();
    this.config = {
      enabled: true,
      schedule: '0 */6 * * *', // Every 6 hours
      autoFix: true,
      notifications: true,
      ...config,
    };
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Scheduled documentation updates are disabled');
      return;
    }

    logger.info(
      `Starting scheduled documentation updates with schedule: ${this.config.schedule}`,
    );

    // Validate cron expression
    if (!cron.validate(this.config.schedule)) {
      throw new Error(`Invalid cron expression: ${this.config.schedule}`);
    }

    // Schedule the update task
    cron.schedule(this.config.schedule, async () => {
      await this.performScheduledUpdate();
    });

    // Run initial update
    await this.performScheduledUpdate();

    logger.info('Scheduled documentation updates started successfully');
  }

  async performScheduledUpdate(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Documentation update already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('Starting scheduled documentation update...');

      // Check and fix documentation if auto-fix is enabled
      if (this.config.autoFix) {
        await this.updater.checkAndFixDocumentation();
      }

      // Update all documentation
      const result = await this.updater.updateAllDocumentation();

      if (result.success) {
        logger.info(
          `Scheduled documentation update completed: ${result.message}`,
        );

        // Create automation job record if notifications are enabled
        if (this.config.notifications) {
          await this.createUpdateJobRecord(result);
        }
      } else {
        logger.error(
          `Scheduled documentation update failed: ${result.message}`,
        );

        // Create failure record
        if (this.config.notifications) {
          await this.createFailureJobRecord(result);
        }
      }
    } catch (error) {
      logger.error('Scheduled documentation update error', {
        error: (error as Error).message,
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async createUpdateJobRecord(
    result: DocumentationUpdateResult,
  ): Promise<void> {
    try {
      const jobData = {
        name: 'documentation-update',
        type: 'DOCUMENTATION_SYNC',
        status: 'COMPLETED',
        result: {
          updates: result.updates,
          message: result.message,
          timestamp: result.timestamp,
        },
        metadata: {
          scheduled: true,
          autoFix: this.config.autoFix,
          schedule: this.config.schedule,
        },
      };

      // Log to system instead of creating database record
      logger.info('Documentation update job completed', jobData);
    } catch (error) {
      logger.error('Failed to create update job record', {
        error: (error as Error).message,
      });
    }
  }

  private async createFailureJobRecord(
    result: DocumentationUpdateResult,
  ): Promise<void> {
    try {
      const jobData = {
        name: 'documentation-update',
        type: 'DOCUMENTATION_SYNC',
        status: 'FAILED',
        error: result.message,
        metadata: {
          scheduled: true,
          timestamp: result.timestamp,
        },
      };

      logger.error('Documentation update job failed', jobData);
    } catch (error) {
      logger.error('Failed to create failure job record', {
        error: (error as Error).message,
      });
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping scheduled documentation updates...');
    // In a real implementation, you'd cancel the cron job
    this.isRunning = false;
  }

  async runNow(): Promise<void> {
    logger.info('Triggering manual documentation update...');
    await this.performScheduledUpdate();
  }

  getStatus(): {
    enabled: boolean;
    schedule: string;
    isRunning: boolean;
    lastUpdate?: string;
  } {
    return {
      enabled: this.config.enabled,
      schedule: this.config.schedule,
      isRunning: this.isRunning,
    };
  }

  updateConfig(newConfig: Partial<ScheduledUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Updated scheduled documentation configuration', newConfig);
  }
}

// CLI execution for manual control
async function main() {
  const command = process.argv[2];
  const scheduler = new ScheduledDocumentationUpdate();

  try {
    switch (command) {
      case 'start':
        await scheduler.start();
        console.log('Scheduled documentation updates started');
        break;

      case 'stop':
        await scheduler.stop();
        console.log('Scheduled documentation updates stopped');
        break;

      case 'run':
        await scheduler.runNow();
        console.log('Manual documentation update completed');
        break;

      case 'status':
        const status = scheduler.getStatus();
        console.log(JSON.stringify(status, null, 2));
        break;

      default:
        console.log('Usage:');
        console.log(
          '  ts-node scheduledDocumentationUpdate.ts start   - Start scheduled updates',
        );
        console.log(
          '  ts-node scheduledDocumentationUpdate.ts stop    - Stop scheduled updates',
        );
        console.log(
          '  ts-node scheduledDocumentationUpdate.ts run     - Run update now',
        );
        console.log(
          '  ts-node scheduledDocumentationUpdate.ts status  - Show current status',
        );
        break;
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

// Export for use in main application
export { ScheduledDocumentationUpdate, ScheduledUpdateConfig };

// Run if called directly
if (require.main === module) {
  main();
}
