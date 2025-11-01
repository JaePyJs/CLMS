import { Router } from 'express';
import multer from 'multer';
import { logger } from '@/utils/logger';
import { importService } from '@/services/importService';
import { shjcsImportService } from '@/services/shjcsImportService';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

/**
 * @route   POST /api/import/students
 * @desc    Import students from CSV file
 * @access  Private (Admin/Librarian)
 */
router.post('/students', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    logger.info(`Starting student import from file: ${req.file.filename}`);

    // Read first line to detect format
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const firstLine = fileContent.split('\n')[0] || '';
    const isSHJCSFormat = firstLine.includes('Names') && firstLine.includes('User id');

    // Import students using appropriate service
    const result = isSHJCSFormat
      ? await shjcsImportService.importSHJCSStudents(req.file.path)
      : await importService.importStudents(req.file.path);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    logger.info('Student import completed', {
      totalRecords: result.totalRecords,
      importedRecords: result.importedRecords,
      skippedRecords: result.skippedRecords,
      errorRecords: result.errorRecords,
    });

    res.status(200).json({
      success: result.success,
      message: `Import completed: ${result.importedRecords} imported, ${result.skippedRecords} skipped, ${result.errorRecords} errors`,
      data: result,
    });
  } catch (error) {
    logger.error('Error importing students', {
      error: (error as Error).message,
    });

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to import students',
      error: (error as Error).message,
    });
  }
});

/**
 * @route   POST /api/import/books
 * @desc    Import books from CSV file
 * @access  Private (Admin/Librarian)
 */
router.post('/books', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    logger.info(`Starting book import from file: ${req.file.filename}`);

    // Read first line to detect format
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const firstLine = fileContent.split('\n')[0] || '';
    const isSHJCSFormat = firstLine.includes('Barcode') && firstLine.includes('Call Number');

    // Import books using appropriate service
    const result = isSHJCSFormat
      ? await shjcsImportService.importSHJCSBooks(req.file.path)
      : await importService.importBooks(req.file.path);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    logger.info('Book import completed', {
      totalRecords: result.totalRecords,
      importedRecords: result.importedRecords,
      skippedRecords: result.skippedRecords,
      errorRecords: result.errorRecords,
    });

    res.status(200).json({
      success: result.success,
      message: `Import completed: ${result.importedRecords} imported, ${result.skippedRecords} skipped, ${result.errorRecords} errors`,
      data: result,
    });
  } catch (error) {
    logger.error('Error importing books', {
      error: (error as Error).message,
    });

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to import books',
      error: (error as Error).message,
    });
  }
});

/**
 * @route   GET /api/import/templates/students
 * @desc    Download student CSV template
 * @access  Public
 */
router.get('/templates/students', (req, res) => {
  try {
    const template = importService.getStudentTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.csv"');
    res.send(template);
  } catch (error) {
    logger.error('Error generating student template', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
    });
  }
});

/**
 * @route   GET /api/import/templates/books
 * @desc    Download book CSV template
 * @access  Public
 */
router.get('/templates/books', (req, res) => {
  try {
    const template = importService.getBookTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="book-import-template.csv"');
    res.send(template);
  } catch (error) {
    logger.error('Error generating book template', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
    });
  }
});

/**
 * @route   GET /api/import/templates/equipment
 * @desc    Download equipment CSV template
 * @access  Public
 */
router.get('/templates/equipment', (req, res) => {
  try {
    const template = importService.getEquipmentTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment-import-template.csv"');
    res.send(template);
  } catch (error) {
    logger.error('Error generating equipment template', {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
    });
  }
});

/**
 * @route   POST /api/import/preview
 * @desc    Preview file data with field mapping suggestions
 * @access  Private (Admin/Librarian)
 */
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    const { importType = 'students', maxPreviewRows = 10 } = req.body;

    logger.info(`Previewing file: ${req.file.filename}`);

    const previewData = await importService.previewFile(req.file.path, {
      maxPreviewRows: parseInt(maxPreviewRows),
      previewMode: true
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'File preview generated successfully',
      data: {
        ...previewData,
        importType,
        fileName: req.file.originalname
      }
    });
  } catch (error) {
    logger.error('Error previewing file', {
      error: (error as Error).message,
    });

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to preview file',
      error: (error as Error).message,
    });
  }
});

/**
 * @route   POST /api/import/students/enhanced
 * @desc    Import students with field mapping support
 * @access  Private (Admin/Librarian)
 */
router.post('/students/enhanced', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    const { fieldMappings, dryRun = false } = req.body;

    logger.info(`Starting enhanced student import from file: ${req.file.filename}`);

    // Parse field mappings if provided
    let mappings;
    if (fieldMappings) {
      try {
        mappings = JSON.parse(fieldMappings);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid field mappings format',
        });
        return;
      }
    }

    // Preview and parse the file
    const previewData = await importService.previewFile(req.file.path);
    const records = await importService.parseFile(req.file.path, {
      fieldMappings: mappings
    });

    if (dryRun) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        message: 'Dry run completed successfully',
        data: {
          preview: previewData,
          recordsCount: records.length,
          sampleRecords: records.slice(0, 5)
        }
      });
      return;
    }

    // Import students using enhanced logic
    const result = await importService.importStudentsWithMapping(req.file.path, mappings || []);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    logger.info('Enhanced student import completed', {
      totalRecords: result.totalRecords,
      importedRecords: result.importedRecords,
      skippedRecords: result.skippedRecords,
      errorRecords: result.errorRecords,
    });

    res.status(200).json({
      success: result.success,
      message: `Import completed: ${result.importedRecords} imported, ${result.skippedRecords} skipped, ${result.errorRecords} errors`,
      data: result,
    });
  } catch (error) {
    logger.error('Error in enhanced student import', {
      error: (error as Error).message,
    });

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to import students',
      error: (error as Error).message,
    });
  }
});

/**
 * @route   POST /api/import/books/enhanced
 * @desc    Import books with field mapping support
 * @access  Private (Admin/Librarian)
 */
router.post('/books/enhanced', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    const { fieldMappings, dryRun = false } = req.body;

    logger.info(`Starting enhanced book import from file: ${req.file.filename}`);

    // Parse field mappings if provided
    let mappings;
    if (fieldMappings) {
      try {
        mappings = JSON.parse(fieldMappings);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid field mappings format',
        });
        return;
      }
    }

    // Import books using enhanced logic
    const result = await importService.importBooksWithMapping(req.file.path, mappings || []);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    logger.info('Enhanced book import completed', {
      totalRecords: result.totalRecords,
      importedRecords: result.importedRecords,
      skippedRecords: result.skippedRecords,
      errorRecords: result.errorRecords,
    });

    res.status(200).json({
      success: result.success,
      message: `Import completed: ${result.importedRecords} imported, ${result.skippedRecords} skipped, ${result.errorRecords} errors`,
      data: result,
    });
  } catch (error) {
    logger.error('Error in enhanced book import', {
      error: (error as Error).message,
    });

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to import books',
      error: (error as Error).message,
    });
  }
});

export default router;
