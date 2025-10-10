export interface ScheduledTask {
    id: string;
    name: string;
    cronExpression: string;
    task: () => Promise<void>;
    enabled: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
}
export declare class JobScheduler {
    private tasks;
    private cronJobs;
    private isInitialized;
    initialize(): Promise<void>;
    private loadJobsFromDatabase;
    private createTaskForJobType;
    private createDailyBackupTask;
    private createGoogleSheetsSyncTask;
    private createSessionExpiryCheckTask;
    private createOverdueNotificationsTask;
    private createWeeklyCleanupTask;
    private createMonthlyReportTask;
    private createIntegrityAuditTask;
    private createTeacherNotificationsTask;
    private updateJobStatus;
    registerTask(task: ScheduledTask): void;
    unregisterTask(taskId: string): void;
    private scheduleTask;
    private executeTask;
    private calculateNextRun;
    getTasks(): ScheduledTask[];
    getTask(taskId: string): ScheduledTask | undefined;
    shutdown(): Promise<void>;
}
export declare const schedulerService: JobScheduler;
export default schedulerService;
//# sourceMappingURL=schedulerService.d.ts.map