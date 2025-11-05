/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// POST /api/import/students - Import students from CSV/Excel
router.post(
  '/students',
  authenticate,
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
          const createData = {
            student_id: studentData.student_id,
            first_name: studentData.first_name,
            last_name: studentData.last_name,
            grade_level: studentData.grade_level
              ? parseInt(studentData.grade_level)
              : 1,
            email: studentData.email || null,
            barcode: studentData.barcode || null,
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
