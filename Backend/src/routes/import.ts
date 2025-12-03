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

// Field aliases for common CSV column names
// Maps various column name variations to standard field names
const FIELD_ALIASES: Record<string, string[]> = {
  student_id: [
    'user id',
    'userid',
    'student id',
    'studentid',
    'id',
    'lrn',
    'student_id',
  ],
  first_name: ['first name', 'firstname', 'first', 'given name', 'first_name'],
  last_name: [
    'surname',
    'last name',
    'lastname',
    'last',
    'family name',
    'last_name',
  ],
  grade_level: [
    'grade level',
    'grade',
    'year',
    'level',
    'class',
    'grade_level',
    'gradelevel',
  ],
  section: ['section', 'block', 'group'],
  designation: ['designation', 'role', 'type'],
  gender: ['sex', 'gender', 'male/female'],
  barcode: [
    'barcode',
    'barcode no',
    'barcode no.',
    'card number',
    'library card',
  ],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'telephone', 'mobile', 'contact', 'phone number'],
  parent_name: [
    'parent name',
    'parent',
    'guardian',
    'parent/guardian',
    'parent_name',
  ],
  parent_phone: [
    'parent phone',
    'parent mobile',
    'parent contact',
    'parent_phone',
  ],
  parent_email: ['parent email', 'parent e-mail', 'parent_email'],
  address: ['address', 'home address', 'residence'],
  emergency_contact: [
    'emergency contact',
    'emergency phone',
    'emergency_contact',
  ],
  notes: ['notes', 'remarks', 'comments', 'observations'],
  full_name: ['name', 'full name', 'student name', 'fullname', 'full_name'],
};

// Field aliases for book CSV column names
// Maps various column name variations to standard field names
const BOOK_FIELD_ALIASES: Record<string, string[]> = {
  accession_no: [
    'barcode',
    'accession no',
    'accession no.',
    'accession number',
    'book barcode',
    'book id',
    'accession_no',
  ],
  title: ['title', 'book title', 'name', 'book name'],
  author: ['author', 'writer', 'by', 'authors'],
  isbn: ['isbn', 'isbn10', 'isbn13', 'isbn-10', 'isbn-13'],
  publisher: ['publisher', 'publishing house', 'press', 'publication'],
  category: [
    'category',
    'genre',
    'subject',
    'collection code',
    'collection',
    'type',
  ],
  subcategory: ['subcategory', 'sub-category', 'sub genre', 'subgenre'],
  location: ['location', 'shelf', 'rack', 'call number', 'call no', 'call no.'],
  year: ['year', 'publication year', 'date', 'copyright', 'pub year'],
  edition: ['edition', 'version', 'ed'],
  pages: ['pages', 'no. of pages', 'physical description', 'page count'],
  remarks: ['remarks', 'notes', 'comments', 'note area', 'observations'],
  cost_price: ['cost_price', 'price', 'cost', 'amount', 'value'],
  source_of_fund: ['source_of_fund', 'fund', 'source', 'funding'],
  volume: ['volume', 'vol', 'vol.'],
  available_copies: [
    'available_copies',
    'available',
    'copies available',
    'qty available',
  ],
  total_copies: ['total_copies', 'total', 'copies', 'quantity', 'qty', 'stock'],
};

// Helper function to normalize field values from a book row object
function normalizeBookFieldFromRow(
  row: Record<string, string>,
  fieldName: string,
): string | undefined {
  // First check the expected field name
  if (row[fieldName]) {
    return row[fieldName];
  }

  // Get aliases for this field
  const aliases = BOOK_FIELD_ALIASES[fieldName] || [];

  // Check each alias (case-insensitive)
  for (const alias of aliases) {
    const key = Object.keys(row).find(
      k => k.toLowerCase().trim() === alias.toLowerCase(),
    );
    if (key && row[key]) {
      return row[key];
    }
  }

  return undefined;
}

// Normalize all standard fields from a book row
function normalizeBookRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  // List of standard book fields to normalize
  const standardFields = [
    'accession_no',
    'title',
    'author',
    'isbn',
    'publisher',
    'category',
    'subcategory',
    'location',
    'year',
    'edition',
    'pages',
    'remarks',
    'cost_price',
    'source_of_fund',
    'volume',
    'available_copies',
    'total_copies',
  ];

  for (const field of standardFields) {
    const value = normalizeBookFieldFromRow(row, field);
    if (value) {
      normalized[field] = String(value).trim();
    }
  }

  return normalized;
}

// Helper function to normalize field values from a row object
// Checks for standard field name first, then aliases
function normalizeFieldFromRow(
  row: Record<string, string>,
  fieldName: string,
): string | undefined {
  // First check the expected field name
  if (row[fieldName]) {
    return row[fieldName];
  }

  // Get aliases for this field
  const aliases = FIELD_ALIASES[fieldName] || [];

  // Check each alias (case-insensitive)
  for (const alias of aliases) {
    const key = Object.keys(row).find(
      k => k.toLowerCase().trim() === alias.toLowerCase(),
    );
    if (key && row[key]) {
      return row[key];
    }
  }

  return undefined;
}

// Normalize all standard fields from a row
function normalizeStudentRow(
  row: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  // List of standard fields to normalize
  const standardFields = [
    'student_id',
    'first_name',
    'last_name',
    'grade_level',
    'section',
    'designation',
    'gender',
    'barcode',
    'email',
    'phone',
    'parent_name',
    'parent_phone',
    'parent_email',
    'address',
    'emergency_contact',
    'notes',
    'full_name',
  ];

  for (const field of standardFields) {
    const value = normalizeFieldFromRow(row, field);
    if (value) {
      normalized[field] = String(value).trim();
    }
  }

  // Handle full_name splitting if first/last are missing
  if (
    normalized.full_name &&
    (!normalized.first_name || !normalized.last_name)
  ) {
    const parts = normalized.full_name.trim().split(' ');
    if (parts.length > 0) {
      if (!normalized.first_name) {
        normalized.first_name = parts[0];
      }
      if (!normalized.last_name) {
        normalized.last_name = parts.slice(1).join(' ') || parts[0];
      }
    }
  }

  // Use student_id as barcode if no barcode provided
  if (!normalized.barcode && normalized.student_id) {
    normalized.barcode = normalized.student_id;
  }

  return normalized;
}

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
          // STEP 1: First normalize the original row using field aliases
          // This handles variations like "Surname" -> "last_name", "User ID" -> "student_id", etc.
          const normalizedRow = normalizeStudentRow(row);

          // STEP 2: Create student data object with normalized values
          const studentData: any = { ...normalizedRow };

          // Map fields based on the provided mapping (if any)
          if (fieldMapping && Array.isArray(fieldMapping)) {
            fieldMapping.forEach((mapping: any) => {
              if (mapping.source && mapping.target) {
                // Check original row first, then normalized
                const value =
                  row[mapping.source] || normalizedRow[mapping.target];
                if (value) {
                  studentData[mapping.target] = value;
                }
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

            // Apply auto-mapping on top of normalized data
            Object.keys(row).forEach(key => {
              const mappedKey =
                autoMapping[key] || key.toLowerCase().replace(/\s+/g, '_');
              if (row[key]) {
                studentData[mappedKey] = row[key];
              }
            });
          }

          // Handle Full Name splitting if First/Last are missing
          if (
            (!studentData.first_name || !studentData.last_name) &&
            (studentData.full_name || studentData.name)
          ) {
            const fullName = String(
              studentData.full_name || studentData.name,
            ).trim();
            const parts = fullName.split(' ');
            if (parts.length > 0) {
              if (!studentData.last_name) {
                studentData.last_name = parts.pop() || '';
              }
              if (!studentData.first_name) {
                studentData.first_name = parts.join(' ');
              }
            }
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
            // is_active should be false by default - students become active only when they scan in
            is_active:
              studentData.is_active !== undefined
                ? studentData.is_active === true ||
                  studentData.is_active === 'true'
                : false,
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

// POST /api/import/books/preview - Preview books import from CSV/Excel
router.post(
  '/books/preview',
  authenticate,
  requireRole(['LIBRARIAN']),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const maxPreviewRows = Math.max(
      1,
      Math.min(1000, parseInt(String(req.body?.maxPreviewRows || '1000'))),
    );
    const skipHeaderRow = req.body?.skipHeaderRow !== 'false';

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
      totalRows = skipHeaderRow ? cleanJson.length - 1 : cleanJson.length;

      // Process rows (skip header if needed)
      const startIndex = skipHeaderRow ? 1 : 0;
      rows = (cleanJson.slice(startIndex) as any[]).map((arr: any[]) =>
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
    const invalidCount = 0;
    let duplicateCount = 0;

    // Track seen ISBNs and accession numbers for duplicate detection
    const seenIsbns = new Set<string>();
    const seenAccessionNos = new Set<string>();

    // Process all rows
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];
      const obj: Record<string, string> = {};

      // If mappings exist, use them
      if (fieldMappings.length > 0) {
        fieldMappings.forEach(mapping => {
          let headerIndex = headers.indexOf(mapping.sourceField);

          // Fallback: Try loose matching (case-insensitive, trimmed)
          if (headerIndex === -1) {
            headerIndex = headers.findIndex(
              h =>
                h.trim().toLowerCase() ===
                mapping.sourceField.trim().toLowerCase(),
            );
          }

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

      // Normalize the book row using BOOK_FIELD_ALIASES
      const normalized = normalizeBookRow(obj);

      // Also apply auto-mapping for SHJCS format when no explicit mappings
      if (fieldMappings.length === 0) {
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

        Object.keys(obj).forEach(key => {
          const mappedKey = autoMapping[key];
          if (mappedKey && obj[key] && !normalized[mappedKey]) {
            normalized[mappedKey] = obj[key];
          }
        });
      }

      // Validate the record - use warnings instead of errors for missing fields
      // since the import will use placeholders
      const errors: string[] = [];
      const warnings: string[] = [];

      // These are not errors - import will use placeholders
      if (!normalized.title) {
        warnings.push('Missing title - will use placeholder "(No Title)"');
      }

      if (!normalized.author) {
        warnings.push('Missing author - will use placeholder "(No Author)"');
      }

      if (!normalized.accession_no) {
        warnings.push('Missing accession number - will auto-generate');
      }

      if (!normalized.category) {
        warnings.push('Missing category - will use "(Uncategorized)"');
      }

      // Check for duplicates within the file
      if (normalized.isbn) {
        if (seenIsbns.has(normalized.isbn.toLowerCase())) {
          warnings.push('Duplicate ISBN in file');
          duplicateCount++;
        } else {
          seenIsbns.add(normalized.isbn.toLowerCase());
        }
      }

      if (normalized.accession_no) {
        if (seenAccessionNos.has(normalized.accession_no.toLowerCase())) {
          warnings.push('Duplicate accession number in file');
          duplicateCount++;
        } else {
          seenAccessionNos.add(normalized.accession_no.toLowerCase());
        }
      }

      // All records are valid - missing fields will get placeholders during import
      const isValid = true;
      validCount++;

      // Only include up to maxPreviewRows in response
      if (records.length < maxPreviewRows) {
        records.push({
          ...normalized,
          errors,
          warnings,
          isValid,
          rowNumber: i + 1,
        });
      }
    }

    return res.json({
      success: true,
      headers,
      records,
      totalRows,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRecords: duplicateCount,
    });
  }),
);

// POST /api/import/books - Import books from CSV/Excel
router.post(
  '/books',
  authenticate,
  requireRole(['LIBRARIAN']),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const skipHeaderRow = req.body?.skipHeaderRow !== 'false';

    logger.info('Import books request', {
      hasFile: !!file,
      hasBodyData: !!req.body.data,
      userId: (req as any).user?.id,
    });

    try {
      let data: any[] = [];
      let fieldMapping: any[] = [];
      let options: any = {};

      // Parse field mappings and options from body
      if (req.body.fieldMappings) {
        try {
          fieldMapping = JSON.parse(req.body.fieldMappings);
        } catch {
          fieldMapping = [];
        }
      }

      if (req.body.options) {
        try {
          options = JSON.parse(req.body.options);
        } catch {
          options = {};
        }
      }

      // If file is uploaded, parse it
      if (file) {
        try {
          const xlsx: any = await import('xlsx');
          const wb = xlsx.read(file.buffer, { type: 'buffer' });
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const json = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

          if (!json || json.length === 0) {
            return res
              .status(400)
              .json({ success: false, message: 'Empty file' });
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
            return res
              .status(400)
              .json({ success: false, message: 'Empty file' });
          }

          const headers = cleanJson[0].map((h: any) => String(h).trim());
          const startIndex = skipHeaderRow ? 1 : 0;
          const rows = cleanJson.slice(startIndex);

          // Convert rows to objects
          data = rows.map((row: any[]) => {
            const obj: Record<string, string> = {};

            // If field mappings exist, use them
            if (fieldMapping.length > 0) {
              fieldMapping.forEach((mapping: any) => {
                let headerIndex = headers.indexOf(mapping.sourceField);
                if (headerIndex === -1) {
                  headerIndex = headers.findIndex(
                    (h: string) =>
                      h.trim().toLowerCase() ===
                      mapping.sourceField.trim().toLowerCase(),
                  );
                }
                if (headerIndex !== -1) {
                  obj[mapping.targetField] = String(
                    row[headerIndex] ?? '',
                  ).trim();
                }
              });
            } else {
              // Direct header mapping
              headers.forEach((h: string, idx: number) => {
                obj[h] = String(row[idx] ?? '').trim();
              });
            }
            return obj;
          });
        } catch (parseError) {
          logger.error('Error parsing file', { error: parseError });
          return res.status(415).json({
            success: false,
            message:
              'Failed to parse file. Please ensure it is a valid CSV or Excel file.',
          });
        }
      } else if (req.body.data) {
        // Use data from body (legacy support)
        data = Array.isArray(req.body.data) ? req.body.data : [];
        fieldMapping = req.body.fieldMapping || [];
        options = req.body.options || {};
      }

      if (!data || data.length === 0) {
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
          // STEP 1: First normalize the original row using field aliases
          // This handles variations like "Call Number" -> "location", "Barcode" -> "accession_no", etc.
          const normalizedRow = normalizeBookRow(row);

          // STEP 2: Create book data object based on field mapping or auto-mapping
          const bookData: any = { ...normalizedRow };

          // Map fields based on the provided mapping (if any)
          if (fieldMapping && Array.isArray(fieldMapping)) {
            fieldMapping.forEach((mapping: any) => {
              if (mapping.source && mapping.target) {
                // Check original row first, then normalized
                const value =
                  row[mapping.source] || normalizedRow[mapping.target];
                if (value) {
                  bookData[mapping.target] = value;
                }
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

            // Apply auto-mapping on top of normalized data
            Object.keys(row).forEach(key => {
              const mappedKey =
                autoMapping[key] || key.toLowerCase().replace(/\s+/g, '_');
              if (row[key]) {
                bookData[mappedKey] = row[key];
              }
            });
          }

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

          // Default to allowing updates for better import experience
          const allowUpdates = options.allowUpdates !== false;

          if (existingBook && !allowUpdates) {
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
              ? isNaN(parseInt(bookData.available_copies))
                ? 1
                : parseInt(bookData.available_copies)
              : 1,
            total_copies: bookData.total_copies
              ? isNaN(parseInt(bookData.total_copies))
                ? 1
                : parseInt(bookData.total_copies)
              : 1,
            cost_price: bookData.cost_price
              ? isNaN(parseFloat(bookData.cost_price))
                ? null
                : parseFloat(bookData.cost_price)
              : null,
            edition: bookData.edition || null,
            pages: bookData.pages || null,
            remarks: bookData.remarks || null,
            source_of_fund: bookData.source_of_fund || null,
            volume: bookData.volume || null,
            year: bookData.year
              ? isNaN(parseInt(bookData.year))
                ? null
                : parseInt(bookData.year)
              : null,
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
          if (existingBook && allowUpdates) {
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

// Fix students endpoint - updates last_name from CSV for existing records
// This is useful when data was imported with wrong field mappings
router.post(
  '/fix-students',
  authenticate,
  requireRole(['LIBRARIAN']),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }

    try {
      const xlsx: any = await import('xlsx');
      const wb = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!json || json.length < 2) {
        return res
          .status(400)
          .json({ success: false, message: 'Empty or invalid file' });
      }

      const headers = (json[0] as any[]).map((h: any) => String(h).trim());
      const dataRows = (json.slice(1) as any[][]).filter(row =>
        row.some(
          cell =>
            cell !== null &&
            cell !== undefined &&
            String(cell).trim().length > 0,
        ),
      );

      let updated = 0;
      let notFound = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = String(dataRows[i][idx] ?? '').trim();
        });

        // Normalize to get standard field names
        const normalized = normalizeStudentRow(row);

        if (!normalized.student_id) {
          errors.push(`Row ${i + 2}: No student ID found`);
          continue;
        }

        // Find the student by student_id
        const existing = await prisma.students.findUnique({
          where: { student_id: normalized.student_id },
        });

        if (!existing) {
          notFound++;
          continue;
        }

        // Update the student's last_name
        if (
          normalized.last_name &&
          normalized.last_name !== existing.last_name
        ) {
          await prisma.students.update({
            where: { id: existing.id },
            data: {
              last_name: normalized.last_name,
              // Also update first_name if it's different (in case that was also wrong)
              first_name: normalized.first_name || existing.first_name,
            },
          });
          updated++;
        }
      }

      logger.info('Fix students completed', {
        updated,
        notFound,
        errors: errors.length,
      });

      return res.json({
        success: true,
        message: `Updated ${updated} records. ${notFound} not found in database.`,
        updated,
        notFound,
        errors: errors.length > 0 ? errors.slice(0, 10) : [],
      });
    } catch (error) {
      logger.error('Error fixing students:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fix students',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
          let headerIndex = headers.indexOf(mapping.sourceField);

          // Fallback: Try loose matching (case-insensitive, trimmed)
          if (headerIndex === -1) {
            headerIndex = headers.findIndex(
              h =>
                h.trim().toLowerCase() ===
                mapping.sourceField.trim().toLowerCase(),
            );
          }

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
        // Normalize field names using the helper function
        // This handles CSV columns like "Surname" -> "last_name", "User ID" -> "student_id", etc.
        const normalized = normalizeStudentRow(obj);

        // Relaxed validation: Check if row has ANY data
        const hasData = Object.values(obj).some(
          val => val && val.trim().length > 0,
        );

        const rec: any = {
          rowNumber: i + 1,
          student_id: normalized.student_id || '',
          barcode: normalized.barcode || normalized.student_id || '',
          first_name: normalized.first_name || '',
          last_name: normalized.last_name || '',
          grade_level: normalized.grade_level || '',
          section: normalized.section || '',
          email: normalized.email || '',
          phone: normalized.phone || '',
          parent_name: normalized.parent_name || '',
          parent_phone: normalized.parent_phone || '',
          parent_email: normalized.parent_email || '',
          address: normalized.address || '',
          emergency_contact: normalized.emergency_contact || '',
          notes: normalized.notes || '',
          designation: normalized.designation || '',
          gender: normalized.gender || '',
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
        if (!rec.student_id) {
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

    // DEBUG: Log field mappings received
    logger.info('Import field mappings received:', {
      mappingCount: fieldMappings.length,
      mappings: fieldMappings.map(m => `${m.sourceField} -> ${m.targetField}`),
    });

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
      importedStudents: 0,
      importedPersonnel: 0,
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

        // FIRST: Normalize from original row to handle CSV column aliases like "Surname" -> "last_name"
        // This must happen BEFORE field mappings so we don't lose the original column names
        const normalizedFromRow = normalizeStudentRow(row);

        const mapped: any = {};

        // DEBUG: Log first row mapping
        if (currentRowIdx === 0) {
          logger.info('First row mapping debug:', {
            headers,
            row,
            normalizedFromRow,
            fieldMappingsCount: fieldMappings?.length || 0,
          });
        }

        if (fieldMappings && fieldMappings.length > 0) {
          fieldMappings.forEach(m => {
            // Find matching key in row (loose match)
            let sourceKey = m.sourceField;
            if (!Object.prototype.hasOwnProperty.call(row, sourceKey)) {
              const foundKey = Object.keys(row).find(
                k =>
                  k.trim().toLowerCase() === m.sourceField.trim().toLowerCase(),
              );
              if (foundKey) {
                sourceKey = foundKey;
              }
            }

            if (Object.prototype.hasOwnProperty.call(row, sourceKey)) {
              mapped[m.targetField] = row[sourceKey];
              // DEBUG: Log first row field mapping
              if (currentRowIdx === 0) {
                logger.info(
                  `Mapped field: ${m.sourceField} -> ${m.targetField} = "${row[sourceKey]}"`,
                );
              }
            } else if (currentRowIdx === 0) {
              logger.warn(
                `Field not found in row: ${m.sourceField} (looking for ${m.targetField})`,
              );
            }
          });
        } else {
          Object.assign(mapped, row);
        }

        // Apply normalized values to fill gaps - normalizedFromRow has standard field names
        // Only apply if the mapped field is empty/missing
        for (const [key, value] of Object.entries(normalizedFromRow)) {
          if (!mapped[key] || String(mapped[key]).trim() === '') {
            mapped[key] = value;
          }
        }

        // DEBUG: Log first row final mapped object
        if (currentRowIdx === 0) {
          logger.info('First row final mapped object:', mapped);
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
          // Normalization already happened in step 1, so mapped already has standard field names

          // Detect if this is a Personnel entry (User ID starting with PN or designation is Personnel/Staff)
          const studentIdUpper = String(mapped.student_id || '')
            .trim()
            .toUpperCase();
          const designationUpper = String(mapped.designation || '')
            .trim()
            .toUpperCase();

          const isPersonnel =
            studentIdUpper.startsWith('PN') ||
            designationUpper.includes('PERSONNEL') ||
            designationUpper.includes('STAFF');

          // Handle full_name splitting if first/last are missing (additional check)
          if (mapped.full_name && (!mapped.first_name || !mapped.last_name)) {
            const parts = String(mapped.full_name).trim().split(' ');
            if (parts.length > 0) {
              if (!mapped.first_name) {
                mapped.first_name = parts[0];
              }
              if (!mapped.last_name) {
                mapped.last_name = parts.slice(1).join(' ');
              }
            }
          }

          // Use User ID as barcode if no barcode is provided
          // Many schools use User ID as the barcode/library card number
          if (!mapped.barcode && mapped.student_id) {
            mapped.barcode = String(mapped.student_id).trim();
          }

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
          const isTempId = String(mapped.student_id).startsWith('TEMP_');
          const canUseStudentId =
            !providedBarcode &&
            !existing?.barcode &&
            mapped.student_id &&
            !isTempId;
          const needsNewBarcode =
            !providedBarcode && !existing?.barcode && !canUseStudentId;

          return {
            valid: true,
            mapped,
            existing,
            needsNewBarcode,
            providedBarcode,
            rowIdx: currentRowIdx,
            isPersonnel,
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
              isPersonnel,
            } = ctx;
            let barcode = providedBarcode;

            if (!barcode) {
              if (existing?.barcode) {
                barcode = existing.barcode;
              } else {
                const isTempId = String(mapped.student_id).startsWith('TEMP_');
                if (!isTempId && mapped.student_id) {
                  barcode = String(mapped.student_id);
                } else if (needsNewBarcode) {
                  const seq = nextSeq + 1 + barcodeOffset;
                  barcodeOffset++;
                  barcode = `PN${String(seq).padStart(5, '0')}`;
                  result.generated.push({ row: rowIdx + 1, barcode });
                }
              }
            }

            const createData = {
              student_id: String(mapped.student_id),
              type: isPersonnel ? 'PERSONNEL' : 'STUDENT',
              first_name: String(mapped.first_name),
              last_name: String(mapped.last_name),
              grade_level: (() => {
                const val = String(mapped.grade_level || '').toUpperCase();
                const designation = String(
                  mapped.designation || '',
                ).toUpperCase();

                // Personnel/Staff default to 0
                if (
                  designation.includes('PERSONNEL') ||
                  designation.includes('STAFF')
                ) {
                  return 0;
                }

                if (
                  val.includes('NURSERY') ||
                  val.includes('KINDER') ||
                  val.includes('PRE')
                ) {
                  return 0;
                }

                // Handle year ranges like "2025-2026" or "20242025"
                // If the number is suspiciously large (e.g. > 100), treat as 0
                const num = parseInt(val.replace(/[^0-9]/g, ''));
                if (isNaN(num) || num > 12) {
                  return 0;
                }
                return num;
              })(),
              email: mapped.email || null,
              gender: mapped.gender || null,
              barcode,
              grade_category: mapped.grade_category || null,
              // is_active should be false by default - students become active only when they scan in
              is_active: false,
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
            if (isPersonnel) {
              result.importedPersonnel++;
            } else {
              result.importedStudents++;
            }
          } catch (err) {
            // If unique constraint fails (race condition despite deduplication), try update
            if ((err as any)?.code === 'P2002') {
              try {
                await prisma.students.update({
                  where: { student_id: String(ctx.mapped.student_id) },
                  data: {
                    first_name: String(ctx.mapped.first_name),
                    last_name: String(ctx.mapped.last_name),
                    type: (ctx as any).isPersonnel ? 'PERSONNEL' : 'STUDENT',
                  },
                });
                result.importedRecords++;
                if ((ctx as any).isPersonnel) {
                  result.importedPersonnel++;
                } else {
                  result.importedStudents++;
                }
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
          students: result.importedStudents,
          personnel: result.importedPersonnel,
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
            // Find matching key in row (loose match)
            let sourceKey = m.sourceField;
            if (!Object.prototype.hasOwnProperty.call(row, sourceKey)) {
              const foundKey = Object.keys(row).find(
                k =>
                  k.trim().toLowerCase() === m.sourceField.trim().toLowerCase(),
              );
              if (foundKey) {
                sourceKey = foundKey;
              }
            }

            if (Object.prototype.hasOwnProperty.call(row, sourceKey)) {
              mapped[m.targetField] = row[sourceKey];
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
