import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { SelfService } from './selfService';
import {
  BookScanService,
  BookScanPayload,
  BookScanIntent,
} from './bookScanService';

export type ScanCategory = 'student' | 'book' | 'equipment' | 'unknown';

interface BarcodeResolution {
  type: ScanCategory;
  student?: {
    id: string;
    student_id: string;
    first_name: string;
    last_name: string;
    grade_level: number;
  };
  book?: {
    id: string;
    title: string;
    accession_no: string;
    isbn: string | null;
    available_copies: number | null;
  };
  equipment?: {
    id: string;
    name: string;
    serial_number: string | null;
    status: string;
  };
}

export class ScanDispatchService {
  public static async processScan(
    barcode: string,
    payload: Record<string, unknown> = {},
  ) {
    const trimmed = (barcode || '').trim();
    if (!trimmed) {
      return { success: false, message: 'Barcode is required' };
    }

    const { preview, ...actionPayload } = payload;
    const previewRequested = preview === true || preview === 'true';

    const resolution = await this.identifyBarcode(trimmed);
    logger.info('Dispatching scan', {
      barcode: trimmed,
      category: resolution.type,
    });

    if (previewRequested) {
      return {
        success: true,
        preview: true,
        type: resolution.type,
        student: resolution.student,
        book: resolution.book,
        equipment: resolution.equipment,
      };
    }

    switch (resolution.type) {
      case 'student':
        return await SelfService.processScan(
          trimmed,
          actionPayload.overrideCooldown === true,
        );
      case 'book': {
        const intent = this.resolveBookIntent(actionPayload);
        if (!intent) {
          return {
            success: false,
            message: 'Book scans require an intent (borrow, read, return)',
          };
        }
        const bookPayload: BookScanPayload = {
          intent,
          studentId: this.asString(actionPayload.studentId),
          dueDate: this.asString(actionPayload.dueDate),
          notes: this.asString(actionPayload.notes),
          librarianId: this.asString(actionPayload.librarianId),
        };
        return await BookScanService.handleScan(trimmed, bookPayload);
      }
      case 'equipment':
        return {
          success: false,
          message: 'Equipment scanning workflow is not yet available',
        };
      default:
        return {
          success: false,
          message: 'Unable to determine barcode type',
        };
    }
  }

  private static async identifyBarcode(
    barcode: string,
  ): Promise<BarcodeResolution> {
    const trimmed = barcode.trim();

    const student = await prisma.students.findFirst({
      where: {
        OR: [{ barcode: trimmed }, { student_id: trimmed }],
      },
      select: {
        id: true,
        student_id: true,
        first_name: true,
        last_name: true,
        grade_level: true,
      },
    });
    if (student) {
      return { type: 'student', student };
    }

    const book = await prisma.books.findFirst({
      where: {
        OR: [{ accession_no: trimmed }, { isbn: trimmed }, { id: trimmed }],
      },
      select: {
        id: true,
        title: true,
        accession_no: true,
        isbn: true,
        available_copies: true,
      },
    });
    if (book) {
      return { type: 'book', book };
    }

    const equipment = await prisma.equipment.findFirst({
      where: {
        OR: [{ serial_number: trimmed }, { id: trimmed }, { name: trimmed }],
      },
      select: {
        id: true,
        name: true,
        serial_number: true,
        status: true,
      },
    });
    if (equipment) {
      return { type: 'equipment', equipment };
    }

    if (/^(EQ|PC|PS|AVR)/i.test(trimmed)) {
      return { type: 'equipment' };
    }

    if (/^(97[89])\d{10}$/.test(trimmed) || /^\d{10,13}$/.test(trimmed)) {
      return { type: 'book' };
    }

    if (
      /^PN\d{5,12}$/i.test(trimmed) ||
      /^[A-Z]{2,4}\d{3,6}$/i.test(trimmed) ||
      trimmed.length >= 6
    ) {
      return { type: 'student' };
    }

    return { type: 'unknown' };
  }

  private static resolveBookIntent(
    payload: Record<string, unknown>,
  ): BookScanIntent | undefined {
    const intentValue = payload.intent || payload.action;
    if (!intentValue) {
      return undefined;
    }
    const normalized = String(intentValue).toUpperCase();
    if (
      normalized === 'BORROW' ||
      normalized === 'READ' ||
      normalized === 'RETURN'
    ) {
      return normalized as BookScanIntent;
    }
    return undefined;
  }

  private static asString(value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return undefined;
  }
}
