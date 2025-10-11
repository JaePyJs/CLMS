#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledDocumentationUpdate = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const updateDocumentation_1 = require("./updateDocumentation");
const logger_1 = require("../utils/logger");
class ScheduledDocumentationUpdate {
    updater;
    config;
    isRunning = false;
    constructor(config) {
        this.updater = new updateDocumentation_1.DocumentationUpdater();
        this.config = {
            enabled: true,
            schedule: '0 */6 * * *',
            autoFix: true,
            notifications: true,
            ...config,
        };
    }
    async start() {
        if (!this.config.enabled) {
            logger_1.logger.info('Scheduled documentation updates are disabled');
            return;
        }
        logger_1.logger.info(`Starting scheduled documentation updates with schedule: ${this.config.schedule}`);
        if (!node_cron_1.default.validate(this.config.schedule)) {
            throw new Error(`Invalid cron expression: ${this.config.schedule}`);
        }
        node_cron_1.default.schedule(this.config.schedule, async () => {
            await this.performScheduledUpdate();
        });
        await this.performScheduledUpdate();
        logger_1.logger.info('Scheduled documentation updates started successfully');
    }
    async performScheduledUpdate() {
        if (this.isRunning) {
            logger_1.logger.warn('Documentation update already in progress, skipping');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting scheduled documentation update...');
            if (this.config.autoFix) {
                await this.updater.checkAndFixDocumentation();
            }
            const result = await this.updater.updateAllDocumentation();
            if (result.success) {
                logger_1.logger.info(`Scheduled documentation update completed: ${result.message}`);
                if (this.config.notifications) {
                    await this.createUpdateJobRecord(result);
                }
            }
            else {
                logger_1.logger.error(`Scheduled documentation update failed: ${result.message}`);
                if (this.config.notifications) {
                    await this.createFailureJobRecord(result);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Scheduled documentation update error', {
                error: error.message,
            });
        }
        finally {
            this.isRunning = false;
        }
    }
    async createUpdateJobRecord(result) {
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
            logger_1.logger.info('Documentation update job completed', jobData);
        }
        catch (error) {
            logger_1.logger.error('Failed to create update job record', {
                error: error.message,
            });
        }
    }
    async createFailureJobRecord(result) {
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
            logger_1.logger.error('Documentation update job failed', jobData);
        }
        catch (error) {
            logger_1.logger.error('Failed to create failure job record', {
                error: error.message,
            });
        }
    }
    async stop() {
        logger_1.logger.info('Stopping scheduled documentation updates...');
        this.isRunning = false;
    }
    async runNow() {
        logger_1.logger.info('Triggering manual documentation update...');
        await this.performScheduledUpdate();
    }
    getStatus() {
        return {
            enabled: this.config.enabled,
            schedule: this.config.schedule,
            isRunning: this.isRunning,
        };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        logger_1.logger.info('Updated scheduled documentation configuration', newConfig);
    }
}
exports.ScheduledDocumentationUpdate = ScheduledDocumentationUpdate;
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
                console.log('  ts-node scheduledDocumentationUpdate.ts start   - Start scheduled updates');
                console.log('  ts-node scheduledDocumentationUpdate.ts stop    - Stop scheduled updates');
                console.log('  ts-node scheduledDocumentationUpdate.ts run     - Run update now');
                console.log('  ts-node scheduledDocumentationUpdate.ts status  - Show current status');
                break;
        }
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=scheduledDocumentationUpdate.js.map