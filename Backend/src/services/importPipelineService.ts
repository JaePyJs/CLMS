import { logger } from '@/utils/logger';
import { DataTransformationPipeline, TransformationResult, EntityType } from '@/utils/dataTransformationPipeline';
import { ImportTransactionManager, ImportTransaction, RollbackResult } from '@/utils/importTransactionManager';
import { prisma } from '@/utils/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Import options
 */
export interface ImportOptions {
  entityType: EntityType;
  filePath: string;
  customMappings?: Record<string, string>;
  validationRules?: any[];
  batchSize?: number;
  dryRun?: boolean;
  skipInvalidRows?: boolean;
  strictMode?: boolean;
  enableRollback?: boolean;
  autoRollbackOnError?: boolean;
  maxErrors?: number;
}

/**
 * Import job status
 */
export interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rolling_back' | 'rolled_back';
  progress: {
    stage: string;
    totalRows: number;
    processedRows: number;
    successRows: number;
    errorRows: number;
    percentage: number;
  };
  startTime: Date;
  endTime?: Date;
  transactionId?: string;
  errors: string[];
  warnings: string[];
  result?: TransformationResult;
  metadata: Record<string, any>;
}

/**
 * Import Pipeline Service
 * 
 * High-level service that orchestrates the complete import process,
 * combining data transformation with transaction management.
 */
export class ImportPipelineService {
  private pipeline: DataTransformationPipeline;
  private transactionManager: ImportTransactionManager;
  private logger = logger.child({ component: 'ImportPipelineService' });
  private activeJobs: Map<string, ImportJob> = new Map();

  constructor() {
    this.pipeline = new DataTransformationPipeline();
    this.transactionManager = new ImportTransactionManager(prisma);
  }

  /**
   * Start a new import job
   */
  async startImport(options: ImportOptions): Promise<ImportJob> {
    const jobId = this.generateJobId();
    
    // Validate file exists
    if (!fs.existsSync(options.filePath)) {
      throw new Error(`File not found: ${options.filePath}`);
    }

    // Create import job
    const job: ImportJob = {
      id: jobId,
      status: 'pending',
      progress: {
        stage: 'initializing',
        totalRows: 0,
        processedRows: 0,
        successRows: 0,
        errorRows: 0,
        percentage: 0
      },
      startTime: new Date(),
      errors: [],
      warnings: [],
      metadata: {
        ...options,
        fileName: path.basename(options.filePath),
        fileSize: fs.statSync(options.filePath).size
      }
    };

    this.activeJobs.set(jobId, job);
    
    this.logger.info('Import job started', {
      jobId,
      entityType: options.entityType,
      filePath: options.filePath,
      dryRun: options.dryRun || false
    });

    // Process import asynchronously
    this.processImport(jobId, options).catch(error => {
      this.logger.error('Import processing failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push(error instanceof Error ? error.message : String(error));
    });

    return job;
  }

  /**
   * Get import job status
   */
  getJob(jobId: string): ImportJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active import jobs
   */
  getActiveJobs(): ImportJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel an import job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'processing' && job.transactionId) {
      // Rollback the transaction
      job.status = 'rolling_back';
      this.logger.info('Cancelling job and rolling back transaction', { jobId });
      
      try {
        const rollbackResult = await this.transactionManager.rollbackTransaction(job.transactionId);
        job.status = 'rolled_back';
        job.endTime = new Date();
        
        this.logger.info('Job cancelled and transaction rolled back', {
          jobId,
          recordsDeleted: rollbackResult.recordsDeleted,
          recordsReverted: rollbackResult.recordsReverted
        });
        
        return true;
      } catch (error) {
        this.logger.error('Failed to rollback transaction during job cancellation', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        job.status = 'failed';
        job.errors.push(`Cancellation failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    } else {
      // Job can be cancelled if not processing
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push('Job cancelled by user');
      return true;
    }
  }

  /**
   * Rollback a completed import
   */
  async rollbackImport(jobId: string): Promise<RollbackResult | null> {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.transactionId) {
      return null;
    }

    this.logger.info('Rolling back import', { jobId, transactionId: job.transactionId });
    
    try {
      job.status = 'rolling_back';
      const rollbackResult = await this.transactionManager.rollbackTransaction(job.transactionId);
      
      if (rollbackResult.success) {
        job.status = 'rolled_back';
      } else {
        job.status = 'failed';
        job.errors.push(...rollbackResult.errors);
      }
      
      job.endTime = new Date();
      
      this.logger.info('Import rollback completed', {
        jobId,
        success: rollbackResult.success,
        recordsDeleted: rollbackResult.recordsDeleted,
        recordsReverted: rollbackResult.recordsReverted
      });
      
      return rollbackResult;
    } catch (error) {
      this.logger.error('Import rollback failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      job.status = 'failed';
      job.errors.push(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
      job.endTime = new Date();
      
      throw error;
    }
  }

  /**
   * Clean up old completed jobs
   */
  cleanupJobs(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (
        job.endTime && 
        job.endTime < cutoffTime &&
        ['completed', 'failed', 'rolled_back'].includes(job.status)
      ) {
        this.activeJobs.delete(jobId);
        cleanedCount++;
      }
    }

    // Also cleanup old transactions
    this.transactionManager.cleanupTransactions(olderThanHours);

    this.logger.info('Cleaned up old jobs', {
      cleanedCount,
      cutoffTime
    });

    return cleanedCount;
  }

  /**
   * Process import job
   */
  private async processImport(jobId: string, options: ImportOptions): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    try {
      job.status = 'processing';
      
      // Update progress from pipeline
      const progressInterval = setInterval(() => {
        const pipelineProgress = this.pipeline.getProgress();
        job.progress = {
          stage: pipelineProgress.stage,
          totalRows: pipelineProgress.totalRows,
          processedRows: pipelineProgress.processedRows,
          successRows: pipelineProgress.successRows,
          errorRows: pipelineProgress.errorRows,
          percentage: pipelineProgress.totalRows > 0 
            ? (pipelineProgress.processedRows / pipelineProgress.totalRows) * 100 
            : 0
        };
      }, 1000);

      // Create transaction if rollback is enabled
      let transactionId: string | undefined;
      if (options.enableRollback && !options.dryRun) {
        const transaction = this.transactionManager.createTransaction(
          options.entityType,
          0, // Will be updated after transformation
          {
            jobId,
            filePath: options.filePath,
            customMappings: options.customMappings,
            startTime: new Date()
          }
        );
        transactionId = transaction.id;
        job.transactionId = transactionId;
      }

      // Process file through pipeline
      const transformationResult = await this.pipeline.processFile(options.filePath, options.entityType, {
        customMappings: options.customMappings,
        validationRules: options.validationRules,
        dryRun: options.dryRun
      });

      clearInterval(progressInterval);

      // Update job with transformation results
      job.result = transformationResult;
      job.errors = transformationResult.errors.map(e => e.message);
      job.warnings = transformationResult.warnings.map(w => w.message);
      job.progress = {
        stage: 'completed',
        totalRows: transformationResult.totalRows,
        processedRows: transformationResult.processedRows,
        successRows: transformationResult.successRows,
        errorRows: transformationResult.errorRows,
        percentage: 100
      };

      // Process data through transaction manager
      if (!options.dryRun && transformationResult.data.length > 0) {
        if (transactionId) {
          // Update transaction with actual record count
          const transaction = this.transactionManager.getTransaction(transactionId);
          if (transaction) {
            transaction.totalRecords = transformationResult.data.length;
          }

          // Process through transaction manager
          await this.transactionManager.processTransaction(
            transactionId,
            transformationResult,
            options.batchSize || 50
          );

          // Check if auto-rollback should be triggered
          const finalTransaction = this.transactionManager.getTransaction(transactionId);
          if (finalTransaction && options.autoRollbackOnError && finalTransaction.status === 'failed') {
            this.logger.info('Auto-rollback triggered due to transaction failure', {
              jobId,
              transactionId,
              errors: finalTransaction.errorRecords
            });

            await this.transactionManager.rollbackTransaction(transactionId);
            job.status = 'rolled_back';
          } else if (finalTransaction && finalTransaction.status === 'completed') {
            job.status = 'completed';
          } else {
            job.status = 'failed';
          }
        } else {
          // Direct import without transaction management
          job.status = 'completed';
        }
      } else {
        // Dry run or no data to process
        job.status = transformationResult.success ? 'completed' : 'failed';
      }

      job.endTime = new Date();

      this.logger.info('Import job completed', {
        jobId,
        status: job.status,
        totalRows: transformationResult.totalRows,
        successRows: transformationResult.successRows,
        errorRows: transformationResult.errorRows,
        duration: job.endTime.getTime() - job.startTime.getTime()
      });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push(error instanceof Error ? error.message : String(error));

      // Auto-rollback if enabled and transaction exists
      if (options.autoRollbackOnError && job.transactionId) {
        try {
          await this.transactionManager.rollbackTransaction(job.transactionId);
          job.status = 'rolled_back';
        } catch (rollbackError) {
          this.logger.error('Auto-rollback failed', {
            jobId,
            transactionId: job.transactionId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          });
        }
      }

      this.logger.error('Import job failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStatistics(): {
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    jobsByStatus: Record<string, number>;
    jobsByEntityType: Record<string, number>;
  } {
    const jobs = Array.from(this.activeJobs.values());
    
    const stats = {
      activeJobs: jobs.filter(j => ['pending', 'processing', 'rolling_back'].includes(j.status)).length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      jobsByStatus: {} as Record<string, number>,
      jobsByEntityType: {} as Record<string, number>
    };

    // Count by status
    jobs.forEach(job => {
      stats.jobsByStatus[job.status] = (stats.jobsByStatus[job.status] || 0) + 1;
    });

    // Count by entity type
    jobs.forEach(job => {
      const entityType = job.metadata.entityType;
      stats.jobsByEntityType[entityType] = (stats.jobsByEntityType[entityType] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const importPipelineService = new ImportPipelineService();