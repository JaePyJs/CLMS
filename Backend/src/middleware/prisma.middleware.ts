import { Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';

/**
 * Prisma middleware for automatic ID and timestamp management
 * 
 * This middleware automatically handles:
 * 1. ID generation for new records (if not provided)
 * 2. Automatic timestamp population for created_at and updated_at fields
 * 3. Update timestamp modification for existing records
 */
export function prismaMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const startTime = Date.now();
    const { model, action, args } = params;

    try {
      // Handle create operations
      if (action === 'create' || action === 'createMany') {
        args.data = await handleCreateOperation(model, args.data);
      }

      // Handle update operations
      if (action === 'update' || action === 'updateMany') {
        args.data = await handleUpdateOperation(model, args.data);
      }

      // Handle upsert operations
      if (action === 'upsert') {
        args.create = await handleCreateOperation(model, args.create);
        args.update = await handleUpdateOperation(model, args.update);
      }

      // Execute the operation
      const result = await next(params);

      // Log performance for monitoring
      const duration = Date.now() - startTime;
      if (duration > 1000) { // Log operations taking more than 1 second
        logger.warn('Slow database operation detected', {
          model,
          action,
          duration,
          args: sanitizeArgs(args),
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database operation failed', {
        model,
        action,
        duration,
        error: (error as Error).message,
        args: sanitizeArgs(args),
      });
      throw error;
    }
  };
}

/**
 * Handle create operations by adding ID and timestamps
 */
async function handleCreateOperation(model: string | undefined, data: any): Promise<any> {
  if (!data) return data;

  // Handle single record creation
  if (typeof data === 'object' && !Array.isArray(data)) {
    const processedData = { ...data };

    // Generate ID if not provided
    if (!processedData.id && hasIdField(model)) {
      processedData.id = crypto.randomUUID();
    }

    // Add created_at timestamp if field exists and not provided
    if (hasCreatedAtField(model) && !processedData.created_at) {
      processedData.created_at = new Date();
    }

    // Add updated_at timestamp if field exists and not provided
    if (model && hasUpdatedAtField(model) && !processedData.updated_at) {
      processedData.updated_at = new Date();
    }

    return processedData;
  }

  // Handle bulk create operations
  if (Array.isArray(data)) {
    return data.map(item => {
      if (!item.id && hasIdField(model)) {
        item.id = crypto.randomUUID();
      }

      if (hasCreatedAtField(model) && !item.created_at) {
        item.created_at = new Date();
      }

      if (hasUpdatedAtField(model) && !item.updated_at) {
        item.updated_at = new Date();
      }

      return item;
    });
  }

  return data;
}

/**
 * Handle update operations by updating timestamps
 */
async function handleUpdateOperation(model: string | undefined, data: any): Promise<any> {
  if (!data || typeof data !== 'object') return data;

  const processedData = { ...data };

  // Always update the updated_at field for update operations
  if (model && hasUpdatedAtField(model) && !processedData.updated_at) {
    processedData.updated_at = new Date();
  }

  return processedData;
}

/**
 * Check if the model has an id field
 */
function hasIdField(model: string | undefined): boolean {
  const modelsWithId = [
    'audit_logs',
    'automation_jobs',
    'automation_logs',
    'barcode_history',
    'book_checkouts',
    'books',
    'equipment',
    'equipment_condition_reports',
    'equipment_maintenance',
    'equipment_reports',
    'equipment_reservations',
    'equipment_sessions',
    'equipment_usage_stats',
    'notifications',
    'student_activities',
    'students',
    'system_config',
    'users',
  ];

  if (!model) return false;
  return modelsWithId.includes(model);
}

/**
 * Check if the model has a created_at field
 */
function hasCreatedAtField(model: string | undefined): boolean {
  const modelsWithCreatedAt = [
    'audit_logs',
    'automation_jobs',
    'automation_logs',
    'barcode_history',
    'book_checkouts',
    'books',
    'equipment',
    'equipment_condition_reports',
    'equipment_maintenance',
    'equipment_reports',
    'equipment_reservations',
    'equipment_sessions',
    'equipment_usage_stats',
    'notifications',
    'student_activities',
    'students',
    'system_config',
    'users',
  ];

  if (!model) return false;
  return modelsWithCreatedAt.includes(model);
}

/**
 * Check if the model has an updated_at field
 */
function hasUpdatedAtField(model: string | undefined): boolean {
  const modelsWithUpdatedAt = [
    'automation_jobs',
    'book_checkouts',
    'books',
    'equipment',
    'equipment_condition_reports',
    'equipment_maintenance',
    'equipment_reservations',
    'equipment_sessions',
    'equipment_usage_stats',
    'student_activities',
    'students',
    'system_config',
    'users',
  ];

  if (!model) return false;
  return modelsWithUpdatedAt.includes(model);
}

/**
 * Sanitize arguments for logging to prevent sensitive data exposure
 */
function sanitizeArgs(args: any): any {
  if (!args) return args;

  const sanitized = { ...args };

  // Remove sensitive data from logs
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  const sanitizeObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = { ...obj };
    sensitiveFields.forEach(field => {
      if (result[field]) {
        result[field] = '[REDACTED]';
      }
    });
    
    // Handle nested data objects
    if (result.data && typeof result.data === 'object') {
      result.data = sanitizeObject(result.data);
    }
    
    // Handle nested create/update objects in upsert
    if (result.create && typeof result.create === 'object') {
      result.create = sanitizeObject(result.create);
    }
    
    if (result.update && typeof result.update === 'object') {
      result.update = sanitizeObject(result.update);
    }
    
    return result;
  };

  return sanitizeObject(sanitized);
}

/**
 * Factory function to create and configure the middleware
 */
export function createPrismaMiddleware() {
  const middleware = prismaMiddleware();
  
  logger.info('Prisma middleware initialized for automatic ID and timestamp management');
  
  return middleware;
}

/**
 * Utility function to apply middleware to a Prisma client
 */
export function applyMiddlewareToClient(prisma: any): void {
  try {
    prisma.$use(createPrismaMiddleware());
    logger.info('Prisma middleware applied successfully');
  } catch (error) {
    logger.error('Failed to apply Prisma middleware', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Export the middleware function for direct use
 */
export default prismaMiddleware;