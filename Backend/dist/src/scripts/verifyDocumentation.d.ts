#!/usr/bin/env ts-node
interface VerificationResult {
    success: boolean;
    overall: 'healthy' | 'warning' | 'error';
    checks: {
        criticalFiles: boolean;
        syntax: boolean;
        compilation: boolean;
        api: boolean;
        sync: boolean;
    };
    details: {
        missingFiles: string[];
        syntaxErrors: string[];
        compilationErrors: string[];
        apiErrors: string[];
        syncIssues: string[];
    };
    recommendations: string[];
    timestamp: string;
}
declare class DocumentationVerifier {
    private projectRoot;
    constructor();
    verifyAll(): Promise<VerificationResult>;
    private checkCriticalFiles;
    private checkDocumentationSyntax;
    private checkCompilation;
    private checkApiEndpoints;
    private checkSynchronization;
    private generateRecommendations;
    private determineOverallStatus;
    fixDocumentation(): Promise<boolean>;
}
export { DocumentationVerifier, VerificationResult };
//# sourceMappingURL=verifyDocumentation.d.ts.map