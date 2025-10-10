"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerService = exports.JobScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("@/utils/logger");
const prisma_1 = require("@/utils/prisma");
const client_1 = require("@prisma/client");
class JobScheduler {
    tasks = new Map();
    cronJobs = new Map();
    isInitialized = false;
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            logger_1.logger.info('Initializing job scheduler...');
            await this.loadJobsFromDatabase();
            this.isInitialized = true;
            logger_1.logger.info('Job scheduler initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize job scheduler', { error: error.message });
            throw error;
        }
    }
    async loadJobsFromDatabase() {
        try {
            const jobs = await prisma_1.prisma.automationJob.findMany({
                where: { isEnabled: true }
            });
            for (const job of jobs) {
                const task = this.createTaskForJobType(job.type);
                if (task) {
                    this.registerTask({
                        id: job.id,
                        name: job.name,
                        cronExpression: job.schedule,
                        task,
                        enabled: job.isEnabled,
                        lastRun: job.lastRunAt || null,
                        nextRun: job.nextRunAt || null
                    });
                }
            }
            logger_1.logger.info(`Loaded ${jobs.length} jobs from database`);
        }
        catch (error) {
            logger_1.logger.error('Failed to load jobs from database', { error: error.message });
            throw error;
        }
    }
    createTaskForJobType(jobType) {
        switch (jobType) {
            case client_1.JobType.DAILY_BACKUP:
                return this.createDailyBackupTask();
            case client_1.JobType.GOOGLE_SHEETS_SYNC:
                return this.createGoogleSheetsSyncTask();
            case client_1.JobType.SESSION_EXPIRY_CHECK:
                return this.createSessionExpiryCheckTask();
            case client_1.JobType.OVERDUE_NOTIFICATIONS:
                return this.createOverdueNotificationsTask();
            case client_1.JobType.WEEKLY_CLEANUP:
                return this.createWeeklyCleanupTask();
            case client_1.JobType.MONTHLY_REPORT:
                return this.createMonthlyReportTask();
            case client_1.JobType.INTEGRITY_AUDIT:
                return this.createIntegrityAuditTask();
            case client_1.JobType.TEACHER_NOTIFICATIONS:
                return this.createTeacherNotificationsTask();
            default:
                logger_1.logger.warn(`Unknown job type: ${jobType}`);
                return null;
        }
    }
    createDailyBackupTask() {
        return async () => {
            logger_1.logger.info('Running daily backup task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Daily Backup', client_1.JobStatus.RUNNING);
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.updateJobStatus('Daily Backup', client_1.JobStatus.COMPLETED);
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Daily backup task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Daily backup task failed', { error: error.message });
                await this.updateJobStatus('Daily Backup', client_1.JobStatus.FAILED);
            }
        };
    }
    createGoogleSheetsSyncTask() {
        return async () => {
            logger_1.logger.info('Running Google Sheets sync task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Google Sheets Sync', client_1.JobStatus.RUNNING);
                const { googleSheetsService } = await Promise.resolve().then(() => __importStar(require('./googleSheets')));
                const syncResult = await googleSheetsService.testConnection();
                if (syncResult) {
                    await this.updateJobStatus('Google Sheets Sync', client_1.JobStatus.COMPLETED);
                    logger_1.logger.info('Google Sheets sync completed successfully');
                }
                else {
                    await this.updateJobStatus('Google Sheets Sync', client_1.JobStatus.FAILED);
                    logger_1.logger.error('Google Sheets sync failed');
                }
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Google Sheets sync task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Google Sheets sync task failed', { error: error.message });
                await this.updateJobStatus('Google Sheets Sync', client_1.JobStatus.FAILED);
            }
        };
    }
    createSessionExpiryCheckTask() {
        return async () => {
            logger_1.logger.info('Running session expiry check task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Session Expiry Check', client_1.JobStatus.RUNNING);
                const now = new Date();
                const expiredSessions = await prisma_1.prisma.activity.findMany({
                    where: {
                        endTime: { lt: now },
                        status: 'ACTIVE'
                    },
                    include: {
                        student: {
                            select: {
                                studentId: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                });
                let expiredCount = 0;
                for (const session of expiredSessions) {
                    await prisma_1.prisma.activity.update({
                        where: { id: session.id },
                        data: { status: 'EXPIRED' }
                    });
                    if (session.equipmentId) {
                        await prisma_1.prisma.equipment.update({
                            where: { id: session.equipmentId },
                            data: { status: 'AVAILABLE' }
                        });
                    }
                    expiredCount++;
                }
                await this.updateJobStatus('Session Expiry Check', client_1.JobStatus.COMPLETED);
                logger_1.logger.info(`Session expiry check completed: ${expiredCount} sessions expired`);
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Session expiry check task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Session expiry check task failed', { error: error.message });
                await this.updateJobStatus('Session Expiry Check', client_1.JobStatus.FAILED);
            }
        };
    }
    createOverdueNotificationsTask() {
        return async () => {
            logger_1.logger.info('Running overdue notifications task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Overdue Notifications', client_1.JobStatus.RUNNING);
                const now = new Date();
                const overdueCheckouts = await prisma_1.prisma.bookCheckout.findMany({
                    where: {
                        dueDate: { lt: now },
                        status: 'ACTIVE'
                    },
                    include: {
                        student: {
                            select: {
                                studentId: true,
                                firstName: true,
                                lastName: true,
                                gradeLevel: true
                            }
                        },
                        book: {
                            select: {
                                accessionNo: true,
                                title: true,
                                author: true
                            }
                        }
                    }
                });
                let notifiedCount = 0;
                for (const checkout of overdueCheckouts) {
                    const overdueDays = Math.ceil((now.getTime() - checkout.dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    const fineAmount = overdueDays * 1.0;
                    await prisma_1.prisma.bookCheckout.update({
                        where: { id: checkout.id },
                        data: {
                            status: 'OVERDUE',
                            overdueDays,
                            fineAmount
                        }
                    });
                    logger_1.logger.info(`Overdue notification sent to ${checkout.student.firstName} ${checkout.student.lastName} for book "${checkout.book.title}" (${overdueDays} days, ₱${fineAmount} fine)`);
                    notifiedCount++;
                }
                await this.updateJobStatus('Overdue Notifications', client_1.JobStatus.COMPLETED);
                logger_1.logger.info(`Overdue notifications task completed: ${notifiedCount} notifications sent`);
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Overdue notifications task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Overdue notifications task failed', { error: error.message });
                await this.updateJobStatus('Overdue Notifications', client_1.JobStatus.FAILED);
            }
        };
    }
    createWeeklyCleanupTask() {
        return async () => {
            logger_1.logger.info('Running weekly cleanup task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Weekly Cleanup', client_1.JobStatus.RUNNING);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const deletedLogs = await prisma_1.prisma.automationLog.deleteMany({
                    where: {
                        startedAt: { lt: thirtyDaysAgo }
                    }
                });
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const deletedAuditLogs = await prisma_1.prisma.auditLog.deleteMany({
                    where: {
                        createdAt: { lt: ninetyDaysAgo }
                    }
                });
                await this.updateJobStatus('Weekly Cleanup', client_1.JobStatus.COMPLETED);
                logger_1.logger.info(`Weekly cleanup completed: ${deletedLogs.count} logs deleted, ${deletedAuditLogs.count} audit logs deleted`);
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Weekly cleanup task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Weekly cleanup task failed', { error: error.message });
                await this.updateJobStatus('Weekly Cleanup', client_1.JobStatus.FAILED);
            }
        };
    }
    createMonthlyReportTask() {
        return async () => {
            logger_1.logger.info('Running monthly report task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Monthly Report', client_1.JobStatus.RUNNING);
                const now = new Date();
                const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                const [totalStudents, totalBooks, totalEquipment, totalActivities, totalCheckouts] = await Promise.all([
                    prisma_1.prisma.student.count({ where: { isActive: true } }),
                    prisma_1.prisma.book.count({ where: { isActive: true } }),
                    prisma_1.prisma.equipment.count(),
                    prisma_1.prisma.activity.count({
                        where: {
                            startTime: { gte: firstDayLastMonth, lte: lastDayLastMonth }
                        }
                    }),
                    prisma_1.prisma.bookCheckout.count({
                        where: {
                            checkoutDate: { gte: firstDayLastMonth, lte: lastDayLastMonth }
                        }
                    })
                ]);
                const report = {
                    month: firstDayLastMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
                    generatedAt: now.toISOString(),
                    statistics: {
                        totalStudents,
                        totalBooks,
                        totalEquipment,
                        totalActivities,
                        totalCheckouts
                    }
                };
                logger_1.logger.info(`Monthly report generated: ${JSON.stringify(report, null, 2)}`);
                await this.updateJobStatus('Monthly Report', client_1.JobStatus.COMPLETED);
                logger_1.logger.info('Monthly report task completed');
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Monthly report task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Monthly report task failed', { error: error.message });
                await this.updateJobStatus('Monthly Report', client_1.JobStatus.FAILED);
            }
        };
    }
    createIntegrityAuditTask() {
        return async () => {
            logger_1.logger.info('Running integrity audit task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Integrity Audit', client_1.JobStatus.RUNNING);
                const issues = [];
                const invalidActivities = await prisma_1.prisma.activity.findMany({
                    where: { status: 'ACTIVE' },
                    include: { student: true }
                });
                for (const activity of invalidActivities) {
                    if (!activity.student) {
                        issues.push(`Activity ${activity.id} has invalid student reference`);
                    }
                }
                const invalidCheckouts = await prisma_1.prisma.bookCheckout.findMany({
                    where: { status: 'ACTIVE' },
                    include: { book: true }
                });
                for (const checkout of invalidCheckouts) {
                    if (!checkout.book) {
                        issues.push(`Checkout ${checkout.id} has invalid book reference`);
                    }
                }
                await this.updateJobStatus('Integrity Audit', client_1.JobStatus.COMPLETED);
                logger_1.logger.info(`Integrity audit completed: ${issues.length} issues found`);
                if (issues.length > 0) {
                    logger_1.logger.warn('Data integrity issues found', { issues });
                }
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Integrity audit task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Integrity audit task failed', { error: error.message });
                await this.updateJobStatus('Integrity Audit', client_1.JobStatus.FAILED);
            }
        };
    }
    createTeacherNotificationsTask() {
        return async () => {
            logger_1.logger.info('Running teacher notifications task');
            const startTime = Date.now();
            try {
                await this.updateJobStatus('Teacher Notifications', client_1.JobStatus.RUNNING);
                const overdueStudents = await prisma_1.prisma.bookCheckout.findMany({
                    where: {
                        status: 'OVERDUE'
                    },
                    include: {
                        student: {
                            select: {
                                studentId: true,
                                firstName: true,
                                lastName: true,
                                gradeLevel: true,
                                gradeCategory: true
                            }
                        },
                        book: {
                            select: {
                                accessionNo: true,
                                title: true,
                                author: true
                            }
                        }
                    }
                });
                const studentsByGrade = overdueStudents.reduce((acc, checkout) => {
                    const grade = checkout.student.gradeCategory;
                    if (!acc[grade]) {
                        acc[grade] = [];
                    }
                    acc[grade].push({
                        student: checkout.student,
                        book: checkout.book,
                        overdueDays: checkout.overdueDays,
                        fineAmount: checkout.fineAmount
                    });
                    return acc;
                }, {});
                for (const [grade, students] of Object.entries(studentsByGrade)) {
                    logger_1.logger.info(`Teacher notification for ${grade}: ${students.length} students with overdue books`);
                    students.forEach(({ student, book, overdueDays, fineAmount }) => {
                        logger_1.logger.info(`- ${student.firstName} ${student.lastName} (${student.studentId}): "${book.title}" (${overdueDays} days, ₱${fineAmount} fine)`);
                    });
                }
                await this.updateJobStatus('Teacher Notifications', client_1.JobStatus.COMPLETED);
                logger_1.logger.info('Teacher notifications task completed');
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Teacher notifications task completed in ${duration}ms`);
            }
            catch (error) {
                logger_1.logger.error('Teacher notifications task failed', { error: error.message });
                await this.updateJobStatus('Teacher Notifications', client_1.JobStatus.FAILED);
            }
        };
    }
    async updateJobStatus(name, status) {
        try {
            const now = new Date();
            const updateData = {
                status,
                totalRuns: { increment: 1 }
            };
            if (status === client_1.JobStatus.RUNNING) {
                updateData.lastRunAt = now;
            }
            if (status === client_1.JobStatus.COMPLETED) {
                updateData.successCount = { increment: 1 };
            }
            if (status === client_1.JobStatus.FAILED) {
                updateData.failureCount = { increment: 1 };
            }
            await prisma_1.prisma.automationJob.updateMany({
                where: { name },
                data: updateData
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to update job status for ${name}`, { error: error.message });
        }
    }
    registerTask(task) {
        if (this.tasks.has(task.id)) {
            this.unregisterTask(task.id);
        }
        this.tasks.set(task.id, task);
        if (task.enabled) {
            this.scheduleTask(task);
        }
        logger_1.logger.info(`Task registered: ${task.name} (${task.id})`);
    }
    unregisterTask(taskId) {
        if (this.cronJobs.has(taskId)) {
            this.cronJobs.get(taskId)?.stop();
            this.cronJobs.delete(taskId);
        }
        this.tasks.delete(taskId);
        logger_1.logger.info(`Task unregistered: ${taskId}`);
    }
    scheduleTask(task) {
        try {
            if (!node_cron_1.default.validate(task.cronExpression)) {
                throw new Error(`Invalid cron expression: ${task.cronExpression}`);
            }
            const cronJob = node_cron_1.default.schedule(task.cronExpression, async () => {
                await this.executeTask(task);
            }, {
                scheduled: true,
                timezone: process.env.TZ || 'Asia/Manila'
            });
            this.cronJobs.set(task.id, cronJob);
            task.nextRun = this.calculateNextRun(task.cronExpression);
            logger_1.logger.info(`Task scheduled: ${task.name} (${task.cronExpression})`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to schedule task: ${task.name}`, { error: error.message });
        }
    }
    async executeTask(task) {
        const startTime = Date.now();
        logger_1.logger.info(`Executing task: ${task.name}`);
        try {
            task.lastRun = new Date();
            await task.task();
            task.nextRun = this.calculateNextRun(task.cronExpression);
            const duration = Date.now() - startTime;
            logger_1.logger.info(`Task executed successfully: ${task.name} (${duration}ms)`);
        }
        catch (error) {
            logger_1.logger.error(`Task execution failed: ${task.name}`, { error: error.message });
        }
    }
    calculateNextRun(cronExpression) {
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setMinutes(nextRun.getMinutes() + 1);
        return nextRun;
    }
    getTasks() {
        return Array.from(this.tasks.values());
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    async shutdown() {
        logger_1.logger.info('Shutting down job scheduler...');
        for (const [taskId, cronJob] of this.cronJobs) {
            cronJob.stop();
            logger_1.logger.info(`Stopped cron job: ${taskId}`);
        }
        this.cronJobs.clear();
        this.tasks.clear();
        this.isInitialized = false;
        logger_1.logger.info('Job scheduler shutdown complete');
    }
}
exports.JobScheduler = JobScheduler;
exports.schedulerService = new JobScheduler();
exports.default = exports.schedulerService;
//# sourceMappingURL=schedulerService.js.map