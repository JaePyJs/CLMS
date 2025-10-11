import { createReadStream } from 'fs';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';
import { parse } from 'csv-parse';
import { GradeCategory, EquipmentType, EquipmentStatus } from '@prisma/client';

// Import result interface
export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: string[];
}

// Student import data interface
interface StudentImportData {
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gradeCategory: string;
  section?: string;
}

// Book import data interface
interface BookImportData {
  accessionNo: string;
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  totalCopies: number;
}

// Equipment import data interface
interface EquipmentImportData {
  equipmentId: string;
  name: string;
  type: string;
  location: string;
  maxTimeMinutes: number;
  requiresSupervision?: string;
  description?: string;
}

// Import service class
export class ImportService {
  // Import students from CSV file
  async importStudents(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting student import from ${filePath}`);

      const records = await this.parseCsvFile<StudentImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (
            !record.studentId ||
            !record.firstName ||
            !record.lastName ||
            !record.gradeLevel ||
            !record.gradeCategory
          ) {
            result.errors.push(
              `Missing required fields for student: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Validate grade category
          if (
            !Object.values(GradeCategory).includes(
              record.gradeCategory as GradeCategory,
            )
          ) {
            result.errors.push(
              `Invalid grade category: ${record.gradeCategory} for student: ${record.studentId}`,
            );
            result.errorRecords++;
            continue;
          }

          // Check if student already exists
          const existingStudent = await prisma.student.findUnique({
            where: { studentId: record.studentId },
          });

          if (existingStudent) {
            logger.info(
              `Student already exists, skipping: ${record.studentId}`,
            );
            result.skippedRecords++;
            continue;
          }

          // Create student
          await prisma.student.create({
            data: {
              studentId: record.studentId,
              firstName: record.firstName,
              lastName: record.lastName,
              gradeLevel: record.gradeLevel,
              gradeCategory: record.gradeCategory as GradeCategory,
              section: record.section || null,
            },
          });

          result.importedRecords++;
          logger.info(`Imported student: ${record.studentId}`);
        } catch (error) {
          const errorMessage = `Error importing student ${record.studentId}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Student import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import students', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Import books from CSV file
  async importBooks(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting book import from ${filePath}`);

      const records = await this.parseCsvFile<BookImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (
            !record.accessionNo ||
            !record.title ||
            !record.author ||
            !record.category ||
            !record.totalCopies
          ) {
            result.errors.push(
              `Missing required fields for book: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Check if book already exists
          const existingBook = await prisma.book.findUnique({
            where: { accessionNo: record.accessionNo },
          });

          if (existingBook) {
            logger.info(`Book already exists, skipping: ${record.accessionNo}`);
            result.skippedRecords++;
            continue;
          }

          // Create book
          await prisma.book.create({
            data: {
              accessionNo: record.accessionNo,
              isbn: record.isbn || null,
              title: record.title,
              author: record.author,
              publisher: record.publisher || null,
              category: record.category,
              subcategory: record.subcategory || null,
              location: record.location || null,
              totalCopies: record.totalCopies,
              availableCopies: record.totalCopies,
            },
          });

          result.importedRecords++;
          logger.info(`Imported book: ${record.accessionNo}`);
        } catch (error) {
          const errorMessage = `Error importing book ${record.accessionNo}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Book import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import books', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Import equipment from CSV file
  async importEquipment(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
    };

    try {
      logger.info(`Starting equipment import from ${filePath}`);

      const records = await this.parseCsvFile<EquipmentImportData>(filePath);
      result.totalRecords = records.length;

      for (const record of records) {
        try {
          // Validate required fields
          if (
            !record.equipmentId ||
            !record.name ||
            !record.type ||
            !record.location ||
            !record.maxTimeMinutes
          ) {
            result.errors.push(
              `Missing required fields for equipment: ${JSON.stringify(record)}`,
            );
            result.errorRecords++;
            continue;
          }

          // Validate equipment type
          if (
            !Object.values(EquipmentType).includes(record.type as EquipmentType)
          ) {
            result.errors.push(
              `Invalid equipment type: ${record.type} for equipment: ${record.equipmentId}`,
            );
            result.errorRecords++;
            continue;
          }

          // Parse requiresSupervision
          const requiresSupervision =
            record.requiresSupervision?.toLowerCase() === 'yes' ||
            record.requiresSupervision?.toLowerCase() === 'true';

          // Check if equipment already exists
          const existingEquipment = await prisma.equipment.findUnique({
            where: { equipmentId: record.equipmentId },
          });

          if (existingEquipment) {
            logger.info(
              `Equipment already exists, skipping: ${record.equipmentId}`,
            );
            result.skippedRecords++;
            continue;
          }

          // Create equipment
          await prisma.equipment.create({
            data: {
              equipmentId: record.equipmentId,
              name: record.name,
              type: record.type as EquipmentType,
              location: record.location,
              maxTimeMinutes: record.maxTimeMinutes,
              requiresSupervision,
              description: record.description || null,
              status: EquipmentStatus.AVAILABLE,
            },
          });

          result.importedRecords++;
          logger.info(`Imported equipment: ${record.equipmentId}`);
        } catch (error) {
          const errorMessage = `Error importing equipment ${record.equipmentId}: ${(error as Error).message}`;
          result.errors.push(errorMessage);
          result.errorRecords++;
          logger.error(errorMessage);
        }
      }

      logger.info(`Equipment import completed`, {
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        errorRecords: result.errorRecords,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import equipment', {
        error: (error as Error).message,
      });
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  // Parse CSV file
  private async parseCsvFile<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const records: T[] = [];

      createReadStream(filePath)
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
          }),
        )
        .on('data', (record: unknown) => {
          records.push(record as T);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  // Get sample CSV templates
  getStudentTemplate(): string {
    return `studentId,firstName,lastName,gradeLevel,gradeCategory,section
2023001,John,Doe,Grade 7,JUNIOR_HIGH,7-A
2023002,Jane,Smith,Grade 8,JUNIOR_HIGH,8-B`;
  }

  getBookTemplate(): string {
    return `accessionNo,isbn,title,author,publisher,category,subcategory,location,totalCopies
ACC-001,978-0-13-468599-1,Effective Java,Joshua Bloch,Addison-Wesley,Programming,Java,Stack A,2
ACC-002,978-1-4919-0409-0,Design Patterns,Erich Gamma,Addison-Wesley,Programming,OOP,Stack B,1`;
  }

  getEquipmentTemplate(): string {
    return `equipmentId,name,type,location,maxTimeMinutes,requiresSupervision,description
COMP-01,Desktop Computer 1,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
COMP-02,Desktop Computer 2,COMPUTER,Computer Lab,60,No,Intel i5 with 8GB RAM
GAME-01,PlayStation 5,GAMING,Gaming Room,30,Yes,Sony PlayStation 5 with controller`;
  }
}

// Create and export singleton instance
export const importService = new ImportService();
export default importService;
