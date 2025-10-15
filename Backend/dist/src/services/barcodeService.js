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
    async generateStudentBarcode(student_id, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const student = await prisma_1.prisma.students.findUnique({
                where: { student_id },
            });
            if (!student) {
                return {
                    success: false,
                    error: `Student with ID ${student_id} not found`,
                };
            }
            const filename = `student_${student.student_id}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(student.student_id, barcodePath, opts);
            await prisma_1.prisma.students.update({
                where: { id: student.id },
                data: { id: crypto.randomUUID(), updated_at: new Date(), barcode_image: barcodePath },
            });
            await this.saveBarcodeHistory(student.id, 'Student', student.student_id, opts.format || 'png');
            logger_1.logger.info(`Generated barcode for student ${student.student_id}`, {
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
                student_id,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateBookBarcode(book_id, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const book = await prisma_1.prisma.books.findUnique({
                where: { id: book_id },
            });
            if (!book) {
                return {
                    success: false,
                    error: `Book with ID ${book_id} not found`,
                };
            }
            const barcodeData = book.accession_no;
            const filename = `book_${barcode_data}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(barcode_data, barcodePath, opts);
            await prisma_1.prisma.books.update({
                where: { id: book.id },
                data: { id: crypto.randomUUID(), updated_at: new Date(), barcode_image: barcodePath },
            });
            await this.saveBarcodeHistory(book.id, 'Book', barcode_data, opts.format || 'png');
            logger_1.logger.info(`Generated barcode for book ${barcode_data}`, {
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
                book_id,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateEquipmentBarcode(equipment_id, options = {}) {
        try {
            const opts = { ...defaultOptions, ...options };
            const equipment = await prisma_1.prisma.equipment.findUnique({
                where: { id: equipment_id },
            });
            if (!equipment) {
                return {
                    success: false,
                    error: `Equipment with ID ${equipment_id} not found`,
                };
            }
            const barcodeData = equipment.equipment_id;
            const filename = `equipment_${barcode_data}.${opts.format}`;
            const barcodePath = (0, path_1.join)(this.outputDir, filename);
            await this.generateBarcodeImage(barcode_data, barcodePath, opts);
            logger_1.logger.info(`Generated barcode for equipment ${barcode_data}`, {
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
                equipment_id,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateAllStudentBarcodes(options = {}) {
        try {
            const students = await prisma_1.prisma.students.findMany({
                where: { is_active: true },
            });
            let successCount = 0;
            let errorCount = 0;
            for (const student of students) {
                const result = await this.generateStudentBarcode(student.student_id, options);
                if (result.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                    logger_1.logger.warn(`Failed to generate barcode for student ${student.student_id}`, { error: result.error });
                }
            }
            logger_1.logger.info(`Generated barcodes for ${success_count} students`, {
                errorCount,
            });
            return {
                success: true,
                count: success_count,
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
            const books = await prisma_1.prisma.books.findMany({
                where: { is_active: true },
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
                    logger_1.logger.warn(`Failed to generate barcode for book ${book.accession_no}`, { error: result.error });
                }
            }
            logger_1.logger.info(`Generated barcodes for ${success_count} books`, {
                errorCount,
            });
            return {
                success: true,
                count: success_count,
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
                    logger_1.logger.warn(`Failed to generate barcode for equipment ${item.equipment_id}`, { error: result.error });
                }
            }
            logger_1.logger.info(`Generated barcodes for ${success_count} equipment items`, {
                errorCount,
            });
            return {
                success: true,
                count: success_count,
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
        const students = await prisma_1.prisma.students.findMany({
            where: { is_active: true },
            orderBy: { student_id: 'asc' },
        });
        logger_1.logger.info(`Found ${students.length} active students`);
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const student of students) {
            try {
                const barcodePath = await this.generateBarcodeForStudent(student.student_id);
                await prisma_1.prisma.students.update({
                    where: { student_id: student.student_id },
                    data: { id: crypto.randomUUID(), updated_at: new Date(), barcode_image: barcodePath },
                });
                const fullName = `${student.first_name} ${student.last_name}`;
                results.push({
                    student_id: student.student_id,
                    name: full_name,
                    barcodePath,
                    barcodeUrl: `/api/utilities/barcode/${student.student_id}`,
                    success: true,
                });
                successCount++;
                logger_1.logger.info(`✅ Generated barcode for ${student.student_id} - ${full_name}`);
            }
            catch (error) {
                const fullName = `${student.first_name} ${student.last_name}`;
                results.push({
                    student_id: student.student_id,
                    name: full_name,
                    barcodePath: '',
                    barcodeUrl: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                errorCount++;
                logger_1.logger.error(`❌ Failed to generate barcode for ${student.student_id}`, error);
            }
        }
        const summary = {
            totalStudents: students.length,
            success_count,
            errorCount,
            outputDir: this.studentBarcodeDir,
            results,
            generated_at: new Date().toISOString(),
        };
        const reportPath = (0, path_1.join)(this.studentBarcodeDir, '_generation-report.json');
        (0, fs_1.writeFileSync)(reportPath, JSON.stringify(summary, null, 2));
        logger_1.logger.info(`Saved generation report to ${reportPath}`);
        await this.generatePrintableSheet(results.filter(r => r.success));
        logger_1.logger.info(`Barcode generation complete: ${success_count} success, ${errorCount} errors`);
        return summary;
    }
    async generateBarcodeForStudent(student_id) {
        const fileName = `${student_id}.png`;
        const filePath = (0, path_1.join)(this.studentBarcodeDir, fileName);
        const png = await bwip_js_1.default.toBuffer({
            bcid: 'code128',
            text: student_id,
            scale: 3,
            height: 15,
            includetext: true,
            textxalign: 'center',
            textsize: 13,
        });
        (0, fs_1.writeFileSync)(filePath, png);
        return filePath;
    }
    async regenerateBarcodeForStudent(student_id) {
        const oldPath = (0, path_1.join)(this.studentBarcodeDir, `${student_id}.png`);
        if ((0, fs_1.existsSync)(oldPath)) {
            (0, fs_1.unlinkSync)(oldPath);
            logger_1.logger.info(`Deleted old barcode for ${student_id}`);
        }
        return this.generateBarcodeForStudent(student_id);
    }
    async deleteBarcodeForStudent(student_id) {
        const filePath = (0, path_1.join)(this.studentBarcodeDir, `${student_id}.png`);
        if ((0, fs_1.existsSync)(filePath)) {
            (0, fs_1.unlinkSync)(filePath);
            logger_1.logger.info(`Deleted barcode for ${student_id}`);
        }
        await prisma_1.prisma.students.update({
            where: { student_id },
            data: { id: crypto.randomUUID(), updated_at: new Date(), barcode_image: null },
        });
    }
    barcodeExists(student_id) {
        const filePath = (0, path_1.join)(this.studentBarcodeDir, `${student_id}.png`);
        return (0, fs_1.existsSync)(filePath);
    }
    getBarcodePath(student_id) {
        const filePath = (0, path_1.join)(this.studentBarcodeDir, `${student_id}.png`);
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
      <p>Student ID: ${result.student_id}</p>
      <img src="${result.student_id}.png" alt="Barcode for ${result.student_id}" />
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
    async saveBarcodeHistory(entity_id, entity_type, barcode_data, format) {
        try {
            await prisma_1.prisma.barcode_history.create({
                data: { id: crypto.randomUUID(), updated_at: new Date(),
                    entity_id,
                    entity_type,
                    barcode_data,
                    format,
                    generated_by: 'CLMS System',
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to save barcode history', {
                error: error.message,
            });
        }
    }
    async getBarcodeHistory(entity_id, entity_type) {
        try {
            const history = await prisma_1.prisma.barcode_history.findMany({
                where: {
                    entity_id,
                    entity_type,
                },
                orderBy: {
                    generated_at: 'desc',
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
