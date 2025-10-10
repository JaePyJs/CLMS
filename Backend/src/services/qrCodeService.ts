import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export interface QRGenerationResult {
  studentId: string;
  name: string;
  qrPath: string;
  qrUrl: string;
  success: boolean;
  error?: string;
}

export interface QRGenerationSummary {
  totalStudents: number;
  successCount: number;
  errorCount: number;
  outputDir: string;
  results: QRGenerationResult[];
  generatedAt: string;
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

    const students = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { studentId: 'asc' },
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
          `Failed to generate QR for student ${student.studentId}: ${errorMessage}`,
        );

        results.push({
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          qrPath: '',
          qrUrl: '',
          success: false,
          error: errorMessage,
        });
      }
    }

    const summary: QRGenerationSummary = {
      totalStudents: students.length,
      successCount,
      errorCount,
      outputDir: this.qrDir,
      results,
      generatedAt: new Date().toISOString(),
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
    studentId: string,
  ): Promise<QRGenerationResult> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const qrData = student.studentId;
    const fileName = `${student.studentId}.png`;
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
    await prisma.student.update({
      where: { id: student.id },
      data: { barcodeImage: filePath },
    });

    return {
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      qrPath: filePath,
      qrUrl: `/api/qr-codes/${student.studentId}.png`,
      success: true,
    };
  }

  async getQRCodeForStudent(studentId: string): Promise<string | null> {
    const student = await prisma.student.findFirst({
      where: { studentId },
    });

    if (!student || !student.barcodeImage) {
      return null;
    }

    return student.barcodeImage;
  }

  async getGenerationReport(): Promise<QRGenerationSummary | null> {
    const reportPath = path.join(this.qrDir, '_generation-report.json');

    if (!fs.existsSync(reportPath)) {
      return null;
    }

    const reportData = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(reportData);
  }

  getQRCodePath(studentId: string): string {
    return path.join(this.qrDir, `${studentId}.png`);
  }

  qrCodeExists(studentId: string): boolean {
    return fs.existsSync(this.getQRCodePath(studentId));
  }

  async deleteQRCode(studentId: string): Promise<boolean> {
    const filePath = this.getQRCodePath(studentId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      // Update database
      const student = await prisma.student.findFirst({
        where: { studentId },
      });

      if (student) {
        await prisma.student.update({
          where: { id: student.id },
          data: { barcodeImage: null },
        });
      }

      return true;
    }

    return false;
  }

  async regenerateQRCode(studentId: string): Promise<QRGenerationResult> {
    await this.deleteQRCode(studentId);

    const student = await prisma.student.findFirst({
      where: { studentId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return this.generateQRCodeForStudent(student.id);
  }
}

export const qrCodeService = new QRCodeService();
