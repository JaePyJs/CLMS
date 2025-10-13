export interface QRGenerationResult {
    student_id: string;
    name: string;
    qrPath: string;
    qrUrl: string;
    success: boolean;
    error?: string;
}
export interface QRGenerationSummary {
    totalStudents: number;
    success_count: number;
    errorCount: number;
    outputDir: string;
    results: QRGenerationResult[];
    generated_at: string;
}
export declare class QRCodeService {
    private qrDir;
    constructor();
    private ensureDirectoryExists;
    generateQRCodesForAllStudents(): Promise<QRGenerationSummary>;
    generateQRCodeForStudent(student_id: string): Promise<QRGenerationResult>;
    getQRCodeForStudent(student_id: string): Promise<string | null>;
    getGenerationReport(): Promise<QRGenerationSummary | null>;
    getQRCodePath(student_id: string): string;
    qrCodeExists(student_id: string): boolean;
    deleteQRCode(student_id: string): Promise<boolean>;
    regenerateQRCode(student_id: string): Promise<QRGenerationResult>;
}
export declare const qrCodeService: QRCodeService;
//# sourceMappingURL=qrCodeService.d.ts.map