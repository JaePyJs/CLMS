import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import { ValidationError } from '@/errors/error-types';
import { SecurityMonitoringService, SecurityEventType } from './securityMonitoringService';

// Input validation levels
export enum ValidationLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  STRICT = 'strict',
  PARANOID = 'paranoid'
}

// Input types
export enum InputType {
  STRING = 'string',
  NUMBER = 'number',
  EMAIL = 'email',
  URL = 'url',
  PHONE = 'phone',
  DATE = 'date',
  UUID = 'uuid',
  JSON = 'json',
  HTML = 'html',
  SQL = 'sql',
  XPATH = 'xpath',
  LDAP = 'ldap',
  COMMAND = 'command',
  FILENAME = 'filename',
  PATH = 'path'
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: string[];
  warnings: string[];
  metadata: {
    originalValue: any;
    validationLevel: ValidationLevel;
    inputType: InputType;
    processingTime: number;
    suspiciousPatterns?: string[];
  };
}

// Sanitization configuration
export interface SanitizationConfig {
  removeHTML: boolean;
  removeScripts: boolean;
  removeStyles: boolean;
  removeComments: boolean;
  removeEmptyTags: boolean;
  strictAttributeFiltering: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxStringLength?: number;
  allowUnicode?: boolean;
  normalizeWhitespace?: boolean;
}

// Advanced validation patterns
const SECURITY_PATTERNS = {
  // SQL injection patterns
  SQL_INJECTION: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|WHERE)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\bOR\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,
    /(\bUNION\s+SELECT\b)/i,
    /(\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b)/i,
    /(\b(GRANT|REVOKE|ALL\s+PRIVILEGES)\b)/i,
    /(\b(INFORMATION_SCHEMA|MYSQL|PG_|SYS\.|MASTER\.)\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bWAITFOR\s+DELAY\b)/i,
    /(\b(BENCHMARK|SLEEP)\s*\()/i
  ],

  // XSS patterns
  XSS: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /@import/i,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/i,
    /<img[^>]*src[^>]*javascript:/gi,
    /<\s*!\[CDATA\[/gi,
    /<\!\[endif\]>/gi
  ],

  // Command injection patterns
  COMMAND_INJECTION: [
    /(\||;|&|`|\$\(|\$\{|\$\()\s*[a-zA-Z0-9]/gi,
    /(\b(curl|wget|nc|netcat|telnet|ssh|ftp|sftp)\b)/i,
    /(\b(rm|mv|cp|cat|ls|ps|kill|chmod|chown)\b)/i,
    /(\b(python|perl|ruby|php|node|java)\b)/i,
    /(\b(echo|printf|print|cat|type)\b)/i,
    /(\b(whoami|id|uname|hostname|pwd)\b)/i,
    /(\.\.\/|\.\.\\)/g,
    /\/etc\/passwd/i,
    /\/bin\/sh/i,
    /cmd\.exe/i,
    /powershell/i
  ],

  // Path traversal patterns
  PATH_TRAVERSAL: [
    /(\.\.[\/\\])/g,
    /(%2e%2e[\/\\])/gi,
    /(\.\.%2f|\.\.%5c)/gi,
    /(%252e%252e[\/\\])/gi,
    /(\/proc\/|\/sys\/|\/dev\/)/i,
    /(windows\\system32|c:\\\\)/i,
    /(\/var\/log|\/tmp\/|\/temp\/)/i
  ],

  // LDAP injection patterns
  LDAP_INJECTION: [
    /(\*|\(|\)|\\|\||&|!|=)/gi,
    /(\*\)\(\)\(uid)/gi,
    /(\*\)\(\)\(|\(\&\)|\(\|))/gi,
    /(\*\)\(uid=\*)/gi,
    /(\*\)\(\)/gi,
    /(objectClass|cn|ou|dc)=/gi
  ],

  // NoSQL injection patterns
  NOSQL_INJECTION: [
    /(\$\{|\$\(|\$\[)/g,
    /(\$where|\$ne|\$gt|\$lt|\$in|\$nin)/gi,
    /(\$regex|\$exists|\$type)/gi,
    /(mapReduce|group|aggregate)/gi,
    /(\$eval|\$function)/gi
  ],

  // XXE injection patterns
  XXE_INJECTION: [
    /<!DOCTYPE[^>]*>/gi,
    /<\!ENTITY[^>]*>/gi,
    /<\!ATTLIST[^>]*>/gi,
    /<\!ELEMENT[^>]*>/gi,
    /(&[a-zA-Z]+;|&#\d+;)/gi,
    /(SYSTEM|PUBLIC)\s+"[^"]*"/gi
  ],

  // SSRF patterns
  SSRF: [
    /(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/gi,
    /(169\.254\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[0-1]\.)/gi,
    /(192\.168\.|::ffff:)/gi,
    /(file:\/\/|gopher:\/\/|dict:\/\/)/gi,
    /(\.internal|\.local|\.localhost)/gi
  ],

  // Cryptographic patterns
  CRYPTO: [
    /(private[_\s]?key|secret[_\s]?key|password|passwd)/gi,
    /(api[_\s]?key|token|jwt|session)/gi,
    /(aes|des|rsa|sha|md5|bcrypt)/gi,
    /(encrypt|decrypt|hash|cipher)/gi
  ]
};

// Default sanitization configurations
const DEFAULT_SANITIZATION_CONFIGS: Record<ValidationLevel, SanitizationConfig> = {
  [ValidationLevel.BASIC]: {
    removeHTML: true,
    removeScripts: true,
    removeStyles: false,
    removeComments: true,
    removeEmptyTags: false,
    strictAttributeFiltering: false,
    maxStringLength: 10000,
    allowUnicode: true,
    normalizeWhitespace: false
  },

  [ValidationLevel.STANDARD]: {
    removeHTML: true,
    removeScripts: true,
    removeStyles: true,
    removeComments: true,
    removeEmptyTags: true,
    strictAttributeFiltering: true,
    maxStringLength: 5000,
    allowUnicode: true,
    normalizeWhitespace: true
  },

  [ValidationLevel.STRICT]: {
    removeHTML: true,
    removeScripts: true,
    removeStyles: true,
    removeComments: true,
    removeEmptyTags: true,
    strictAttributeFiltering: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'u'],
    allowedAttributes: {
      '*': ['class'],
      'a': ['href']
    },
    maxStringLength: 2000,
    allowUnicode: false,
    normalizeWhitespace: true
  },

  [ValidationLevel.PARANOID]: {
    removeHTML: true,
    removeScripts: true,
    removeStyles: true,
    removeComments: true,
    removeEmptyTags: true,
    strictAttributeFiltering: true,
    allowedTags: [],
    allowedAttributes: {},
    maxStringLength: 1000,
    allowUnicode: false,
    normalizeWhitespace: true
  }
};

export class InputValidationService {
  private securityMonitor: SecurityMonitoringService;

  constructor(securityMonitor: SecurityMonitoringService) {
    this.securityMonitor = securityMonitor;
  }

  /**
   * Main validation method
   */
  public async validateInput(
    value: any,
    inputType: InputType,
    validationLevel: ValidationLevel = ValidationLevel.STANDARD,
    customConfig?: Partial<SanitizationConfig>
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        originalValue: value,
        validationLevel,
        inputType,
        processingTime: 0,
        suspiciousPatterns: []
      }
    };

    try {
      // Check for null/undefined values
      if (value === null || value === undefined) {
        result.isValid = false;
        result.errors.push('Value cannot be null or undefined');
        result.metadata.processingTime = Date.now() - startTime;
        return result;
      }

      // Convert to string for analysis
      const stringValue = String(value);

      // Check for suspicious patterns
      await this.checkSuspiciousPatterns(stringValue, result);

      // Type-specific validation
      await this.validateByType(value, inputType, result);

      // Apply sanitization
      if (result.isValid) {
        const config = { ...DEFAULT_SANITIZATION_CONFIGS[validationLevel], ...customConfig };
        result.sanitizedValue = await this.sanitizeValue(value, inputType, config);
      }

      result.metadata.processingTime = Date.now() - startTime;

      // Log security events if suspicious patterns detected
      if (result.metadata.suspiciousPatterns && result.metadata.suspiciousPatterns.length > 0) {
        await this.securityMonitor.recordSecurityEvent(
          SecurityEventType.SUSPICIOUS_INPUT,
          {} as Request,
          {
            suspiciousPatterns: result.metadata.suspiciousPatterns,
            inputType,
            validationLevel,
            originalValue: this.maskSensitiveData(stringValue)
          }
        );
      }

      return result;
    } catch (error) {
      logger.error('Input validation error', { error, inputType, validationLevel });
      result.isValid = false;
      result.errors.push('Validation processing failed');
      result.metadata.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Check for suspicious patterns
   */
  private async checkSuspiciousPatterns(value: string, result: ValidationResult): Promise<void> {
    const suspiciousPatterns: string[] = [];

    // Check each security pattern category
    for (const [category, patterns] of Object.entries(SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          suspiciousPatterns.push(`${category}: ${pattern.source}`);
          result.warnings.push(`Suspicious pattern detected: ${category}`);

          // Critical patterns that immediately invalidate input
          if (['SQL_INJECTION', 'COMMAND_INJECTION', 'XSS'].includes(category)) {
            result.isValid = false;
            result.errors.push(`Input contains malicious ${category.toLowerCase()} pattern`);
          }
        }
      }
    }

    // Check for encoding-based attacks
    if (this.isEncodedAttack(value)) {
      suspiciousPatterns.push('ENCODED_ATTACK');
      result.warnings.push('Input appears to be encoded, possible attack attempt');
    }

    // Check for excessive length
    if (value.length > 100000) { // 100KB
      suspiciousPatterns.push('EXCESSIVE_LENGTH');
      result.warnings.push('Input length exceeds reasonable limits');
    }

    // Check for high entropy (possible encryption keys/tokens)
    if (this.hasHighEntropy(value)) {
      suspiciousPatterns.push('HIGH_ENTROPY');
      result.warnings.push('Input has high entropy, possible sensitive data');
    }

    result.metadata.suspiciousPatterns = suspiciousPatterns;
  }

  /**
   * Validate by input type
   */
  private async validateByType(
    value: any,
    inputType: InputType,
    result: ValidationResult
  ): Promise<void> {
    switch (inputType) {
      case InputType.STRING:
        await this.validateString(value, result);
        break;
      case InputType.NUMBER:
        await this.validateNumber(value, result);
        break;
      case InputType.EMAIL:
        await this.validateEmail(value, result);
        break;
      case InputType.URL:
        await this.validateURL(value, result);
        break;
      case InputType.PHONE:
        await this.validatePhone(value, result);
        break;
      case InputType.DATE:
        await this.validateDate(value, result);
        break;
      case InputType.UUID:
        await this.validateUUID(value, result);
        break;
      case InputType.JSON:
        await this.validateJSON(value, result);
        break;
      case InputType.HTML:
        await this.validateHTML(value, result);
        break;
      case InputType.FILENAME:
        await this.validateFilename(value, result);
        break;
      case InputType.PATH:
        await this.validatePath(value, result);
        break;
      default:
        result.warnings.push(`Unknown input type: ${inputType}`);
    }
  }

  /**
   * String validation
   */
  private async validateString(value: any, result: ValidationResult): Promise<void> {
    if (typeof value !== 'string') {
      result.isValid = false;
      result.errors.push('Value must be a string');
      return;
    }

    // Check for control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
      result.isValid = false;
      result.errors.push('String contains invalid control characters');
    }

    // Check for Unicode normalization attacks
    if (this.hasUnicodeNormalizationAttack(value)) {
      result.warnings.push('String may contain Unicode normalization attack');
    }
  }

  /**
   * Number validation
   */
  private async validateNumber(value: any, result: ValidationResult): Promise<void> {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      result.isValid = false;
      result.errors.push('Value must be a valid number');
      return;
    }

    // Check for extremely large numbers
    if (Math.abs(num) > Number.MAX_SAFE_INTEGER) {
      result.warnings.push('Number exceeds safe integer range');
    }
  }

  /**
   * Email validation
   */
  private async validateEmail(value: any, result: ValidationResult): Promise<void> {
    const emailSchema = z.string().email();
    const validationResult = emailSchema.safeParse(value);

    if (!validationResult.success) {
      result.isValid = false;
      result.errors.push('Invalid email format');
      return;
    }

    // Additional checks
    const email = String(value);

    // Check for suspicious email patterns
    if (/(test|example|fake|dummy)\.com$/i.test(email)) {
      result.warnings.push('Email appears to be from a test domain');
    }

    if (email.length > 254) {
      result.isValid = false;
      result.errors.push('Email address too long');
    }
  }

  /**
   * URL validation
   */
  private async validateURL(value: any, result: ValidationResult): Promise<void> {
    const urlSchema = z.string().url();
    const validationResult = urlSchema.safeParse(value);

    if (!validationResult.success) {
      result.isValid = false;
      result.errors.push('Invalid URL format');
      return;
    }

    // Additional security checks
    const url = new URL(String(value));

    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'];
    if (dangerousProtocols.includes(url.protocol)) {
      result.isValid = false;
      result.errors.push(`Dangerous URL protocol: ${url.protocol}`);
    }

    // Check for SSRF
    if (SECURITY_PATTERNS.SSRF.some(pattern => pattern.test(url.hostname))) {
      result.isValid = false;
      result.errors.push('URL contains SSRF patterns');
    }
  }

  /**
   * Phone validation
   */
  private async validatePhone(value: any, result: ValidationResult): Promise<void> {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(String(value))) {
      result.isValid = false;
      result.errors.push('Invalid phone number format');
    }
  }

  /**
   * Date validation
   */
  private async validateDate(value: any, result: ValidationResult): Promise<void> {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      result.isValid = false;
      result.errors.push('Invalid date format');
      return;
    }

    // Check for reasonable date ranges
    const now = new Date();
    const minDate = new Date('1900-01-01');
    const maxDate = new Date('2100-12-31');

    if (date < minDate || date > maxDate) {
      result.warnings.push('Date is outside reasonable range');
    }
  }

  /**
   * UUID validation
   */
  private async validateUUID(value: any, result: ValidationResult): Promise<void> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(value))) {
      result.isValid = false;
      result.errors.push('Invalid UUID format');
    }
  }

  /**
   * JSON validation
   */
  private async validateJSON(value: any, result: ValidationResult): Promise<void> {
    try {
      if (typeof value === 'string') {
        JSON.parse(value);
      } else {
        JSON.stringify(value);
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push('Invalid JSON format');
    }

    // Check for JSON depth (prevents stack overflow)
    const jsonDepth = this.getJSONDepth(value);
    if (jsonDepth > 20) {
      result.warnings.push('JSON structure is too deep');
    }
  }

  /**
   * HTML validation
   */
  private async validateHTML(value: any, result: ValidationResult): Promise<void> {
    if (typeof value !== 'string') {
      result.isValid = false;
      result.errors.push('HTML value must be a string');
      return;
    }

    // Check for script tags and event handlers
    if (SECURITY_PATTERNS.XSS.some(pattern => pattern.test(value))) {
      result.warnings.push('HTML contains potentially dangerous elements');
    }
  }

  /**
   * Filename validation
   */
  private async validateFilename(value: any, result: ValidationResult): Promise<void> {
    const filename = String(value);

    // Check for dangerous characters
    if (/[<>:"|?*\\]/.test(filename)) {
      result.isValid = false;
      result.errors.push('Filename contains invalid characters');
    }

    // Check path traversal
    if (SECURITY_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(filename))) {
      result.isValid = false;
      result.errors.push('Filename contains path traversal patterns');
    }

    // Check for dangerous extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.js', '.jar'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (dangerousExtensions.includes(extension)) {
      result.warnings.push(`Filename has potentially dangerous extension: ${extension}`);
    }
  }

  /**
   * Path validation
   */
  private async validatePath(value: any, result: ValidationResult): Promise<void> {
    const path = String(value);

    // Check path traversal
    if (SECURITY_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(path))) {
      result.isValid = false;
      result.errors.push('Path contains traversal patterns');
    }

    // Check for absolute paths (usually not allowed in user input)
    if (/^([a-zA-Z]:)?[\/\\]/.test(path)) {
      result.warnings.push('Path appears to be absolute');
    }
  }

  /**
   * Sanitize value based on type and configuration
   */
  private async sanitizeValue(
    value: any,
    inputType: InputType,
    config: SanitizationConfig
  ): Promise<any> {
    let sanitized = value;

    // Convert to string for HTML sanitization
    const stringValue = String(value);

    // HTML sanitization
    if (config.removeHTML && [InputType.HTML, InputType.STRING].includes(inputType)) {
      sanitized = DOMPurify.sanitize(stringValue, {
        ALLOWED_TAGS: config.allowedTags || [],
        ALLOWED_ATTR: this.flattenAttributes(config.allowedAttributes || {}),
        REMOVE_SCRIPTS: config.removeScripts,
        REMOVE_STYLES: config.removeStyles,
        REMOVE_COMMENTS: config.removeComments,
        REMOVE_EMPTY_TAGS: config.removeEmptyTags
      });
    }

    // String length validation
    if (config.maxStringLength && typeof sanitized === 'string') {
      sanitized = sanitized.substring(0, config.maxStringLength);
    }

    // Unicode normalization
    if (!config.allowUnicode && typeof sanitized === 'string') {
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
    }

    // Whitespace normalization
    if (config.normalizeWhitespace && typeof sanitized === 'string') {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }

    // Type-specific sanitization
    switch (inputType) {
      case InputType.NUMBER:
        return this.sanitizeNumber(sanitized);
      case InputType.EMAIL:
        return this.sanitizeEmail(sanitized);
      case InputType.URL:
        return this.sanitizeURL(sanitized);
      case InputType.JSON:
        return this.sanitizeJSON(sanitized);
      default:
        return sanitized;
    }
  }

  /**
   * Sanitize number
   */
  private sanitizeNumber(value: any): number | null {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? null : num;
  }

  /**
   * Sanitize email
   */
  private sanitizeEmail(value: any): string {
    return String(value).toLowerCase().trim();
  }

  /**
   * Sanitize URL
   */
  private sanitizeURL(value: any): string {
    try {
      const url = new URL(String(value));
      return url.toString();
    } catch {
      return '';
    }
  }

  /**
   * Sanitize JSON
   */
  private sanitizeJSON(value: any): any {
    try {
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      return value;
    } catch {
      return null;
    }
  }

  /**
   * Helper methods
   */
  private isEncodedAttack(value: string): boolean {
    // Check for multiple encoding layers
    let decoded = value;
    let layers = 0;

    while (layers < 5) {
      const previouslyDecoded = decoded;
      decoded = decodeURIComponent(decoded);
      if (decoded === previouslyDecoded) break;
      layers++;
    }

    return layers > 1;
  }

  private hasHighEntropy(value: string): boolean {
    if (value.length < 20) return false;

    const uniqueChars = new Set(value).size;
    const entropy = uniqueChars / value.length;

    return entropy > 0.8;
  }

  private hasUnicodeNormalizationAttack(value: string): boolean {
    // Check for homoglyph attacks and other Unicode issues
    const normalized = value.normalize('NFKC');
    return normalized !== value;
  }

  private getJSONDepth(value: any, currentDepth = 0): number {
    if (currentDepth > 100) return currentDepth; // Prevent infinite recursion

    if (typeof value !== 'object' || value === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        const depth = this.getJSONDepth(value[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  private flattenAttributes(attributes: Record<string, string[]>): string[] {
    const result: string[] = [];
    for (const [tag, attrs] of Object.entries(attributes)) {
      if (tag === '*') {
        result.push(...attrs);
      } else {
        result.push(...attrs.map(attr => `${tag}.${attr}`));
      }
    }
    return result;
  }

  private maskSensitiveData(value: string): string {
    // Mask potentially sensitive data for logging
    if (value.length > 100) {
      return value.substring(0, 50) + '...[MASKED]...' + value.substring(value.length - 20);
    }
    return value.replace(/([a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})/g, '$1***$2');
  }

  /**
   * Express middleware for automatic input validation
   */
  public createValidationMiddleware(
    fieldMappings: Record<string, { type: InputType; level: ValidationLevel; required?: boolean }>
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const validationErrors: string[] = [];

        // Validate request body
        if (req.body) {
          for (const [field, config] of Object.entries(fieldMappings)) {
            if (req.body[field] !== undefined) {
              const result = await this.validateInput(
                req.body[field],
                config.type,
                config.level
              );

              if (!result.isValid) {
                validationErrors.push(`${field}: ${result.errors.join(', ')}`);
              } else {
                // Replace with sanitized value
                req.body[field] = result.sanitizedValue;
              }
            } else if (config.required) {
              validationErrors.push(`${field}: Required field is missing`);
            }
          }
        }

        // Validate query parameters
        if (req.query) {
          for (const [param, config] of Object.entries(fieldMappings)) {
            if (req.query[param] !== undefined) {
              const result = await this.validateInput(
                req.query[param],
                config.type,
                config.level
              );

              if (!result.isValid) {
                validationErrors.push(`${param}: ${result.errors.join(', ')}`);
              } else {
                req.query[param] = result.sanitizedValue;
              }
            }
          }
        }

        if (validationErrors.length > 0) {
          throw new ValidationError(`Input validation failed: ${validationErrors.join('; ')}`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

export default InputValidationService;