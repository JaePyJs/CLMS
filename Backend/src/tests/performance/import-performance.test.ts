import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { measureExecutionTime, runLoadTest } from '../helpers/testUtils';
import { ImportService } from '@/services/importService';
import { DataTransformationPipeline } from '@/utils/dataTransformationPipeline';
import { TypeInference } from '@/utils/typeInference';
import { cleanupDatabase } from '../helpers/testUtils';

describe('Import Performance Tests', () => {
  let importService: ImportService;
  let transformationPipeline: DataTransformationPipeline;
  let typeInference: TypeInference;
  const testDir = join(process.cwd(), 'test-data-imports');

  beforeAll(async () => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
    
    importService = new ImportService();
    transformationPipeline = new DataTransformationPipeline({
      logLevel: 'info',
      strictMode: false,
      maxErrors: 100,
      skipInvalidRows: true,
      batchSize: 50
    });
    
    typeInference = new TypeInference({
      strictMode: false,
      logLevel: 'info'
    });

    // Clean up database before tests
    await cleanupDatabase();
  });

  afterAll(async () => {
    // Clean up test files
    try {
      const files = ['test-students-100.csv', 'test-students-1000.csv', 'test-students-5000.csv',
                   'test-books-100.csv', 'test-books-1000.csv', 'test-books-5000.csv',
                   'test-equipment-100.csv', 'test-equipment-1000.csv', 'test-equipment-5000.csv'];
      
      files.forEach(file => {
        try {
          unlinkSync(join(testDir, file));
        } catch (error) {
          // File might not exist, ignore
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    await cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await cleanupDatabase();
  });

  describe('CSV Import Performance', () => {
    it('should handle small student CSV imports efficiently', async () => {
      const filePath = join(testDir, 'test-students-100.csv');
      const recordCount = 100;

      // Generate test CSV data
      const csvData = [
        'name,grade_level,section'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        csvData.push(`Test Student ${i},Grade ${((i % 6) + 7)},${String.fromCharCode(65 + (i % 4))}`);
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importStudents(filePath);
        
        console.log(`Small student import results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records imported: ${result.importedRecords}`);
        console.log(`  Errors: ${result.errorRecords}`);
        console.log(`  Processing time: ${result.transformationStats?.processingTime}ms`);
        
        expect(result.success).toBe(true);
        expect(result.importedRecords).toBe(recordCount);
        expect(result.errorRecords).toBe(0);
      });

      const recordsPerSecond = recordCount / (duration / 1000);
      
      console.log(`Small student import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(recordsPerSecond).toBeGreaterThan(50); // Should handle at least 50 records/second
    });

    it('should handle medium student CSV imports efficiently', async () => {
      const filePath = join(testDir, 'test-students-1000.csv');
      const recordCount = 1000;

      // Generate test CSV data
      const csvData = [
        'name,grade_level,section'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        csvData.push(`Test Student ${i},Grade ${((i % 6) + 7)},${String.fromCharCode(65 + (i % 4))}`);
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importStudents(filePath);
        
        console.log(`Medium student import results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records imported: ${result.importedRecords}`);
        console.log(`  Errors: ${result.errorRecords}`);
        
        expect(result.success).toBe(true);
        expect(result.importedRecords).toBe(recordCount);
        expect(result.errorRecords).toBe(0);
      });

      const recordsPerSecond = recordCount / (duration / 1000);
      
      console.log(`Medium student import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(recordsPerSecond).toBeGreaterThan(100); // Should handle at least 100 records/second
    });

    it('should handle large student CSV imports efficiently', async () => {
      const filePath = join(testDir, 'test-students-5000.csv');
      const recordCount = 5000;

      // Generate test CSV data
      const csvData = [
        'name,grade_level,section'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        csvData.push(`Test Student ${i},Grade ${((i % 6) + 7)},${String.fromCharCode(65 + (i % 4))}`);
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importStudents(filePath);
        
        console.log(`Large student import results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records imported: ${result.importedRecords}`);
        console.log(`  Errors: ${result.errorRecords}`);
        
        expect(result.success).toBe(true);
        expect(result.importedRecords).toBe(recordCount);
        expect(result.errorRecords).toBe(0);
      });

      const recordsPerSecond = recordCount / (duration / 1000);
      
      console.log(`Large student import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(recordsPerSecond).toBeGreaterThan(150); // Should handle at least 150 records/second
    });
  });

  describe('Book Import Performance', () => {
    it('should handle large book CSV imports efficiently', async () => {
      const filePath = join(testDir, 'test-books-1000.csv');
      const recordCount = 1000;

      // Generate test CSV data
      const csvData = [
        'accession_no,title,author,publisher,category'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        csvData.push(`ACC${String(i).padStart(6, '0')},Test Book ${i},Test Author ${i},Test Publisher,Fiction`);
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importBooks(filePath);
        
        console.log(`Book import results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records imported: ${result.importedRecords}`);
        console.log(`  Errors: ${result.errorRecords}`);
        
        expect(result.success).toBe(true);
        expect(result.importedRecords).toBe(recordCount);
        expect(result.errorRecords).toBe(0);
      });

      const recordsPerSecond = recordCount / (duration / 1000);
      
      console.log(`Book import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(recordsPerSecond).toBeGreaterThan(60); // Should handle at least 60 records/second
    });
  });

  describe('Equipment Import Performance', () => {
    it('should handle large equipment CSV imports efficiently', async () => {
      const filePath = join(testDir, 'test-equipment-1000.csv');
      const recordCount = 1000;

      // Generate test CSV data
      const csvData = [
        'equipment_id,name,type,location,max_time_minutes'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        csvData.push(`EQ${String(i).padStart(4, '0')},Equipment ${i},COMPUTER,Lab ${((i % 5) + 1)},60`);
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importEquipment(filePath);
        
        console.log(`Equipment import results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records imported: ${result.importedRecords}`);
        console.log(`  Errors: ${result.errorRecords}`);
        
        expect(result.success).toBe(true);
        expect(result.importedRecords).toBe(recordCount);
        expect(result.errorRecords).toBe(0);
      });

      const recordsPerSecond = recordCount / (duration / 1000);
      
      console.log(`Equipment import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(recordsPerSecond).toBeGreaterThan(100); // Should handle at least 100 records/second
    });
  });

  describe('Data Transformation Pipeline Performance', () => {
    it('should handle type inference efficiently', async () => {
      const testData = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        name: `Test ${i}`,
        age: (20 + (i % 50)).toString(),
        active: (i % 2 === 0).toString(),
        score: (Math.random() * 100).toFixed(2),
        date: new Date(Date.now() - i * 1000 * 60).toISOString().split('T')[0]
      }));

      const { duration } = await measureExecutionTime(async () => {
        const result = typeInference.inferTypes(testData);
        
        console.log(`Type inference results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Fields analyzed: ${Object.keys(result.fieldTypes).length}`);
        console.log(`  Processing time: ${result.processingTime}ms`);
        
        expect(result.totalRecords).toBe(testData.length);
        expect(Object.keys(result.fieldTypes).length).toBeGreaterThan(0);
      });

      const recordsPerSecond = testData.length / (duration / 1000);
      
      console.log(`Type inference performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(recordsPerSecond).toBeGreaterThan(200); // Should handle at least 200 records/second
    });

    it('should handle data transformation efficiently', async () => {
      const testData = Array.from({ length: 2000 }, (_, i) => ({
        'Student Name': `Test Student ${i}`,
        'Grade Level': `Grade ${((i % 6) + 7)}`,
        'Section': String.fromCharCode(65 + (i % 4)),
        'Email': `student${i}@test.com`,
        'Phone': `+123456789${String(i).padStart(2, '0')}`
      }));

      const { duration } = await measureExecutionTime(async () => {
        const result = await transformationPipeline.transformData(testData, 'students');
        
        console.log(`Data transformation results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records transformed: ${result.transformedRecords}`);
        console.log(`  Errors: ${result.errors.length}`);
        console.log(`  Processing time: ${result.processingTime}ms`);
        
        expect(result.totalRecords).toBe(testData.length);
        expect(result.transformedRecords).toBe(testData.length);
      });

      const recordsPerSecond = testData.length / (duration / 1000);
      
      console.log(`Data transformation performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(recordsPerSecond).toBeGreaterThan(200); // Should handle at least 200 records/second
    });
  });

  describe('Memory Usage During Imports', () => {
    it('should maintain reasonable memory usage during large imports', async () => {
      const filePath = join(testDir, 'test-students-5000.csv');
      const recordCount = 5000;

      // Generate test CSV data
      const csvData = [
        'name,grade_level,section'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        csvData.push(`Test Student ${i},Grade ${((i % 6) + 7)},${String.fromCharCode(65 + (i % 4))}`);
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const initialMemory = process.memoryUsage().heapUsed;

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importStudents(filePath);
        expect(result.success).toBe(true);
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory usage during large import:`);
      console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      console.log(`  Memory per record: ${(memoryIncrease * 1024 / recordCount).toFixed(2)}KB`);

      // Memory increase should be reasonable for this operation
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
      expect(memoryIncrease / recordCount * 1024).toBeLessThan(50); // Less than 50KB per record
    });

    it('should handle batch processing without memory leaks', async () => {
      const batchSize = 100;
      const batches = 10;
      
      for (let batch = 0; batch < batches; batch++) {
        const filePath = join(testDir, `test-batch-${batch}.csv`);
        const recordCount = batchSize;

        // Generate test CSV data
        const csvData = [
          'name,grade_level,section'
        ];
        
        for (let i = 0; i < recordCount; i++) {
          csvData.push(`Batch ${batch} Student ${i},Grade ${((i % 6) + 7)},${String.fromCharCode(65 + (i % 4))}`);
        }
        
        writeFileSync(filePath, csvData.join('\n'));

        await measureExecutionTime(async () => {
          const result = await importService.importStudents(filePath);
          expect(result.success).toBe(true);
        });

        // Clean up file
        unlinkSync(filePath);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`Batch ${batch + 1} memory usage: ${currentMemory.toFixed(2)}MB`);
      }

      // Memory should not grow significantly across batches
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`Final memory usage after all batches: ${finalMemory.toFixed(2)}MB`);

      // This is a rough check - memory usage should be reasonable
      expect(finalMemory).toBeLessThan(500); // Less than 500MB total
    });
  });

  describe('Concurrent Import Performance', () => {
    it('should handle concurrent import operations', async () => {
      const concurrentImports = 5;
      const recordsPerImport = 200;

      const importPromises = Array.from({ length: concurrentImports }, async (_, i) => {
        const filePath = join(testDir, `concurrent-${i}.csv`);
        
        // Generate test CSV data
        const csvData = [
          'name,grade_level,section'
        ];
        
        for (let j = 0; j < recordsPerImport; j++) {
          csvData.push(`Concurrent ${i} Student ${j},Grade ${((j % 6) + 7)},${String.fromCharCode(65 + (j % 4))}`);
        }
        
        writeFileSync(filePath, csvData.join('\n'));

        return { filePath, importId: i };
      });

      const importFiles = await Promise.all(importPromises);

      const { duration } = await measureExecutionTime(async () => {
        const results = await Promise.all(
          importFiles.map(async ({ filePath, importId }) => {
            const result = await importService.importStudents(filePath);
            
            // Clean up file
            unlinkSync(filePath);
            
            return { importId, result };
          })
        );

        // Verify all imports succeeded
        results.forEach(({ importId, result }) => {
          console.log(`Import ${importId}: ${result.importedRecords} records`);
          expect(result.success).toBe(true);
          expect(result.importedRecords).toBe(recordsPerImport);
        });
      });

      const totalRecords = concurrentImports * recordsPerImport;
      const recordsPerSecond = totalRecords / (duration / 1000);

      console.log(`Concurrent import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Total records: ${totalRecords}`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      expect(recordsPerSecond).toBeGreaterThan(50); // Should handle at least 50 records/second
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid data efficiently', async () => {
      const filePath = join(testDir, 'test-invalid.csv');
      const recordCount = 1000;

      // Generate test CSV data with some invalid records
      const csvData = [
        'name,grade_level,section'
      ];
      
      for (let i = 0; i < recordCount; i++) {
        if (i % 10 === 0) {
          // Invalid record - missing required fields
          csvData.push('Invalid Student');
        } else if (i % 15 === 0) {
          // Invalid record - invalid grade
          csvData.push(`Invalid Student ${i},Invalid Grade,A`);
        } else {
          // Valid record
          csvData.push(`Test Student ${i},Grade ${((i % 6) + 7)},${String.fromCharCode(65 + (i % 4))}`);
        }
      }
      
      writeFileSync(filePath, csvData.join('\n'));

      const { duration } = await measureExecutionTime(async () => {
        const result = await importService.importStudents(filePath);
        
        console.log(`Invalid data import results:`);
        console.log(`  Records processed: ${result.totalRecords}`);
        console.log(`  Records imported: ${result.importedRecords}`);
        console.log(`  Error records: ${result.errorRecords}`);
        console.log(`  Errors: ${result.errors.length}`);
        
        expect(result.success).toBe(true);
        expect(result.importedRecords).toBeGreaterThan(800); // Most should be valid
        expect(result.errorRecords).toBeGreaterThan(100); // Some should be invalid
      });

      const recordsPerSecond = recordCount / (duration / 1000);
      
      console.log(`Invalid data import performance:`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Records per second: ${recordsPerSecond.toFixed(2)}`);

      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(recordsPerSecond).toBeGreaterThan(60); // Should handle at least 60 records/second
    });
  });
});