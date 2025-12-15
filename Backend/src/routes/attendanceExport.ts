import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { AttendanceExportService } from '../services/attendanceExportService';
import { logger } from '../utils/logger';

const router = Router();

// All attendance export routes require authentication
router.use(authenticate);

// GET /api/attendance-export/data - Get attendance data for export
router.get(
  '/data',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Get attendance data for export', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const data = await AttendanceExportService.getAttendanceData(start, end);

      res.json({
        success: true,
        data,
        count: data.length,
      });
    } catch (error) {
      logger.error('Error getting attendance data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve attendance data',
      });
    }
  }),
);

// PATCH /api/attendance-export/:id - Update an attendance record (inline editing)
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Activity ID is required',
        });
        return;
      }

      // Import prisma
      const { prisma } = await import('../utils/prisma');

      // Get existing record to merge metadata
      const existing = await prisma.student_activities.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'Activity not found',
        });
        return;
      }

      // Parse existing metadata
      let metadata: Record<string, string> = {};
      if (existing.metadata) {
        try {
          metadata = JSON.parse(existing.metadata);
        } catch {
          // Ignore parse errors
        }
      }

      // Update metadata fields
      if (updates.gradeLevel !== undefined) {
        metadata.gradeLevel = updates.gradeLevel;
      }
      if (updates.section !== undefined) {
        metadata.section = updates.section;
      }
      if (updates.designation !== undefined) {
        metadata.designation = updates.designation;
      }
      if (updates.sex !== undefined) {
        metadata.sex = updates.sex;
      }
      if (updates.bookTitle !== undefined) {
        metadata.bookTitle = updates.bookTitle;
      }
      if (updates.bookAuthor !== undefined) {
        metadata.bookAuthor = updates.bookAuthor;
      }
      if (updates.dueDate !== undefined) {
        metadata.dueDate = updates.dueDate;
      }
      if (updates.returnDate !== undefined) {
        metadata.returnDate = updates.returnDate;
      }
      if (updates.fineAmount !== undefined) {
        metadata.fineAmount = String(updates.fineAmount);
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        metadata: JSON.stringify(metadata),
      };

      // Update core fields if provided
      if (updates.status) {
        updateData.status = updates.status;
      }
      if (updates.activityType) {
        updateData.activity_type = updates.activityType;
      }
      if (updates.checkInTime) {
        updateData.start_time = new Date(updates.checkInTime);
      }
      if (updates.checkOutTime) {
        updateData.end_time = new Date(updates.checkOutTime);
      }

      await prisma.student_activities.update({
        where: { id },
        data: updateData,
      });

      logger.info('Attendance record updated', {
        id,
        updates: Object.keys(updates),
        userId: req.user!.userId,
      });

      res.json({
        success: true,
        message: 'Record updated successfully',
      });
    } catch (error) {
      logger.error('Error updating attendance record', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update record',
      });
    }
  }),
);

// GET /api/attendance-export/export/csv - Export attendance to CSV
router.get(
  '/export/csv',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Export attendance to CSV', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const csv = await AttendanceExportService.exportToCSV(start, end);

      // Set headers for CSV download
      const filename = `clms-attendance-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      res.send(csv);
    } catch (error) {
      logger.error('Error exporting to CSV', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to export to CSV',
      });
    }
  }),
);

// GET /api/attendance-export/summary - Get attendance summary statistics
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Get attendance summary', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const summary = await AttendanceExportService.generateSummary(start, end);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error generating attendance summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate summary',
      });
    }
  }),
);

// GET /api/attendance-export/google-sheets - Prepare data for Google Sheets
router.get(
  '/google-sheets',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Prepare data for Google Sheets', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        userId: req.user!.userId,
      });

      const sheetsData = await AttendanceExportService.prepareGoogleSheetsData(
        start,
        end,
      );

      res.json({
        success: true,
        data: sheetsData,
      });
    } catch (error) {
      logger.error('Error preparing Google Sheets data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to prepare Google Sheets data',
      });
    }
  }),
);

export default router;

// POST /api/attendance-export/import/google-sheets - Import from Google Sheets
router.post(
  '/import/google-sheets',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { spreadsheetId, sheetName } = req.body;

      if (!spreadsheetId || !sheetName) {
        res.status(400).json({
          success: false,
          message: 'Spreadsheet ID and Sheet Name are required',
        });
        return;
      }

      logger.info('Import from Google Sheets', {
        spreadsheetId,
        sheetName,
        userId: req.user!.userId,
      });

      // 1. Fetch data from sheets
      const { googleSheetsService } = await import(
        '../services/googleSheetsService'
      );
      const importResult = await googleSheetsService.importAttendanceFromSheet(
        spreadsheetId,
        sheetName,
      );

      if (importResult.importedCount === 0 && importResult.errors.length > 0) {
        // Critical failure to import anything
        res.status(400).json({
          success: false,
          message: 'Failed to import any data',
          errors: importResult.errors,
        });
        return;
      }

      // 2. Persist to database
      const { attendanceRepository } = await import(
        '../repositories/attendanceRepository'
      );
      const result = await attendanceRepository.bulkInsertActivities(
        importResult.preview as import('../services/googleSheetsService').ProcessedAttendanceRecord[],
      );

      // Broadcast to all connected clients that attendance data has been updated
      // This triggers real-time refresh on Dashboard, Leaderboard, and other screens
      if (result.insertedCount > 0) {
        try {
          const { websocketServer } = await import(
            '../websocket/websocketServer'
          );
          websocketServer.broadcastToAll({
            id: `import-${Date.now()}`,
            type: 'ACTIVITY_LOG',
            data: {
              event: 'ATTENDANCE_IMPORT',
              importedCount: result.insertedCount,
              timestamp: new Date().toISOString(),
              message: `${result.insertedCount} attendance records imported from Google Sheets`,
            },
            timestamp: new Date(),
          });
          logger.info('WebSocket broadcast sent for Google Sheets import', {
            insertedCount: result.insertedCount,
          });

          // Also persist notification to database for notification center
          const { notificationService } = await import(
            '../services/notification.service'
          );
          await notificationService.createNotification({
            type: 'SUCCESS',
            title: 'Google Sheets Import Complete',
            message: `Successfully imported ${result.insertedCount} attendance records from Google Sheets.`,
            priority: 'NORMAL',
            metadata: {
              event: 'ATTENDANCE_IMPORT',
              importedCount: result.insertedCount,
              updatedCount: result.updatedCount,
            },
          });
        } catch (wsError) {
          logger.warn('Failed to broadcast import notification', { wsError });
        }
      }

      res.json({
        success: true,
        message: 'Import completed',
        imported: result.insertedCount,
        updated: result.updatedCount,
        sheetParsed: importResult.importedCount,
        skippedStudentNotFound: result.skippedStudentNotFound,
        unmatchedStudentIds: result.unmatchedStudentIds,
        errors: importResult.errors,
      });
    } catch (error) {
      logger.error('Error importing from Google Sheets', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to import from Google Sheets',
      });
    }
  }),
);

// POST /api/attendance-export/export/google-sheets - Export to Google Sheets
router.post(
  '/export/google-sheets',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { spreadsheetId, sheetName, startDate, endDate, overwrite } =
        req.body;

      if (!spreadsheetId || !sheetName || !startDate || !endDate) {
        res.status(400).json({
          success: false,
          message:
            'Spreadsheet ID, Sheet Name, Start Date, and End Date are required',
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
        return;
      }

      logger.info('Export to Google Sheets', {
        spreadsheetId,
        sheetName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        overwrite,
        userId: req.user!.userId,
      });

      // 1. Get data from DB
      const { attendanceRepository } = await import(
        '../repositories/attendanceRepository'
      );
      const data = await attendanceRepository.getAttendanceForExport(
        start,
        end,
      );

      if (data.length === 0) {
        res.json({
          success: true,
          message: 'No data to export for selected range',
          exported: 0,
          sheetUrl: '',
        });
        return;
      }

      // 2. Push to Google Sheets
      const { googleSheetsService } = await import(
        '../services/googleSheetsService'
      );
      const exportResult = await googleSheetsService.exportAttendanceToSheet(
        spreadsheetId,
        sheetName,
        data,
        overwrite,
      );

      res.json({
        success: true,
        message: 'Export completed',
        exported: exportResult.exportedCount,
        sheetUrl: exportResult.sheetUrl,
      });
    } catch (error) {
      logger.error('Error exporting to Google Sheets', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to export to Google Sheets',
      });
    }
  }),
);

// GET /api/attendance-export/validate-sheet - Validate Google Sheet data
router.get(
  '/validate-sheet',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { spreadsheetId, sheetName } = req.query;

      if (!spreadsheetId || !sheetName) {
        res.status(400).json({
          success: false,
          message: 'Spreadsheet ID and Sheet Name are required',
        });
        return;
      }

      logger.info('Validate Google Sheet', {
        spreadsheetId,
        sheetName,
        userId: req.user!.userId,
      });

      const { googleSheetsService } = await import(
        '../services/googleSheetsService'
      );
      const validationResult = await googleSheetsService.validateSheet(
        spreadsheetId as string,
        sheetName as string,
      );

      res.json({
        success: true,
        data: validationResult,
      });
    } catch (error) {
      logger.error('Error validating Google Sheet', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to validate Google Sheet',
      });
    }
  }),
);

// GET /api/attendance-export/book-activities - Get book activities from imported data
router.get(
  '/book-activities',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        startDate,
        endDate,
        page = '1',
        limit = '50',
        studentId,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Build where clause
      const whereClause: Record<string, unknown> = {
        // Only get activities that have book info in metadata
        OR: [{ description: { not: null } }, { metadata: { not: null } }],
      };

      // Filter by studentId if provided
      if (studentId) {
        whereClause.student_id = studentId as string;
      }

      if (startDate && endDate) {
        whereClause.start_time = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const { prisma } = await import('../utils/prisma');

      // Get activities with book info
      const activities = await prisma.student_activities.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              section: true,
            },
          },
        },
        orderBy: { start_time: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      });

      // Count total
      const total = await prisma.student_activities.count({
        where: whereClause,
      });

      // Transform data - parse metadata for book info
      const data = activities
        .map(activity => {
          let bookTitle = '';
          let bookAuthor = '';
          let dueDate = '';
          let returnDate = '';
          let fineAmount = 0;

          // Try to parse metadata for book info
          if (activity.metadata) {
            try {
              const meta =
                typeof activity.metadata === 'string'
                  ? JSON.parse(activity.metadata)
                  : activity.metadata;
              bookTitle = meta.bookTitle || '';
              bookAuthor = meta.bookAuthor || '';
              dueDate = meta.dueDate || '';
              returnDate = meta.returnDate || '';
              fineAmount = parseFloat(meta.fineAmount) || 0;
            } catch {
              // Not JSON, might be plain text
            }
          }

          // Fallback to description if no book info in metadata
          if (!bookTitle && activity.description) {
            bookTitle = activity.description;
          }

          // Only include records with book info
          if (!bookTitle) {
            return null;
          }

          return {
            id: activity.id,
            bookTitle,
            bookAuthor,
            checkoutDate: activity.start_time,
            dueDate: dueDate || null,
            returnDate: returnDate || activity.end_time || null,
            fineAmount,
            status: activity.status,
            activityType: activity.activity_type,
            student: {
              id: activity.student?.id || '',
              studentId: activity.student?.student_id || '',
              firstName: activity.student?.first_name || '',
              lastName: activity.student?.last_name || '',
              gradeLevel: activity.student?.grade_level?.toString() || '',
              section: activity.student?.section || '',
            },
          };
        })
        .filter(Boolean); // Remove null entries

      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error fetching book activities', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to fetch book activities',
      });
    }
  }),
);
