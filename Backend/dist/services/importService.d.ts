export interface ImportResult {
    success: boolean;
    totalRecords: number;
    importedRecords: number;
    skippedRecords: number;
    errorRecords: number;
    errors: string[];
}
export declare class ImportService {
    importStudents(filePath: string): Promise<ImportResult>;
    importBooks(filePath: string): Promise<ImportResult>;
    importEquipment(filePath: string): Promise<ImportResult>;
    private parseCsvFile;
    getStudentTemplate(): string;
    getBookTemplate(): string;
    getEquipmentTemplate(): string;
}
export declare const importService: ImportService;
export default importService;
//# sourceMappingURL=importService.d.ts.map