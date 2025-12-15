import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  googleSheetsService,
  ProcessedBorrowingRecord,
} from '../services/googleSheetsService';
import { borrowingRepository } from '../repositories/borrowingRepository';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';

const router = Router();

// Middleware to ensure user is authenticated
router.use(authenticate);

/**
 * @route   POST /api/borrowing-export/import/google-sheets
 * @desc    Import borrowing history from Google Sheet
 * @access  Private
 */
router.post(
  '/import/google-sheets',
  asyncHandler(async (req, res) => {
    const { spreadsheetId, sheetName } = req.body;

    if (!spreadsheetId || !sheetName) {
      res.status(400);
      throw new Error('Spreadsheet ID and Sheet Name are required');
    }

    try {
      // 1. Fetch and Parse from Sheet
      const sheetResult = await googleSheetsService.importBorrowingFromSheet(
        spreadsheetId,
        sheetName,
      );

      if (sheetResult.importedCount === 0) {
        res.json({
          message: 'No records found or sheet is empty',
          imported: 0,
          parsed: 0,
          errors: sheetResult.errors,
        });
        return;
      }

      // 2. Bulk Insert into Database
      // Note: We only insert valid records. Errors are reported back.
      const validRecords =
        sheetResult.preview as unknown as ProcessedBorrowingRecord[];
      const insertedCount =
        await borrowingRepository.bulkInsertBorrowingHistory(validRecords);

      logger.info(
        `Imported ${insertedCount} borrowing records from Google Sheet`,
        {
          spreadsheetId,
          sheetName,
          parsedCount: sheetResult.importedCount,
          errors: sheetResult.errors.length,
        },
      );

      res.status(200).json({
        message: 'Import completed successfully',
        imported: insertedCount,
        parsed: sheetResult.importedCount,
        errors: sheetResult.errors,
      });
    } catch (error) {
      logger.error('Google Sheets import failed:', error);
      res.status(500);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to import from Google Sheets',
      );
    }
  }),
);

/**
 * @route   POST /api/borrowing-export/export/google-sheets
 * @desc    Export borrowing history to Google Sheets
 * @access  Private
 */
router.post(
  '/export/google-sheets',
  asyncHandler(async (req, res) => {
    const { spreadsheetId, sheetName, startDate, endDate, overwrite } =
      req.body;

    if (!spreadsheetId || !sheetName || !startDate || !endDate) {
      res.status(400);
      throw new Error(
        'Spreadsheet ID, Sheet Name, Start Date, and End Date are required',
      );
    }

    try {
      // 1. Get Data from DB
      const start = new Date(startDate);
      const end = new Date(endDate);
      // specific time for end date to include the whole day
      end.setHours(23, 59, 59, 999);

      const records = await borrowingRepository.getBorrowingHistoryForExport(
        start,
        end,
      );

      if (records.length === 0) {
        res.json({
          message: 'No records found for the selected date range',
          exported: 0,
        });
        return;
      }

      // 2. Push to Google Sheets
      const result = await googleSheetsService.exportBorrowingToSheet(
        spreadsheetId,
        sheetName,
        records,
        overwrite,
      );

      logger.info(
        `Exported ${result.exportedCount} borrowing records to Google Sheet`,
        {
          spreadsheetId,
          sheetName,
        },
      );

      res.status(200).json({
        message: 'Export completed successfully',
        exported: result.exportedCount,
        sheetUrl: result.sheetUrl,
      });
    } catch (error) {
      logger.error('Google Sheets export failed:', error);
      res.status(500);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to export to Google Sheets',
      );
    }
  }),
);

/**
 * @route   GET /api/borrowing-export/validate-sheet
 * @desc    Validate Google Sheets data structure
 * @access  Private
 */
router.get(
  '/validate-sheet',
  asyncHandler(async (req, res) => {
    const { spreadsheetId, sheetName } = req.query;

    if (!spreadsheetId || !sheetName) {
      res.status(400);
      throw new Error('Spreadsheet ID and Sheet Name are required');
    }

    try {
      const report = await googleSheetsService.validateSheet(
        spreadsheetId as string,
        sheetName as string,
        'BORROWING',
      );

      res.status(200).json(report);
    } catch (error) {
      logger.error('Sheet validation failed:', error);
      res.status(500);
      throw new Error(
        error instanceof Error ? error.message : 'Validation failed',
      );
    }
  }),
);

export default router;
