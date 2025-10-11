export interface BarcodeOptions {
    width?: number;
    height?: number;
    includeText?: boolean;
    format?: 'png' | 'svg' | 'jpg';
}
export interface BarcodeResult {
    success: boolean;
    barcodePath?: string;
    error?: string;
}
export interface BarcodeGenerationResult {
    studentId: string;
    name: string;
    barcodePath: string;
    barcodeUrl: string;
    success: boolean;
    error?: string;
}
export interface BarcodeGenerationSummary {
    totalStudents: number;
    successCount: number;
    errorCount: number;
    outputDir: string;
    results: BarcodeGenerationResult[];
    generatedAt: string;
}
export declare class BarcodeService {
    private outputDir;
    private studentBarcodeDir;
    constructor();
    generateStudentBarcode(studentId: string, options?: BarcodeOptions): Promise<BarcodeResult>;
    generateBookBarcode(bookId: string, options?: BarcodeOptions): Promise<BarcodeResult>;
    generateEquipmentBarcode(equipmentId: string, options?: BarcodeOptions): Promise<BarcodeResult>;
    generateAllStudentBarcodes(options?: BarcodeOptions): Promise<{
        success: boolean;
        count: number;
        error?: string;
    }>;
    generateAllBookBarcodes(options?: BarcodeOptions): Promise<{
        success: boolean;
        count: number;
        error?: string;
    }>;
    generateAllEquipmentBarcodes(options?: BarcodeOptions): Promise<{
        success: boolean;
        count: number;
        error?: string;
    }>;
    generateBarcodesForAllStudents(): Promise<BarcodeGenerationSummary>;
    generateBarcodeForStudent(studentId: string): Promise<string>;
    regenerateBarcodeForStudent(studentId: string): Promise<string>;
    deleteBarcodeForStudent(studentId: string): Promise<void>;
    barcodeExists(studentId: string): boolean;
    getBarcodePath(studentId: string): string | null;
    getGenerationReport(): Promise<BarcodeGenerationSummary | null>;
    private generatePrintableSheet;
    private generateBarcodeImage;
    private saveBarcodeHistory;
    getBarcodeHistory(entityId: string, entityType: string): Promise<{
        format: string;
        entityId: string;
        studentId: string | null;
        id: string;
        bookId: string | null;
        entityType: string;
        barcodeData: string;
        generatedAt: Date;
        generatedBy: string;
    }[]>;
    getOutputDir(): string;
}
export declare const barcodeService: BarcodeService;
export default barcodeService;
//# sourceMappingURL=barcodeService.d.ts.map