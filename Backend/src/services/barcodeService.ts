import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Barcode Generation Service
 * Generates unique numeric barcodes for students and books
 */
export class BarcodeService {
  /**
   * Generate a unique numeric barcode
   * Format: 9-12 digit numeric code
   * Ensures uniqueness in database
   */
  static async generateBarcode(): Promise<string> {
    try {
      let barcode = '';
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        // Generate random 9-12 digit barcode
        const length = 9 + Math.floor(Math.random() * 4); // 9-12 digits
        barcode = this.generateRandomBarcode(length);

        // Check if barcode already exists
        const existing = await prisma.students.findFirst({
          where: { barcode },
          select: { id: true },
        });

        if (!existing) {
          isUnique = true;
        } else {
          attempts++;
        }
      }

      if (!isUnique) {
        throw new Error('Failed to generate unique barcode after 10 attempts');
      }

      logger.info('Generated unique barcode', { barcode, attempts });
      return barcode;
    } catch (error) {
      logger.error('Barcode generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to generate barcode');
    }
  }

  /**
   * Generate random numeric barcode
   */
  private static generateRandomBarcode(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
  }

  /**
   * Validate barcode format
   */
  static validateBarcode(barcode: string): boolean {
    return /^\d{9,12}$/.test(barcode) || /^PN\d{5,12}$/.test(barcode);
  }

  /**
   * Check if barcode is unique in database
   */
  static async isBarcodeUnique(barcode: string): Promise<boolean> {
    const existing = await prisma.students.findFirst({
      where: { barcode },
      select: { id: true },
    });
    return !existing;
  }

  /**
   * Get or generate barcode for student
   * If barcode is provided, validate it
   * If not provided, generate one
   */
  static async getOrGenerateBarcode(barcode?: string | null): Promise<string> {
    if (barcode) {
      if (!this.validateBarcode(barcode)) {
        throw new Error('Invalid barcode format. Must be 9-12 digits.');
      }
      const isUnique = await this.isBarcodeUnique(barcode);
      if (!isUnique) {
        throw new Error('Barcode already in use by another student');
      }
      return barcode;
    } else {
      return await this.generateBarcode();
    }
  }

  /**
   * Generate PN-prefixed barcode using a persisted sequence
   * Uses prisma.system_settings key 'barcode.sequence'
   */
  static async getNextPNBarcode(): Promise<string> {
    const key = 'barcode.sequence';
    let seq = 0;
    try {
      const setting = await prisma.system_settings.findUnique({ where: { key } });
      if (!setting) {
        await prisma.system_settings.create({ data: { key, value: '18' } });
        seq = 18;
      } else {
        seq = parseInt(setting.value || '0');
        seq = isNaN(seq) ? 0 : seq + 1;
        await prisma.system_settings.update({ where: { key }, data: { value: String(seq) } });
      }
    } catch (_e) {
      seq = Math.floor(Date.now() % 100000);
    }
    let code = `PN${String(seq).padStart(5, '0')}`;
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.students.findFirst({ where: { barcode: code } });
      if (!exists) {
        return code;
      }
      attempts++;
      seq++;
      code = `PN${String(seq).padStart(5, '0')}`;
    }
    return code;
  }
}
