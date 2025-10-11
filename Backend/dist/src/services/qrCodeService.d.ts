export interface QRGenerationResult {
    studentId: string;
    name: string;
    qrPath: string;
    qrUrl: string;
    success: boolean;
    error?: string;
}
export interface QRGenerationSummary {
    totalStudents: number;
    successCount: number;
    errorCount: number;
    outputDir: string;
    results: QRGenerationResult[];
    generatedAt: string;
}
export declare class QRCodeService {
    private qrDir;
    constructor();
    private ensureDirectoryExists;
    generateQRCodesForAllStudents(): Promise<QRGenerationSummary>;
    generateQRCodeForStudent(studentId: string): Promise<QRGenerationResult>;
    getQRCodeForStudent(studentId: string): Promise<string | null>;
    getGenerationReport(): Promise<QRGenerationSummary | null>;
    getQRCodePath(studentId: string): string;
    qrCodeExists(studentId: string): boolean;
    deleteQRCode(studentId: string): Promise<boolean>;
    regenerateQRCode(studentId: string): Promise<QRGenerationResult>;
}
export declare const qrCodeService: QRCodeService;
//# sourceMappingURL=qrCodeService.d.ts.map