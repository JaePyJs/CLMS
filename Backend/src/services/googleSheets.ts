import { GoogleAuth } from 'google-auth-library';
import { google, type sheets_v4 } from 'googleapis';
import { logger } from '@/utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { GoogleSheetCellValue } from '@/types';

interface DailyReportData {
  date: string;
  totalActivities: number;
  activitiesByType: Record<string, number>;
  activitiesByGrade: Record<string, number>;
  equipmentUsage: number;
  uniqueStudents: number;
}

// Google Sheets API scopes
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Google Sheets service class
export class GoogleSheetsService {
  private auth: GoogleAuth | null = null;
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string | null = null;
  private isInitialized = false;

  // Initialize the Google Sheets service
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Google Sheets service...');

      // Get credentials path from environment
      const credentialsPath =
        process.env.GOOGLE_CREDENTIALS_PATH ||
        join(process.cwd(), 'google-credentials.json');

      // Get spreadsheet ID from environment
      this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || null;

      if (!this.spreadsheetId) {
        throw new Error('Google Spreadsheet ID is required');
      }

      // Load credentials
      const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));

      // Create auth client
      this.auth = new GoogleAuth({
        credentials,
        scopes: SCOPES,
      });

      // Create sheets client
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      this.isInitialized = true;
      logger.info('Google Sheets service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Google Sheets service', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Test connection to Google Sheets
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get spreadsheet metadata
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      logger.info('Google Sheets connection test successful', {
        spreadsheetTitle: response.data.properties?.title,
      });

      return true;
    } catch (error) {
      logger.error('Google Sheets connection test failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Health check for the service
  async healthCheck(): Promise<{ connected: boolean; error?: string }> {
    try {
      const connected = await this.testConnection();
      return { connected };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  // Sync all data to Google Sheets
  async syncAllData(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      logger.info('Starting Google Sheets sync for all data');
      const startTime = Date.now();
      let totalRecordsProcessed = 0;

      // Sync students
      const studentsResult = await this.syncStudents();
      if (studentsResult.success) {
        totalRecordsProcessed += studentsResult.recordsProcessed || 0;
      }

      // Sync books
      const booksResult = await this.syncBooks();
      if (booksResult.success) {
        totalRecordsProcessed += booksResult.recordsProcessed || 0;
      }

      // Sync equipment
      const equipmentResult = await this.syncEquipment();
      if (equipmentResult.success) {
        totalRecordsProcessed += equipmentResult.recordsProcessed || 0;
      }

      // Sync activities
      const activitiesResult = await this.syncActivities();
      if (activitiesResult.success) {
        totalRecordsProcessed += activitiesResult.recordsProcessed || 0;
      }

      // Sync book checkouts
      const checkoutsResult = await this.syncBookCheckouts();
      if (checkoutsResult.success) {
        totalRecordsProcessed += checkoutsResult.recordsProcessed || 0;
      }

      const duration = Date.now() - startTime;
      logger.info(`Google Sheets sync completed in ${duration}ms`, {
        totalRecordsProcessed,
      });

      return {
        success: true,
        recordsProcessed: totalRecordsProcessed,
      };
    } catch (error) {
      logger.error('Google Sheets sync failed', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Sync students to Google Sheets
  async syncStudents(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get all students from database
      const students = await prisma.students.findMany({
        where: { is_active: true },
        orderBy: { student_id: 'asc' },
      });

      // Prepare data for Google Sheets
      const headers = [
        'Student ID',
        'First Name',
        'Last Name',
        'Grade Level',
        'Grade Category',
        'Section',
        'Created At',
        'Updated At',
      ];

      const rows = students.map(student => [
        student.student_id,
        student.first_name,
        student.last_name,
        student.grade_level,
        student.grade_category,
        student.section || '',
        student.created_at.toISOString(),
        student.updated_at.toISOString(),
      ]);

      // Update Google Sheets
      await this.updateSheet('Students', headers, rows);

      logger.info(`Synced ${students.length} students to Google Sheets`);

      return {
        success: true,
        recordsProcessed: students.length,
      };
    } catch (error) {
      logger.error('Failed to sync students to Google Sheets', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Sync books to Google Sheets
  async syncBooks(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get all books from database
      const books = await prisma.books.findMany({
        where: { is_active: true },
        orderBy: { accession_no: 'asc' },
      });

      // Prepare data for Google Sheets
      const headers = [
        'Accession No',
        'ISBN',
        'Title',
        'Author',
        'Publisher',
        'Category',
        'Subcategory',
        'Location',
        'Total Copies',
        'Available Copies',
        'Created At',
        'Updated At',
      ];

      const rows = books.map(book => [
        book.accession_no,
        book.isbn || '',
        book.title,
        book.author,
        book.publisher || '',
        book.category,
        book.subcategory || '',
        book.location || '',
        book.total_copies.toString(),
        book.available_copies.toString(),
        book.created_at.toISOString(),
        book.updated_at.toISOString(),
      ]);

      // Update Google Sheets
      await this.updateSheet('Books', headers, rows);

      logger.info(`Synced ${books.length} books to Google Sheets`);

      return {
        success: true,
        recordsProcessed: books.length,
      };
    } catch (error) {
      logger.error('Failed to sync books to Google Sheets', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Sync equipment to Google Sheets
  async syncEquipment(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get all equipment from database
      const equipment = await prisma.equipment.findMany({
        orderBy: { equipment_id: 'asc' },
      });

      // Prepare data for Google Sheets
      const headers = [
        'Equipment ID',
        'Name',
        'Type',
        'Location',
        'Status',
        'Max Time (minutes)',
        'Requires Supervision',
        'Description',
        'Created At',
        'Updated At',
      ];

      const rows = equipment.map(item => [
        item.equipment_id,
        item.name,
        item.type,
        item.location,
        item.status,
        item.max_time_minutes.toString(),
        item.requires_supervision ? 'Yes' : 'No',
        item.description || '',
        item.created_at.toISOString(),
        item.updated_at.toISOString(),
      ]);

      // Update Google Sheets
      await this.updateSheet('Equipment', headers, rows);

      logger.info(
        `Synced ${equipment.length} equipment items to Google Sheets`,
      );

      return {
        success: true,
        recordsProcessed: equipment.length,
      };
    } catch (error) {
      logger.error('Failed to sync equipment to Google Sheets', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Sync activities to Google Sheets
  async syncActivities(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get activities from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activityInclude = {
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
          },
        },
        equipment: {
          select: {
            equipment_id: true,
            name: true,
          },
        },
      } as const satisfies Prisma.student_activitiesInclude;

      type ActivityRecord = Prisma.student_activitiesGetPayload<{
        include: typeof activityInclude;
      }>;

      const activities: ActivityRecord[] =
        await prisma.student_activities.findMany({
          where: {
            start_time: { gte: thirtyDaysAgo },
          },
          include: activityInclude,
          orderBy: { start_time: 'desc' },
        });

      // Prepare data for Google Sheets
      const headers = [
        'Activity ID',
        'Student ID',
        'Student Name',
        'Activity Type',
        'Equipment ID',
        'Equipment Name',
        'Start Time',
        'End Time',
        'Duration (minutes)',
        'Time Limit (minutes)',
        'Status',
        'Notes',
        'Processed By',
        'Created At',
      ];

      const rows = activities.map(activity => {
        const student = activity.students;
        const equipment = activity.equipment;

        return [
          activity.id,
          student?.student_id ?? '',
          student ? `${student.first_name} ${student.last_name}` : '',
          activity.activity_type,
          equipment?.equipment_id ?? '',
          equipment?.name ?? '',
          activity.start_time.toISOString(),
          activity.end_time?.toISOString() ?? '',
          activity.duration_minutes?.toString() ?? '',
          activity.time_limit_minutes?.toString() ?? '',
          activity.status,
          activity.notes ?? '',
          activity.processed_by,
          activity.created_at.toISOString(),
        ];
      });

      // Update Google Sheets
      await this.updateSheet('Activities', headers, rows);

      logger.info(`Synced ${activities.length} activities to Google Sheets`);

      return {
        success: true,
        recordsProcessed: activities.length,
      };
    } catch (error) {
      logger.error('Failed to sync activities to Google Sheets', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Sync book checkouts to Google Sheets
  async syncBookCheckouts(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get checkouts from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const checkoutInclude = {
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
          },
        },
        books: {
          select: {
            accession_no: true,
            title: true,
            author: true,
          },
        },
      } as const satisfies Prisma.book_checkoutsInclude;

      type CheckoutRecord = Prisma.book_checkoutsGetPayload<{
        include: typeof checkoutInclude;
      }>;

      const checkouts: CheckoutRecord[] = await prisma.book_checkouts.findMany({
        where: {
          checkout_date: { gte: thirtyDaysAgo },
        },
        include: checkoutInclude,
        orderBy: { checkout_date: 'desc' },
      });

      // Prepare data for Google Sheets
      const headers = [
        'Checkout ID',
        'Student ID',
        'Student Name',
        'Accession No',
        'Book Title',
        'Book Author',
        'Checkout Date',
        'Due Date',
        'Return Date',
        'Status',
        'Overdue Days',
        'Fine Amount',
        'Fine Paid',
        'Notes',
        'Processed By',
        'Created At',
      ];

      const rows = checkouts.map(checkout => {
        const student = checkout.students;
        const book = checkout.books;

        return [
          checkout.id,
          student?.student_id ?? '',
          student ? `${student.first_name} ${student.last_name}` : '',
          book?.accession_no ?? '',
          book?.title ?? '',
          book?.author ?? '',
          checkout.checkout_date.toISOString(),
          checkout.due_date.toISOString(),
          checkout.return_date?.toISOString() ?? '',
          checkout.status,
          checkout.overdue_days.toString(),
          checkout.fine_amount.toString(),
          checkout.fine_paid ? 'Yes' : 'No',
          checkout.notes ?? '',
          checkout.processed_by,
          checkout.created_at.toISOString(),
        ];
      });

      // Update Google Sheets
      await this.updateSheet('Book Checkouts', headers, rows);

      logger.info(`Synced ${checkouts.length} book checkouts to Google Sheets`);

      return {
        success: true,
        recordsProcessed: checkouts.length,
      };
    } catch (error) {
      logger.error('Failed to sync book checkouts to Google Sheets', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Update a specific sheet in Google Sheets
  private async updateSheet(
    sheetName: string,
    headers: string[],
    rows: string[][],
  ): Promise<void> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      // Get all sheets to find the target sheet
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      // Find the sheet by name
      const sheet = spreadsheet.data.sheets?.find(
        sheet => sheet.properties?.title === sheetName,
      );

      // If sheet doesn't exist, create it
      if (!sheet) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        });
      }
      // Clear existing data
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      // Write headers and data
      const data = [headers, ...rows];
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: data,
        },
      });

      logger.info(
        `Updated Google Sheets: ${sheetName} with ${rows.length} rows`,
      );
    } catch (error) {
      logger.error(`Failed to update Google Sheets: ${sheetName}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Get data from Google Sheets
  async getSheetData(
    sheetName: string,
    range?: string,
  ): Promise<GoogleSheetCellValue[][]> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range || `${sheetName}!A:Z`,
      });

      return (response.data.values as GoogleSheetCellValue[][]) || [];
    } catch (error) {
      logger.error(`Failed to get data from Google Sheets: ${sheetName}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Get spreadsheet information
  async getSpreadsheetInfo(): Promise<{ title: string; sheets: string[] }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const title = response.data.properties?.title || 'Unknown';
      const sheets =
        response.data.sheets?.map(
          sheet => sheet.properties?.title || 'Untitled',
        ) || [];

      return { title, sheets };
    } catch (error) {
      logger.error('Failed to get spreadsheet info', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Generate daily report
  async generateDailyReport(
    date?: Date,
  ): Promise<{ success: boolean; data?: DailyReportData; error?: string }> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        throw new Error('Google Sheets service is not properly initialized');
      }

      const targetDate = date || new Date();
      const isoString = targetDate.toISOString();
      const dateString = isoString.split('T')[0] ?? isoString;

      logger.info(`Generating daily report for ${dateString}`);

      // Create proper date boundaries
      const startOfDay = new Date(dateString);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateString);
      endOfDay.setHours(23, 59, 59, 999);

      // Get activities for the specified date
      const dailyActivityInclude = {
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
          },
        },
        equipment: {
          select: {
            equipment_id: true,
            name: true,
            type: true,
          },
        },
      } as const satisfies Prisma.student_activitiesInclude;

      type DailyActivityRecord = Prisma.student_activitiesGetPayload<{
        include: typeof dailyActivityInclude;
      }>;

      const activities: DailyActivityRecord[] =
        await prisma.student_activities.findMany({
          where: {
            start_time: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          include: dailyActivityInclude,
          orderBy: { start_time: 'desc' },
        });

      // Prepare report data
      const reportData: DailyReportData = {
        date: dateString,
        totalActivities: activities.length,
        activitiesByType: activities.reduce(
          (acc, activity) => {
            const activityType = activity.activity_type ?? 'unknown';
            acc[activityType] = (acc[activityType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        activitiesByGrade: activities.reduce(
          (acc, activity) => {
            const student = activity.students;
            const gradeLevel = student?.grade_level ?? 'Unknown';
            acc[gradeLevel] = (acc[gradeLevel] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        equipmentUsage: activities.filter(activity =>
          Boolean(activity.equipment),
        ).length,
        uniqueStudents: new Set(
          activities
            .map(activity => activity.students?.student_id)
            .filter((id): id is string => Boolean(id)),
        ).size,
      };

      await this.appendDailyReport(reportData);

      // Log the report generation
      await this.logAutomationTask(
        'daily_report',
        'success',
        `Generated daily report for ${dateString}`,
        reportData,
      );

      logger.info(`Daily report generated for ${dateString}`, reportData);

      return {
        success: true,
        data: reportData,
      };
    } catch (error) {
      logger.error('Failed to generate daily report', {
        error: (error as Error).message,
      });
      await this.logAutomationTask(
        'daily_report',
        'error',
        `Failed to generate daily report: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async ensureSheetHeaders(
    sheetName: string,
    headers: string[],
  ): Promise<void> {
    if (!this.sheets || !this.spreadsheetId) {
      throw new Error('Google Sheets service is not properly initialized');
    }

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheetExists = spreadsheet.data.sheets?.some(
      sheet => sheet.properties?.title === sheetName,
    );

    if (!sheetExists) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
    }
    const existingHeader = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!1:1`,
    });

    if (
      !existingHeader.data.values ||
      existingHeader.data.values.length === 0
    ) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
    }
  }

  private async appendDailyReport(report: DailyReportData): Promise<void> {
    if (!this.sheets || !this.spreadsheetId) {
      throw new Error('Google Sheets service is not properly initialized');
    }

    const sheetName = 'Daily Reports';
    const headers = [
      'Date',
      'Total Activities',
      'Equipment Usage',
      'Unique Students',
      'Activities By Type',
      'Activities By Grade',
    ];

    await this.ensureSheetHeaders(sheetName, headers);

    const row: GoogleSheetCellValue[] = [
      report.date,
      report.totalActivities,
      report.equipmentUsage,
      report.uniqueStudents,
      JSON.stringify(report.activitiesByType),
      JSON.stringify(report.activitiesByGrade),
    ];

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  }

  // Log automation task
  async logAutomationTask(
    taskType: string,
    status:
      | 'success'
      | 'error'
      | 'info'
      | 'warning'
      | 'BACKUP'
      | 'SYNC'
      | 'NOTIFICATION',
    message: string,
    data?: unknown,
  ): Promise<void> {
    try {
      if (!this.sheets || !this.spreadsheetId) {
        logger.warn(
          'Google Sheets service not initialized, skipping automation task logging',
        );
        return;
      }

      const sheetName = 'Automation Log';
      const headers = [
        'Timestamp',
        'Task Type',
        'Status',
        'Message',
        'Data',
        'Source',
      ];

      await this.ensureSheetHeaders(sheetName, headers);

      const rows = [
        [
          new Date().toISOString(),
          taskType,
          status,
          message,
          data ? JSON.stringify(data) : '',
          'System',
        ],
      ];

      // Append to automation log sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });

      logger.info(`Logged automation task: ${taskType} - ${status}`);
    } catch (error) {
      logger.error('Failed to log automation task', {
        error: (error as Error).message,
      });
      // Don't throw - logging failure shouldn't stop the main task
    }
  }

  // Sync student activities (alias for syncActivities for compatibility)
  async syncStudentActivities(): Promise<{
    success: boolean;
    recordsProcessed?: number;
    error?: string;
  }> {
    return this.syncActivities();
  }

  // Shutdown the service
  async shutdown(): Promise<void> {
    logger.info('Shutting down Google Sheets service...');

    this.auth = null;
    this.sheets = null;
    this.spreadsheetId = null;
    this.isInitialized = false;

    logger.info('Google Sheets service shutdown complete');
  }
}

// Create and export singleton instance
export const googleSheetsService = new GoogleSheetsService();
export default googleSheetsService;
