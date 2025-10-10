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
export declare class BarcodeService {
    private outputDir;
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
    private generateBarcodeImage;
    private saveBarcodeHistory;
    getBarcodeHistory(entityId: string, entityType: string): Promise<{
        format: string;
        id: string;
        bookId: string | null;
        entityId: string;
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