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
    format: 'png',
};
class BarcodeService {
    outputDir;
    studentBarcodeDir;
    constructor() {
        this.outputDir = (0, path_1.join)(process.cwd(), 'uploads', 'barcodes');
        this.studentBarcodeDir = (0, path_1.join)(process.cwd(), 'barcodes', 'students');
        if (!(0, fs_1.existsSync)(this.outputDir)) {
            (0, fs_1.mkdirSync)(this.outputDir, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(this.studentBarcodeDir)) {
            (0, fs_1.mkdirSync)(this.studentBarcodeDir, { recursive: true });
        }
    }
    async generateStudentBarcode(studentId, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const student = await prisma_1.prisma.student.findUnique({
                where: { studentId },
            });
            if (!student) {
                return {
                    success: false,
                    error: `Student with ID ${studentId} not found`,
                };
            }
            const filename = `student_${student.studentId}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(student.studentId, barcodePath, opts);
            await prisma_1.prisma.student.update({
                where: { id: student.id },
                data: { barcodeImage: barcodePath },
            });
            await this.saveBarcodeHistory(student.id, 'Student', student.studentId, opts.format || 'png');
            logger_1.logger.info(`Generated barcode for student ${student.studentId}`, {
                path: barcodePath,
            });
            return {
                success: true,
                barcodePath,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate student barcode', {
                error: error.message,
                studentId,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateBookBarcode(bookId, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const book = await prisma_1.prisma.book.findUnique({
                where: { id: bookId },
            });
            if (!book) {
                return {
                    success: false,
                    error: `Book with ID ${bookId} not found`,
                };
            }
            const barcodeData = book.accessionNo;
            const filename = `book_${barcodeData}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(barcodeData, barcodePath, opts);
            await prisma_1.prisma.book.update({
                where: { id: book.id },
                data: { barcodeImage: barcodePath },
            });
            await this.saveBarcodeHistory(book.id, 'Book', barcodeData, opts.format || 'png');
            logger_1.logger.info(`Generated barcode for book ${barcodeData}`, {
                path: barcodePath,
            });
            return {
                success: true,
                barcodePath,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate book barcode', {
                error: error.message,
                bookId,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateEquipmentBarcode(equipmentId, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const equipment = await prisma_1.prisma.equipment.findUnique({
                where: { id: equipmentId },
            });
            if (!equipment) {
                return {
                    success: false,
                    error: `Equipment with ID ${equipmentId} not found`,
                };
            }
            const barcodeData = equipment.equipmentId;
            const filename = `equipment_${barcodeData}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(barcodeData, barcodePath, opts);
            logger_1.logger.info(`Generated barcode for equipment ${barcodeData}`, {
                path: barcodePath,
            });
            return {
                success: true,
                barcodePath,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate equipment barcode', {
                error: error.message,
                equipmentId,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateAllStudentBarcodes(options = {}) {
        try {
            const students = await prisma_1.prisma.student.findMany({
                where: { isActive: true },
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
            logger_1.logger.info(`Generated barcodes for ${successCount} students`, {
                errorCount,
            });
            return {
                success: true,
                count: successCount,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate all student barcodes', {
                error: error.message,
            });
            return {
                success: false,
                count: 0,
                error: error.message,
            };
        }
    }
    async generateAllBookBarcodes(options = {}) {
        try {
            const books = await prisma_1.prisma.book.findMany({
                where: { isActive: true },
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
            logger_1.logger.info(`Generated barcodes for ${successCount} books`, {
                errorCount,
            });
            return {
                success: true,
                count: successCount,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate all book barcodes', {
                error: error.message,
            });
            return {
                success: false,
                count: 0,
                error: error.message,
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
            logger_1.logger.info(`Generated barcodes for ${successCount} equipment items`, {
                errorCount,
            });
            return {
                success: true,
                count: successCount,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate all equipment barcodes', {
                error: error.message,
            });
            return {
                success: false,
                count: 0,
                error: error.message,
            };
        }
    }
    async generateBarcodesForAllStudents() {
        logger_1.logger.info('Starting barcode generation for all students');
        const students = await prisma_1.prisma.student.findMany({
            where: { isActive: true },
            orderBy: { studentId: 'asc' },
        });
        logger_1.logger.info(`Found ${students.length} active students`);
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const student of students) {
            try {
                const barcodePath = await this.generateBarcodeForStudent(student.studentId);
                await prisma_1.prisma.student.update({
                    where: { studentId: student.studentId },
                    data: { barcodeImage: barcodePath },
                });
                const fullName = `${student.firstName} ${student.lastName}`;
                results.push({
                    studentId: student.studentId,
                    name: fullName,
                    barcodePath,
                    barcodeUrl: `/api/utilities/barcode/${student.studentId}`,
                    success: true,
                });
                successCount++;
                logger_1.logger.info(`✅ Generated barcode for ${student.studentId} - ${fullName}`);
            }
            catch (error) {
                const fullName = `${student.firstName} ${student.lastName}`;
                results.push({
                    studentId: student.studentId,
                    name: fullName,
                    barcodePath: '',
                    barcodeUrl: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                errorCount++;
                logger_1.logger.error(`❌ Failed to generate barcode for ${student.studentId}`, error);
            }
        }
        const summary = {
            totalStudents: students.length,
            successCount,
            errorCount,
            outputDir: this.studentBarcodeDir,
            results,
            generatedAt: new Date().toISOString(),
        };
        const reportPath = (0, path_1.join)(this.studentBarcodeDir, '_generation-report.json');
        (0, fs_1.writeFileSync)(reportPath, JSON.stringify(summary, null, 2));
        logger_1.logger.info(`Saved generation report to ${reportPath}`);
        await this.generatePrintableSheet(results.filter(r => r.success));
        logger_1.logger.info(`Barcode generation complete: ${successCount} success, ${errorCount} errors`);
        return summary;
    }
    async generateBarcodeForStudent(studentId) {
        const fileName = `${studentId}.png`;
        const filePath = (0, path_1.join)(this.studentBarcodeDir, fileName);
        const png = await bwip_js_1.default.toBuffer({
            bcid: 'code128',
            text: studentId,
            scale: 3,
            height: 15,
            includetext: true,
            textxalign: 'center',
            textsize: 13,
        });
        (0, fs_1.writeFileSync)(filePath, png);
        return filePath;
    }
    async regenerateBarcodeForStudent(studentId) {
        const oldPath = (0, path_1.join)(this.studentBarcodeDir, `${studentId}.png`);
        if ((0, fs_1.existsSync)(oldPath)) {
            (0, fs_1.unlinkSync)(oldPath);
            logger_1.logger.info(`Deleted old barcode for ${studentId}`);
        }
        return this.generateBarcodeForStudent(studentId);
    }
    async deleteBarcodeForStudent(studentId) {
        const filePath = (0, path_1.join)(this.studentBarcodeDir, `${studentId}.png`);
        if ((0, fs_1.existsSync)(filePath)) {
            (0, fs_1.unlinkSync)(filePath);
            logger_1.logger.info(`Deleted barcode for ${studentId}`);
        }
        await prisma_1.prisma.student.update({
            where: { studentId },
            data: { barcodeImage: null },
        });
    }
    barcodeExists(studentId) {
        const filePath = (0, path_1.join)(this.studentBarcodeDir, `${studentId}.png`);
        return (0, fs_1.existsSync)(filePath);
    }
    getBarcodePath(studentId) {
        const filePath = (0, path_1.join)(this.studentBarcodeDir, `${studentId}.png`);
        return (0, fs_1.existsSync)(filePath) ? filePath : null;
    }
    async getGenerationReport() {
        const reportPath = (0, path_1.join)(this.studentBarcodeDir, '_generation-report.json');
        if (!(0, fs_1.existsSync)(reportPath)) {
            return null;
        }
        const reportData = (0, fs_1.readFileSync)(reportPath, 'utf-8');
        return JSON.parse(reportData);
    }
    async generatePrintableSheet(results) {
        const htmlPath = (0, path_1.join)(this.studentBarcodeDir, 'index.html');
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Student Barcodes - Sacred Heart Library</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .header h1 {
      color: #333;
      margin-bottom: 10px;
    }

    .header p {
      color: #666;
      font-size: 14px;
    }

    .controls {
      text-align: center;
      margin-bottom: 20px;
    }

    .btn {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 4px;
      cursor: pointer;
      margin: 0 5px;
    }

    .btn:hover {
      background: #45a049;
    }

    .btn-secondary {
      background: #2196F3;
    }

    .btn-secondary:hover {
      background: #0b7dda;
    }

    .barcode-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .barcode-card {
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .barcode-card h3 {
      color: #333;
      margin-bottom: 8px;
      font-size: 16px;
    }

    .barcode-card p {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
    }

    .barcode-card img {
      max-width: 100%;
      height: auto;
      border: 1px solid #eee;
      border-radius: 4px;
      padding: 10px;
      background: white;
    }

    .footer {
      text-align: center;
      padding: 20px;
      background: white;
      border-radius: 8px;
      margin-top: 30px;
      color: #666;
      font-size: 14px;
    }

    /* Print styles */
    @media print {
      body {
        background: white;
        padding: 0;
      }

      .header, .controls, .footer {
        display: none;
      }

      .barcode-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
      }

      .barcode-card {
        box-shadow: none;
        border: 1px solid #333;
        margin-bottom: 0;
      }
    }

    /* Compressed print mode */
    @media print {
      @page {
        size: A4;
        margin: 15mm;
      }

      .barcode-grid.compressed {
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }

      .barcode-grid.compressed .barcode-card {
        padding: 10px;
      }

      .barcode-grid.compressed .barcode-card h3 {
        font-size: 12px;
      }

      .barcode-grid.compressed .barcode-card p {
        font-size: 10px;
        margin-bottom: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Student Barcodes</h1>
    <p>Sacred Heart of Jesus Catholic School Library</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>Total Students: ${results.length}</p>
  </div>

  <div class="controls">
    <button class="btn" onclick="window.print()">🖨️ Print All Barcodes</button>
    <button class="btn btn-secondary" onclick="toggleCompressed()">📐 Toggle Compressed Mode</button>
  </div>

  <div class="barcode-grid" id="barcodeGrid">
    ${results
            .map(result => `
    <div class="barcode-card">
      <h3>${result.name}</h3>
      <p>Student ID: ${result.studentId}</p>
      <img src="${result.studentId}.png" alt="Barcode for ${result.studentId}" />
    </div>
    `)
            .join('')}
  </div>

  <div class="footer">
    <p>© 2024 Sacred Heart of Jesus Catholic School Library</p>
    <p>CLMS v1.0.0 - Barcode Generation System</p>
  </div>

  <script>
    function toggleCompressed() {
      const grid = document.getElementById('barcodeGrid');
      grid.classList.toggle('compressed');
      const isCompressed = grid.classList.contains('compressed');
      alert(isCompressed ? 'Compressed mode enabled - 4 per row' : 'Normal mode - 3 per row');
    }
  </script>
</body>
</html>
    `;
        (0, fs_1.writeFileSync)(htmlPath, html.trim());
        logger_1.logger.info(`Generated printable barcode sheet: ${htmlPath}`);
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
                fileStream.on('error', error => reject(error));
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
                    generatedBy: 'CLMS System',
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to save barcode history', {
                error: error.message,
            });
        }
    }
    async getBarcodeHistory(entityId, entityType) {
        try {
            const history = await prisma_1.prisma.barcodeHistory.findMany({
                where: {
                    entityId,
                    entityType,
                },
                orderBy: {
                    generatedAt: 'desc',
                },
            });
            return history;
        }
        catch (error) {
            logger_1.logger.error('Failed to get barcode history', {
                error: error.message,
            });
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