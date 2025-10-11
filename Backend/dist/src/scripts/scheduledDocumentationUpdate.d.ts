#!/usr/bin/env ts-node
interface ScheduledUpdateConfig {
    enabled: boolean;
    schedule: string;
    autoFix: boolean;
    notifications: boolean;
}
declare class ScheduledDocumentationUpdate {
    private updater;
    private config;
    private isRunning;
    constructor(config?: Partial<ScheduledUpdateConfig>);
    start(): Promise<void>;
    performScheduledUpdate(): Promise<void>;
    private createUpdateJobRecord;
    private createFailureJobRecord;
    stop(): Promise<void>;
    runNow(): Promise<void>;
    getStatus(): {
        enabled: boolean;
        schedule: string;
        isRunning: boolean;
        lastUpdate?: string;
    };
    updateConfig(newConfig: Partial<ScheduledUpdateConfig>): void;
}
export { ScheduledDocumentationUpdate, ScheduledUpdateConfig };
//# sourceMappingURL=scheduledDocumentationUpdate.d.ts.map