export declare class GoogleSheetsService {
    private auth;
    private sheets;
    private spreadsheetId;
    private isInitialized;
    initialize(): Promise<void>;
    testConnection(): Promise<boolean>;
    healthCheck(): Promise<{
        connected: boolean;
        error?: string;
    }>;
    syncAllData(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    syncStudents(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    syncBooks(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    syncEquipment(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    syncActivities(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    syncBookCheckouts(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    private updateSheet;
    getSheetData(sheetName: string, range?: string): Promise<any[][]>;
    getSpreadsheetInfo(): Promise<{
        title: string;
        sheets: string[];
    }>;
    generateDailyReport(date?: Date): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    logAutomationTask(taskType: string, status: 'success' | 'error' | 'info' | 'warning' | 'BACKUP' | 'SYNC' | 'NOTIFICATION', message: string, data?: any): Promise<void>;
    syncStudentActivities(): Promise<{
        success: boolean;
        recordsProcessed?: number;
        error?: string;
    }>;
    shutdown(): Promise<void>;
}
export declare const googleSheetsService: GoogleSheetsService;
export default googleSheetsService;
//# sourceMappingURL=googleSheets.d.ts.map