#!/usr/bin/env ts-node
interface DocumentationUpdateResult {
    success: boolean;
    message: string;
    updates: {
        version: boolean;
        features: boolean;
        health: boolean;
        files: boolean;
    };
    timestamp: string;
}
declare class DocumentationUpdater {
    private projectRoot;
    constructor();
    updateAllDocumentation(): Promise<DocumentationUpdateResult>;
    private updateVersionInfo;
    private updateFeatureCounts;
    private updateHealthStatus;
    private updateFileDocumentation;
    checkAndFixDocumentation(): Promise<boolean>;
    private getClaudeMdTemplate;
    private getReadmeTemplate;
}
export { DocumentationUpdater, DocumentationUpdateResult };
//# sourceMappingURL=updateDocumentation.d.ts.map