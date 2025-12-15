import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { GoogleSheetsService } from './googleSheetsService';

interface StudentScanLog {
  timestamp?: Date;
  barcode: string;
  studentId?: string;
  studentName?: string;
  action: string;
  source: string;
  status?: string;
  location?: string;
  notes?: string;
}

interface BookActionLog {
  timestamp?: Date;
  barcode: string;
  bookId?: string;
  bookTitle?: string;
  intent: 'BORROW' | 'READ' | 'RETURN';
  studentId?: string;
  studentName?: string;
  dueDate?: string;
  notes?: string;
}

interface EquipmentUsageLog {
  timestamp?: Date;
  studentId?: string;
  studentName?: string;
  equipmentId?: string;
  equipmentName?: string;
  room?: string;
  action: 'ASSIGN' | 'REASSIGN' | 'END';
  durationMinutes?: number;
  notes?: string;
}

interface PrintingLog {
  timestamp?: Date;
  studentId?: string;
  guestName?: string;
  jobId?: string;
  pages: number;
  cost: number;
  paperSize: string;
  colorLevel: string;
  operator?: string;
}

const DEFAULT_BASE_DIR =
  process.env.SCANS_EXPORT_DIR || path.join(process.cwd(), '..', 'reports');

const FILE_CONFIG = {
  students: {
    prefix: 'student-scans',
    headers:
      'Timestamp,Barcode,Student ID,Student Name,Action,Source,Status,Location,Notes',
    sheet: 'Students',
  },
  books: {
    prefix: 'book-actions',
    headers:
      'Timestamp,Barcode,Book ID,Book Title,Intent,Student ID,Student Name,Due Date,Notes',
    sheet: 'Books',
  },
  equipment: {
    prefix: 'equipment-usage',
    headers:
      'Timestamp,Student ID,Student Name,Equipment ID,Equipment Name,Room,Action,Duration (mins),Notes',
    sheet: 'Equipment',
  },
  printing: {
    prefix: 'printing-jobs',
    headers:
      'Timestamp,Student ID,Guest Name,Job ID,Pages,Cost,Paper Size,Color Level,Operator',
    sheet: 'Printing',
  },
} as const;

type CsvConfig = (typeof FILE_CONFIG)[keyof typeof FILE_CONFIG];

export class ScanExportService {
  private static async ensureDirectory(dir: string) {
    await fsPromises.mkdir(dir, { recursive: true });
  }

  private static getFilePath(config: CsvConfig, when = new Date()) {
    const datePart = when.toISOString().split('T')[0];
    return path.join(DEFAULT_BASE_DIR, `${config.prefix}-${datePart}.csv`);
  }

  private static formatCsvRow(values: Array<string | number | undefined>) {
    return values
      .map(value => {
        const safe = value === undefined ? '' : String(value);
        const escaped = safe.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',');
  }

  private static async appendCsv(
    config: CsvConfig,
    row: Array<string | number | undefined>,
    when = new Date(),
  ) {
    const filePath = this.getFilePath(config, when);
    await this.ensureDirectory(path.dirname(filePath));

    const needsHeader = !fs.existsSync(filePath);
    if (needsHeader) {
      await fsPromises.writeFile(filePath, `${config.headers}\n`, 'utf8');
    }

    const formatted = this.formatCsvRow(row);
    await fsPromises.appendFile(filePath, `${formatted}\n`, 'utf8');
    return filePath;
  }

  private static async appendSheet(
    sheet: string,
    row: Array<string | number | undefined>,
    when = new Date(),
  ) {
    try {
      const formatted = row.map(value =>
        value === undefined ? '' : String(value),
      );
      const timestamp = when.toISOString();
      await GoogleSheetsService.appendRow(formatted);
      logger.debug('Appended row to Google Sheet', { sheet, timestamp });
    } catch (error) {
      logger.error('Failed to append row to Google Sheet', {
        sheet,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  public static async logStudentScan(data: StudentScanLog) {
    const when = data.timestamp ?? new Date();
    const row = [
      when.toISOString(),
      data.barcode,
      data.studentId,
      data.studentName,
      data.action,
      data.source,
      data.status,
      data.location,
      data.notes,
    ];

    const config = FILE_CONFIG.students;
    await this.appendCsv(config, row, when);
    await this.appendSheet(config.sheet, row, when);
  }

  public static async logBookAction(data: BookActionLog) {
    const when = data.timestamp ?? new Date();
    const row = [
      when.toISOString(),
      data.barcode,
      data.bookId,
      data.bookTitle,
      data.intent,
      data.studentId,
      data.studentName,
      data.dueDate,
      data.notes,
    ];

    const config = FILE_CONFIG.books;
    await this.appendCsv(config, row, when);
    await this.appendSheet(config.sheet, row, when);
  }

  public static async logEquipmentUsage(data: EquipmentUsageLog) {
    const when = data.timestamp ?? new Date();
    const row = [
      when.toISOString(),
      data.studentId,
      data.studentName,
      data.equipmentId,
      data.equipmentName,
      data.room,
      data.action,
      data.durationMinutes,
      data.notes,
    ];

    const config = FILE_CONFIG.equipment;
    await this.appendCsv(config, row, when);
    await this.appendSheet(config.sheet, row, when);
  }

  public static async logPrintingJob(data: PrintingLog) {
    const when = data.timestamp ?? new Date();
    const row = [
      when.toISOString(),
      data.studentId,
      data.guestName,
      data.jobId,
      data.pages,
      data.cost,
      data.paperSize,
      data.colorLevel,
      data.operator,
    ];

    const config = FILE_CONFIG.printing;
    await this.appendCsv(config, row, when);
    await this.appendSheet(config.sheet, row, when);
  }
}
