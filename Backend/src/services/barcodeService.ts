import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import bwipjs from 'bwip-js';

// Barcode image options
export interface BarcodeOptions {
  width?: number;
  height?: number;
  includeText?: boolean;
  format?: 'png' | 'svg' | 'jpg';
}

// Barcode generation result
export interface BarcodeResult {
  success: boolean;
  barcodePath?: string;
  error?: string;
}

// Enhanced barcode generation result with more details
export interface BarcodeGenerationResult {
  student_id: string;
  name: string;
  barcodePath: string;
  barcodeUrl: string;
  success: boolean;
  error?: string;
}

// Barcode generation summary
export interface BarcodeGenerationSummary {
  totalStudents: number;
  success_count: number;
  errorCount: number;
  outputDir: string;
  results: BarcodeGenerationResult[];
  generated_at: string;
}

// Default barcode options
const defaultOptions: BarcodeOptions = {
  width: 200,
  height: 50,
  includeText: true,
  format: 'png',
};

// Barcode service class
export class BarcodeService {
  private outputDir: string;
  private studentBarcodeDir: string;

  constructor() {
    // Set output directory to uploads/barcodes
    this.outputDir = join(process.cwd(), 'uploads', 'barcodes');

    // Separate directory for student barcodes (for printable sheets)
    this.studentBarcodeDir = join(process.cwd(), 'barcodes', 'students');

    // Create directories if they don't exist
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
    if (!existsSync(this.studentBarcodeDir)) {
      mkdirSync(this.studentBarcodeDir, { recursive: true });
    }
  }

  // Generate barcode for a student
  async generateStudentBarcode(
    student_id: string,
    options: BarcodeOptions = {},
  ): Promise<BarcodeResult> {
    try {
      const opts = { ...defaultOptions, ...options };

      // Get student from database
      const student = await prisma.students.findUnique({
        where: { student_id },
      });

      if (!student) {
        return {
          success: false,
          error: `Student with ID ${student_id} not found`,
        };
      }

      // Generate filename
      const filename = `student_${student.student_id}.${opts.format}`;
      const barcodePath = join(this.outputDir, filename);

      // Generate barcode
      await this.generateBarcodeImage(student.student_id, barcodePath, opts);

      // Update student record with barcode path
      await prisma.students.update({
        where: { id: student.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(),  barcode_image: barcodePath },
      });

      // Save barcode history
      await this.saveBarcodeHistory(
        student.id,
        'Student',
        student.student_id,
        opts.format || 'png',
      );

      logger.info(`Generated barcode for student ${student.student_id}`, {
        path: barcodePath,
      });

      return {
        success: true,
        barcodePath,
      };
    } catch (error) {
      logger.error('Failed to generate student barcode', {
        error: (error as Error).message,
        student_id,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Generate barcode for a book
  async generateBookBarcode(
    book_id: string,
    options: BarcodeOptions = {},
  ): Promise<BarcodeResult> {
    try {
      const opts = { ...defaultOptions, ...options };

      // Get book from database
      const book = await prisma.books.findUnique({
        where: { id: book_id },
      });

      if (!book) {
        return {
          success: false,
          error: `Book with ID ${book_id} not found`,
        };
      }

      // Use accession number as barcode data
      const barcodeData = book.accession_no;

      // Generate filename
      const filename = `book_${barcode_data}.${opts.format}`;
      const barcodePath = join(this.outputDir, filename);

      // Generate barcode
      await this.generateBarcodeImage(barcode_data, barcodePath, opts);

      // Update book record with barcode path
      await prisma.books.update({
        where: { id: book.id },
        data: { id: crypto.randomUUID(), updated_at: new Date(),  barcode_image: barcodePath },
      });

      // Save barcode history
      await this.saveBarcodeHistory(
        book.id,
        'Book',
        barcode_data,
        opts.format || 'png',
      );

      logger.info(`Generated barcode for book ${barcode_data}`, {
        path: barcodePath,
      });

      return {
        success: true,
        barcodePath,
      };
    } catch (error) {
      logger.error('Failed to generate book barcode', {
        error: (error as Error).message,
        book_id,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Generate barcode for equipment
  async generateEquipmentBarcode(
    equipment_id: string,
    options: BarcodeOptions = {},
  ): Promise<BarcodeResult> {
    try {
      const opts = { ...defaultOptions, ...options };

      // Get equipment from database
      const equipment = await prisma.equipment.findUnique({
        where: { id: equipment_id },
      });

      if (!equipment) {
        return {
          success: false,
          error: `Equipment with ID ${equipment_id} not found`,
        };
      }

      // Use equipment ID as barcode data
      const barcodeData = equipment.equipment_id;

      // Generate filename
      const filename = `equipment_${barcode_data}.${opts.format}`;
      const barcodePath = join(this.outputDir, filename);

      // Generate barcode
      await this.generateBarcodeImage(barcode_data, barcodePath, opts);

      logger.info(`Generated barcode for equipment ${barcode_data}`, {
        path: barcodePath,
      });

      return {
        success: true,
        barcodePath,
      };
    } catch (error) {
      logger.error('Failed to generate equipment barcode', {
        error: (error as Error).message,
        equipment_id,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Generate barcodes for all students
  async generateAllStudentBarcodes(
    options: BarcodeOptions = {},
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const students = await prisma.students.findMany({
        where: { is_active: true },
      });

      let successCount = 0;
      let errorCount = 0;

      for (const student of students) {
        const result = await this.generateStudentBarcode(
          student.student_id,
          options,
        );
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          logger.warn(
            `Failed to generate barcode for student ${student.student_id}`,
            { error: result.error },
          );
        }
      }

      logger.info(`Generated barcodes for ${success_count} students`, {
        errorCount,
      });

      return {
        success: true,
        count: success_count,
      };
    } catch (error) {
      logger.error('Failed to generate all student barcodes', {
        error: (error as Error).message,
      });
      return {
        success: false,
        count: 0,
        error: (error as Error).message,
      };
    }
  }

  // Generate barcodes for all books
  async generateAllBookBarcodes(
    options: BarcodeOptions = {},
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const books = await prisma.books.findMany({
        where: { is_active: true },
      });

      let successCount = 0;
      let errorCount = 0;

      for (const book of books) {
        const result = await this.generateBookBarcode(book.id, options);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          logger.warn(
            `Failed to generate barcode for book ${book.accession_no}`,
            { error: result.error },
          );
        }
      }

      logger.info(`Generated barcodes for ${success_count} books`, {
        errorCount,
      });

      return {
        success: true,
        count: success_count,
      };
    } catch (error) {
      logger.error('Failed to generate all book barcodes', {
        error: (error as Error).message,
      });
      return {
        success: false,
        count: 0,
        error: (error as Error).message,
      };
    }
  }

  // Generate barcodes for all equipment
  async generateAllEquipmentBarcodes(
    options: BarcodeOptions = {},
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const equipment = await prisma.equipment.findMany();

      let successCount = 0;
      let errorCount = 0;

      for (const item of equipment) {
        const result = await this.generateEquipmentBarcode(item.id, options);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          logger.warn(
            `Failed to generate barcode for equipment ${item.equipment_id}`,
            { error: result.error },
          );
        }
      }

      logger.info(`Generated barcodes for ${success_count} equipment items`, {
        errorCount,
      });

      return {
        success: true,
        count: success_count,
      };
    } catch (error) {
      logger.error('Failed to generate all equipment barcodes', {
        error: (error as Error).message,
      });
      return {
        success: false,
        count: 0,
        error: (error as Error).message,
      };
    }
  }

  // NEW: Generate barcodes for all students with enhanced tracking and printable sheet
  async generateBarcodesForAllStudents(): Promise<BarcodeGenerationSummary> {
    logger.info('Starting barcode generation for all students');

    const students = await prisma.students.findMany({
      where: { is_active: true },
      orderBy: { student_id: 'asc' },
    });

    logger.info(`Found ${students.length} active students`);

    const results: BarcodeGenerationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        const barcodePath = await this.generateBarcodeForStudent(
          student.student_id,
        );

        // Update database with barcode path
        await prisma.students.update({
          where: { student_id: student.student_id },
          data: { id: crypto.randomUUID(), updated_at: new Date(),  barcode_image: barcodePath },
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
        logger.info(
          `✅ Generated barcode for ${student.student_id} - ${full_name}`,
        );
      } catch (error) {
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
        logger.error(
          `❌ Failed to generate barcode for ${student.student_id}`,
          error,
        );
      }
    }

    // Generate summary report
    const summary: BarcodeGenerationSummary = {
      totalStudents: students.length,
      success_count,
      errorCount,
      outputDir: this.studentBarcodeDir,
      results,
      generated_at: new Date().toISOString(),
    };

    // Save summary to JSON file
    const reportPath = join(this.studentBarcodeDir, '_generation-report.json');
    writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    logger.info(`Saved generation report to ${reportPath}`);

    // Generate printable HTML sheet
    await this.generatePrintableSheet(results.filter(r => r.success));

    logger.info(
      `Barcode generation complete: ${success_count} success, ${errorCount} errors`,
    );
    return summary;
  }

  // NEW: Generate barcode for a single student (separate folder)
  async generateBarcodeForStudent(student_id: string): Promise<string> {
    const fileName = `${student_id}.png`;
    const filePath = join(this.studentBarcodeDir, fileName);

    // Generate barcode using Code128 format
    const png = await bwipjs.toBuffer({
      bcid: 'code128', // Barcode type
      text: student_id, // Text to encode
      scale: 3, // 3x scaling factor
      height: 15, // Bar height, in millimeters
      includetext: true, // Show human-readable text
      textxalign: 'center', // Center the text
      textsize: 13, // Font size for text
    });

    writeFileSync(filePath, png);
    return filePath;
  }

  // NEW: Regenerate barcode for a student
  async regenerateBarcodeForStudent(student_id: string): Promise<string> {
    // Delete old barcode if exists
    const oldPath = join(this.studentBarcodeDir, `${student_id}.png`);
    if (existsSync(oldPath)) {
      unlinkSync(oldPath);
      logger.info(`Deleted old barcode for ${student_id}`);
    }

    // Generate new barcode
    return this.generateBarcodeForStudent(student_id);
  }

  // NEW: Delete barcode for a student
  async deleteBarcodeForStudent(student_id: string): Promise<void> {
    const filePath = join(this.studentBarcodeDir, `${student_id}.png`);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
      logger.info(`Deleted barcode for ${student_id}`);
    }

    // Remove from database
    await prisma.students.update({
      where: { student_id },
      data: { id: crypto.randomUUID(), updated_at: new Date(),  barcode_image: null },
    });
  }

  // NEW: Check if barcode exists
  barcodeExists(student_id: string): boolean {
    const filePath = join(this.studentBarcodeDir, `${student_id}.png`);
    return existsSync(filePath);
  }

  // NEW: Get barcode path
  getBarcodePath(student_id: string): string | null {
    const filePath = join(this.studentBarcodeDir, `${student_id}.png`);
    return existsSync(filePath) ? filePath : null;
  }

  // NEW: Get generation report
  async getGenerationReport(): Promise<BarcodeGenerationSummary | null> {
    const reportPath = join(this.studentBarcodeDir, '_generation-report.json');

    if (!existsSync(reportPath)) {
      return null;
    }

    const reportData = readFileSync(reportPath, 'utf-8');
    return JSON.parse(reportData);
  }

  // NEW: Generate printable HTML sheet with compressed mode
  private async generatePrintableSheet(
    results: BarcodeGenerationResult[],
  ): Promise<void> {
    const htmlPath = join(this.studentBarcodeDir, 'index.html');

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
      .map(
        result => `
    <div class="barcode-card">
      <h3>${result.name}</h3>
      <p>Student ID: ${result.student_id}</p>
      <img src="${result.student_id}.png" alt="Barcode for ${result.student_id}" />
    </div>
    `,
      )
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

    writeFileSync(htmlPath, html.trim());
    logger.info(`Generated printable barcode sheet: ${htmlPath}`);
  }

  // Generate barcode image using bwip-js
  private async generateBarcodeImage(
    data: string,
    outputPath: string,
    options: BarcodeOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create barcode
        const png = bwipjs.toBuffer({
          bcid: 'code128', // Barcode type
          text: data, // Text to encode
          scale: 3, // Scaling factor
          height: options.height || 10, // Bar height, in millimeters
          includetext: options.includeText || true, // Show human-readable text
          textxalign: 'center', // Always good to set this
        });

        // Write to file
        const fileStream = createWriteStream(outputPath);
        fileStream.write(png);
        fileStream.end();

        fileStream.on('finish', () => resolve());
        fileStream.on('error', error => reject(error));
      } catch (error) {
        reject(error);
      }
    });
  }

  // Save barcode generation history
  private async saveBarcodeHistory(
    entity_id: string,
    entity_type: string,
    barcode_data: string,
    format: string,
  ): Promise<void> {
    try {
      await prisma.barcode_history.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          entity_id,
          entity_type,
          barcode_data,
          format,
          generated_by: 'CLMS System',
        },
      });
    } catch (error) {
      logger.error('Failed to save barcode history', {
        error: (error as Error).message,
      });
    }
  }

  // Get barcode history
  async getBarcodeHistory(entity_id: string, entity_type: string) {
    try {
      const history = await prisma.barcode_history.findMany({
        where: {
          entity_id,
          entity_type,
        },
        orderBy: {
          generated_at: 'desc',
        },
      });

      return history;
    } catch (error) {
      logger.error('Failed to get barcode history', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Get output directory
  getOutputDir(): string {
    return this.outputDir;
  }
}

// Create and export singleton instance
export const barcodeService = new BarcodeService();
export default barcodeService;
