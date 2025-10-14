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
    student_id: string;
    name: string;
    barcodePath: string;
    barcodeUrl: string;
    success: boolean;
    error?: string;
}
export interface BarcodeGenerationSummary {
    totalStudents: number;
    success_count: number;
    errorCount: number;
    outputDir: string;
    results: BarcodeGenerationResult[];
    generated_at: string;
}
export declare class BarcodeService {
    private outputDir;
    private studentBarcodeDir;
    constructor();
    generateStudentBarcode(student_id: string, options?: BarcodeOptions): Promise<BarcodeResult>;
    generateBookBarcode(book_id: string, options?: BarcodeOptions): Promise<BarcodeResult>;
    generateEquipmentBarcode(equipment_id: string, options?: BarcodeOptions): Promise<BarcodeResult>;
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
    generateBarcodeForStudent(student_id: string): Promise<string>;
    regenerateBarcodeForStudent(student_id: string): Promise<string>;
    deleteBarcodeForStudent(student_id: string): Promise<void>;
    barcodeExists(student_id: string): boolean;
    getBarcodePath(student_id: string): string | null;
    getGenerationReport(): Promise<BarcodeGenerationSummary | null>;
    private generatePrintableSheet;
    private generateBarcodeImage;
    private saveBarcodeHistory;
    getBarcodeHistory(entity_id: string, entity_type: string): Promise<{
        format: string;
        entity_id: string;
        id: string;
        student_id: string | null;
        barcode_data: string;
        book_id: string | null;
        entity_type: string;
        generated_at: Date;
        generated_by: string;
    }[]>;
    getOutputDir(): string;
}
export declare const barcodeService: BarcodeService;
export default barcodeService;
//# sourceMappingURL=barcodeService.d.ts.map