export interface DocumentationInfo {
    version: string;
    lastUpdated: string;
    lastCommitHash?: string;
    environment: string;
    features: {
        backend: {
            tests: number;
            apiEndpoints: number;
            services: number;
            databaseTables: number;
        };
        frontend: {
            tests: number;
            components: number;
            pages: number;
            assets: number;
        };
    };
    documentation: {
        claudeMd: {
            exists: boolean;
            lastModified: string;
            sections: number;
        };
        readmeMd: {
            exists: boolean;
            lastModified: string;
        };
        apiDocs: {
            exists: boolean;
            lastModified: string;
        };
    };
    health: {
        status: 'healthy' | 'warning' | 'error';
        checks: {
            documentation: boolean;
            tests: boolean;
            builds: boolean;
        };
    };
}
declare class DocumentationService {
    private static instance;
    private cache;
    private cacheExpiry;
    private readonly CACHE_DURATION;
    private constructor();
    static getInstance(): DocumentationService;
    getDocumentationInfo(): Promise<DocumentationInfo>;
    private buildDocumentationInfo;
    private getVersion;
    private getLastCommitHash;
    private getBackendFeatures;
    private getFrontendFeatures;
    private countFiles;
    private countDatabaseTables;
    private getFileInfo;
    private getHealthStatus;
    private checkDocumentation;
    private checkTests;
    private checkBuilds;
    private getProjectRoot;
    refreshCache(): Promise<void>;
}
export declare const documentationService: DocumentationService;
export default documentationService;
//# sourceMappingURL=documentationService.d.ts.map