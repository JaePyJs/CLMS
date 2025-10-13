import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import Joi from 'joi';
import DOMPurify from 'isomorphic-dompurify';

export interface ValidationRule {
  field: string;
  schema: Joi.Schema;
  required?: boolean;
  sanitize?: boolean;
}

export interface SecurityValidationConfig {
  maxFieldLength: number;
  allowedMimeTypes: string[];
  maxFileSize: number;
  enableXSSProtection: boolean;
  enableSQLInjectionProtection: boolean;
  enableCSRFProtection: boolean;
}

export class InputValidator {
  private config: SecurityValidationConfig;
  private sqlInjectionPatterns: RegExp[];
  private xssPatterns: RegExp[];

  constructor(config: Partial<SecurityValidationConfig> = {}) {
    this.config = {
      maxFieldLength: 10000,
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      enableXSSProtection: true,
      enableSQLInjectionProtection: true,
      enableCSRFProtection: true,
      ...config
    };

    this.initializeSecurityPatterns();
  }

  private initializeSecurityPatterns(): void {
    // SQL Injection patterns
    this.sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"])/i,
      /(--)|(\/\*)|(\*\/)/,
      /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|SCRIPT)\s)/i,
      /(['"]\s*(OR|AND)\s*['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
      /(\bxp_cmdshell\b)/i,
      /(\bsp_oacreate\b)/i,
      /(\bexec\s*\()/i,
      /(\bwaitfor\s+delay\b)/i,
      /(\bbulk\s+insert\b)/i,
      /(\bopenrowset\b)/i,
      /(\bopendatasource\b)/i
    ];

    // XSS patterns
    this.xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<form[^>]*action[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /onfocus\s*=/gi,
      /onblur\s*=/gi,
      /onchange\s*=/gi,
      /onsubmit\s*=/gi,
      /<.*?event\s*=/gi,
      /expression\s*\(/gi,
      /url\s*\(/gi,
      /@import/gi,
      /<meta[^>]*http-equiv[^>]*>/gi,
      /<link[^>]*>/gi,
      /<style[^>]*>.*?<\/style>/gi
    ];
  }

  validateBody(rules: ValidationRule[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validationErrors: Record<string, string> = {};

        for (const rule of rules) {
          const value = req.body[rule.field];

          // Check required fields
          if (rule.required && (value === undefined || value === null || value === '')) {
            validationErrors[rule.field] = `${rule.field} is required`;
            continue;
          }

          // Skip validation if field is not provided and not required
          if (value === undefined || value === null) {
            continue;
          }

          // Check field length
          if (typeof value === 'string' && value.length > this.config.maxFieldLength) {
            validationErrors[rule.field] = `${rule.field} exceeds maximum length`;
            continue;
          }

          // Validate against schema
          const { error } = rule.schema.validate(value);
          if (error) {
            validationErrors[rule.field] = error.details[0].message;
            continue;
          }

          // Security validations
          if (typeof value === 'string') {
            // Check for SQL injection
            if (this.config.enableSQLInjectionProtection && this.detectSQLInjection(value)) {
              validationErrors[rule.field] = `${rule.field} contains potentially malicious content`;
              continue;
            }

            // Check for XSS
            if (this.config.enableXSSProtection && this.detectXSS(value)) {
              validationErrors[rule.field] = `${rule.field} contains potentially dangerous content`;
              continue;
            }

            // Sanitize if required
            if (rule.sanitize) {
              req.body[rule.field] = this.sanitizeInput(value);
            }
          }
        }

        if (Object.keys(validationErrors).length > 0) {
          logger.warn('Input validation failed', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            errors: validationErrors,
            body: this.sanitizeForLogging(req.body)
          });

          res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: validationErrors
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Input validation error', {
          error: (error as Error).message,
          ip: req.ip
        });

        res.status(500).json({
          success: false,
          error: 'Validation error occurred'
        });
      }
    };
  }

  validateQuery(rules: ValidationRule[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validationErrors: Record<string, string> = {};

        for (const rule of rules) {
          const value = req.query[rule.field];

          // Check required fields
          if (rule.required && (value === undefined || value === null || value === '')) {
            validationErrors[rule.field] = `${rule.field} is required`;
            continue;
          }

          // Skip validation if field is not provided and not required
          if (value === undefined || value === null) {
            continue;
          }

          // Convert to string if needed
          const stringValue = Array.isArray(value) ? value.join(',') : String(value);

          // Check field length
          if (stringValue.length > this.config.maxFieldLength) {
            validationErrors[rule.field] = `${rule.field} exceeds maximum length`;
            continue;
          }

          // Validate against schema
          const { error } = rule.schema.validate(stringValue);
          if (error) {
            validationErrors[rule.field] = error.details[0].message;
            continue;
          }

          // Security validations
          if (this.config.enableSQLInjectionProtection && this.detectSQLInjection(stringValue)) {
            validationErrors[rule.field] = `${rule.field} contains potentially malicious content`;
            continue;
          }

          if (this.config.enableXSSProtection && this.detectXSS(stringValue)) {
            validationErrors[rule.field] = `${rule.field} contains potentially dangerous content`;
            continue;
          }

          // Update query with sanitized value
          req.query[rule.field] = rule.sanitize ? this.sanitizeInput(stringValue) : stringValue;
        }

        if (Object.keys(validationErrors).length > 0) {
          logger.warn('Query validation failed', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            errors: validationErrors,
            query: this.sanitizeForLogging(req.query)
          });

          res.status(400).json({
            success: false,
            error: 'Query validation failed',
            details: validationErrors
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('Query validation error', {
          error: (error as Error).message,
          ip: req.ip
        });

        res.status(500).json({
          success: false,
          error: 'Query validation error occurred'
        });
      }
    };
  }

  validateFile() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.file) {
          res.status(400).json({
            success: false,
            error: 'No file uploaded'
          });
          return;
        }

        const file = req.file;

        // Check file size
        if (file.size > this.config.maxFileSize) {
          res.status(400).json({
            success: false,
            error: `File size exceeds maximum allowed size of ${this.config.maxFileSize / 1024 / 1024}MB`
          });
          return;
        }

        // Check MIME type
        if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            error: `File type ${file.mimetype} is not allowed`
          });
          return;
        }

        // Additional file content validation
        if (this.isFileSuspicious(file)) {
          logger.warn('Suspicious file upload detected', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size
          });

          res.status(400).json({
            success: false,
            error: 'File content appears to be suspicious'
          });
          return;
        }

        next();
      } catch (error) {
        logger.error('File validation error', {
          error: (error as Error).message,
          ip: req.ip
        });

        res.status(500).json({
          success: false,
          error: 'File validation error occurred'
        });
      }
    };
  }

  private detectSQLInjection(input: string): boolean {
    return this.sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  private detectXSS(input: string): boolean {
    return this.xssPatterns.some(pattern => pattern.test(input));
  }

  private sanitizeInput(input: string): string {
    // Remove potentially dangerous HTML
    let sanitized = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    // Additional sanitization for SQL injection patterns
    sanitized = sanitized.replace(/['"\\]/g, '');

    // Remove suspicious characters
    sanitized = sanitized.replace(/[<>&\r\n\t]/g, '');

    return sanitized.trim();
  }

  private isFileSuspicious(file: Express.Multer.File): boolean {
    // Check for executable file signatures
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE/Windows executable
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF/Linux executable
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Mach-O/macOS executable
      Buffer.from([0x25, 0x50, 0x44, 0x46]) // PDF (but check content)
    ];

    // Check file header (first few bytes)
    const buffer = file.buffer;
    for (const signature of executableSignatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        return true;
      }
    }

    // Check for script content in text files
    if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
      const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
      if (this.detectSQLInjection(content) || this.detectXSS(content)) {
        return true;
      }
    }

    return false;
  }

  private sanitizeForLogging(data: any): any {
    try {
      const sanitized = JSON.parse(JSON.stringify(data));

      const sensitiveFields = [
        'password', 'token', 'secret', 'key', 'auth',
        'creditCard', 'ssn', 'socialSecurityNumber',
        'bankAccount', 'privateKey', 'apiKey'
      ];

      const sanitizeObject = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) {
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }

        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

          if (isSensitive) {
            sanitized[key] = '[REDACTED]';
          } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
          } else if (typeof value === 'string' && value.length > 100) {
            sanitized[key] = value.substring(0, 100) + '...';
          } else {
            sanitized[key] = value;
          }
        }

        return sanitized;
      };

      return sanitizeObject(sanitized);
    } catch (error) {
      return '[UNABLE TO SANITIZE FOR LOGGING]';
    }
  }

  // Common validation schemas
  static schemas = {
    id: Joi.string().uuid().required(),
    email: Joi.string().email().max(255),
    username: Joi.string().alphanum().min(3).max(50),
    password: Joi.string().min(8).max(128).pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    ),
    name: Joi.string().min(1).max(100).pattern(/^[a-zA-Z\s'-]+$/),
    phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20),
    date: Joi.date().iso(),
    boolean: Joi.boolean(),
    positiveInteger: Joi.number().integer().min(1),
    nonNegativeInteger: Joi.number().integer().min(0),
    decimal: Joi.number().min(0),
    url: Joi.string().uri(),
    text: Joi.string().max(1000),
    longText: Joi.string().max(10000),
    role: Joi.string().valid('SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'ASSISTANT', 'TEACHER', 'VIEWER'),
    grade: Joi.string().valid('PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'),
    searchTerm: Joi.string().min(1).max(100),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
    ipAddress: Joi.string().ip(),
    macAddress: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
    barcode: Joi.string().alphanum().length(8, 20),
    accessToken: Joi.string().min(10).max(500),
    refreshToken: Joi.string().min(10).max(500),
    mfaToken: Joi.string().length(6).pattern(/^\d+$/),
    sessionId: Joi.string().min(10).max(100)
  };
}

// Export singleton instance
export const inputValidator = new InputValidator();

// Export convenience functions
export const validateBody = (rules: ValidationRule[]) => inputValidator.validateBody(rules);
export const validateQuery = (rules: ValidationRule[]) => inputValidator.validateQuery(rules);
export const validateFile = () => inputValidator.validateFile();