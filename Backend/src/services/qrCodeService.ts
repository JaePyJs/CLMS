import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

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

export class QRCodeService {
  private qrDir: string;

  constructor() {
    this.qrDir = path.join(process.cwd(), 'qr-codes', 'students');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.qrDir)) {
      fs.mkdirSync(this.qrDir, { recursive: true });
      logger.info(`Created QR codes directory: ${this.qrDir}`);
    }
  }

  async generateQRCodesForAllStudents(): Promise<QRGenerationSummary> {
    logger.info('Starting QR code generation for all students');

    const students = await prisma.students.findMany({
      where: { is_active: true },
      orderBy: { student_id: 'asc' },
    });

    logger.info(`Found ${students.length} active students`);

    const results: QRGenerationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        const result = await this.generateQRCodeForStudent(student.id);
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          `Failed to generate QR for student ${student.student_id}: ${errorMessage}`,
        );

        results.push({
          student_id: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          qrPath: '',
          qrUrl: '',
          success: false,
          error: errorMessage,
        });
      }
    }

    const summary: QRGenerationSummary = {
      totalStudents: students.length,
      success_count: successCount,
      errorCount,
      outputDir: this.qrDir,
      results,
      generated_at: new Date().toISOString(),
    };

    // Save report
    const reportPath = path.join(this.qrDir, '_generation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    logger.info(
      `QR generation complete. Success: ${successCount}, Failed: ${errorCount}`,
    );

    return summary;
  }

  async generateQRCodeForStudent(
    student_id: string,
  ): Promise<QRGenerationResult> {
    const student = await prisma.students.findUnique({
      where: { id: student_id },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const qrData = student.student_id;
    const fileName = `${student.student_id}.png`;
    const filePath = path.join(this.qrDir, fileName);

    await QRCode.toFile(filePath, qrData, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });

    // Update database
    await prisma.students.update({
      where: { id: student.id },
      data: { updated_at: new Date(), barcode_image: filePath },
    });

    return {
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      qrPath: filePath,
      qrUrl: `/api/qr-codes/${student.student_id}.png`,
      success: true,
    };
  }

  async getQRCodeForStudent(student_id: string): Promise<string | null> {
    const student = await prisma.students.findFirst({
      where: { student_id },
    });

    if (!student || !student.barcode_image) {
      return null;
    }

    return student.barcode_image;
  }

  async getGenerationReport(): Promise<QRGenerationSummary | null> {
    const reportPath = path.join(this.qrDir, '_generation-report.json');

    if (!fs.existsSync(reportPath)) {
      return null;
    }

    const reportData = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(reportData);
  }

  getQRCodePath(student_id: string): string {
    return path.join(this.qrDir, `${student_id}.png`);
  }

  qrCodeExists(student_id: string): boolean {
    return fs.existsSync(this.getQRCodePath(student_id));
  }

  async deleteQRCode(student_id: string): Promise<boolean> {
    const filePath = this.getQRCodePath(student_id);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      // Update database
      const student = await prisma.students.findFirst({
        where: { student_id },
      });

      if (student) {
        await prisma.students.update({
          where: { id: student.id },
          data: { updated_at: new Date(), barcode_image: null },
        });
      }

      return true;
    }

    return false;
  }

  async regenerateQRCode(student_id: string): Promise<QRGenerationResult> {
    await this.deleteQRCode(student_id);

    const student = await prisma.students.findFirst({
      where: { student_id },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return this.generateQRCodeForStudent(student.id);
  }
}

export const qrCodeService = new QRCodeService();
