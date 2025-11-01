import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { FieldEncryption, DatabaseEncryption, EncryptionCompliance } from '@/utils/encryption';

/**
 * Middleware for automatic encryption/decryption of sensitive data
 * Provides transparent field-level encryption for database operations
 */
export class EncryptionMiddleware {
  /**
   * Middleware to encrypt request body data before processing
   */
  static encryptRequestBody = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Determine table name from route
      const tableName = this.extractTableNameFromRoute(req.path);
      if (!tableName) {
        return next();
      }

      // Encrypt sensitive fields in request body
      const encryptedBody = DatabaseEncryption.processRecordForStorage(req.body, tableName);
      req.body = encryptedBody;

      // Log encryption event
      EncryptionCompliance.logEncryptionEvent('encrypt_request', tableName, req.user?.id, {
        route: req.path,
        method: req.method,
        fieldsEncrypted: FieldEncryption.getSensitiveFieldsForTable(tableName).length
      });

      next();
    } catch (error) {
      logger.error('Error in encryption middleware (request)', {
        error: (error as Error).message,
        path: req.path,
        method: req.method
      });
      next(error);
    }
  };

  /**
   * Middleware to decrypt response data before sending
   */
  static decryptResponseData = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Override res.json to decrypt data before sending
      const originalJson = res.json;

      res.json = function(data: any) {
        try {
          const decryptedData = DatabaseEncryption.processRecordForRetrieval(data);

          // Log decryption event
          const tableName = EncryptionMiddleware.extractTableNameFromRoute(req.path);
          if (tableName) {
            EncryptionCompliance.logEncryptionEvent('decrypt_response', tableName, req.user?.id, {
              route: req.path,
              method: req.method
            });
          }

          return originalJson.call(this, decryptedData);
        } catch (error) {
          logger.error('Error decrypting response data', {
            error: (error as Error).message,
            path: req.path
          });
          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      logger.error('Error in encryption middleware (response)', {
        error: (error as Error).message,
        path: req.path
      });
      next(error);
    }
  };

  /**
   * Middleware to validate encryption configuration
   */
  static validateEncryption = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const compliance = EncryptionCompliance.checkComplianceStatus();

      if (!compliance.isCompliant) {
        logger.warn('Encryption compliance issues detected', compliance);

        // In production, you might want to block requests if encryption is not properly configured
        if (process.env.NODE_ENV === 'production' && compliance.issues.length > 0) {
          res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Encryption system is not properly configured',
            details: compliance.issues
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('Error validating encryption configuration', {
        error: (error as Error).message
      });
      next(error);
    }
  };

  /**
   * Middleware to add encryption headers to responses
   */
  static addEncryptionHeaders = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Add headers indicating encryption status
      res.setHeader('X-Encryption-Enabled', 'true');
      res.setHeader('X-Encryption-Version', '1.0');
      res.setHeader('X-Data-Classification', 'confidential');

      next();
    } catch (error) {
      logger.error('Error adding encryption headers', {
        error: (error as Error).message
      });
      next(error);
    }
  };

  /**
   * Middleware to mask sensitive data for unauthorized users
   */
  static maskSensitiveData = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user || !this.hasPermissionToViewSensitiveData(req.user)) {
        // Override res.json to mask sensitive data
        const originalJson = res.json;

        res.json = function(data: any) {
          try {
            const maskedData = EncryptionMiddleware.maskDataForUser(data, req.user);
            return originalJson.call(this, maskedData);
          } catch (error) {
            logger.error('Error masking sensitive data', {
              error: (error as Error).message,
              path: req.path
            });
            return originalJson.call(this, data);
          }
        };
      }

      next();
    } catch (error) {
      logger.error('Error in data masking middleware', {
        error: (error as Error).message,
        path: req.path
      });
      next(error);
    }
  };

  /**
   * Middleware to log encryption operations
   */
  static logEncryptionOperations = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const startTime = Date.now();

      // Log response completion
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const tableName = this.extractTableNameFromRoute(req.path);

        if (tableName) {
          EncryptionCompliance.logEncryptionEvent('api_request', tableName, req.user?.id, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          });
        }
      });

      next();
    } catch (error) {
      logger.error('Error in encryption logging middleware', {
        error: (error as Error).message
      });
      next(error);
    }
  };

  /**
   * Extract table name from request route
   */
  private static extractTableNameFromRoute(path: string): string | null {
    // Extract table name from REST API routes
    // /api/students -> students
    // /api/books/123 -> books
    // /api/users/profile -> users

    const match = path.match(/^\/api\/([^\/]+)/);
    return match && match[1] ? match[1] : null;
  }

  /**
   * Check if user has permission to view sensitive data
   */
  private static hasPermissionToViewSensitiveData(user: any): boolean {
    if (!user) return false;

    // Define roles that can view sensitive data
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'];
    return allowedRoles.includes(user.role);
  }

  /**
   * Mask sensitive data for users without proper permissions
   */
  private static maskDataForUser(data: any, user: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // If user has permission, return data as-is
    if (this.hasPermissionToViewSensitiveData(user)) {
      return data;
    }

    // Handle array of records
    if (Array.isArray(data)) {
      return data.map(item => this.maskRecord(item));
    }

    // Handle single record
    return this.maskRecord(data);
  }

  /**
   * Mask sensitive fields in a single record
   */
  private static maskRecord(record: any): any {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const masked = { ...record };

    // Mask common sensitive fields
    const fieldsToMask = [
      'first_name',
      'last_name',
      'email',
      'student_id',
      'section',
      'serial_number',
      'asset_tag'
    ];

    for (const field of fieldsToMask) {
      if (masked.hasOwnProperty(field) && masked[field]) {
        if (field === 'email') {
          masked[field] = this.maskEmail(masked[field]);
        } else if (field === 'student_id' || field === 'serial_number' || field === 'asset_tag') {
          masked[field] = this.maskId(masked[field]);
        } else {
          masked[field] = this.maskString(masked[field]);
        }
      }
    }

    return masked;
  }

  /**
   * Mask email addresses
   */
  private static maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return email;

    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    
    if (localPart.length <= 2) {
      return `${'*'.repeat(localPart.length)}@${domain}`;
    }

    const visibleLocal = localPart.slice(0, 2);
    const maskedLocal = '*'.repeat(localPart.length - 2);
    return `${visibleLocal}${maskedLocal}@${domain}`;
  }

  /**
   * Mask ID numbers
   */
  private static maskId(id: string): string {
    if (!id || typeof id !== 'string') return id;

    if (id.length <= 4) {
      return '*'.repeat(id.length);
    }

    const visible = id.slice(-4);
    const masked = '*'.repeat(id.length - 4);
    return masked + visible;
  }

  /**
   * Mask general strings
   */
  private static maskString(str: string, visibleChars: number = 2): string {
    if (!str || typeof str !== 'string') return str;

    if (str.length <= visibleChars) {
      return '*'.repeat(str.length);
    }

    const visible = str.slice(-visibleChars);
    const masked = '*'.repeat(str.length - visibleChars);
    return masked + visible;
  }
}

/**
 * Middleware to apply encryption to specific routes
 */
export const applyEncryptionToRoute = (tableName: string) => {
  return [
    EncryptionMiddleware.validateEncryption,
    EncryptionMiddleware.encryptRequestBody,
    EncryptionMiddleware.decryptResponseData,
    EncryptionMiddleware.maskSensitiveData,
    EncryptionMiddleware.logEncryptionOperations,
    EncryptionMiddleware.addEncryptionHeaders
  ];
};

/**
 * Middleware for read-only routes (no request body encryption)
 */
export const applyEncryptionToReadOnlyRoute = (tableName: string) => {
  return [
    EncryptionMiddleware.validateEncryption,
    EncryptionMiddleware.decryptResponseData,
    EncryptionMiddleware.maskSensitiveData,
    EncryptionMiddleware.logEncryptionOperations,
    EncryptionMiddleware.addEncryptionHeaders
  ];
};

export default EncryptionMiddleware;