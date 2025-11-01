import crypto from 'crypto';
import fs from 'fs';
import { logger } from '@/utils/logger';

export interface EnvSecurityConfig {
  encryptionEnabled: boolean;
  encryptionKey?: string;
  validationEnabled: boolean;
  auditEnabled: boolean;
  requiredVariables: string[];
  sensitiveVariables: string[];
  allowedOrigins: string[];
  secureProductionDefaults: Record<string, string>;
}

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
  decrypted: Record<string, string>;
}

export interface EnvSecurityStatus {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
}

export class EnvSecurity {
  private config: EnvSecurityConfig;
  private encryptionKey: Buffer | null = null;
  private cache: Map<string, string> = new Map();

  constructor(config: Partial<EnvSecurityConfig> = {}) {
    this.config = {
      encryptionEnabled: true,
      validationEnabled: true,
      auditEnabled: true,
      requiredVariables: [
        'NODE_ENV',
        'DATABASE_URL',
        'JWT_SECRET',
        'REDIS_URL',
      ],
      sensitiveVariables: [
        'DATABASE_URL',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'API_KEYS',
        'SECRET_KEYS',
        'PASSWORD',
        'TOKEN',
        'KEY',
        'PRIVATE',
        'CREDENTIALS',
      ],
      allowedOrigins: [],
      secureProductionDefaults: {
        NODE_ENV: 'production',
        BCRYPT_ROUNDS: '12',
        RATE_LIMIT_WINDOW: '900000',
        RATE_LIMIT_MAX_REQUESTS: '100',
      },
      ...config,
    };

    this.initializeEncryption();
    this.validateEnvironment();
  }

  // Get environment variable with decryption
  get(key: string, defaultValue?: string): string {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        const cachedValue = this.cache.get(key);
        if (cachedValue !== undefined) {
          return cachedValue;
        }
      }

      let value = process.env[key];

      if (value === undefined) {
        value = defaultValue;
      }

      if (value === undefined) {
        throw new Error(`Environment variable ${key} is not set`);
      }

      // Decrypt if encryption is enabled and variable is sensitive
      if (this.config.encryptionEnabled && this.isSensitiveVariable(key)) {
        value = this.decryptValue(value);
      }

      // Cache the value
      this.cache.set(key, value);

      // Log access if audit is enabled
      if (this.config.auditEnabled) {
        this.logEnvironmentAccess(key, 'access');
      }

      return value;
    } catch (error) {
      logger.error('Failed to get environment variable', {
        error: (error as Error).message,
        key,
      });
      throw error;
    }
  }

  // Set environment variable with encryption
  set(key: string, value: string, encrypt: boolean = false): void {
    try {
      // Validate key and value
      if (this.config.validationEnabled) {
        this.validateVariable(key, value);
      }

      // Encrypt if needed
      let finalValue = value;
      if (encrypt && this.config.encryptionEnabled) {
        finalValue = this.encryptValue(value);
      }

      // Set in process.env
      process.env[key] = finalValue;

      // Update cache
      this.cache.set(key, value);

      // Log access if audit is enabled
      if (this.config.auditEnabled) {
        this.logEnvironmentAccess(key, 'set', { encrypted: encrypt });
      }

      logger.debug('Environment variable set', {
        key,
        encrypted: encrypt,
        sensitive: this.isSensitiveVariable(key),
      });
    } catch (error) {
      logger.error('Failed to set environment variable', {
        error: (error as Error).message,
        key,
      });
      throw error;
    }
  }

  // Validate all required environment variables
  validateEnvironment(): EnvValidationResult {
    const result: EnvValidationResult = {
      isValid: true,
      missing: [],
      invalid: [],
      warnings: [],
      decrypted: {},
    };

    try {
      // Check required variables
      for (const variable of this.config.requiredVariables) {
        const value = process.env[variable];
        if (!value) {
          result.missing.push(variable);
          result.isValid = false;
        } else {
          result.decrypted[variable] =
            this.config.encryptionEnabled && this.isSensitiveVariable(variable)
              ? this.decryptValue(value)
              : value;
        }
      }

      // Validate variable formats
      for (const [key, value] of Object.entries(process.env)) {
        if (value) {
          const validation = this.validateVariableFormat(key, value);
          if (!validation.isValid) {
            result.invalid.push(`${key}: ${validation.error}`);
            result.isValid = false;
          }
        }
      }

      // Security warnings
      if (process.env.NODE_ENV === 'production') {
        // Check for insecure defaults
        if (process.env.JWT_SECRET === 'default-secret-key') {
          result.warnings.push('Using default JWT secret in production');
          result.isValid = false;
        }

        if (
          process.env.BCRYPT_ROUNDS &&
          parseInt(process.env.BCRYPT_ROUNDS) < 10
        ) {
          result.warnings.push(
            'BCrypt rounds should be at least 10 in production',
          );
        }

        // Check for missing security headers
        if (!process.env.CORS_ORIGIN) {
          result.warnings.push('CORS origin not specified in production');
        }
      }

      // Log validation results
      if (result.isValid) {
        logger.info('Environment validation passed', {
          variablesChecked: this.config.requiredVariables.length,
          encrypted: this.config.encryptionEnabled,
        });
      } else {
        logger.error('Environment validation failed', {
          missing: result.missing,
          invalid: result.invalid,
          warnings: result.warnings,
        });
      }

      return result;
    } catch (error) {
      logger.error('Environment validation error', {
        error: (error as Error).message,
      });

      result.isValid = false;
      result.invalid.push(`Validation error: ${(error as Error).message}`);
      return result;
    }
  }

  // Encrypt sensitive environment variables
  encryptSensitiveVariables(envFilePath: string): void {
    try {
      if (!fs.existsSync(envFilePath)) {
        throw new Error(`Environment file not found: ${envFilePath}`);
      }

      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const lines = envContent.split('\n');
      const encryptedLines: string[] = [];

      for (const line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) {
          encryptedLines.push(line);
          continue;
        }

        const [rawKey = '', ...valueParts] = line.split('=');
        const key = rawKey.trim();
        const value = valueParts.join('=');

        if (key.length === 0) {
          encryptedLines.push(line);
          continue;
        }

        if (this.isSensitiveVariable(key)) {
          const encryptedValue = this.encryptValue(value);
          encryptedLines.push(`${key}=${encryptedValue}`);
        } else {
          encryptedLines.push(line);
        }
      }

      const encryptedContent = encryptedLines.join('\n');
      const encryptedFilePath = envFilePath.replace('.env', '.env.encrypted');

      fs.writeFileSync(encryptedFilePath, encryptedContent);

      logger.info('Environment variables encrypted', {
        inputFile: envFilePath,
        outputFile: encryptedFilePath,
        variablesEncrypted: lines.filter(currentLine => {
          if (currentLine.trim() === '' || currentLine.trim().startsWith('#')) {
            return false;
          }
          const [lineKey = ''] = currentLine.split('=');
          return this.isSensitiveVariable(lineKey.trim());
        }).length,
      });
    } catch (error) {
      logger.error('Failed to encrypt environment variables', {
        error: (error as Error).message,
        envFilePath,
      });
      throw error;
    }
  }

  // Load and decrypt environment from file
  loadEncryptedEnvironment(envFilePath: string): void {
    try {
      if (!fs.existsSync(envFilePath)) {
        throw new Error(`Encrypted environment file not found: ${envFilePath}`);
      }

      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) {
          continue;
        }

        const [rawKey = '', ...valueParts] = line.split('=');
        const key = rawKey.trim();
        const value = valueParts.join('=');

        if (key.length === 0) {
          continue;
        }

        if (this.isSensitiveVariable(key)) {
          const decryptedValue = this.decryptValue(value);
          process.env[key] = decryptedValue;
        } else {
          process.env[key] = value;
        }
      }

      logger.info('Encrypted environment loaded', {
        envFilePath,
        variablesLoaded: lines.filter(
          line => line.trim() !== '' && !line.trim().startsWith('#'),
        ).length,
      });
    } catch (error) {
      logger.error('Failed to load encrypted environment', {
        error: (error as Error).message,
        envFilePath,
      });
      throw error;
    }
  }

  // Generate secure random values
  generateSecureRandom(
    type: 'string' | 'hex' | 'base64',
    length: number = 32,
  ): string {
    try {
      const bytes = crypto.randomBytes(length);

      switch (type) {
        case 'string':
          return bytes
            .toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, length);
        case 'hex':
          return bytes.toString('hex');
        case 'base64':
          return bytes.toString('base64');
        default:
          throw new Error(`Unsupported random type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to generate secure random value', {
        error: (error as Error).message,
        type,
        length,
      });
      throw error;
    }
  }

  // Generate secure configuration values
  generateSecureConfig(): Record<string, string> {
    return {
      JWT_SECRET: this.generateSecureRandom('hex', 64),
      ENCRYPTION_KEY: this.generateSecureRandom('hex', 64),
      SESSION_SECRET: this.generateSecureRandom('base64', 48),
      API_SECRET: this.generateSecureRandom('hex', 32),
      CSRF_SECRET: this.generateSecureRandom('hex', 32),
      WEBHOOK_SECRET: this.generateSecureRandom('hex', 32),
    };
  }

  // Check if environment is secure
  isEnvironmentSecure(): EnvSecurityStatus {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for development defaults in production
    if (process.env.NODE_ENV === 'production') {
      if (process.env.JWT_SECRET === 'default-secret-key') {
        issues.push('Using default JWT secret in production');
        recommendations.push('Generate and set a secure JWT secret');
      }

      if (
        process.env.DATABASE_URL &&
        process.env.DATABASE_URL.includes('localhost')
      ) {
        issues.push('Using localhost database in production');
        recommendations.push('Use production database connection');
      }

      if (
        !process.env.REDIS_URL ||
        process.env.REDIS_URL.includes('localhost')
      ) {
        issues.push('Redis not properly configured for production');
        recommendations.push('Configure production Redis instance');
      }
    }

    // Check for weak encryption
    if (process.env.BCRYPT_ROUNDS && parseInt(process.env.BCRYPT_ROUNDS) < 10) {
      issues.push('BCrypt rounds too low');
      recommendations.push('Set BCRYPT_ROUNDS to at least 10');
    }

    // Check for missing security headers configuration
    if (!process.env.CORS_ORIGIN && process.env.NODE_ENV === 'production') {
      issues.push('CORS not properly configured');
      recommendations.push('Set specific CORS origins for production');
    }

    // Check for debug mode in production
    if (process.env.DEBUG && process.env.NODE_ENV === 'production') {
      issues.push('Debug mode enabled in production');
      recommendations.push('Disable debug mode in production');
    }

    return {
      isSecure: issues.length === 0,
      issues,
      recommendations,
    };
  }

  // Get environment security report
  getSecurityReport(): {
    config: EnvSecurityConfig;
    validation: EnvValidationResult;
    securityCheck: EnvSecurityStatus;
    encryptedVariables: string[];
    cacheStats: {
      size: number;
      keys: string[];
    };
  } {
    return {
      config: this.config,
      validation: this.validateEnvironment(),
      securityCheck: this.isEnvironmentSecure(),
      encryptedVariables: this.config.sensitiveVariables,
      cacheStats: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys()),
      },
    };
  }

  private initializeEncryption(): void {
    try {
      let key = this.config.encryptionKey || process.env.ENCRYPTION_KEY;

      if (!key) {
        // Generate a new encryption key
        key = this.generateSecureRandom('hex', 64);
        logger.warn('No encryption key provided, generated new key', {
          keyPreview: `${key.substring(0, 8)}...`,
        });
      }

      this.encryptionKey = Buffer.from(key, 'hex');

      if (this.encryptionKey.length !== 32) {
        throw new Error('Encryption key must be 32 bytes (64 hex characters)');
      }
    } catch (error) {
      logger.error('Failed to initialize encryption', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private ensureEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    return this.encryptionKey;
  }

  private isSensitiveVariable(key: string): boolean {
    const upperKey = key.toUpperCase();
    return this.config.sensitiveVariables.some(sensitive =>
      upperKey.includes(sensitive.toUpperCase()),
    );
  }

  private encryptValue(value: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        this.ensureEncryptionKey(),
        iv,
      );
      const encrypted = Buffer.concat([
        cipher.update(value, 'utf8'),
        cipher.final(),
      ]);

      return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
      logger.error('Failed to encrypt value', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private decryptValue(encryptedValue: string): string {
    try {
      const parts = encryptedValue.split(':');
      if (parts.length !== 2) {
        // Value might not be encrypted, return as-is
        return encryptedValue;
      }

      const [ivHex, encryptedHex] = parts;
      if (!ivHex || !encryptedHex) {
        return encryptedValue;
      }

      const iv = Buffer.from(ivHex, 'hex');
      const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        this.ensureEncryptionKey(),
        iv,
      );
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      // If decryption fails, return original value
      logger.warn('Failed to decrypt value, returning original', {
        error: (error as Error).message,
      });
      return encryptedValue;
    }
  }

  private validateVariable(key: string, value: string): void {
    // Key validation
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable name: ${key}`);
    }

    // Value validation
    if (typeof value !== 'string') {
      throw new Error(`Environment variable value must be a string: ${key}`);
    }

    // Length validation
    if (value.length > 10000) {
      throw new Error(`Environment variable value too long: ${key}`);
    }
  }

  private validateVariableFormat(
    key: string,
    value: string,
  ): { isValid: boolean; error?: string } {
    const upperKey = key.toUpperCase();

    // URL validation
    if (upperKey.includes('URL')) {
      try {
        new URL(value);
      } catch {
        return { isValid: false, error: 'Invalid URL format' };
      }
    }

    // Port validation
    if (upperKey.includes('PORT')) {
      const port = parseInt(value);
      if (isNaN(port) || port < 1 || port > 65535) {
        return { isValid: false, error: 'Invalid port number' };
      }
    }

    // Number validation
    if (
      upperKey.includes('ROUNDS') ||
      upperKey.includes('LIMIT') ||
      upperKey.includes('TIMEOUT')
    ) {
      const num = parseInt(value);
      if (isNaN(num) || num < 0) {
        return { isValid: false, error: 'Invalid number format' };
      }
    }

    // Boolean validation
    if (upperKey.includes('ENABLED') || upperKey.includes('DISABLED')) {
      if (!['true', 'false', '0', '1'].includes(value.toLowerCase())) {
        return { isValid: false, error: 'Invalid boolean format' };
      }
    }

    return { isValid: true };
  }

  private logEnvironmentAccess(
    key: string,
    action: 'access' | 'set',
    metadata?: Record<string, unknown>,
  ): void {
    try {
      const isSensitive = this.isSensitiveVariable(key);
      const logData: Record<string, unknown> = {
        key,
        action,
        sensitive: isSensitive,
        timestamp: new Date(),
        ...metadata,
      };

      if (!isSensitive) {
        logData.value = process.env[key];
      }

      logger.debug('Environment variable access', logData);
    } catch (error) {
      logger.error('Failed to log environment access', {
        error: (error as Error).message,
        key,
        action,
      });
    }
  }
}

// Export singleton instance
export const envSecurity = new EnvSecurity();

// Export convenience functions
export const getEnv = (key: string, defaultValue?: string) =>
  envSecurity.get(key, defaultValue);
export const setEnv = (key: string, value: string, encrypt?: boolean) =>
  envSecurity.set(key, value, encrypt);
export const validateEnv = () => envSecurity.validateEnvironment();
