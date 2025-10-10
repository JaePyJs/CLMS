"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.barcodeService = exports.BarcodeService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("@/utils/logger");
const prisma_1 = require("@/utils/prisma");
const bwip_js_1 = __importDefault(require("bwip-js"));
const defaultOptions = {
    width: 200,
    height: 50,
    includeText: true,
    format: 'png'
};
class BarcodeService {
    outputDir;
    constructor() {
        this.outputDir = (0, path_1.join)(process.cwd(), 'uploads', 'barcodes');
        if (!(0, fs_1.existsSync)(this.outputDir)) {
            (0, fs_1.mkdirSync)(this.outputDir, { recursive: true });
        }
    }
    async generateStudentBarcode(studentId, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const student = await prisma_1.prisma.student.findUnique({
                where: { studentId }
            });
            if (!student) {
                return {
                    success: false,
                    error: `Student with ID ${studentId} not found`
                };
            }
            const filename = `student_${student.studentId}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(student.studentId, barcodePath, opts);
            await prisma_1.prisma.student.update({
                where: { id: student.id },
                data: { barcodeImage: barcodePath }
            });
            await this.saveBarcodeHistory(student.id, 'Student', student.studentId, opts.format || 'png');
            logger_1.logger.info(`Generated barcode for student ${student.studentId}`, { path: barcodePath });
            return {
                success: true,
                barcodePath
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate student barcode', { error: error.message, studentId });
            return {
                success: false,
                error: error.message
            };
        }
    }
    async generateBookBarcode(bookId, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const book = await prisma_1.prisma.book.findUnique({
                where: { id: bookId }
            });
            if (!book) {
                return {
                    success: false,
                    error: `Book with ID ${bookId} not found`
                };
            }
            const barcodeData = book.accessionNo;
            const filename = `book_${barcodeData}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(barcodeData, barcodePath, opts);
            await prisma_1.prisma.book.update({
                where: { id: book.id },
                data: { barcodeImage: barcodePath }
            });
            await this.saveBarcodeHistory(book.id, 'Book', barcodeData, opts.format || 'png');
            logger_1.logger.info(`Generated barcode for book ${barcodeData}`, { path: barcodePath });
            return {
                success: true,
                barcodePath
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate book barcode', { error: error.message, bookId });
            return {
                success: false,
                error: error.message
            };
        }
    }
    async generateEquipmentBarcode(equipmentId, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const equipment = await prisma_1.prisma.equipment.findUnique({
                where: { id: equipmentId }
            });
            if (!equipment) {
                return {
                    success: false,
                    error: `Equipment with ID ${equipmentId} not found`
                };
            }
            const barcodeData = equipment.equipmentId;
            const filename = `equipment_${barcodeData}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(barcodeData, barcodePath, opts);
            logger_1.logger.info(`Generated barcode for equipment ${barcodeData}`, { path: barcodePath });
            return {
                success: true,
                barcodePath
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate equipment barcode', { error: error.message, equipmentId });
            return {
                success: false,
                error: error.message
            };
        }
    }
    async generateAllStudentBarcodes(options = {}) {
        try {
            const students = await prisma_1.prisma.student.findMany({
                where: { isActive: true }
            });
            let successCount = 0;
            let errorCount = 0;
            for (const student of students) {
                const result = await this.generateStudentBarcode(student.studentId, options);
                if (result.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                    logger_1.logger.warn(`Failed to generate barcode for student ${student.studentId}`, { error: result.error });
                }
            }
            logger_1.logger.info(`Generated barcodes for ${successCount} students`, { errorCount });
            return {
                success: true,
                count: successCount
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate all student barcodes', { error: error.message });
            return {
                success: false,
                count: 0,
                error: error.message
            };
        }
    }
    async generateAllBookBarcodes(options = {}) {
        try {
            const books = await prisma_1.prisma.book.findMany({
                where: { isActive: true }
            });
            let successCount = 0;
            let errorCount = 0;
            for (const book of books) {
                const result = await this.generateBookBarcode(book.id, options);
                if (result.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                    logger_1.logger.warn(`Failed to generate barcode for book ${book.accessionNo}`, { error: result.error });
                }
            }
            logger_1.logger.info(`Generated barcodes for ${successCount} books`, { errorCount });
            return {
                success: true,
                count: successCount
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate all book barcodes', { error: error.message });
            return {
                success: false,
                count: 0,
                error: error.message
            };
        }
    }
    async generateAllEquipmentBarcodes(options = {}) {
        try {
            const equipment = await prisma_1.prisma.equipment.findMany();
            let successCount = 0;
            let errorCount = 0;
            for (const item of equipment) {
                const result = await this.generateEquipmentBarcode(item.id, options);
                if (result.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                    logger_1.logger.warn(`Failed to generate barcode for equipment ${item.equipmentId}`, { error: result.error });
                }
            }
            logger_1.logger.info(`Generated barcodes for ${successCount} equipment items`, { errorCount });
            return {
                success: true,
                count: successCount
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate all equipment barcodes', { error: error.message });
            return {
                success: false,
                count: 0,
                error: error.message
            };
        }
    }
    async generateBarcodeImage(data, outputPath, options) {
        return new Promise((resolve, reject) => {
            try {
                const png = bwip_js_1.default.toBuffer({
                    bcid: 'code128',
                    text: data,
                    scale: 3,
                    height: options.height || 10,
                    includetext: options.includeText || true,
                    textxalign: 'center',
                });
                const fileStream = (0, fs_1.createWriteStream)(outputPath);
                fileStream.write(png);
                fileStream.end();
                fileStream.on('finish', () => resolve());
                fileStream.on('error', (error) => reject(error));
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async saveBarcodeHistory(entityId, entityType, barcodeData, format) {
        try {
            await prisma_1.prisma.barcodeHistory.create({
                data: {
                    entityId,
                    entityType,
                    barcodeData,
                    format,
                    generatedBy: 'CLMS System'
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to save barcode history', { error: error.message });
        }
    }
    async getBarcodeHistory(entityId, entityType) {
        try {
            const history = await prisma_1.prisma.barcodeHistory.findMany({
                where: {
                    entityId,
                    entityType
                },
                orderBy: {
                    generatedAt: 'desc'
                }
            });
            return history;
        }
        catch (error) {
            logger_1.logger.error('Failed to get barcode history', { error: error.message });
            throw error;
        }
    }
    getOutputDir() {
        return this.outputDir;
    }
}
exports.BarcodeService = BarcodeService;
exports.barcodeService = new BarcodeService();
exports.default = exports.barcodeService;
//# sourceMappingURL=barcodeService.js.map