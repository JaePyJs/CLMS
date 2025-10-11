import { AutomationJob, AutomationLog } from '@prisma/client';
interface QueueSnapshot {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}
interface AutomationSystemHealth {
    initialized: boolean;
    scheduledJobs: number;
    activeQueues: number;
    redisConnected: boolean;
}
export declare class AutomationService {
    private prisma;
    private scheduledJobs;
    private redis;
    private queues;
    private isInitialized;
    constructor();
    private resolveJobConfig;
    private ensureJobConfigObject;
    initialize(): Promise<void>;
    private initializeQueues;
    private setupJobProcessors;
    private setupQueueEventListeners;
    private loadScheduledJobs;
    scheduleJob(job: AutomationJob): Promise<void>;
    private executeJob;
    private executeDailyBackup;
    private executeTeacherNotifications;
    private executeGoogleSheetsSync;
    private executeSessionExpiryCheck;
    private processDailyBackup;
    private processGoogleSheetsSync;
    private processTeacherNotifications;
    private processSessionExpiryCheck;
    private processOverdueNotifications;
    private processWeeklyCleanup;
    private processIntegrityAudit;
    private processDatabaseBackup;
    private processActivitySync;
    private executeOverdueNotifications;
    private executeWeeklyCleanup;
    private executeMonthlyReport;
    private executeIntegrityAudit;
    private logJobExecution;
    private getNextRunTime;
    private setupCleanupInterval;
    triggerJob(jobId: string, userId?: string): Promise<void>;
    getJobStatus(jobId: string): Promise<(AutomationJob & {
        AutomationLog: AutomationLog[];
    }) | null>;
    getAllJobs(): Promise<AutomationJob[]>;
    getQueueStatus(): Promise<Record<string, QueueSnapshot>>;
    shutdown(): Promise<void>;
    getSystemHealth(): AutomationSystemHealth;
}
export declare const automationService: AutomationService;
export default automationService;
//# sourceMappingURL=automation.d.ts.map