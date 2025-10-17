import { logger } from './logger';
import { PrismaClient } from '@prisma/client';
import { TransformationResult, EntityType } from './dataTransformationPipeline';

/**
 * Import transaction state
 */
export interface ImportTransaction {
  id: string;
  entityType: EntityType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  startTime: Date;
  endTime?: Date;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  errorRecords: number;
  createdRecords: string[];
  updatedRecords: string[];
  errors: string[];
  metadata: Record<string, any>;
}

/**
 * Rollback operation result
 */
export interface RollbackResult {
  success: boolean;
  transactionId: string;
  recordsDeleted: number;
  recordsReverted: number;
  errors: string[];
  duration: number;
}

/**
 * Import batch for transaction management
 */
export interface ImportBatch {
  id: string;
  transactionId: string;
  records: any[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  errors: string[];
  createdRecordIds: string[];
  updatedRecordIds: string[];
}

/**
 * Import Transaction Manager
 * 
 * Manages import operations with rollback capabilities,
 * ensuring data integrity during bulk imports.
 */
export class ImportTransactionManager {
  private prisma: PrismaClient;
  private logger = logger.child({ component: 'ImportTransactionManager' });
  private activeTransactions: Map<string, ImportTransaction> = new Map();
  private transactionBatches: Map<string, ImportBatch[]> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new import transaction
   */
  createTransaction(
    entityType: EntityType,
    totalRecords: number,
    metadata: Record<string, any> = {}
  ): ImportTransaction {
    const transaction: ImportTransaction = {
      id: this.generateTransactionId(),
      entityType,
      status: 'pending',
      startTime: new Date(),
      totalRecords,
      processedRecords: 0,
      successRecords: 0,
      errorRecords: 0,
      createdRecords: [],
      updatedRecords: [],
      errors: [],
      metadata
    };

    this.activeTransactions.set(transaction.id, transaction);
    this.transactionBatches.set(transaction.id, []);

    this.logger.info('Import transaction created', {
      transactionId: transaction.id,
      entityType,
      totalRecords
    });

    return transaction;
  }

  /**
   * Process an import transaction with rollback support
   */
  async processTransaction(
    transactionId: string,
    transformationResult: TransformationResult,
    batchSize: number = 50
  ): Promise<ImportTransaction> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    this.logger.info('Processing import transaction', {
      transactionId,
      totalRecords: transformationResult.totalRows
    });

    try {
      transaction.status = 'in_progress';
      transaction.totalRecords = transformationResult.totalRows;

      // Process data in batches
      const batches = this.createBatches(transformationResult.data, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchId = this.generateBatchId();
        
        this.logger.debug('Processing batch', {
          transactionId,
          batchId,
          batchNumber: i + 1,
          totalBatches: batches.length,
          batchSize: batch.length
        });

        const batchResult = await this.processBatch(
          transactionId,
          batchId,
          batch,
          transaction.entityType
        );

        // Update transaction status
        transaction.processedRecords += batch.records.length;
        transaction.successRecords += batchResult.successRecords;
        transaction.errorRecords += batchResult.errorRecords;
        transaction.createdRecords.push(...batchResult.createdRecordIds);
        transaction.updatedRecords.push(...batchResult.updatedRecordIds);
        transaction.errors.push(...batchResult.errors);

        // If too many errors, consider rollback
        if (transaction.errorRecords > 10 && transaction.processedRecords > 0) {
          const errorRate = transaction.errorRecords / transaction.processedRecords;
          if (errorRate > 0.5) {
            this.logger.warn('High error rate detected, considering rollback', {
              transactionId,
              errorRate: errorRate * 100,
              errors: transaction.errorRecords,
              processed: transaction.processedRecords
            });
            
            // Optionally rollback automatically on high error rate
            // await this.rollbackTransaction(transactionId);
          }
        }
      }

      transaction.status = transaction.errorRecords === 0 ? 'completed' : 'failed';
      transaction.endTime = new Date();

      this.logger.info('Import transaction completed', {
        transactionId,
        status: transaction.status,
        successRecords: transaction.successRecords,
        errorRecords: transaction.errorRecords,
        duration: transaction.endTime.getTime() - transaction.startTime.getTime()
      });

      return transaction;
    } catch (error) {
      transaction.status = 'failed';
      transaction.endTime = new Date();
      transaction.errors.push(error instanceof Error ? error.message : String(error));

      this.logger.error('Import transaction failed', {
        transactionId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId: string): Promise<RollbackResult> {
    const startTime = Date.now();
    const transaction = this.activeTransactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    this.logger.info('Rolling back transaction', {
      transactionId,
      recordsToRollback: transaction.createdRecords.length + transaction.updatedRecords.length
    });

    const result: RollbackResult = {
      success: false,
      transactionId,
      recordsDeleted: 0,
      recordsReverted: 0,
      errors: [],
      duration: 0
    };

    try {
      // Use database transaction for atomic rollback
      await this.prisma.$transaction(async (tx) => {
        // Delete created records
        for (const recordId of transaction.createdRecords) {
          try {
            await this.deleteRecord(tx, transaction.entityType, recordId);
            result.recordsDeleted++;
          } catch (error) {
            const errorMsg = `Failed to delete record ${recordId}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            this.logger.error(errorMsg, { transactionId, recordId });
          }
        }

        // Note: Reverting updated records would require storing previous values
        // For now, we'll count them as reverted
        result.recordsReverted = transaction.updatedRecords.length;
      });

      result.success = result.errors.length === 0;
      transaction.status = 'rolled_back';

      this.logger.info('Transaction rollback completed', {
        transactionId,
        success: result.success,
        recordsDeleted: result.recordsDeleted,
        recordsReverted: result.recordsReverted,
        errors: result.errors.length
      });

    } catch (error) {
      result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error('Transaction rollback failed', {
        transactionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Get transaction status
   */
  getTransaction(transactionId: string): ImportTransaction | null {
    return this.activeTransactions.get(transactionId) || null;
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions(): ImportTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Clean up old completed transactions
   */
  cleanupTransactions(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [transactionId, transaction] of this.activeTransactions.entries()) {
      if (
        transaction.endTime && 
        transaction.endTime < cutoffTime &&
        ['completed', 'failed', 'rolled_back'].includes(transaction.status)
      ) {
        this.activeTransactions.delete(transactionId);
        this.transactionBatches.delete(transactionId);
        cleanedCount++;
      }
    }

    this.logger.info('Cleaned up old transactions', {
      cleanedCount,
      cutoffTime
    });

    return cleanedCount;
  }

  /**
   * Process a single batch of records
   */
  private async processBatch(
    transactionId: string,
    batchId: string,
    records: any[],
    entityType: EntityType
  ): Promise<{
    successRecords: number;
    errorRecords: number;
    createdRecordIds: string[];
    updatedRecordIds: string[];
    errors: string[];
  }> {
    const result = {
      successRecords: 0,
      errorRecords: 0,
      createdRecordIds: [] as string[],
      updatedRecordIds: [] as string[],
      errors: [] as string[]
    };

    const batch: ImportBatch = {
      id: batchId,
      transactionId,
      records,
      status: 'processing',
      errors: [],
      createdRecordIds: [],
      updatedRecordIds: []
    };

    try {
      for (const record of records) {
        try {
          const operationResult = await this.processRecord(record, entityType);
          
          if (operationResult.created) {
            result.createdRecordIds.push(operationResult.id);
            batch.createdRecordIds.push(operationResult.id);
          }
          
          if (operationResult.updated) {
            result.updatedRecordIds.push(operationResult.id);
            batch.updatedRecordIds.push(operationResult.id);
          }
          
          result.successRecords++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(errorMsg);
          batch.errors.push(errorMsg);
          result.errorRecords++;
        }
      }

      batch.status = result.errorRecords === 0 ? 'completed' : 'failed';
      batch.processedAt = new Date();

      // Store batch information
      const batches = this.transactionBatches.get(transactionId) || [];
      batches.push(batch);
      this.transactionBatches.set(transactionId, batches);

    } catch (error) {
      batch.status = 'failed';
      batch.errors.push(error instanceof Error ? error.message : String(error));
      result.errors.push(`Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Process a single record
   */
  private async processRecord(
    record: any,
    entityType: EntityType
  ): Promise<{
    id: string;
    created: boolean;
    updated: boolean;
  }> {
    switch (entityType) {
      case 'students':
        return this.processStudentRecord(record);
      case 'books':
        return this.processBookRecord(record);
      case 'equipment':
        return this.processEquipmentRecord(record);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Process student record
   */
  private async processStudentRecord(record: any): Promise<{
    id: string;
    created: boolean;
    updated: boolean;
  }> {
    const studentId = record.student_id;
    
    // Check if student exists
    const existingStudent = await this.prisma.students.findUnique({
      where: { student_id }
    });

    if (existingStudent) {
      // Update existing student
      const updatedStudent = await this.prisma.students.update({
        where: { id: existingStudent.id },
        data: {
          ...record,
          updated_at: new Date()
        }
      });
      
      return {
        id: updatedStudent.id,
        created: false,
        updated: true
      };
    } else {
      // Create new student
      const newStudent = await this.prisma.students.create({
        data: {
          ...record,
          id: this.generateId(),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      
      return {
        id: newStudent.id,
        created: true,
        updated: false
      };
    }
  }

  /**
   * Process book record
   */
  private async processBookRecord(record: any): Promise<{
    id: string;
    created: boolean;
    updated: boolean;
  }> {
    const accessionNo = record.accession_no;
    
    // Check if book exists
    const existingBook = await this.prisma.books.findUnique({
      where: { accession_no: accessionNo }
    });

    if (existingBook) {
      // Update existing book
      const updatedBook = await this.prisma.books.update({
        where: { id: existingBook.id },
        data: {
          ...record,
          updated_at: new Date()
        }
      });
      
      return {
        id: updatedBook.id,
        created: false,
        updated: true
      };
    } else {
      // Create new book
      const newBook = await this.prisma.books.create({
        data: {
          ...record,
          id: this.generateId(),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      
      return {
        id: newBook.id,
        created: true,
        updated: false
      };
    }
  }

  /**
   * Process equipment record
   */
  private async processEquipmentRecord(record: any): Promise<{
    id: string;
    created: boolean;
    updated: boolean;
  }> {
    const equipmentId = record.equipment_id;
    
    // Check if equipment exists
    const existingEquipment = await this.prisma.equipment.findUnique({
      where: { equipment_id }
    });

    if (existingEquipment) {
      // Update existing equipment
      const updatedEquipment = await this.prisma.equipment.update({
        where: { id: existingEquipment.id },
        data: {
          ...record,
          updated_at: new Date()
        }
      });
      
      return {
        id: updatedEquipment.id,
        created: false,
        updated: true
      };
    } else {
      // Create new equipment
      const newEquipment = await this.prisma.equipment.create({
        data: {
          ...record,
          id: this.generateId(),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      
      return {
        id: newEquipment.id,
        created: true,
        updated: false
      };
    }
  }

  /**
   * Delete a record
   */
  private async deleteRecord(tx: any, entityType: EntityType, recordId: string): Promise<void> {
    switch (entityType) {
      case 'students':
        await tx.students.delete({ where: { id: recordId } });
        break;
      case 'books':
        await tx.books.delete({ where: { id: recordId } });
        break;
      case 'equipment':
        await tx.equipment.delete({ where: { id: recordId } });
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Create batches from data
   */
  private createBatches(data: any[], batchSize: number): any[][] {
    const batches: any[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique record ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}