/**
 * Data Transformation Pipeline Usage Examples
 * 
 * This file demonstrates how to use the flexible data transformation pipeline
 * for importing CSV/Excel data with various entity types.
 */

import { importPipelineService, ImportOptions } from '@/services/importPipelineService';
import { DataTransformationPipeline } from '@/utils/dataTransformationPipeline';
import { ImportTransactionManager } from '@/utils/importTransactionManager';
import { prisma } from '@/utils/prisma';
import { EntityType } from '@/utils/dataTransformationPipeline';

/**
 * Example 1: Simple CSV import with auto-detection
 */
async function simpleCsvImport() {
  console.log('=== Simple CSV Import Example ===');
  
  const importOptions: ImportOptions = {
    entityType: 'students',
    filePath: './data/students.csv',
    enableRollback: true,
    dryRun: false
  };

  try {
    // Start the import job
    const job = await importPipelineService.startImport(importOptions);
    console.log(`Import job started: ${job.id}`);

    // Monitor progress
    const checkProgress = setInterval(() => {
      const currentJob = importPipelineService.getJob(job.id);
      if (currentJob) {
        console.log(`Progress: ${currentJob.progress.percentage.toFixed(1)}% - ${currentJob.progress.stage}`);
        
        if (['completed', 'failed', 'rolled_back'].includes(currentJob.status)) {
          clearInterval(checkProgress);
          
          console.log(`Import completed with status: ${currentJob.status}`);
          console.log(`Total rows: ${currentJob.progress.totalRows}`);
          console.log(`Success rows: ${currentJob.progress.successRows}`);
          console.log(`Error rows: ${currentJob.progress.errorRows}`);
          
          if (currentJob.errors.length > 0) {
            console.log('Errors:', currentJob.errors.slice(0, 5)); // Show first 5 errors
          }
        }
      }
    }, 1000);

  } catch (error) {
    console.error('Import failed:', error);
  }
}

/**
 * Example 2: Excel import with custom field mappings
 */
async function excelImportWithCustomMappings() {
  console.log('=== Excel Import with Custom Mappings ===');
  
  const importOptions: ImportOptions = {
    entityType: 'books',
    filePath: './data/books.xlsx',
    customMappings: {
      'Book Title': 'title',
      'Author Name': 'author',
      'Accession Number': 'accession_no',
      'ISBN Number': 'isbn',
      'Book Category': 'category',
      'Sub-Category': 'subcategory',
      'Location': 'location',
      'Total Copies': 'total_copies',
      'Cost': 'cost_price',
      'Year Published': 'year'
    },
    enableRollback: true,
    batchSize: 100,
    dryRun: false
  };

  try {
    const job = await importPipelineService.startImport(importOptions);
    console.log(`Excel import job started: ${job.id}`);

    // Wait for completion (in production, use webhooks or polling)
    await waitForJobCompletion(job.id);
    
  } catch (error) {
    console.error('Excel import failed:', error);
  }
}

/**
 * Example 3: Equipment import with validation rules
 */
async function equipmentImportWithValidation() {
  console.log('=== Equipment Import with Validation ===');
  
  const importOptions: ImportOptions = {
    entityType: 'equipment',
    filePath: './data/equipment.csv',
    validationRules: [
      {
        field: 'equipment_id',
        required: true,
        pattern: /^[A-Z0-9\-_]+$/,
        maxLength: 50
      },
      {
        field: 'name',
        required: true,
        minLength: 3,
        maxLength: 100
      },
      {
        field: 'type',
        required: true,
        customValidator: (value: any) => {
          const validTypes = ['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER'];
          return validTypes.includes(value) || `Must be one of: ${validTypes.join(', ')}`;
        }
      },
      {
        field: 'max_time_minutes',
        required: true,
        customValidator: (value: any) => {
          const num = parseInt(value);
          return (num > 0 && num <= 480) || 'Must be between 1 and 480 minutes';
        }
      }
    ],
    enableRollback: true,
    autoRollbackOnError: true,
    maxErrors: 5,
    skipInvalidRows: true
  };

  try {
    const job = await importPipelineService.startImport(importOptions);
    console.log(`Equipment import job started: ${job.id}`);

    await waitForJobCompletion(job.id);
    
  } catch (error) {
    console.error('Equipment import failed:', error);
  }
}

/**
 * Example 4: Dry run import to validate data
 */
async function dryRunImport() {
  console.log('=== Dry Run Import Example ===');
  
  const importOptions: ImportOptions = {
    entityType: 'students',
    filePath: './data/students_new.csv',
    dryRun: true, // This will not actually import data
    enableRollback: false, // Not needed for dry run
    strictMode: true
  };

  try {
    const job = await importPipelineService.startImport(importOptions);
    console.log(`Dry run job started: ${job.id}`);

    await waitForJobCompletion(job.id);
    
    const completedJob = importPipelineService.getJob(job.id);
    if (completedJob?.result) {
      console.log('Dry run results:');
      console.log(`- Total rows: ${completedJob.result.totalRows}`);
      console.log(`- Would be imported: ${completedJob.result.successRows}`);
      console.log(`- Would be skipped: ${completedJob.result.errorRows}`);
      console.log(`- Warnings: ${completedJob.result.warnings.length}`);
      
      if (completedJob.result.warnings.length > 0) {
        console.log('Sample warnings:');
        completedJob.result.warnings.slice(0, 3).forEach(warning => {
          console.log(`  Row ${warning.row}: ${warning.message}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Dry run failed:', error);
  }
}

/**
 * Example 5: Using the pipeline directly for custom processing
 */
async function directPipelineUsage() {
  console.log('=== Direct Pipeline Usage ===');
  
  const pipeline = new DataTransformationPipeline({
    batchSize: 50,
    strictMode: false,
    logLevel: 'info'
  });

  try {
    // Process file through pipeline without importing
    const result = await pipeline.processFile(
      './data/custom_data.csv',
      'books',
      {
        customMappings: {
          'title': 'title',
          'author': 'author',
          'accession': 'accession_no'
        },
        dryRun: true
      }
    );

    console.log('Pipeline processing completed:');
    console.log(`- Total rows: ${result.totalRows}`);
    console.log(`- Success rows: ${result.successRows}`);
    console.log(`- Error rows: ${result.errorRows}`);
    console.log(`- Processing time: ${result.duration}ms`);

    // Access field mappings for UI display
    console.log('Field mappings detected:');
    Object.entries(result.fieldMappings).forEach(([source, mapping]) => {
      console.log(`  ${source} -> ${mapping.targetField} (${mapping.inferredType})`);
    });

  } catch (error) {
    console.error('Pipeline processing failed:', error);
  }
}

/**
 * Example 6: Rollback a completed import
 */
async function rollbackImport() {
  console.log('=== Rollback Import Example ===');
  
  // First, perform an import
  const importOptions: ImportOptions = {
    entityType: 'students',
    filePath: './data/test_students.csv',
    enableRollback: true,
    dryRun: false
  };

  try {
    const job = await importPipelineService.startImport(importOptions);
    await waitForJobCompletion(job.id);
    
    const completedJob = importPipelineService.getJob(job.id);
    if (completedJob?.status === 'completed' && completedJob.transactionId) {
      console.log(`Import completed. Rolling back transaction ${completedJob.transactionId}...`);
      
      const rollbackResult = await importPipelineService.rollbackImport(job.id);
      
      if (rollbackResult?.success) {
        console.log('Rollback successful:');
        console.log(`- Records deleted: ${rollbackResult.recordsDeleted}`);
        console.log(`- Records reverted: ${rollbackResult.recordsReverted}`);
        console.log(`- Duration: ${rollbackResult.duration}ms`);
      } else {
        console.log('Rollback failed:', rollbackResult?.errors);
      }
    }
    
  } catch (error) {
    console.error('Rollback example failed:', error);
  }
}

/**
 * Example 7: Monitor active imports
 */
async function monitorActiveImports() {
  console.log('=== Monitor Active Imports ===');
  
  const activeJobs = importPipelineService.getActiveJobs();
  console.log(`Active jobs: ${activeJobs.length}`);
  
  activeJobs.forEach(job => {
    console.log(`Job ${job.id}:`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Entity: ${job.metadata.entityType}`);
    console.log(`  Progress: ${job.progress.percentage.toFixed(1)}%`);
    console.log(`  Stage: ${job.progress.stage}`);
    console.log(`  Started: ${job.startTime.toISOString()}`);
    console.log(`  File: ${job.metadata.fileName}`);
  });

  // Get overall statistics
  const stats = importPipelineService.getPipelineStatistics();
  console.log('Pipeline Statistics:');
  console.log(`  Active jobs: ${stats.activeJobs}`);
  console.log(`  Completed jobs: ${stats.completedJobs}`);
  console.log(`  Failed jobs: ${stats.failedJobs}`);
  console.log('  Jobs by status:', stats.jobsByStatus);
  console.log('  Jobs by entity type:', stats.jobsByEntityType);
}

/**
 * Example 8: Cancel a running import
 */
async function cancelRunningImport() {
  console.log('=== Cancel Running Import ===');
  
  const activeJobs = importPipelineService.getActiveJobs();
  const runningJob = activeJobs.find(job => job.status === 'processing');
  
  if (runningJob) {
    console.log(`Cancelling job ${runningJob.id}...`);
    
    const success = await importPipelineService.cancelJob(runningJob.id);
    
    if (success) {
      console.log('Job cancelled successfully');
    } else {
      console.log('Failed to cancel job');
    }
  } else {
    console.log('No running jobs found');
  }
}

/**
 * Helper function to wait for job completion
 */
async function waitForJobCompletion(jobId: string): Promise<void> {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const job = importPipelineService.getJob(jobId);
      
      if (job && ['completed', 'failed', 'rolled_back'].includes(job.status)) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 500);
  });
}

/**
 * Example 9: Cleanup old jobs
 */
async function cleanupOldJobs() {
  console.log('=== Cleanup Old Jobs ===');
  
  // Clean up jobs older than 24 hours
  const cleanedCount = importPipelineService.cleanupJobs(24);
  console.log(`Cleaned up ${cleanedCount} old jobs`);
}

/**
 * Example 10: Using transaction manager directly
 */
async function directTransactionUsage() {
  console.log('=== Direct Transaction Manager Usage ===');
  
  const transactionManager = new ImportTransactionManager(prisma);
  
  // Create a transaction
  const transaction = transactionManager.createTransaction(
    'books',
    100, // Expected number of records
    {
      source: 'manual_import',
      operator: 'admin'
    }
  );
  
  console.log(`Created transaction: ${transaction.id}`);
  
  try {
    // Simulate processing some records
    const sampleRecords = [
      {
        accession_no: 'TEST-001',
        title: 'Test Book 1',
        author: 'Test Author',
        category: 'Fiction'
      },
      {
        accession_no: 'TEST-002',
        title: 'Test Book 2',
        author: 'Test Author',
        category: 'Non-Fiction'
      }
    ];
    
    // Create a mock transformation result
    const mockTransformationResult = {
      success: true,
      totalRows: sampleRecords.length,
      processedRows: sampleRecords.length,
      successRows: sampleRecords.length,
      errorRows: 0,
      skippedRows: 0,
      data: sampleRecords,
      errors: [],
      warnings: [],
      fieldMappings: {},
      statistics: {},
      duration: 100
    };
    
    // Process through transaction manager
    const completedTransaction = await transactionManager.processTransaction(
      transaction.id,
      mockTransformationResult,
      10 // Batch size
    );
    
    console.log(`Transaction completed: ${completedTransaction.status}`);
    console.log(`Created records: ${completedTransaction.createdRecords.length}`);
    console.log(`Updated records: ${completedTransaction.updatedRecords.length}`);
    
    // Rollback the transaction for cleanup
    const rollbackResult = await transactionManager.rollbackTransaction(transaction.id);
    console.log(`Rollback successful: ${rollbackResult.success}`);
    console.log(`Records deleted: ${rollbackResult.recordsDeleted}`);
    
  } catch (error) {
    console.error('Direct transaction usage failed:', error);
    
    // Rollback on error
    await transactionManager.rollbackTransaction(transaction.id);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('Running Data Transformation Pipeline Examples...\n');
  
  try {
    await simpleCsvImport();
    await excelImportWithCustomMappings();
    await equipmentImportWithValidation();
    await dryRunImport();
    await directPipelineUsage();
    await rollbackImport();
    await monitorActiveImports();
    await cancelRunningImport();
    await cleanupOldJobs();
    await directTransactionUsage();
    
    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export examples for individual testing
export {
  simpleCsvImport,
  excelImportWithCustomMappings,
  equipmentImportWithValidation,
  dryRunImport,
  directPipelineUsage,
  rollbackImport,
  monitorActiveImports,
  cancelRunningImport,
  cleanupOldJobs,
  directTransactionUsage,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}