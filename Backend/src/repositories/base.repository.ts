import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';

/**
 * Base Repository Class
 * 
 * Provides common repository functionality with automatic field population,
 * error handling, and logging for all repository implementations.
 */
export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  protected prisma: PrismaClient;
  protected modelName: string;
  protected externalIdField: string;

  constructor(
    prisma: PrismaClient,
    modelName: string,
    externalIdField: string = 'id'
  ) {
    this.prisma = prisma;
    this.modelName = modelName;
    this.externalIdField = externalIdField;
  }

  /**
   * Get the Prisma model for this repository
   */
  protected getModel(): any {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Generate a unique ID for new records
   */
  protected generateId(prefix: string = this.modelName): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Populate missing required fields with default values
   */
  protected populateMissingFields(data: any): any {
    const processedData = { ...data };

    // Generate ID if not provided
    if (!processedData.id) {
      processedData.id = this.generateId(this.modelName);
    }

    // Add timestamps if not provided
    if (!processedData.created_at) {
      processedData.created_at = new Date();
    }

    if (!processedData.updated_at) {
      processedData.updated_at = new Date();
    }

    return processedData;
  }

  /**
   * Find a record by external identifier
   */
  async findByExternalId(externalId: string): Promise<TModel | null> {
    try {
      const whereClause = {
        [this.externalIdField]: externalId
      };

      const record = await this.getModel().findUnique({
        where: whereClause
      });

      return record as TModel | null;
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by ${this.externalIdField}`, {
        error: (error as Error).message,
        externalId,
        field: this.externalIdField
      });
      throw error;
    }
  }

  /**
   * Find a record by database ID
   */
  async findById(id: string): Promise<TModel | null> {
    try {
      const record = await this.getModel().findUnique({
        where: { id }
      });

      return record as TModel | null;
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by ID`, {
        error: (error as Error).message,
        id
      });
      throw error;
    }
  }

  /**
   * Create a new record with automatic field population
   */
  async create(data: TCreateInput): Promise<TModel> {
    try {
      const processedData = this.populateMissingFields(data);

      const record = await this.getModel().create({
        data: processedData
      });

      logger.info(`${this.modelName} created successfully`, {
        id: record.id,
        [this.externalIdField]: (record as any)[this.externalIdField]
      });

      return record as TModel;
    } catch (error) {
      logger.error(`Error creating ${this.modelName}`, {
        error: (error as Error).message,
        data: this.sanitizeDataForLogging(data)
      });
      throw error;
    }
  }

  /**
   * Update a record by database ID
   */
  async updateById(id: string, data: TUpdateInput): Promise<TModel | null> {
    try {
      const processedData = {
        ...data,
        updated_at: new Date()
      };

      const record = await this.getModel().update({
        where: { id },
        data: processedData
      });

      logger.info(`${this.modelName} updated successfully`, {
        id,
        [this.externalIdField]: (record as any)[this.externalIdField]
      });

      return record as TModel;
    } catch (error) {
      // If record not found, return null instead of throwing
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to update non-existent ${this.modelName}`, { id });
        return null;
      }

      logger.error(`Error updating ${this.modelName}`, {
        error: (error as Error).message,
        id,
        data: this.sanitizeDataForLogging(data)
      });
      throw error;
    }
  }

  /**
   * Update a record by external identifier
   */
  async updateByExternalId(externalId: string, data: TUpdateInput): Promise<TModel | null> {
    try {
      const whereClause = {
        [this.externalIdField]: externalId
      };

      const processedData = {
        ...data,
        updated_at: new Date()
      };

      const record = await this.getModel().update({
        where: whereClause,
        data: processedData
      });

      logger.info(`${this.modelName} updated successfully`, {
        id: record.id,
        [this.externalIdField]: externalId
      });

      return record as TModel;
    } catch (error) {
      // If record not found, return null instead of throwing
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to update non-existent ${this.modelName}`, {
          [this.externalIdField]: externalId
        });
        return null;
      }

      logger.error(`Error updating ${this.modelName}`, {
        error: (error as Error).message,
        externalId,
        data: this.sanitizeDataForLogging(data)
      });
      throw error;
    }
  }

  /**
   * Upsert a record by external identifier
   */
  async upsertByExternalId(
    externalId: string,
    createData: TCreateInput,
    updateData: TUpdateInput
  ): Promise<TModel> {
    try {
      const whereClause = {
        [this.externalIdField]: externalId
      };

      const processedCreateData = this.populateMissingFields({
        ...createData,
        [this.externalIdField]: externalId
      });

      const processedUpdateData = {
        ...updateData,
        updated_at: new Date()
      };

      const record = await this.getModel().upsert({
        where: whereClause,
        create: processedCreateData,
        update: processedUpdateData
      });

      logger.info(`${this.modelName} upserted successfully`, {
        id: record.id,
        [this.externalIdField]: externalId,
        action: record.created_at.getTime() === record.updated_at.getTime() ? 'created' : 'updated'
      });

      return record as TModel;
    } catch (error) {
      logger.error(`Error upserting ${this.modelName}`, {
        error: (error as Error).message,
        externalId,
        createData: this.sanitizeDataForLogging(createData),
        updateData: this.sanitizeDataForLogging(updateData)
      });
      throw error;
    }
  }

  /**
   * Delete a record by database ID
   */
  async deleteById(id: string): Promise<boolean> {
    try {
      await this.getModel().delete({
        where: { id }
      });

      logger.info(`${this.modelName} deleted successfully`, { id });
      return true;
    } catch (error) {
      // If record not found, return false instead of throwing
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to delete non-existent ${this.modelName}`, { id });
        return false;
      }

      logger.error(`Error deleting ${this.modelName}`, {
        error: (error as Error).message,
        id
      });
      throw error;
    }
  }

  /**
   * Delete a record by external identifier
   */
  async deleteByExternalId(externalId: string): Promise<boolean> {
    try {
      const whereClause = {
        [this.externalIdField]: externalId
      };

      await this.getModel().delete({
        where: whereClause
      });

      logger.info(`${this.modelName} deleted successfully`, {
        [this.externalIdField]: externalId
      });
      return true;
    } catch (error) {
      // If record not found, return false instead of throwing
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to delete non-existent ${this.modelName}`, {
          [this.externalIdField]: externalId
        });
        return false;
      }

      logger.error(`Error deleting ${this.modelName}`, {
        error: (error as Error).message,
        externalId
      });
      throw error;
    }
  }

  /**
   * Check if a record exists by external identifier
   */
  async existsByExternalId(externalId: string): Promise<boolean> {
    try {
      const whereClause = {
        [this.externalIdField]: externalId
      };

      const count = await this.getModel().count({
        where: whereClause
      });

      return count > 0;
    } catch (error) {
      logger.error(`Error checking ${this.modelName} existence`, {
        error: (error as Error).message,
        externalId
      });
      throw error;
    }
  }

  /**
   * Sanitize data for logging to prevent sensitive data exposure
   */
  protected sanitizeDataForLogging(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Handle database errors with consistent logging
   */
  protected handleDatabaseError(error: any, operation: string, context: any = {}): never {
    const errorMessage = (error as Error).message;

    logger.error(`Database error during ${operation} for ${this.modelName}`, {
      error: errorMessage,
      context: this.sanitizeDataForLogging(context)
    });

    throw error;
  }
}