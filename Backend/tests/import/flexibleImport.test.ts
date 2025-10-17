import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ImportService } from '@/services/importService';
import { DataTransformationPipeline } from '@/utils/dataTransformationPipeline';
import { TypeInference } from '@/utils/typeInference';
import { StudentsRepository } from '@/repositories/students.repository';
import { BooksRepository } from '@/repositories/books.repository';
import { EquipmentRepository } from '@/repositories/equipment.repository';
import { prisma } from '@/utils/prisma';
import * as fs from 'fs';
import * as path from 'path';

describe('Flexible Import Functionality Tests', () => {
  let importService: ImportService;
  let transformationPipeline: DataTransformationPipeline;
  let typeInference: TypeInference;
  let studentsRepository: StudentsRepository;
  let booksRepository: BooksRepository;
  let equipmentRepository: EquipmentRepository;

  const testDataDir = path.join(__dirname, 'data');
  const outputDir = path.join(__dirname, 'reports');

  beforeEach(() => {
    // Initialize services
    importService = new ImportService();
    transformationPipeline = new DataTransformationPipeline({
      strictMode: false,
      logLevel: 'error'
    });
    typeInference = new TypeInference({
      strictMode: false,
      logLevel: 'error'
    });
    studentsRepository = new StudentsRepository();
    booksRepository = new BooksRepository();
    equipmentRepository = new EquipmentRepository();

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  describe('Student Import Tests', () => {
    it('should import students with various ID formats', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      
      // Verify various ID formats were processed
      const students = await studentsRepository.getStudents({ limit: 100 });
      expect(students.students.length).toBeGreaterThan(0);
      
      // Check for different ID formats
      const studentIds = students.students.map(s => s.student_id);
      expect(studentIds.some(id => id.startsWith('STU'))).toBe(true);
      expect(studentIds.some(id => id.includes('-'))).toBe(true);
      expect(studentIds.some(id => id.includes('_'))).toBe(true);
      expect(studentIds.some(id => /^\d+$/.test(id))).toBe(true);
    });

    it('should handle various grade level formats', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);

      expect(result.success).toBe(true);
      
      // Verify grade levels were processed correctly
      const students = await studentsRepository.getStudents({ limit: 100 });
      const gradeLevels = students.students.map(s => s.grade_level);
      
      // Check for various grade level formats
      expect(gradeLevels.some(gl => gl === '8')).toBe(true);
      expect(gradeLevels.some(gl => gl === 'Grade 8')).toBe(true);
      expect(gradeLevels.some(gl => gl === 'G8')).toBe(true);
    });

    it('should auto-determine grade categories', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);

      expect(result.success).toBe(true);
      
      // Verify grade categories were assigned correctly
      const juniorHighStudents = await studentsRepository.findByGradeCategory('JUNIOR_HIGH');
      const seniorHighStudents = await studentsRepository.findByGradeCategory('SENIOR_HIGH');
      
      expect(juniorHighStudents.length).toBeGreaterThan(0);
      expect(seniorHighStudents.length).toBeGreaterThan(0);
    });

    it('should handle various name formats', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);

      expect(result.success).toBe(true);
      
      // Verify names were parsed correctly
      const students = await studentsRepository.getStudents({ limit: 100 });
      expect(students.students.length).toBeGreaterThan(0);
      
      // Check for various name formats
      const studentsWithMiddleInitial = students.students.filter(s => 
        s.first_name.includes(' ') || s.last_name.includes('-')
      );
      expect(studentsWithMiddleInitial.length).toBeGreaterThan(0);
    });
  });

  describe('Book Import Tests', () => {
    it('should import books with various accession number formats', async () => {
      const filePath = path.join(testDataDir, 'test_books_various_ids.csv');
      const result = await importService.importBooks(filePath);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      
      // Verify various accession number formats were processed
      const books = await booksRepository.getBooks({ limit: 100 });
      expect(books.books.length).toBeGreaterThan(0);
      
      // Check for different accession number formats
      const accessionNos = books.books.map(b => b.accession_no);
      expect(accessionNos.some(id => id.startsWith('ACC'))).toBe(true);
      expect(accessionNos.some(id => id.includes('-'))).toBe(true);
      expect(accessionNos.some(id => id.includes('_'))).toBe(true);
      expect(accessionNos.some(id => /^\d+$/.test(id))).toBe(true);
    });

    it('should handle various ISBN formats', async () => {
      const filePath = path.join(testDataDir, 'test_books_various_ids.csv');
      const result = await importService.importBooks(filePath);

      expect(result.success).toBe(true);
      
      // Verify ISBNs were processed correctly
      const books = await booksRepository.getBooks({ limit: 100 });
      const isbns = books.books.map(b => b.isbn).filter(Boolean);
      
      // Check for various ISBN formats
      expect(isbns.some(isbn => isbn && isbn.includes('-'))).toBe(true);
      expect(isbns.some(isbn => isbn && isbn.length === 13)).toBe(true);
      expect(isbns.some(isbn => isbn && isbn.length === 10)).toBe(true);
    });

    it('should parse cost prices correctly', async () => {
      const filePath = path.join(testDataDir, 'test_books_various_ids.csv');
      const result = await importService.importBooks(filePath);

      expect(result.success).toBe(true);
      
      // Verify cost prices were parsed correctly
      const books = await booksRepository.getBooks({ limit: 100 });
      const booksWithPrices = books.books.filter(b => b.cost_price !== null);
      
      expect(booksWithPrices.length).toBeGreaterThan(0);
      expect(booksWithPrices.every(b => typeof b.cost_price === 'number')).toBe(true);
    });

    it('should handle publication year formats', async () => {
      const filePath = path.join(testDataDir, 'test_books_various_ids.csv');
      const result = await importService.importBooks(filePath);

      expect(result.success).toBe(true);
      
      // Verify publication years were parsed correctly
      const books = await booksRepository.getBooks({ limit: 100 });
      const booksWithYears = books.books.filter(b => b.year !== null);
      
      expect(booksWithYears.length).toBeGreaterThan(0);
      expect(booksWithYears.every(b => typeof b.year === 'number')).toBe(true);
      expect(booksWithYears.every(b => b.year! >= 1900 && b.year! <= 2100)).toBe(true);
    });
  });

  describe('Equipment Import Tests', () => {
    it('should import equipment with various ID formats', async () => {
      const filePath = path.join(testDataDir, 'test_equipment_various_ids.csv');
      const result = await importService.importEquipment(filePath);

      expect(result.success).toBe(true);
      expect(result.importedRecords).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      
      // Verify various equipment ID formats were processed
      const equipment = await equipmentRepository.getEquipment({ limit: 100 });
      expect(equipment.equipment.length).toBeGreaterThan(0);
      
      // Check for different equipment ID formats
      const equipmentIds = equipment.equipment.map(e => e.equipment_id);
      expect(equipmentIds.some(id => id.startsWith('EQ'))).toBe(true);
      expect(equipmentIds.some(id => id.includes('-'))).toBe(true);
      expect(equipmentIds.some(id => id.includes('_'))).toBe(true);
      expect(equipmentIds.some(id => /^\d+$/.test(id))).toBe(true);
    });

    it('should handle various equipment types', async () => {
      const filePath = path.join(testDataDir, 'test_equipment_various_ids.csv');
      const result = await importService.importEquipment(filePath);

      expect(result.success).toBe(true);
      
      // Verify equipment types were processed correctly
      const equipment = await equipmentRepository.getEquipment({ limit: 100 });
      const types = [...new Set(equipment.equipment.map(e => e.type))];
      
      expect(types.length).toBeGreaterThan(1);
      expect(types.includes('computer')).toBe(true);
      expect(types.includes('projector')).toBe(true);
    });

    it('should parse max time minutes correctly', async () => {
      const filePath = path.join(testDataDir, 'test_equipment_various_ids.csv');
      const result = await importService.importEquipment(filePath);

      expect(result.success).toBe(true);
      
      // Verify max time minutes were parsed correctly
      const equipment = await equipmentRepository.getEquipment({ limit: 100 });
      expect(equipment.equipment.every(e => typeof e.max_time_minutes === 'number')).toBe(true);
      expect(equipment.equipment.every(e => e.max_time_minutes > 0)).toBe(true);
    });

    it('should handle supervision requirements', async () => {
      const filePath = path.join(testDataDir, 'test_equipment_various_ids.csv');
      const result = await importService.importEquipment(filePath);

      expect(result.success).toBe(true);
      
      // Verify supervision requirements were processed
      const equipment = await equipmentRepository.getEquipment({ limit: 100 });
      const supervisedEquipment = equipment.equipment.filter(e => e.requires_supervision);
      const unsupervisedEquipment = equipment.equipment.filter(e => !e.requires_supervision);
      
      expect(supervisedEquipment.length).toBeGreaterThan(0);
      expect(unsupervisedEquipment.length).toBeGreaterThan(0);
    });
  });

  describe('Type Inference Tests', () => {
    it('should infer various numeric formats', () => {
      const testValues = [
        '123', '123.45', '1,234', '1,234.56', '$123.45', '123%'
      ];
      
      testValues.forEach(value => {
        const result = typeInference.convertValue(value, 'number');
        expect(result.success).toBe(true);
        expect(typeof result.value).toBe('number');
      });
    });

    it('should infer various date formats', () => {
      const testValues = [
        '01/15/2024', '15/01/2024', '2024-01-15', 'Jan 15, 2024', '15-Jan-2024', '2024'
      ];
      
      testValues.forEach(value => {
        const result = typeInference.convertValue(value, 'date');
        expect(result.success).toBe(true);
        expect(result.value).toBeInstanceOf(Date);
      });
    });

    it('should infer various boolean formats', () => {
      const testValues = [
        'true', 'false', 'yes', 'no', '1', '0', 'y', 'n', 'on', 'off'
      ];
      
      testValues.forEach(value => {
        const result = typeInference.convertValue(value, 'boolean');
        expect(result.success).toBe(true);
        expect(typeof result.value).toBe('boolean');
      });
    });

    it('should handle ID type inference', () => {
      const testIds = [
        'STU001', '2024-001', 'STU_2024_001', '12345', 'ABC123XYZ'
      ];
      
      testIds.forEach(id => {
        const result = typeInference.convertValue(id, 'id');
        expect(result.success).toBe(true);
        expect(typeof result.value).toBe('string');
      });
    });

    it('should infer email formats', () => {
      const testEmails = [
        'test@example.com', 'user+tag@domain.com', 'user.name@sub.domain.com'
      ];
      
      testEmails.forEach(email => {
        const result = typeInference.convertValue(email, 'email');
        expect(result.success).toBe(true);
        expect(typeof result.value).toBe('string');
      });
    });

    it('should handle invalid formats gracefully', () => {
      const invalidEmail = 'invalid-email';
      const result = typeInference.convertValue(invalidEmail, 'email');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Data Transformation Pipeline Tests', () => {
    it('should process CSV files through pipeline', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await transformationPipeline.processFile(filePath, 'students');
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.fieldMappings).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('should handle field name variations', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await transformationPipeline.processFile(filePath, 'students');
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.fieldMappings).length).toBeGreaterThan(0);
    });

    it('should handle missing fields gracefully', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await transformationPipeline.processFile(filePath, 'students');
      
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should provide transformation statistics', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await transformationPipeline.processFile(filePath, 'students');
      
      expect(result.statistics).toBeDefined();
      expect(result.statistics.typeConversions).toBeDefined();
      expect(result.statistics.validationErrors).toBeDefined();
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle missing required fields', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errorRecords).toBeGreaterThan(0);
    });

    it('should handle invalid data formats', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle duplicate IDs gracefully', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.updatedRecords).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('already exists'))).toBe(true);
    });

    it('should handle very long fields', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    it('should handle special characters in names', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.success).toBe(true);
      expect(result.importedRecords).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      const filePath = path.join(testDataDir, 'test_large_dataset.csv');
      const result = await importService.importStudents(filePath);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.importedRecords).toBeGreaterThan(400);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should track progress during large imports', async () => {
      const filePath = path.join(testDataDir, 'test_large_dataset.csv');
      const progressUpdates: any[] = [];
      
      // Mock progress tracking
      const originalProcessFile = transformationPipeline.processFile.bind(transformationPipeline);
      transformationPipeline.processFile = async (...args) => {
        const result = await originalProcessFile(...args);
        progressUpdates.push(transformationPipeline.getProgress());
        return result;
      };
      
      await importService.importStudents(filePath);
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.every(p => p.totalRows > 0)).toBe(true);
    });

    it('should handle memory efficiently during large imports', async () => {
      const filePath = path.join(testDataDir, 'test_large_dataset.csv');
      const initialMemory = process.memoryUsage();
      
      await importService.importStudents(filePath);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Enum Validation Tests', () => {
    it('should validate grade categories with fallback', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.success).toBe(true);
      
      // Verify grade categories are valid enum values
      const students = await studentsRepository.getStudents({ limit: 100 });
      const gradeCategories = students.students.map(s => s.grade_category);
      
      expect(gradeCategories.every(gc => gc === 'JUNIOR_HIGH' || gc === 'SENIOR_HIGH')).toBe(true);
    });

    it('should handle various enum input formats', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('grade category'))).toBe(true);
    });

    it('should provide fallback for invalid enum values', async () => {
      const filePath = path.join(testDataDir, 'test_edge_cases.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.errors.some(e => e.includes('Invalid grade level'))).toBe(true);
    });
  });

  describe('Import Service Integration Tests', () => {
    it('should preview import data correctly', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const preview = await importService.previewFile(filePath);
      
      expect(preview.headers.length).toBeGreaterThan(0);
      expect(preview.rows.length).toBeGreaterThan(0);
      expect(preview.suggestedMappings.length).toBeGreaterThan(0);
      expect(preview.fileType).toBe('csv');
    });

    it('should handle field mapping during import', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const fieldMappings = [
        { sourceField: 'name', targetField: 'name', required: true },
        { sourceField: 'grade_level', targetField: 'grade_level', required: true },
        { sourceField: 'section', targetField: 'section', required: true }
      ];
      
      const result = await importService.importStudentsWithMapping(filePath, fieldMappings);
      
      expect(result.success).toBe(true);
      expect(result.importedRecords).toBeGreaterThan(0);
    });

    it('should generate import statistics', async () => {
      const filePath = path.join(testDataDir, 'test_students_various_ids.csv');
      const result = await importService.importStudents(filePath);
      
      expect(result.transformationStats).toBeDefined();
      expect(result.transformationStats?.typeConversions).toBeDefined();
      expect(result.transformationStats?.fieldMappings).toBeDefined();
      expect(result.transformationStats?.processingTime).toBeDefined();
    });
  });

  // Helper function to clean up test data
  async function cleanupTestData() {
    try {
      // Clean up test students
      const testStudents = await prisma.students.findMany({
        where: {
          student_id: {
            startsWith: 'STU',
            contains: 'TEST'
          }
        }
      });
      
      for (const student of testStudents) {
        await prisma.students.delete({
          where: { id: student.id }
        });
      }
      
      // Clean up test books
      const testBooks = await prisma.books.findMany({
        where: {
          accession_no: {
            startsWith: 'ACC',
            contains: 'TEST'
          }
        }
      });
      
      for (const book of testBooks) {
        await prisma.books.delete({
          where: { id: book.id }
        });
      }
      
      // Clean up test equipment
      const testEquipment = await prisma.equipment.findMany({
        where: {
          equipment_id: {
            startsWith: 'EQ',
            contains: 'TEST'
          }
        }
      });
      
      for (const equipment of testEquipment) {
        await prisma.equipment.delete({
          where: { id: equipment.id }
        });
      }
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }
});