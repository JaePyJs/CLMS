"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationService = exports.AutomationService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const bull_1 = __importDefault(require("bull"));
const ioredis_1 = __importDefault(require("ioredis"));
const client_1 = require("@prisma/client");
const logger_1 = require("@/utils/logger");
const googleSheets_1 = require("./googleSheets");
const errors_1 = require("@/utils/errors");
class AutomationService {
    prisma;
    scheduledJobs = new Map();
    redis;
    queues = new Map();
    isInitialized = false;
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
        });
    }
    resolveJobConfig(rawConfig) {
        if (rawConfig === null || rawConfig === undefined) {
            return {};
        }
        if (typeof rawConfig === 'string') {
            try {
                const parsed = JSON.parse(rawConfig);
                return this.ensureJobConfigObject(parsed);
            }
            catch (error) {
                logger_1.logger.warn('Failed to parse automation job config from string', {
                    error: error.message,
                });
                return {};
            }
        }
        if (Array.isArray(rawConfig)) {
            return { values: rawConfig };
        }
        return this.ensureJobConfigObject(rawConfig);
    }
    ensureJobConfigObject(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.redis.connect();
            logger_1.logger.info('Connected to Redis for automation queues');
            await this.initializeQueues();
            await this.loadScheduledJobs();
            this.setupCleanupInterval();
            this.isInitialized = true;
            logger_1.logger.info('Automation service initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize automation service', {
                error: error.message,
            });
            throw error;
        }
    }
    async initializeQueues() {
        const queueConfigs = [
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
            const queue = new bull_1.default(config.name, {
                redis: this.redis.options,
                ...config.options,
            });
            this.setupJobProcessors(queue, config.name);
            this.setupQueueEventListeners(queue, config.name);
            this.queues.set(config.name, queue);
            logger_1.logger.info(`Initialized queue: ${config.name}`);
        }
    }
    setupJobProcessors(queue, queueName) {
        switch (queueName) {
            case 'backup':
                queue.process('daily-backup', this.processDailyBackup.bind(this));
                queue.process('database-backup', this.processDatabaseBackup.bind(this));
                break;
            case 'sync':
                queue.process('google-sheets-sync', this.processGoogleSheetsSync.bind(this));
                queue.process('activity-sync', this.processActivitySync.bind(this));
                break;
            case 'notifications':
                queue.process('teacher-notifications', this.processTeacherNotifications.bind(this));
                queue.process('overdue-notifications', this.processOverdueNotifications.bind(this));
                break;
            case 'maintenance':
                queue.process('session-expiry-check', this.processSessionExpiryCheck.bind(this));
                queue.process('weekly-cleanup', this.processWeeklyCleanup.bind(this));
                queue.process('integrity-audit', this.processIntegrityAudit.bind(this));
                break;
        }
    }
    setupQueueEventListeners(queue, _queueName) {
        queue.on('completed', (job, result) => {
            logger_1.automationLogger.jobSuccess(job.name, job.id.toString(), job.finishedOn - job.timestamp, result);
        });
        queue.on('failed', (job, err) => {
            logger_1.automationLogger.jobFailure(job.name, job.id.toString(), job.finishedOn - job.timestamp, err);
        });
        queue.on('stalled', (job) => {
            logger_1.logger.warn(`Job stalled: ${job.name} (${job.id})`);
        });
        queue.on('progress', (job, progress) => {
            logger_1.logger.debug(`Job progress: ${job.name} (${job.id}) - ${progress}%`);
        });
    }
    async loadScheduledJobs() {
        try {
            const jobs = await this.prisma.automationJob.findMany({
                where: { isEnabled: true },
            });
            for (const job of jobs) {
                await this.scheduleJob(job);
            }
            logger_1.logger.info(`Loaded ${jobs.length} scheduled jobs`);
        }
        catch (error) {
            logger_1.logger.error('Failed to load scheduled jobs', {
                error: error.message,
            });
        }
    }
    async scheduleJob(job) {
        try {
            if (!node_cron_1.default.validate(job.schedule)) {
                throw new Error(`Invalid cron expression: ${job.schedule}`);
            }
            if (this.scheduledJobs.has(job.id)) {
                this.scheduledJobs.get(job.id)?.stop();
            }
            const scheduledTask = node_cron_1.default.schedule(job.schedule, () => {
                void this.executeJob(job);
            }, {
                scheduled: false,
                timezone: process.env.LIBRARY_TIMEZONE || 'Asia/Manila',
            });
            scheduledTask.start();
            this.scheduledJobs.set(job.id, scheduledTask);
            const nextRun = this.getNextRunTime(job.schedule);
            await this.prisma.automationJob.update({
                where: { id: job.id },
                data: { nextRunAt: nextRun },
            });
            logger_1.logger.info(`Scheduled job: ${job.name}`, {
                schedule: job.schedule,
                nextRun: nextRun?.toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to schedule job: ${job.name}`, {
                error: error.message,
            });
        }
    }
    async executeJob(job) {
        const startTime = logger_1.performanceLogger.start('job_execution', {
            jobName: job.name,
        });
        try {
            const jobConfig = this.resolveJobConfig(job.config);
            await this.prisma.automationJob.update({
                where: { id: job.id },
                data: { status: client_1.JobStatus.RUNNING, lastRunAt: new Date() },
            });
            logger_1.automationLogger.jobStart(job.name, job.id, jobConfig);
            let result;
            switch (job.type) {
                case client_1.JobType.DAILY_BACKUP:
                    result = await this.executeDailyBackup(job, jobConfig);
                    break;
                case client_1.JobType.TEACHER_NOTIFICATIONS:
                    result = await this.executeTeacherNotifications(job, jobConfig);
                    break;
                case client_1.JobType.GOOGLE_SHEETS_SYNC:
                    result = await this.executeGoogleSheetsSync(job, jobConfig);
                    break;
                case client_1.JobType.SESSION_EXPIRY_CHECK:
                    result = await this.executeSessionExpiryCheck(job, jobConfig);
                    break;
                case client_1.JobType.OVERDUE_NOTIFICATIONS:
                    result = await this.executeOverdueNotifications(job, jobConfig);
                    break;
                case client_1.JobType.WEEKLY_CLEANUP:
                    result = await this.executeWeeklyCleanup(job, jobConfig);
                    break;
                case client_1.JobType.MONTHLY_REPORT:
                    result = await this.executeMonthlyReport(job, jobConfig);
                    break;
                case client_1.JobType.INTEGRITY_AUDIT:
                    result = await this.executeIntegrityAudit(job, jobConfig);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }
            await this.prisma.automationJob.update({
                where: { id: job.id },
                data: {
                    status: client_1.JobStatus.IDLE,
                    totalRuns: { increment: 1 },
                    successCount: { increment: result.success ? 1 : 0 },
                    failureCount: { increment: result.success ? 0 : 1 },
                    averageDurationMs: result.duration,
                },
            });
            await this.logJobExecution(job.id, client_1.JobStatus.COMPLETED, result);
            const nextRun = this.getNextRunTime(job.schedule);
            await this.prisma.automationJob.update({
                where: { id: job.id },
                data: { nextRunAt: nextRun },
            });
            logger_1.performanceLogger.end('job_execution', startTime, {
                jobName: job.name,
                success: result.success,
            });
            logger_1.automationLogger.jobSuccess(job.name, job.id, result.duration, result);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            await this.prisma.automationJob.update({
                where: { id: job.id },
                data: {
                    status: client_1.JobStatus.IDLE,
                    totalRuns: { increment: 1 },
                    failureCount: { increment: 1 },
                    averageDurationMs: duration,
                },
            });
            const result = {
                success: false,
                errorMessage: error.message,
                duration,
            };
            await this.logJobExecution(job.id, client_1.JobStatus.FAILED, result);
            logger_1.performanceLogger.end('job_execution', startTime, {
                jobName: job.name,
                success: false,
            });
            logger_1.automationLogger.jobFailure(job.name, job.id, duration, error);
        }
    }
    async executeDailyBackup(job, config) {
        const startTime = Date.now();
        try {
            await this.queues.get('backup')?.add('daily-backup', {
                jobName: job.name,
                jobId: job.id,
                config,
            });
            return {
                success: true,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
                metadata: { queued: true },
            };
        }
        catch (error) {
            return {
                success: false,
                errorMessage: error.message,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
    }
    async executeTeacherNotifications(job, config) {
        const startTime = Date.now();
        try {
            await this.queues.get('notifications')?.add('teacher-notifications', {
                jobName: job.name,
                jobId: job.id,
                config,
            });
            return {
                success: true,
                duration: Date.now() - startTime,
                metadata: { queued: true },
            };
        }
        catch (error) {
            return {
                success: false,
                errorMessage: error.message,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
    }
    async executeGoogleSheetsSync(job, _config) {
        const startTime = Date.now();
        try {
            const activities = await this.prisma.activity.findMany({
                where: { googleSynced: false },
                include: {
                    student: true,
                    equipment: true,
                },
                take: 1000,
            });
            if (activities.length === 0) {
                return {
                    success: true,
                    recordsProcessed: 0,
                    duration: Date.now() - startTime,
                    metadata: { message: 'No records to sync' },
                };
            }
            await this.queues.get('sync')?.add('google-sheets-sync', {
                activities,
                jobName: job.name,
                jobId: job.id,
            });
            return {
                success: true,
                recordsProcessed: activities.length,
                duration: Date.now() - startTime,
                metadata: { queued: true },
            };
        }
        catch (error) {
            return {
                success: false,
                errorMessage: error.message,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
    }
    async executeSessionExpiryCheck(_job, _config) {
        const startTime = Date.now();
        let expiredSessions = 0;
        try {
            const now = new Date();
            const expiredSessionsData = await this.prisma.equipmentSession.findMany({
                where: {
                    status: client_1.SessionStatus.ACTIVE,
                    plannedEnd: { lt: now },
                },
                include: {
                    student: true,
                    equipment: true,
                },
            });
            for (const session of expiredSessionsData) {
                await this.prisma.equipmentSession.update({
                    where: { id: session.id },
                    data: {
                        status: client_1.SessionStatus.EXPIRED,
                        sessionEnd: now,
                        actualDuration: Math.floor((now.getTime() - session.sessionStart.getTime()) / 60000),
                    },
                });
                await this.prisma.activity.create({
                    data: {
                        studentId: session.studentId,
                        studentName: `${session.student.firstName} ${session.student.lastName}`.trim(),
                        studentGradeLevel: session.student.gradeLevel,
                        studentGradeCategory: session.student.gradeCategory,
                        activityType: client_1.ActivityType.COMPUTER_USE,
                        equipmentId: session.equipmentId,
                        startTime: session.sessionStart,
                        endTime: now,
                        durationMinutes: Math.floor((now.getTime() - session.sessionStart.getTime()) / 60000),
                        status: client_1.ActivityStatus.EXPIRED,
                        processedBy: 'SYSTEM',
                    },
                });
                expiredSessions++;
            }
            if (expiredSessions > 0) {
                await this.prisma.equipment.updateMany({
                    where: {
                        id: { in: expiredSessionsData.map(s => s.equipmentId) },
                    },
                    data: { status: client_1.EquipmentStatus.AVAILABLE },
                });
            }
            return {
                success: true,
                recordsProcessed: expiredSessions,
                duration: Date.now() - startTime,
                metadata: { expiredSessions },
            };
        }
        catch (error) {
            return {
                success: false,
                errorMessage: error.message,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
    }
    async processDailyBackup(job) {
        const startTime = Date.now();
        const { jobName } = job.data;
        try {
            await googleSheets_1.googleSheetsService.logAutomationTask(jobName, 'BACKUP', 'RUNNING', {
                startTime: new Date().toISOString(),
                triggeredBy: 'SCHEDULED',
            });
            await googleSheets_1.googleSheetsService.logAutomationTask(jobName, 'BACKUP', 'COMPLETED', {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                recordsProcessed: 0,
                triggeredBy: 'SCHEDULED',
            });
            return {
                success: true,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async processGoogleSheetsSync(job) {
        const startTime = Date.now();
        const { jobName } = job.data;
        try {
            const result = await googleSheets_1.googleSheetsService.syncStudentActivities();
            await googleSheets_1.googleSheetsService.logAutomationTask(jobName, 'SYNC', result.success ? 'COMPLETED' : 'FAILED', {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                recordsProcessed: result.recordsProcessed || 0,
                triggeredBy: 'SCHEDULED',
                metadata: { error: result.error },
            });
            const jobResult = {
                success: result.success,
                recordsProcessed: result.recordsProcessed || 0,
                duration: Date.now() - startTime,
            };
            if (result.error) {
                jobResult.errorMessage = result.error;
            }
            return jobResult;
        }
        catch (error) {
            throw error;
        }
    }
    async processTeacherNotifications(job) {
        const startTime = Date.now();
        const { jobName } = job.data;
        try {
            await googleSheets_1.googleSheetsService.logAutomationTask(jobName, 'NOTIFICATION', 'COMPLETED', {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                recordsProcessed: 0,
                triggeredBy: 'SCHEDULED',
            });
            return {
                success: true,
                recordsProcessed: 0,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async processSessionExpiryCheck(_job) {
        return {
            success: true,
            recordsProcessed: 0,
            duration: 0,
        };
    }
    async processOverdueNotifications(_job) {
        return {
            success: true,
            recordsProcessed: 0,
            duration: 0,
        };
    }
    async processWeeklyCleanup(_job) {
        return {
            success: true,
            recordsProcessed: 0,
            duration: 0,
        };
    }
    async processIntegrityAudit(_job) {
        return {
            success: true,
            recordsProcessed: 0,
            duration: 0,
        };
    }
    async processDatabaseBackup(_job) {
        return {
            success: true,
            recordsProcessed: 0,
            duration: 0,
        };
    }
    async processActivitySync(_job) {
        return {
            success: true,
            recordsProcessed: 0,
            duration: 0,
        };
    }
    async executeOverdueNotifications(_job, _config) {
        return {
            success: true,
            duration: 0,
        };
    }
    async executeWeeklyCleanup(_job, _config) {
        return {
            success: true,
            duration: 0,
        };
    }
    async executeMonthlyReport(_job, _config) {
        return {
            success: true,
            duration: 0,
        };
    }
    async executeIntegrityAudit(_job, _config) {
        return {
            success: true,
            duration: 0,
        };
    }
    async logJobExecution(jobId, status, result) {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to log job execution', {
                error: error.message,
                jobId,
                status,
            });
        }
    }
    getNextRunTime(cronExpression) {
        try {
            const scheduledTask = node_cron_1.default.schedule(cronExpression, () => { }, {
                scheduled: false,
            });
            scheduledTask.stop();
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        catch {
            return null;
        }
    }
    setupCleanupInterval() {
        setInterval(async () => {
            try {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                await this.prisma.automationLog.deleteMany({
                    where: {
                        startedAt: { lt: thirtyDaysAgo },
                    },
                });
                logger_1.logger.debug('Cleaned up old automation logs');
            }
            catch (error) {
                logger_1.logger.error('Failed to cleanup old automation logs', {
                    error: error.message,
                });
            }
        }, 60 * 60 * 1000);
    }
    async triggerJob(jobId, userId = 'MANUAL') {
        try {
            const job = await this.prisma.automationJob.findUnique({
                where: { id: jobId },
            });
            if (!job) {
                throw new errors_1.BaseError(`Job not found: ${jobId}`, 404);
            }
            if (!job.isEnabled) {
                throw new errors_1.BaseError(`Job is disabled: ${job.name}`, 400);
            }
            await this.executeJob(job);
            logger_1.logger.info(`Manually triggered job: ${job.name}`, { userId });
        }
        catch (error) {
            logger_1.logger.error('Failed to trigger job', {
                jobId,
                error: error.message,
            });
            throw error;
        }
    }
    async getJobStatus(jobId) {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get job status', {
                jobId,
                error: error.message,
            });
            throw error;
        }
    }
    async getAllJobs() {
        try {
            return await this.prisma.automationJob.findMany({
                orderBy: { name: 'asc' },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get all jobs', {
                error: error.message,
            });
            throw error;
        }
    }
    async getQueueStatus() {
        const queueStatus = {};
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
    async shutdown() {
        logger_1.logger.info('Shutting down automation service');
        for (const task of this.scheduledJobs.values()) {
            task.stop();
        }
        this.scheduledJobs.clear();
        for (const queue of this.queues.values()) {
            await queue.close();
        }
        this.queues.clear();
        await this.redis.disconnect();
        await this.prisma.$disconnect();
        logger_1.logger.info('Automation service shutdown complete');
    }
    getSystemHealth() {
        return {
            initialized: this.isInitialized,
            scheduledJobs: this.scheduledJobs.size,
            activeQueues: this.queues.size,
            redisConnected: this.redis.status === 'ready',
        };
    }
}
exports.AutomationService = AutomationService;
exports.automationService = new AutomationService();
exports.default = exports.automationService;
//# sourceMappingURL=automation.js.map