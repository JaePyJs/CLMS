/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import multer from 'multer';
import { BarcodeService } from '../services/barcodeService';
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/import/students - Import students from CSV/Excel
router.post(
  '/students',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Import students request', {
      fileName: req.body.fileName,
      recordCount: req.body.data?.length,
      userId: (req as any).user?.id,
    });

    try {
      const { data, fieldMapping, options = {} } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No data provided for import',
        });
      }

      const result = {
        totalRecords: data.length,
        importedRecords: 0,
        skippedRecords: 0,
        errorRecords: 0,
        errors: [] as string[],
      };

      // Process each student record
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Create student data object based on field mapping
          const studentData: any = {};

          // Map fields based on the provided mapping
          if (fieldMapping && Array.isArray(fieldMapping)) {
            fieldMapping.forEach((mapping: any) => {
              if (mapping.source && mapping.target) {
                studentData[mapping.target] = row[mapping.source];
              }
            });
          } else {
            // Auto-detect fields if no mapping provided
            Object.assign(studentData, row);
          }

          // Validate required fields
          if (!studentData.student_id) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Missing required field 'student_id'`,
            );
            continue;
          }

          if (!studentData.first_name) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Missing required field 'first_name'`,
            );
            continue;
          }

          if (!studentData.last_name) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Missing required field 'last_name'`,
            );
            continue;
          }

          // Check if student already exists
          const existingStudent = await prisma.students.findUnique({
            where: { student_id: studentData.student_id },
          });

          if (existingStudent && !options.allowUpdates) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Student with ID '${studentData.student_id}' already exists`,
            );
            continue;
          }

          // Prepare student data
          let barcode = String(studentData.barcode || '').trim();
          if (!barcode) {
            barcode = `PN${String(Date.now()).slice(-6)}`;
            const collision = await prisma.students.findFirst({
              where: { barcode },
            });
            if (collision) {
              barcode = `PN${String(Date.now() + i).slice(-6)}`;
            }
          }

          const createData = {
            student_id: String(studentData.student_id),
            first_name: String(studentData.first_name),
            last_name: String(studentData.last_name),
            grade_level: studentData.grade_level
              ? parseInt(String(studentData.grade_level))
              : 1,
            email: studentData.email || null,
            barcode,
            grade_category: studentData.grade_category || null,
            is_active:
              studentData.is_active !== undefined
                ? studentData.is_active === true ||
                  studentData.is_active === 'true'
                : true,
          };

          // Create or update student
          if (existingStudent && options.allowUpdates) {
            await prisma.students.update({
              where: { id: existingStudent.id },
              data: createData,
            });
          } else {
            await prisma.students.create({
              data: createData,
            });
          }

          if (!existingStudent && !studentData.barcode) {
            result.errors.push(
              `Row ${i + 1}: Barcode generated: ${createData.barcode}`,
            );
          }

          result.importedRecords++;
        } catch (error) {
          result.errorRecords++;
          result.errors.push(
            `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      logger.info('Import students completed', {
        ...result,
        userId: (req as any).user?.id,
      });

      res.json({
        success: result.importedRecords > 0,
        data: result,
      });
    } catch (error) {
      logger.error('Error importing students', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/import/books - Import books from CSV/Excel
router.post(
  '/books',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Import books request', {
      fileName: req.body.fileName,
      recordCount: req.body.data?.length,
      userId: (req as any).user?.id,
    });

    try {
      const { data, fieldMapping, options = {} } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No data provided for import',
        });
      }

      const result = {
        totalRecords: data.length,
        importedRecords: 0,
        skippedRecords: 0,
        errorRecords: 0,
        errors: [] as string[],
      };

      // Process each book record
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Create book data object based on field mapping
          const bookData: any = {};

          // Map fields based on the provided mapping
          if (fieldMapping && Array.isArray(fieldMapping)) {
            fieldMapping.forEach((mapping: any) => {
              if (mapping.source && mapping.target) {
                bookData[mapping.target] = row[mapping.source];
              }
            });
          } else {
            // Auto-detect fields if no mapping provided
            Object.assign(bookData, row);
          }

          // Validate required fields
          if (!bookData.title) {
            result.skippedRecords++;
            result.errors.push(`Row ${i + 1}: Missing required field 'title'`);
            continue;
          }

          if (!bookData.author) {
            result.skippedRecords++;
            result.errors.push(`Row ${i + 1}: Missing required field 'author'`);
            continue;
          }

          if (!bookData.accession_no) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Missing required field 'accession_no'`,
            );
            continue;
          }

          if (!bookData.category) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Missing required field 'category'`,
            );
            continue;
          }

          // Check if book already exists
          const existingBook = await prisma.books.findUnique({
            where: { accession_no: bookData.accession_no },
          });

          if (existingBook && !options.allowUpdates) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Book with accession number '${bookData.accession_no}' already exists`,
            );
            continue;
          }

          // Prepare book data
          const createData = {
            title: bookData.title,
            author: bookData.author,
            isbn: bookData.isbn || null,
            publisher: bookData.publisher || null,
            category: bookData.category,
            subcategory: bookData.subcategory || null,
            location: bookData.location || null,
            accession_no: bookData.accession_no,
            available_copies: bookData.available_copies
              ? parseInt(bookData.available_copies)
              : 1,
            total_copies: bookData.total_copies
              ? parseInt(bookData.total_copies)
              : 1,
            cost_price: bookData.cost_price
              ? parseFloat(bookData.cost_price)
              : null,
            edition: bookData.edition || null,
            pages: bookData.pages || null,
            remarks: bookData.remarks || null,
            source_of_fund: bookData.source_of_fund || null,
            volume: bookData.volume || null,
            year: bookData.year ? parseInt(bookData.year) : null,
            is_active:
              bookData.is_active !== undefined
                ? bookData.is_active === true || bookData.is_active === 'true'
                : true,
          };

          // Validate available vs total copies
          if (createData.available_copies > createData.total_copies) {
            result.skippedRecords++;
            result.errors.push(
              `Row ${i + 1}: Available copies cannot exceed total copies`,
            );
            continue;
          }

          // Create or update book
          if (existingBook && options.allowUpdates) {
            await prisma.books.update({
              where: { id: existingBook.id },
              data: createData,
            });
          } else {
            await prisma.books.create({
              data: createData,
            });
          }

          result.importedRecords++;
        } catch (error) {
          result.errorRecords++;
          result.errors.push(
            `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      logger.info('Import books completed', {
        ...result,
        userId: (req as any).user?.id,
      });

      res.json({
        success: result.importedRecords > 0,
        data: result,
      });
    } catch (error) {
      logger.error('Error importing books', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// GET /api/import/template/:type - Download CSV template
router.get(
  '/template/:type',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get import template request', {
      type: req.params['type'],
      userId: (req as any).user?.id,
    });

    try {
      const { type } = req.params;

      let headers: string[];
      let sampleData: any[];

      if (type === 'students') {
        headers = [
          'student_id',
          'first_name',
          'last_name',
          'grade_level',
          'email',
          'barcode',
          'grade_category',
        ];
        sampleData = [
          {
            student_id: 'STU001',
            first_name: 'John',
            last_name: 'Doe',
            grade_level: '10',
            email: 'john.doe@school.edu',
            barcode: '123456789',
            grade_category: 'General',
          },
          {
            student_id: 'STU002',
            first_name: 'Jane',
            last_name: 'Smith',
            grade_level: '11',
            email: 'jane.smith@school.edu',
            barcode: '987654321',
            grade_category: 'Honor',
          },
        ];
      } else if (type === 'books') {
        headers = [
          'title',
          'author',
          'isbn',
          'publisher',
          'category',
          'subcategory',
          'location',
          'accession_no',
          'available_copies',
          'total_copies',
          'cost_price',
          'edition',
          'pages',
          'remarks',
          'source_of_fund',
          'volume',
          'year',
        ];
        sampleData = [
          {
            title: 'Introduction to Programming',
            author: 'John Smith',
            isbn: '978-0-123456-78-9',
            publisher: 'Tech Press',
            category: 'Computer Science',
            subcategory: 'Programming',
            location: 'A-101',
            accession_no: 'ACC001',
            available_copies: '5',
            total_copies: '5',
            cost_price: '29.99',
            edition: '1st',
            pages: '500',
            remarks: 'New arrival',
            source_of_fund: 'Library Fund',
            volume: '1',
            year: '2024',
          },
        ];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid template type. Use "students" or "books"',
        });
      }

      // Generate CSV content
      const csvContent = [
        headers.join(','),
        ...sampleData.map(row =>
          headers
            .map(header => {
              const value = row[header] || '';
              // Escape commas and quotes
              if (
                typeof value === 'string' &&
                (value.includes(',') || value.includes('"'))
              ) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(','),
        ),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${type}_template.csv`,
      );
      res.send(csvContent);
    } catch (error) {
      logger.error('Error generating template', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

// POST /api/import/export/:type - Export data to CSV
router.post(
  '/export/:type',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Export data request', {
      type: req.params['type'],
      filters: req.body.filters,
      userId: (req as any).user?.id,
    });

    try {
      const { type } = req.params;
      const { filters = {} } = req.body;

      let data: any[];
      let headers: string[];

      if (type === 'students') {
        data = await prisma.students.findMany({
          where: filters,
          orderBy: { created_at: 'desc' },
        });
        headers = [
          'student_id',
          'first_name',
          'last_name',
          'grade_level',
          'email',
          'barcode',
          'grade_category',
          'is_active',
          'created_at',
        ];
      } else if (type === 'books') {
        data = await prisma.books.findMany({
          where: filters,
          orderBy: { created_at: 'desc' },
        });
        headers = [
          'title',
          'author',
          'isbn',
          'publisher',
          'category',
          'subcategory',
          'location',
          'accession_no',
          'available_copies',
          'total_copies',
          'cost_price',
          'edition',
          'pages',
          'remarks',
          'source_of_fund',
          'volume',
          'year',
          'is_active',
          'created_at',
        ];
      } else if (type === 'borrows') {
        data = await prisma.book_checkouts.findMany({
          where: filters,
          include: {
            student: true,
            book: true,
          },
          orderBy: { checkout_date: 'desc' },
        });
        headers = [
          'student_id',
          'student_name',
          'book_title',
          'book_author',
          'accession_no',
          'checkout_date',
          'due_date',
          'return_date',
          'status',
          'fine_amount',
        ];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid export type',
        });
      }

      // Transform data based on type
      let rows: any[];

      if (type === 'students') {
        rows = data.map(student => ({
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          grade_level: student.grade_level,
          email: student.email,
          barcode: student.barcode,
          grade_category: student.grade_category,
          is_active: student.is_active,
          created_at: student.created_at.toISOString(),
        }));
      } else if (type === 'books') {
        rows = data.map(book => ({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisher: book.publisher,
          category: book.category,
          subcategory: book.subcategory,
          location: book.location,
          accession_no: book.accession_no,
          available_copies: book.available_copies,
          total_copies: book.total_copies,
          cost_price: book.cost_price,
          edition: book.edition,
          pages: book.pages,
          remarks: book.remarks,
          source_of_fund: book.source_of_fund,
          volume: book.volume,
          year: book.year,
          is_active: book.is_active,
          created_at: book.created_at.toISOString(),
        }));
      } else if (type === 'borrows') {
        rows = data.map(borrow => ({
          student_id: borrow.student.student_id,
          student_name: `${borrow.student.first_name} ${borrow.student.last_name}`,
          book_title: borrow.book.title,
          book_author: borrow.book.author,
          accession_no: borrow.book.accession_no,
          checkout_date: borrow.checkout_date.toISOString(),
          due_date: borrow.due_date.toISOString(),
          return_date: borrow.return_date
            ? borrow.return_date.toISOString()
            : '',
          status: borrow.status,
          fine_amount: borrow.fine_amount,
        }));
      } else {
        rows = data;
      }

      // Generate CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row =>
          headers
            .map(header => {
              const value = row[header] || '';
              // Escape commas and quotes
              if (
                typeof value === 'string' &&
                (value.includes(',') || value.includes('"'))
              ) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(','),
        ),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${type}_export_${Date.now()}.csv`,
      );
      res.send(csvContent);

      logger.info('Export completed', {
        type,
        recordCount: rows.length,
        userId: (req as any).user?.id,
      });
    } catch (error) {
      logger.error('Error exporting data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }),
);

export default router;

// Enhanced import: preview
router.post(
  '/preview',
  authenticate,
  requireRole(['LIBRARIAN']),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const importType = String(req.body?.importType || 'students').toLowerCase();
    const maxPreviewRows = Math.max(
      1,
      Math.min(100, parseInt(String(req.body?.maxPreviewRows || '10'))),
    );
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }
    const name = file.originalname.toLowerCase();
    const isCSV = name.endsWith('.csv') || file.mimetype === 'text/csv';
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    let headers: string[] = [];
    let rows: Array<string | string[]> = [];
    if (isCSV) {
      const text = file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }
      headers = lines[0].split(',').map(h => h.trim());
      rows = lines.slice(1, 1 + maxPreviewRows);
    } else if (isExcel) {
      try {
        const xlsx: any = await import('xlsx');
        const wb = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (!json || json.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: 'Empty file' });
        }
        headers = (json[0] as string[]).map((h: any) => String(h).trim());
        rows = (json.slice(1, 1 + maxPreviewRows) as any[]).map((arr: any[]) =>
          arr.map(v => String(v ?? '').trim()),
        );
      } catch (_e) {
        return res.status(415).json({
          success: false,
          message: 'Excel parsing not available on server',
        });
      }
    } else {
      return res
        .status(415)
        .json({ success: false, message: 'Unsupported file type' });
    }
    const records: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rowData = Array.isArray(rows[i])
        ? (rows[i] as string[])
        : parseCSVLine(String(rows[i]));
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (rowData[idx] ?? '').trim();
      });
      if (importType === 'students') {
        const requiredMissing = [
          !obj['student_id'] ? 'student_id' : null,
          !obj['first_name'] ? 'first_name' : null,
          !obj['last_name'] ? 'last_name' : null,
        ].filter(Boolean) as string[];
        const rec: any = {
          rowNumber: i + 1,
          firstName: obj['first_name'] || '',
          lastName: obj['last_name'] || '',
          gradeLevel: obj['grade_level'] || '',
          section: obj['section'] || '',
          email: obj['email'] || '',
          errors: [] as string[],
          warnings: [] as string[],
        };
        if (requiredMissing.length > 0) {
          rec.errors.push(`Missing required: ${requiredMissing.join(', ')}`);
        }
        if (!obj['barcode']) {
          rec.warnings.push('Barcode will be generated');
        }
        records.push(rec);
      }
    }
    return res
      .status(200)
      .json({ success: true, data: { records, duplicateRecords: 0 } });
  }),
);

// Enhanced import: students (multipart CSV)
router.post(
  '/students/enhanced',
  authenticate,
  requireRole(['LIBRARIAN']),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const rawMappings = String(req.body?.fieldMappings || '[]');
    let fieldMappings: Array<{
      sourceField: string;
      targetField: string;
      required?: boolean;
    }> = [];
    try {
      fieldMappings = JSON.parse(rawMappings) as any[];
    } catch (_e) {
      fieldMappings = [];
    }
    const dryRun = String(req.body?.dryRun || 'false').toLowerCase() === 'true';

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }
    const name = file.originalname.toLowerCase();
    const isCSV = name.endsWith('.csv') || file.mimetype === 'text/csv';
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    let headers: string[] = [];
    let dataRows: string[][] = [];
    if (isCSV) {
      const text = file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }
      headers = lines[0].split(',').map(h => h.trim());
      dataRows = lines.slice(1).map(line => parseCSVLine(line));
    } else if (isExcel) {
      try {
        const xlsx: any = await import('xlsx');
        const wb = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (!json || json.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: 'Empty file' });
        }
        headers = (json[0] as string[]).map((h: any) => String(h).trim());
        dataRows = (json.slice(1) as any[]).map((arr: any[]) =>
          arr.map(v => String(v ?? '').trim()),
        );
      } catch (_e) {
        return res.status(415).json({
          success: false,
          message: 'Excel parsing not available on server',
        });
      }
    } else {
      return res
        .status(415)
        .json({ success: false, message: 'Unsupported file type' });
    }
    const result = {
      importedRecords: 0,
      errorRecords: 0,
      errors: [] as string[],
      generated: [] as Array<{ row: number; barcode: string }>,
    };
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const cols = dataRows[i];
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = (cols[idx] ?? '').trim();
        });
        const mapped: any = {};
        if (fieldMappings && fieldMappings.length > 0) {
          fieldMappings.forEach(m => {
            if (row[m.sourceField]) {
              mapped[m.targetField] = row[m.sourceField];
            }
          });
        } else {
          Object.assign(mapped, row);
        }
        if (!mapped.student_id || !mapped.first_name || !mapped.last_name) {
          result.errorRecords++;
          result.errors.push(`Row ${i + 1}: missing required fields`);
          continue;
        }
        let barcode = String(mapped.barcode || '').trim();
        if (!barcode) {
          barcode = await BarcodeService.getNextPNBarcode();
          result.errors.push(`Row ${i + 1}: Barcode generated ${barcode}`);
          result.generated.push({ row: i + 1, barcode });
        }
        const createData = {
          student_id: String(mapped.student_id),
          first_name: String(mapped.first_name),
          last_name: String(mapped.last_name),
          grade_level: mapped.grade_level
            ? parseInt(String(mapped.grade_level))
            : 1,
          email: mapped.email || null,
          barcode,
          grade_category: mapped.grade_category || null,
          is_active:
            mapped.is_active !== undefined
              ? mapped.is_active === true || mapped.is_active === 'true'
              : true,
        };
        if (!dryRun) {
          const existing = await prisma.students.findUnique({
            where: { student_id: createData.student_id },
          });
          if (existing) {
            await prisma.students.update({
              where: { id: existing.id },
              data: createData,
            });
          } else {
            await prisma.students.create({ data: createData });
          }
        }
        result.importedRecords++;
      } catch (err) {
        result.errorRecords++;
        result.errors.push(
          `Row ${i}: ${(err as Error)?.message || 'Unknown error'}`,
        );
      }
    }
    return res
      .status(200)
      .json({ success: result.importedRecords > 0, data: result });
  }),
);

router.post(
  '/books/enhanced',
  authenticate,
  requireRole(['LIBRARIAN']),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const rawMappings = String(req.body?.fieldMappings || '[]');
    let fieldMappings: Array<{
      sourceField: string;
      targetField: string;
      required?: boolean;
    }> = [];
    try {
      fieldMappings = JSON.parse(rawMappings) as any[];
    } catch (_e) {
      fieldMappings = [];
    }
    const dryRun = String(req.body?.dryRun || 'false').toLowerCase() === 'true';

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }
    const name = file.originalname.toLowerCase();
    const isCSV = name.endsWith('.csv') || file.mimetype === 'text/csv';
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    let headers: string[] = [];
    let dataRows: string[][] = [];
    if (isCSV) {
      const text = file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }
      headers = lines[0].split(',').map(h => h.trim());
      dataRows = lines.slice(1).map(line => parseCSVLine(line));
    } else if (isExcel) {
      try {
        const xlsx: any = await import('xlsx');
        const wb = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (!json || json.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: 'Empty file' });
        }
        headers = (json[0] as string[]).map((h: any) => String(h).trim());
        dataRows = (json.slice(1) as any[]).map((arr: any[]) =>
          arr.map(v => String(v ?? '').trim()),
        );
      } catch (_e) {
        return res.status(415).json({
          success: false,
          message: 'Excel parsing not available on server',
        });
      }
    } else {
      return res
        .status(415)
        .json({ success: false, message: 'Unsupported file type' });
    }
    const result = {
      importedRecords: 0,
      errorRecords: 0,
      errors: [] as string[],
    };
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const cols = dataRows[i];
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = (cols[idx] ?? '').trim();
        });
        const mapped: any = {};
        if (fieldMappings && fieldMappings.length > 0) {
          fieldMappings.forEach(m => {
            if (row[m.sourceField]) {
              mapped[m.targetField] = row[m.sourceField];
            }
          });
        } else {
          Object.assign(mapped, row);
        }
        if (
          !mapped.title ||
          !mapped.author ||
          !mapped.accession_no ||
          !mapped.category
        ) {
          result.errorRecords++;
          result.errors.push(`Row ${i + 1}: missing required fields`);
          continue;
        }
        const createData = {
          title: String(mapped.title),
          author: String(mapped.author),
          isbn: mapped.isbn || null,
          publisher: mapped.publisher || null,
          category: String(mapped.category),
          subcategory: mapped.subcategory || null,
          location: mapped.location || null,
          accession_no: String(mapped.accession_no),
          available_copies: mapped.available_copies
            ? parseInt(String(mapped.available_copies))
            : 1,
          total_copies: mapped.total_copies
            ? parseInt(String(mapped.total_copies))
            : 1,
          cost_price: mapped.cost_price
            ? parseFloat(String(mapped.cost_price))
            : null,
          edition: mapped.edition || null,
          pages: mapped.pages || null,
          remarks: mapped.remarks || null,
          source_of_fund: mapped.source_of_fund || null,
          volume: mapped.volume || null,
          year: mapped.year ? parseInt(String(mapped.year)) : null,
          is_active:
            mapped.is_active !== undefined
              ? mapped.is_active === true || mapped.is_active === 'true'
              : true,
        };
        if (createData.available_copies > createData.total_copies) {
          result.errorRecords++;
          result.errors.push(
            `Row ${i + 1}: Available copies cannot exceed total copies`,
          );
          continue;
        }
        if (!dryRun) {
          const existing = await prisma.books.findUnique({
            where: { accession_no: createData.accession_no },
          });
          if (existing) {
            await prisma.books.update({
              where: { id: existing.id },
              data: createData,
            });
          } else {
            await prisma.books.create({ data: createData });
          }
        }
        result.importedRecords++;
      } catch (err) {
        result.errorRecords++;
        result.errors.push(
          `Row ${i}: ${(err as Error)?.message || 'Unknown error'}`,
        );
      }
    }
    return res
      .status(200)
      .json({ success: result.importedRecords > 0, data: result });
  }),
);

// Templates alias for students
router.get(
  '/templates/students',
  authenticate,
  requireRole(['LIBRARIAN']),
  asyncHandler(async (_req: Request, res: Response) => {
    res.redirect(302, '/api/import/template/students');
  }),
);

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}
