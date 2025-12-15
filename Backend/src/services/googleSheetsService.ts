import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

// Type definitions for Google Sheets data
export interface ProcessedAttendanceRecord {
  timestamp: Date;
  studentId: string;
  surname: string;
  firstName: string;
  gradeLevel: string;
  section: string; // Student's actual class section (from sheet column F like "ST. JOAN OF ARC")
  designation: string; // "Student" | "Personnel"
  sex: string; // "Male" | "Female"
  action: 'Check In' | 'Check Out';
  activityType:
    | 'Check In'
    | 'Check Out'
    | 'Borrowed'
    | 'Print'
    | 'Room Use'
    | 'Recreation';
  roomCategory: string; // Room/area from sheet's second Section column (Primary Section, AVR USE, etc.)
  bookTitle?: string; // For borrowed items (only if detected as actual book)
  bookAuthor?: string;
  notes?: string; // Librarian notes (if Title contains notes, not book)
  // Borrowing-specific fields
  status?: string; // "Borrowed", "Returned", "Room Use", "Overdue"
  dueDate?: Date; // Due date for borrowed items
  fine?: number; // Fine amount in pesos
}

export interface ProcessedBorrowingRecord {
  timestamp: Date; // borrowed date usually
  studentId: string;
  surname: string;
  firstName: string;
  gradeLevel: string;
  section: string;
  designation: string;
  sex: string;
  action: 'Borrow' | 'Return';
  bookTitle: string;
  bookAuthor: string;
  callNumber: string; // or Section (Book)
  borrowDate: Date;
  dueDate: Date;
  returnedDate?: Date;
  status: string; // "Borrowed", "Returned", "Overdue"
  fine?: string;
  remarks?: string;
}

export interface SheetImportResult {
  importedCount: number;
  errors: { row: number; error: string }[];
  preview: (ProcessedAttendanceRecord | ProcessedBorrowingRecord)[];
}

export interface SheetExportResult {
  exportedCount: number;
  sheetUrl: string;
}

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  // Google Auth types are complex and change between googleapis versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private auth?: any;
  // Sheets API typing is version-specific and auto-generated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sheets?: any;

  private constructor() {}

  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  /**
   * Initialize Google Sheets API client
   */
  public async authenticate(): Promise<void> {
    try {
      if (this.auth) {
        return;
      }

      const credentialsPath =
        process.env.GOOGLE_SHEETS_CREDENTIALS_PATH ||
        './google-credentials.json';
      const resolvedPath = path.resolve(process.cwd(), credentialsPath);

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(
          `Google credentials file not found at: ${resolvedPath}`,
        );
      }

      this.auth = new google.auth.GoogleAuth({
        keyFile: resolvedPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const client = await this.auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: client });

      logger.info('Google Sheets API authenticated successfully');
    } catch (error) {
      logger.error('Failed to authenticate with Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Validate sheet data without importing
   */
  /**
   * Validate sheet data without importing
   */
  public async validateSheet(
    spreadsheetId: string,
    sheetName: string,
    type: 'ATTENDANCE' | 'BORROWING' = 'ATTENDANCE',
  ): Promise<{
    valid: boolean;
    rowCount: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errors: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preview: any[];
  }> {
    await this.authenticate();

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return {
          valid: false,
          rowCount: 0,
          errors: ['Sheet is empty'],
          preview: [],
        };
      }

      // Check header row (Row 1)
      const headers = rows[0];
      const requiredHeaders =
        type === 'ATTENDANCE'
          ? ['Timestamp', 'User ID', 'Action']
          : ['Timestamp', 'User ID', 'Action', 'Title'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        return {
          valid: false,
          rowCount: rows.length,
          errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
          preview: [],
        };
      }

      // Parse first 10 rows for preview
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const preview: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errors: any[] = [];

      // Map headers to indices
      const headerMap: Record<string, number> = {};
      headers.forEach((h: string, i: number) => {
        headerMap[h] = i;
      });

      // Process data rows (skip header)
      const dataRows = rows.slice(1);

      // Process first 10 rows for preview (using for loop to support async)
      const previewRows = dataRows.slice(0, 10);
      for (let index = 0; index < previewRows.length; index++) {
        const row = previewRows[index] as unknown[];
        try {
          const parsed = await this.parseRow(row, headerMap, index + 2, type); // +2 because 1-based and header is row 1
          preview.push(parsed);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          errors.push({ row: index + 2, error: err.message });
        }
      }

      return {
        valid: true, // Pass validation if headers are correct - row errors shown separately
        rowCount: dataRows.length,
        errors,
        preview,
      };
    } catch (error: unknown) {
      logger.error('Error validating sheet:', error);

      // Provide better error messages based on error type
      const err = error as {
        code?: number;
        message?: string;
        errors?: Array<{ reason?: string }>;
      };

      if (err.code === 404) {
        throw new Error(
          `Sheet tab "${sheetName}" not found. Please check the exact tab name at the bottom of your spreadsheet.`,
        );
      }
      if (err.code === 403) {
        throw new Error(
          `Access denied. Please share this spreadsheet with your service account email (found in google-credentials.json).`,
        );
      }
      if (err.code === 400 && err.errors?.[0]?.reason === 'invalidRange') {
        throw new Error(
          `Sheet tab "${sheetName}" not found. Tab names are case-sensitive.`,
        );
      }
      if (err.message?.includes('not found')) {
        throw new Error(
          `Spreadsheet not found. Please verify the Spreadsheet ID is correct.`,
        );
      }

      throw error;
    }
  }

  /**
   * Import attendance from Google Sheet
   */
  public async importAttendanceFromSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<SheetImportResult> {
    return this.importFromSheet(spreadsheetId, sheetName, 'ATTENDANCE');
  }

  /**
   * Import borrowing history from Google Sheet
   */
  public async importBorrowingFromSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<SheetImportResult> {
    return this.importFromSheet(spreadsheetId, sheetName, 'BORROWING');
  }

  private async importFromSheet(
    spreadsheetId: string,
    sheetName: string,
    type: 'ATTENDANCE' | 'BORROWING',
  ): Promise<SheetImportResult> {
    await this.authenticate();

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });

      const rows = response.data.values;
      if (!rows || rows.length < 2) {
        return {
          importedCount: 0,
          errors: [{ row: 0, error: 'Sheet is empty or has no data rows' }],
          preview: [],
        };
      }

      const headers = rows[0];
      const headerMap: Record<string, number> = {};
      headers.forEach((h: string, i: number) => {
        headerMap[h] = i;
      });

      const validRecords: (
        | ProcessedAttendanceRecord
        | ProcessedBorrowingRecord
      )[] = [];
      const errors: { row: number; error: string }[] = [];

      // Process all rows
      for (let i = 1; i < rows.length; i++) {
        try {
          // Cast here based on the known type
          if (type === 'ATTENDANCE') {
            const record = (await this.parseRow(
              rows[i],
              headerMap,
              i + 1,
              type,
            )) as ProcessedAttendanceRecord;
            validRecords.push(record);
          } else {
            const record = (await this.parseRow(
              rows[i],
              headerMap,
              i + 1,
              type,
            )) as ProcessedBorrowingRecord;
            validRecords.push(record);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          errors.push({ row: i + 1, error: err.message });
        }
      }

      return {
        importedCount: validRecords.length,
        errors,
        preview: validRecords, // Caller usually saves this to DB
      };
    } catch (error) {
      logger.error('Error importing from sheet:', error);
      throw error;
    }
  }

  /**
   * Export attendance data to Google Sheet
   */
  public async exportAttendanceToSheet(
    spreadsheetId: string,
    sheetName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    overwrite: boolean = false,
  ): Promise<SheetExportResult> {
    const headers = [
      'Timestamp',
      'User ID',
      'Surname',
      'First Name',
      'Grade Level',
      'Section',
      'Designation',
      'Sex',
      'Action',
      'Type',
      'Title',
      'Author',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRow = (record: any) => [
      record.timestamp ? new Date(record.timestamp).toLocaleString() : '',
      record.studentId,
      record.surname,
      record.firstName,
      record.gradeLevel,
      record.section,
      record.designation,
      record.sex,
      record.action,
      record.activityType || record.action || 'Check In',
      record.bookTitle || '',
      record.bookAuthor || '',
    ];

    return this.exportToSheet(
      spreadsheetId,
      sheetName,
      data,
      headers,
      mapRow,
      overwrite,
    );
  }

  /**
   * Export borrowing history to Google Sheet
   */
  public async exportBorrowingToSheet(
    spreadsheetId: string,
    sheetName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    overwrite: boolean = false,
  ): Promise<SheetExportResult> {
    const headers = [
      'Timestamp',
      'User ID',
      'Surname',
      'First Name',
      'Grade Level',
      'Section',
      'Designation',
      'Sex',
      'Action',
      'Title',
      'Author',
      'Book Section',
      'Borrowed',
      'Due Date',
      'Returned',
      'Status',
      'Fine',
      'Remarks',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRow = (record: any) => [
      record.timestamp ? new Date(record.timestamp).toLocaleString() : '',
      record.studentId,
      record.surname,
      record.firstName,
      record.gradeLevel,
      record.section,
      record.designation,
      record.sex,
      record.action,
      record.bookTitle,
      record.bookAuthor,
      record.callNumber,
      record.borrowDate ? new Date(record.borrowDate).toLocaleDateString() : '',
      record.dueDate ? new Date(record.dueDate).toLocaleDateString() : '',
      record.returnedDate
        ? new Date(record.returnedDate).toLocaleDateString()
        : '',
      record.status,
      record.fine,
      record.remarks,
    ];

    return this.exportToSheet(
      spreadsheetId,
      sheetName,
      data,
      headers,
      mapRow,
      overwrite,
    );
  }

  private async exportToSheet(
    spreadsheetId: string,
    sheetName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    headers: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapRow: (record: any) => any[],
    overwrite: boolean,
  ): Promise<SheetExportResult> {
    await this.authenticate();

    try {
      if (overwrite) {
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: sheetName,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      if (overwrite) {
        values.push(headers);
      }

      data.forEach(record => {
        values.push(mapRow(record));
      });

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });

      return {
        exportedCount: data.length,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
      };
    } catch (error) {
      logger.error('Error exporting to sheet:', error);
      throw error;
    }
  }

  /**
   * Helper to parse a single row
   */
  private async parseRow(
    row: unknown[],
    headerMap: Record<string, number>,
    rowNum: number,
    type: 'ATTENDANCE' | 'BORROWING',
  ): Promise<ProcessedAttendanceRecord | ProcessedBorrowingRecord> {
    // getValue returns FIRST occurrence of a column name in headerMap
    const getValue = (col: string) => {
      const idx = headerMap[col];
      return idx !== undefined && row[idx]
        ? row[idx].toString().trim()
        : undefined;
    };

    const getByIndex = (idx: number) =>
      row[idx] ? row[idx].toString().trim() : undefined;

    // Check timestamp FIRST - skip rows without timestamp
    const timestampStr = getValue('Timestamp') || getByIndex(0);
    if (!timestampStr || timestampStr.trim() === '') {
      throw new Error(`Row ${rowNum}: Missing Timestamp - skipping empty row`);
    }

    // Try to get Student ID by name 'User ID' or 'Student ID' or Col 1
    const studentId =
      getValue('User ID') || getValue('Student ID') || getByIndex(1);

    if (!studentId) {
      throw new Error(`Row ${rowNum}: Missing User ID / Student ID`);
    }

    // Handle duplicate columns by using column index if available
    // Standard columns: E=Grade Level (idx 4), F=Section (idx 5)
    let gradeLevel = getValue('Grade Level') || '';

    // If gradeLevel looks like boolean/corrupted from wrong column, try index 4
    if (gradeLevel === 'FALSE' || gradeLevel === 'TRUE' || gradeLevel === '') {
      const gradeLevelByIdx = getByIndex(4);
      if (
        gradeLevelByIdx &&
        gradeLevelByIdx !== 'FALSE' &&
        gradeLevelByIdx !== 'TRUE'
      ) {
        gradeLevel = gradeLevelByIdx;
      }
    }

    // Column F (index 5) = Actual student section like "ST. JOAN OF ARC"
    // Column L (index 11) = Room category like "Primary Section", "PERSONNEL"
    let section = getValue('Section') || getByIndex(5) || '';
    let roomCategory = getByIndex(11) || ''; // Second "Section" column for room category

    // If section looks like a room category (not a saint name), swap them
    const roomCategoryPatterns = [
      'PERSONNEL',
      'Primary Section',
      'High School',
      'Senior High',
      'AVR',
      'LIBRARY',
    ];
    if (
      section &&
      roomCategoryPatterns.some(p =>
        section.toUpperCase().includes(p.toUpperCase()),
      )
    ) {
      // This is actually a room category, not a student section
      roomCategory = section;
      section = '';
    }

    // Default roomCategory to "Library" if still empty
    if (roomCategory === '' || !roomCategory) {
      roomCategory = 'Library';
    }

    // ========== SMART DATA ENRICHMENT ==========
    // Look up student in database to fill in missing data from the students table
    // This enriches the Google Sheet data with complete student info
    let designation = getValue('Designation') || '';
    let sex = getValue('Sex') || getValue('Gender') || '';

    try {
      const studentFromDb = await prisma.students.findFirst({
        where: {
          OR: [{ student_id: studentId }, { barcode: studentId }],
        },
      });

      if (studentFromDb) {
        // Fill section from DB if sheet is empty
        if (!section && studentFromDb.section) {
          section = studentFromDb.section;
        }

        // Fill grade level from DB if sheet is empty/invalid
        if (!gradeLevel && studentFromDb.grade_level !== null) {
          gradeLevel =
            studentFromDb.grade_level === 0
              ? 'Pre-School'
              : `GRADE ${studentFromDb.grade_level}`;
        }

        // Fill gender from DB if empty
        if (!sex && studentFromDb.gender) {
          sex = studentFromDb.gender;
        }

        // Fill designation from DB type if empty
        if (!designation && studentFromDb.type) {
          designation =
            studentFromDb.type === 'PERSONNEL' ? 'Personnel' : 'Student';
        }
      }
    } catch (dbError) {
      // Log but continue - we can still use sheet data if DB lookup fails
      logger.warn(
        `Could not lookup student ${studentId} in database:`,
        dbError,
      );
    }
    // ========== END SMART DATA ENRICHMENT ==========

    const common = {
      studentId,
      surname: getValue('Surname') || getValue('Last Name') || '',
      firstName: getValue('First Name') || '',
      gradeLevel,
      section, // Student's actual class section (e.g., "ST. JOAN OF ARC")
      roomCategory, // Room category (Primary Section, PERSONNEL, etc.)
      designation,
      sex,
      action:
        getValue('Action') || (type === 'ATTENDANCE' ? 'Check In' : 'Borrow'),
    };

    // Timestamp parsing
    let timestamp: Date;
    if (timestampStr) {
      timestamp = new Date(timestampStr);
    } else {
      // This shouldn't happen since we check above, but fallback
      timestamp = new Date();
    }

    // Ensure valid date
    if (isNaN(timestamp.getTime())) {
      throw new Error(
        `Row ${rowNum}: Invalid timestamp format: ${timestampStr}`,
      );
    }

    if (type === 'ATTENDANCE') {
      // Detect activity type based on available data
      const rawTitle = getValue('Title') || getValue('Book Title') || '';
      const bookAuthor = getValue('Author') || getValue('Book Author') || '';
      const status = getValue('Status') || getByIndex(14) || ''; // Column O (index 14)
      const actionLower = common.action.toLowerCase();

      // Parse Due Date (Column P, index 15)
      const dueDateStr = getValue('Due Date') || getByIndex(15) || '';
      let dueDate: Date | undefined = undefined;
      if (dueDateStr && dueDateStr.trim() !== '' && dueDateStr !== 'FALSE') {
        const parsedDate = new Date(dueDateStr);
        if (!isNaN(parsedDate.getTime())) {
          dueDate = parsedDate;
        }
      }

      // Parse Fine (Column S, index 18)
      const fineStr = getValue('Fine') || getByIndex(18) || '';
      let fine: number | undefined = undefined;
      if (fineStr && fineStr.trim() !== '' && fineStr !== 'FALSE') {
        const parsedFine = parseFloat(fineStr);
        if (!isNaN(parsedFine) && parsedFine > 0) {
          fine = parsedFine;
        }
      }

      // Smart detection: Is the Title a book or a librarian note?
      // Notes patterns - NOT book titles
      const NOTE_PATTERNS = [
        'not using library card',
        'no library card',
        'library card',
        'contest',
        'event',
        'meeting',
        'no card',
        'avr use',
        'computer use',
        'recreation',
        'printing',
        '*', // Entries starting with * are usually notes
      ];

      let bookTitle: string | undefined = undefined;
      let notes: string | undefined = undefined;

      if (rawTitle) {
        const titleLower = rawTitle.toLowerCase().trim();

        // Check if it matches note patterns
        const isNote = NOTE_PATTERNS.some(pattern =>
          pattern === '*'
            ? rawTitle.trim().startsWith('*')
            : titleLower.includes(pattern),
        );

        if (isNote) {
          // It's a librarian note, not a book title
          notes = rawTitle;
          bookTitle = undefined;
        } else if (bookAuthor) {
          // Has an author = definitely a book
          bookTitle = rawTitle;
        } else if (
          rawTitle.length > 5 &&
          !rawTitle.includes(' use') &&
          !rawTitle.includes(' card')
        ) {
          // Longer entries without "use" or "card" are likely books
          bookTitle = rawTitle;
        } else {
          // Short entries without author might be notes
          notes = rawTitle;
        }
      }

      // Default activity type is Room Use (most common case: student using library)
      // Only change if we detect specific activities like borrowed, print, etc.
      let activityType: ProcessedAttendanceRecord['activityType'] = 'Room Use';

      // Check if this is a book borrowing activity (has book title or explicit borrow/return status)
      if (
        bookTitle ||
        status.toLowerCase().includes('return') ||
        status.toLowerCase().includes('borrow') ||
        status.toLowerCase() === 'borrowed' ||
        status.toLowerCase() === 'overdue' ||
        status.toLowerCase() === 'returned'
      ) {
        activityType = 'Borrowed';
      }
      // Check for printing
      else if (
        actionLower.includes('print') ||
        status.toLowerCase().includes('print')
      ) {
        activityType = 'Print';
      }
      // Check for recreation
      else if (
        status.toLowerCase().includes('recreation') ||
        actionLower.includes('recreation') ||
        common.roomCategory.toLowerCase().includes('recreation')
      ) {
        activityType = 'Recreation';
      }
      // Check for explicit check in/out
      else if (actionLower.includes('check in')) {
        activityType = 'Check In';
      } else if (
        actionLower.includes('out') ||
        actionLower.includes('checkout')
      ) {
        activityType = 'Check Out';
      }
      // Default stays as Room Use (already set above)

      return {
        ...common,
        timestamp,
        activityType,
        bookTitle,
        bookAuthor: bookTitle ? bookAuthor || undefined : undefined,
        notes,
        status: status || undefined,
        dueDate,
        fine,
      } as ProcessedAttendanceRecord;
    } else {
      // BORROWING
      const borrowDateStr = getValue('Borrowed') || getValue('Borrow Date');
      const borrowDate = borrowDateStr ? new Date(borrowDateStr) : timestamp;

      const dueDateStr = getValue('Due Date');
      const dueDate = dueDateStr ? new Date(dueDateStr) : timestamp; // Default to same day if missing? Or +Xd?

      const returnedDateStr = getValue('Returned') || getValue('Return Date');
      const returnedDate = returnedDateStr
        ? new Date(returnedDateStr)
        : undefined;

      return {
        ...common,
        timestamp,
        bookTitle: getValue('Title') || getValue('Book Title') || '',
        bookAuthor: getValue('Author') || getValue('Book Author') || '',
        callNumber:
          getValue('Section') ||
          getValue('Book Section') ||
          getValue('Call Number') ||
          '', // 'Section' is ambiguous (Student vs Book). Usually Book Section is separate. CSV has 'Section' twice?
        // If CSV has duplicate headers 'Section', headerMap might only keep last one.
        // Assuming user map handles it or we use index for book section (Col 11?).
        // For safely, we try 'Call Number' or 'Accession'.
        borrowDate: isNaN(borrowDate.getTime()) ? timestamp : borrowDate,
        dueDate: isNaN(dueDate.getTime()) ? timestamp : dueDate,
        returnedDate:
          returnedDate && !isNaN(returnedDate.getTime())
            ? returnedDate
            : undefined,
        status: getValue('Status') || 'BORROWED',
        fine: getValue('Fine'),
        remarks: getValue('Remarks'),
      } as ProcessedBorrowingRecord;
    }
  }

  // Static compatibility methods for existing service consumers
  public static async syncAll(): Promise<void> {
    logger.warn(
      'GoogleSheetsService.syncAll called but not implemented in new version',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async appendRow(row: any[]): Promise<void> {
    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      // Default to "Student Activities" as per user request if not specified, or just "Sheet1"
      const sheetName = 'Student Activities';

      if (!spreadsheetId) {
        logger.warn('GOOGLE_SHEETS_SPREADSHEET_ID not set, skipping appendRow');
        return;
      }

      const instance = GoogleSheetsService.getInstance();
      await instance.authenticate();

      await instance.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });
    } catch (error) {
      logger.error('Failed to append row to Google Sheet', error);
      // Don't throw to avoid breaking the calling flow
    }
  }
}

export const googleSheetsService = GoogleSheetsService.getInstance();
