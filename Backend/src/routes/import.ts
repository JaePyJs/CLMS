/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import multer from 'multer';

import { websocketServer } from '../websocket/websocketServer';
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
            // Auto-detect fields based on SHJCS CSV format
            // Map User ID -> student_id (which becomes barcode)
            // Map Surname -> last_name, First Name -> first_name, etc.
            const autoMapping: Record<string, string> = {
              'User ID': 'student_id',
              Surname: 'last_name',
              'First Name': 'first_name',
              'Grade Level': 'grade_level',
              Section: 'section',
              Designation: 'designation',
              Sex: 'sex',
            };

            Object.keys(row).forEach(key => {
              const mappedKey =
                autoMapping[key] || key.toLowerCase().replace(/\s+/g, '_');
              studentData[mappedKey] = row[key];
            });
          }

          // Validate required fields - Use placeholders instead of skipping
          if (!studentData.student_id) {
            studentData.student_id = `TEMP_${Date.now()}_${i}`;
            result.errors.push(
              `Row ${i + 1}: Missing student_id - Generated temporary ID: ${studentData.student_id}`,
            );
          }

          if (!studentData.first_name) {
            studentData.first_name = '(No First Name)';
            result.errors.push(
              `Row ${i + 1}: Missing first_name - Imported with placeholder`,
            );
          }

          if (!studentData.last_name) {
            studentData.last_name = '(No Last Name)';
            result.errors.push(
              `Row ${i + 1}: Missing last_name - Imported with placeholder`,
            );
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

          // Prepare student data - handle User ID as barcode
          // The CSV column "User ID" is mapped to student_id
          // We want: Barcode = User ID (if User ID exists)
          let barcode = String(
            studentData.barcode || studentData.student_id || '',
          ).trim();

          // If no barcode/User ID is provided, generate one
          if (!barcode || barcode === '') {
            barcode = `PN${String(Date.now()).slice(-6)}`;
            const collision = await prisma.students.findFirst({
              where: { barcode },
            });
            if (collision) {
              barcode = `PN${String(Date.now() + i).slice(-6)}`;
            }
            // If we generated a barcode, and student_id was also missing, use the generated barcode as student_id too
            if (!studentData.student_id) {
              studentData.student_id = barcode;
            }
          } else {
            // If we have a barcode (from User ID), ensure student_id matches it if it was missing
            if (!studentData.student_id) {
              studentData.student_id = barcode;
            }
          }

          const createData = {
            student_id: String(studentData.student_id),
            first_name: String(studentData.first_name),
            last_name: String(studentData.last_name),
            grade_level: studentData.grade_level
              ? parseInt(String(studentData.grade_level))
              : 1,
            section: studentData.section || null,
            designation: studentData.designation || null,
            sex: studentData.sex || null,
            email: studentData.email || null,
            barcode, // This is now explicitly the resolved barcode
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

          if (
            !existingStudent &&
            !studentData.barcode &&
            !studentData.student_id
          ) {
            // Only log this if we truly generated everything from scratch
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

      // Broadcast import completion to all connected clients (kiosks, dashboards)
      // This makes the new student barcodes immediately available for scanning
      if (result.importedRecords > 0) {
        websocketServer.broadcastToAll({
          id: `import_students_${Date.now()}`,
          type: 'students:imported',
          data: {
            count: result.importedRecords,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        });
      }

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
            // Auto-detect fields based on SHJCS Bibliography format
            // Map Barcode -> accession_no (book barcode)
            const autoMapping: Record<string, string> = {
              Barcode: 'accession_no',
              'Call Number': 'location',
              Title: 'title',
              Author: 'author',
              Year: 'year',
              Edition: 'edition',
              ISBN: 'isbn',
              Publisher: 'publisher',
              Publication: 'publisher',
              'Collection Code': 'category',
              'Physical Description': 'pages',
              'Note Area': 'remarks',
              Price: 'cost_price',
            };

            Object.keys(row).forEach(key => {
              const mappedKey =
                autoMapping[key] || key.toLowerCase().replace(/\s+/g, '_');
              bookData[mappedKey] = row[key];
            });
          }

          // Validate required fields
          // Validate required fields - Use placeholders instead of skipping
          if (!bookData.title) {
            bookData.title = '(No Title)';
            result.errors.push(
              `Row ${i + 1}: Missing title - Imported with placeholder`,
            );
          }

          if (!bookData.author) {
            bookData.author = '(No Author)';
            result.errors.push(
              `Row ${i + 1}: Missing author - Imported with placeholder`,
            );
          }

          if (!bookData.accession_no) {
            bookData.accession_no = `TEMP_BOOK_${Date.now()}_${i}`;
            result.errors.push(
              `Row ${i + 1}: Missing accession_no - Generated temporary: ${bookData.accession_no}`,
            );
          }

          if (!bookData.category) {
            bookData.category = '(Uncategorized)';
            result.errors.push(
              `Row ${i + 1}: Missing category - Imported with placeholder`,
            );
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

      // Broadcast import completion to all connected clients
      // This makes the new book barcodes immediately available for scanning
      if (result.importedRecords > 0) {
        websocketServer.broadcastToAll({
          id: `import_books_${Date.now()}`,
          type: 'books:imported',
          data: {
            count: result.importedRecords,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        });
      }

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
      Math.min(1000, parseInt(String(req.body?.maxPreviewRows || '10'))),
    );
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }

    let headers: string[] = [];
    let rows: Array<string[]> = [];
    let totalRows = 0;

    try {
      const xlsx: any = await import('xlsx');
      const wb = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!json || json.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }

      // Filter out empty rows
      const cleanJson = (json as any[][]).filter(row =>
        row.some(
          cell =>
            cell !== null &&
            cell !== undefined &&
            String(cell).trim().length > 0,
        ),
      );

      if (cleanJson.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }

      headers = cleanJson[0].map((h: any) => String(h).trim());
      totalRows = cleanJson.length - 1; // Exclude header

      // Process all rows
      rows = (cleanJson.slice(1) as any[]).map((arr: any[]) =>
        arr.map(v => String(v ?? '').trim()),
      );
    } catch (_error) {
      return res.status(415).json({
        success: false,
        message:
          'Failed to parse file. Please ensure it is a valid CSV or Excel file.',
      });
    }
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

    const records: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    // Process all rows for counts, but only store preview records
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];

      const obj: Record<string, string> = {};

      // If mappings exist, use them
      if (fieldMappings.length > 0) {
        fieldMappings.forEach(mapping => {
          const headerIndex = headers.indexOf(mapping.sourceField);
          if (headerIndex !== -1) {
            obj[mapping.targetField] = (rowData[headerIndex] ?? '').trim();
          }
        });
      } else {
        // Fallback to direct header matching
        headers.forEach((h, idx) => {
          obj[h] = (rowData[idx] ?? '').trim();
        });
      }

      if (importType === 'students') {
        // Relaxed validation: Check if row has ANY data
        const hasData = Object.values(obj).some(
          val => val && val.trim().length > 0,
        );

        // Default barcode to studentId if missing
        const studentId = obj['studentId'] || obj['student_id'] || '';
        const barcode = obj['barcode'] || studentId || ''; // Fallback to studentId

        const rec: any = {
          rowNumber: i + 1,
          studentId: studentId,
          barcode: barcode,
          firstName: obj['firstName'] || obj['first_name'] || '(No Name)',
          lastName: obj['lastName'] || obj['last_name'] || '(No Surname)',
          gradeLevel: obj['gradeLevel'] || obj['grade_level'] || '',
          section: obj['section'] || '',
          email: obj['email'] || '',
          phone: obj['phone'] || '',
          parentName: obj['parentName'] || '',
          parentPhone: obj['parentPhone'] || '',
          parentEmail: obj['parentEmail'] || '',
          address: obj['address'] || '',
          emergencyContact: obj['emergencyContact'] || '',
          notes: obj['notes'] || '',
          errors: [] as string[],
          warnings: [] as string[],
        };

        // Only error if absolutely no data
        if (!hasData) {
          rec.errors.push('Row is empty');
          invalidCount++;
        } else {
          validCount++;
        }

        // Generate temporary ID if missing
        if (!rec.studentId) {
          rec.warnings.push('Missing Student ID - Will be generated');
        }

        if (!rec.barcode) {
          rec.warnings.push('Barcode will be generated');
        }

        // Only add to records if within preview limit
        if (records.length < maxPreviewRows) {
          records.push(rec);
        }
      } else if (importType === 'books') {
        // Relaxed validation: Check if row has ANY data
        const hasData = Object.values(obj).some(
          val => val && val.trim().length > 0,
        );

        const rec: any = {
          rowNumber: i + 1,
          title: obj['title'] || '(No Title)',
          author: obj['author'] || '(No Author)',
          isbn: obj['isbn'] || '',
          publisher: obj['publisher'] || '',
          category: obj['category'] || '(Uncategorized)',
          subcategory: obj['subcategory'] || '',
          location: obj['location'] || '',
          accession_no: obj['accession_no'] || obj['accessionNo'] || '',
          available_copies:
            obj['available_copies'] || obj['availableCopies'] || '1',
          total_copies: obj['total_copies'] || obj['totalCopies'] || '1',
          cost_price: obj['cost_price'] || obj['costPrice'] || '',
          edition: obj['edition'] || '',
          pages: obj['pages'] || '',
          remarks: obj['remarks'] || '',
          source_of_fund: obj['source_of_fund'] || obj['sourceOfFund'] || '',
          volume: obj['volume'] || '',
          year: obj['year'] || '',
          errors: [] as string[],
          warnings: [] as string[],
        };

        // Only error if absolutely no data
        if (!hasData) {
          rec.errors.push('Row is empty');
          invalidCount++;
        } else {
          validCount++;
        }

        // Generate temporary ID if missing
        if (!rec.accession_no) {
          rec.warnings.push('Missing Accession No - Will be generated');
        }

        if (rec.title === '(No Title)') {
          rec.warnings.push('Missing Title');
        }

        if (rec.author === '(No Author)') {
          rec.warnings.push('Missing Author');
        }

        // Only add to records if within preview limit
        if (records.length < maxPreviewRows) {
          records.push(rec);
        }
      }
    }
    return res.status(200).json({
      success: true,
      data: {
        records,
        totalRows,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRecords: 0,
      },
    });
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

    let headers: string[] = [];
    let dataRows: string[][] = [];

    try {
      const xlsx: any = await import('xlsx');
      const wb = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!json || json.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }

      // Filter out empty rows
      const cleanJson = (json as any[][]).filter(row =>
        row.some(
          cell =>
            cell !== null &&
            cell !== undefined &&
            String(cell).trim().length > 0,
        ),
      );

      if (cleanJson.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }

      headers = cleanJson[0].map((h: any) => String(h).trim());

      // Process all rows
      dataRows = (cleanJson.slice(1) as any[]).map((arr: any[]) =>
        arr.map(v => String(v ?? '').trim()),
      );
    } catch (error) {
      logger.error('File parsing error:', error);
      return res.status(415).json({
        success: false,
        message:
          'Failed to parse file. Please ensure it is a valid CSV or Excel file.',
      });
    }
    const result = {
      importedRecords: 0,
      errorRecords: 0,
      errors: [] as string[],
      generated: [] as Array<{ row: number; barcode: string }>,
    };

    // Batch processing configuration
    const BATCH_SIZE = 50;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);

      // 1. Map fields for the entire batch first
      const mappedBatch = batch.map((cols, batchIdx) => {
        const currentRowIdx = i + batchIdx;
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
        return { mapped, currentRowIdx };
      });

      // 2. Deduplicate by student_id (keep last occurrence in batch)
      const uniqueBatchMap = new Map<string, (typeof mappedBatch)[0]>();
      const itemsWithoutId: typeof mappedBatch = [];

      mappedBatch.forEach(item => {
        if (item.mapped.student_id) {
          uniqueBatchMap.set(String(item.mapped.student_id), item);
        } else {
          itemsWithoutId.push(item);
        }
      });

      // Combine unique items and items without ID
      const itemsToProcess = [
        ...itemsWithoutId,
        ...Array.from(uniqueBatchMap.values()),
      ];

      // 3. Pre-process batch to identify who needs new barcodes
      const batchContext = await Promise.all(
        itemsToProcess.map(async ({ mapped, currentRowIdx }) => {
          // Apply placeholders for missing fields
          if (!mapped.student_id) {
            mapped.student_id = `TEMP_${Date.now()}_${currentRowIdx}`;
          }
          if (!mapped.first_name) {
            mapped.first_name = '(No First Name)';
          }
          if (!mapped.last_name) {
            mapped.last_name = '(No Last Name)';
          }

          // if (!mapped.student_id || !mapped.first_name || !mapped.last_name) {
          //   return {
          //     valid: false,
          //     error: `Row ${currentRowIdx + 1}: missing required fields`,
          //     rowIdx: currentRowIdx,
          //   };
          // }

          let existing = null;
          if (!dryRun) {
            existing = await prisma.students.findUnique({
              where: { student_id: String(mapped.student_id) },
            });
          }

          const providedBarcode = String(mapped.barcode || '').trim();
          const needsNewBarcode = !providedBarcode && !existing?.barcode;

          return {
            valid: true,
            mapped,
            existing,
            needsNewBarcode,
            providedBarcode,
            rowIdx: currentRowIdx,
            error: undefined,
          };
        }),
      );

      // Calculate how many new barcodes we need
      const newBarcodeCount = batchContext.filter(
        ctx => ctx.valid && ctx.needsNewBarcode,
      ).length;
      let nextSeq = 0;

      if (newBarcodeCount > 0 && !dryRun) {
        // Atomically reserve a range of barcodes
        const key = 'barcode.sequence';
        try {
          const result = await prisma.$transaction(async tx => {
            const setting = await tx.system_settings.findUnique({
              where: { key },
            });
            let currentSeq = 0;
            if (!setting) {
              currentSeq = 18; // Default start
              await tx.system_settings.create({
                data: { key, value: String(currentSeq + newBarcodeCount) },
              });
            } else {
              currentSeq = parseInt(setting.value || '0');
              if (isNaN(currentSeq)) {
                currentSeq = 0;
              }
              // Increment by the number of barcodes we need
              await tx.system_settings.update({
                where: { key },
                data: { value: String(currentSeq + newBarcodeCount) },
              });
            }
            return currentSeq;
          });
          nextSeq = result;
        } catch (_e) {
          nextSeq = Math.floor(Date.now() % 100000);
        }
      }

      // Process the batch with reserved barcodes
      let barcodeOffset = 0;

      await Promise.all(
        batchContext.map(async ctx => {
          if (!ctx.valid) {
            result.errorRecords++;
            result.errors.push(ctx.error || 'Unknown error');
            return;
          }

          try {
            const {
              mapped,
              existing,
              needsNewBarcode,
              providedBarcode,
              rowIdx,
            } = ctx;
            let barcode = providedBarcode;

            if (!barcode) {
              if (existing?.barcode) {
                barcode = existing.barcode;
              } else if (needsNewBarcode) {
                const seq = nextSeq + 1 + barcodeOffset;
                barcodeOffset++;
                barcode = `PN${String(seq).padStart(5, '0')}`;
                result.generated.push({ row: rowIdx + 1, barcode });
              }
            }

            const createData = {
              student_id: String(mapped.student_id),
              first_name: String(mapped.first_name),
              last_name: String(mapped.last_name),
              grade_level: (() => {
                const val = String(mapped.grade_level || '').toUpperCase();
                if (
                  val.includes('NURSERY') ||
                  val.includes('KINDER') ||
                  val.includes('PRE')
                ) {
                  return 0;
                }
                const num = parseInt(val.replace(/[^0-9]/g, ''));
                return isNaN(num) ? 1 : num;
              })(),
              email: mapped.email || null,
              gender: mapped.gender || null,
              barcode,
              grade_category: mapped.grade_category || null,
              is_active:
                mapped.is_active !== undefined
                  ? mapped.is_active === true || mapped.is_active === 'true'
                  : true,
            };

            if (!dryRun) {
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
            // If unique constraint fails (race condition despite deduplication), try update
            if ((err as any)?.code === 'P2002') {
              try {
                await prisma.students.update({
                  where: { student_id: String(ctx.mapped.student_id) },
                  data: {
                    first_name: String(ctx.mapped.first_name),
                    last_name: String(ctx.mapped.last_name),
                  },
                });
                result.importedRecords++;
                return;
              } catch (retryErr) {
                result.errorRecords++;
                result.errors.push(
                  `Row ${ctx.rowIdx + 1}: Failed to update duplicate student - ${(retryErr as Error)?.message}`,
                );
                return;
              }
            }
            result.errorRecords++;
            result.errors.push(
              `Row ${ctx.rowIdx + 1}: ${(err as Error)?.message || 'Unknown error'}`,
            );
          }
        }),
      );
    }

    // Broadcast import completion
    if (result.importedRecords > 0) {
      websocketServer.broadcastToAll({
        id: `import_students_${Date.now()}`,
        type: 'students:imported',
        data: {
          count: result.importedRecords,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      });
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

    let headers: string[] = [];
    let dataRows: string[][] = [];

    try {
      const xlsx: any = await import('xlsx');
      const wb = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!json || json.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }

      // Filter out empty rows
      const cleanJson = (json as any[][]).filter(row =>
        row.some(
          cell =>
            cell !== null &&
            cell !== undefined &&
            String(cell).trim().length > 0,
        ),
      );

      if (cleanJson.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty file' });
      }

      headers = cleanJson[0].map((h: any) => String(h).trim());

      // Process all rows
      dataRows = (cleanJson.slice(1) as any[]).map((arr: any[]) =>
        arr.map(v => String(v ?? '').trim()),
      );
    } catch (_error) {
      return res.status(415).json({
        success: false,
        message:
          'Failed to parse file. Please ensure it is a valid CSV or Excel file.',
      });
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

    // Broadcast import completion
    if (result.importedRecords > 0) {
      websocketServer.broadcastToAll({
        id: `import_books_${Date.now()}`,
        type: 'books:imported',
        data: {
          count: result.importedRecords,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      });
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

export default router;
