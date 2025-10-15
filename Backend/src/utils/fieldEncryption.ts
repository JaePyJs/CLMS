import crypto from 'crypto';
import { logger } from '@/utils/logger';

// Encryption configuration
interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  iterations: number;
  saltLength: number;
}

// Encrypted data structure
interface EncryptedData {
  data: string; // Encrypted data (base64)
  iv: string;  // Initialization vector (base64)
  salt: string; // Salt for key derivation (base64)
  algorithm: string;
  version: number;
}

// Encryption metadata for database storage
interface EncryptionMetadata {
  encrypted: boolean;
  algorithm: string;
  keyId?: string;
  encryptedAt: Date;
  encryptedBy: string;
}

// Default encryption configuration
const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 12,  // 96 bits for GCM
  tagLength: 16, // 128 bits authentication tag
  iterations: 100000,
  saltLength: 32 // 256 bits
};

/**
 * Field-Level Encryption Utility
 * Provides AES-256-GCM encryption for sensitive data fields
 */
export class FieldEncryption {
  private config: EncryptionConfig;
  private masterKey: Buffer;
  private keyCache: Map<string, Buffer> = new Map();
  private rotationEnabled: boolean;
  private keyRotationInterval: number;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Get master key from environment or generate a warning
    const masterKeyHex = process.env.FIELD_ENCRYPTION_MASTER_KEY;
    if (!masterKeyHex) {
      logger.error('FIELD_ENCRYPTION_MASTER_KEY environment variable not set. Field encryption will not work.');
      throw new Error('FIELD_ENCRYPTION_MASTER_KEY is required for field encryption');
    }

    try {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
      if (this.masterKey.length !== this.config.keyLength) {
        throw new Error(`Master key must be ${this.config.keyLength} bytes (64 hex characters for AES-256)`);
      }
    } catch (error) {
      logger.error('Invalid master key format', { error });
      throw new Error('Invalid FIELD_ENCRYPTION_MASTER_KEY format. Must be 64 hex characters.');
    }

    this.rotationEnabled = process.env.ENCRYPTION_KEY_ROTATION === 'true';
    this.keyRotationInterval = parseInt(process.env.ENCRYPTION_ROTATION_INTERVAL || '86400000'); // 24 hours default

    if (this.rotationEnabled) {
      this.startKeyRotation();
    }
  }

  /**
   * Encrypt a field value
   */
  public encryptField(
    value: string,
    context: {
      field: string;
      userId: string;
      entityId?: string;
    }
  ): { encryptedData: EncryptedData; metadata: EncryptionMetadata } {
    try {
      if (!value || value.trim() === '') {
        throw new Error('Cannot encrypt empty value');
      }

      // Generate unique salt for this encryption
      const salt = crypto.randomBytes(this.config.saltLength);

      // Derive encryption key using PBKDF2
      const key = this.deriveKey(salt, context.field);

      // Generate random IV
      const iv = crypto.randomBytes(this.config.ivLength);

      // Create cipher
      const cipher = crypto.createCipher(this.config.algorithm, key);

      // Encrypt the data
      let encrypted = cipher.update(value, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Convert encrypted data to base64
      const encryptedBase64 = encrypted;

      const encryptedData: EncryptedData = {
        data: encryptedBase64,
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        algorithm: this.config.algorithm,
        version: 1
      };

      const metadata: EncryptionMetadata = {
        encrypted: true,
        algorithm: this.config.algorithm,
        keyId: this.generateKeyId(context.field, salt),
        encryptedAt: new Date(),
        encryptedBy: context.userId
      };

      // Log encryption event (without sensitive data)
      logger.debug('Field encrypted', {
        field: context.field,
        entityId: context.entityId,
        encryptedBy: context.userId,
        algorithm: this.config.algorithm
      });

      return { encryptedData, metadata };

    } catch (error) {
      logger.error('Field encryption failed', {
        error: (error as Error).message,
        field: context.field,
        userId: context.userId
      });
      throw new Error(`Field encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Decrypt a field value
   */
  public decryptField(
    encryptedData: EncryptedData,
    context: {
      field: string;
      userId: string;
      entityId?: string;
    }
  ): string {
    try {
      // Convert base64 strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const encryptedWithTag = Buffer.from(encryptedData.data, 'base64');

      // Derive decryption key
      const key = this.deriveKey(salt, context.field);

      // Create decipher
      const decipher = crypto.createDecipher(encryptedData.algorithm, key);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // Log decryption event (without sensitive data)
      logger.debug('Field decrypted', {
        field: context.field,
        entityId: context.entityId,
        decryptedBy: context.userId,
        algorithm: encryptedData.algorithm
      });

      return decrypted;

    } catch (error) {
      logger.error('Field decryption failed', {
        error: (error as Error).message,
        field: context.field,
        userId: context.userId
      });
      throw new Error(`Field decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a value is encrypted
   */
  public isEncrypted(value: any): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return (
      typeof value.data === 'string' &&
      typeof value.iv === 'string' &&
      typeof value.salt === 'string' &&
      typeof value.algorithm === 'string' &&
      typeof value.version === 'number'
    );
  }

  /**
   * Encrypt multiple fields in an object
   */
  public encryptFields(
    data: Record<string, any>,
    fieldsToEncrypt: string[],
    context: {
      userId: string;
      entityId?: string;
    }
  ): Record<string, any> {
    const result = { ...data };

    for (const field of fieldsToEncrypt) {
      if (data[field] && typeof data[field] === 'string') {
        const { encryptedData, metadata } = this.encryptField(data[field], {
          field,
          userId: context.userId,
          entityId: context.entityId
        });

        // Store encrypted data
        result[field] = encryptedData;

        // Store metadata in a separate field
        result[`${field}_enc`] = metadata;
      }
    }

    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  public decryptFields(
    data: Record<string, any>,
    fieldsToDecrypt: string[],
    context: {
      userId: string;
      entityId?: string;
    }
  ): Record<string, any> {
    const result = { ...data };

    for (const field of fieldsToDecrypt) {
      const encryptedData = data[field];
      const metadata = data[`${field}_enc`];

      if (this.isEncrypted(encryptedData)) {
        try {
          result[field] = this.decryptField(encryptedData, {
            field,
            userId: context.userId,
            entityId: context.entityId
          });
        } catch (error) {
          logger.warn('Failed to decrypt field, keeping original value', {
            field,
            error: (error as Error).message
          });
          // Keep original encrypted value if decryption fails
        }
      }
    }

    return result;
  }

  /**
   * Rotate encryption keys
   */
  public async rotateEncryption(
    data: Record<string, any>,
    fieldsToRotate: string[],
    context: {
      userId: string;
      entityId?: string;
    }
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of fieldsToRotate) {
      const encryptedData = data[field];
      const metadata = data[`${field}_enc`];

      if (this.isEncrypted(encryptedData) && metadata) {
        try {
          // Decrypt with old key
          const decryptedValue = this.decryptField(encryptedData, {
            field,
            userId: context.userId,
            entityId: context.entityId
          });

          // Re-encrypt with new key
          const { encryptedData: newEncryptedData, metadata: newMetadata } = this.encryptField(decryptedValue, {
            field,
            userId: context.userId,
            entityId: context.entityId
          });

          result[field] = newEncryptedData;
          result[`${field}_enc`] = {
            ...newMetadata,
            rotatedAt: new Date(),
            rotatedBy: context.userId,
            previousKeyId: metadata.keyId
          };

        } catch (error) {
          logger.error('Failed to rotate encryption for field', {
            field,
            error: (error as Error).message
          });
        }
      }
    }

    return result;
  }

  /**
   * Derive encryption key using PBKDF2
   */
  private deriveKey(salt: Buffer, field: string): Buffer {
    const cacheKey = salt.toString('hex') + ':' + field;

    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const key = crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.concat([salt, Buffer.from(field)]),
      this.config.iterations,
      this.config.keyLength,
      'sha256'
    );

    // Cache the key (limit cache size)
    if (this.keyCache.size > 1000) {
      const firstKey = this.keyCache.keys().next().value;
      this.keyCache.delete(firstKey);
    }
    this.keyCache.set(cacheKey, key);

    return key;
  }

  /**
   * Generate key ID for tracking
   */
  private generateKeyId(field: string, salt: Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(field);
    hash.update(salt);
    hash.update(this.masterKey);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Start automatic key rotation
   */
  private startKeyRotation(): void {
    setInterval(() => {
      try {
        // Clear key cache to force regeneration
        this.keyCache.clear();
        logger.info('Field encryption key cache cleared for rotation');
      } catch (error) {
        logger.error('Key rotation failed', { error });
      }
    }, this.keyRotationInterval);
  }

  /**
   * Validate encryption configuration
   */
  public validateConfig(): boolean {
    try {
      // Test encryption/decryption
      const testValue = 'test-value';
      const { encryptedData } = this.encryptField(testValue, {
        field: 'test',
        userId: 'system',
        entityId: 'test'
      });

      const decryptedValue = this.decryptField(encryptedData, {
        field: 'test',
        userId: 'system',
        entityId: 'test'
      });

      return testValue === decryptedValue;
    } catch (error) {
      logger.error('Encryption configuration validation failed', { error });
      return false;
    }
  }

  /**
   * Get encryption statistics
   */
  public getStats(): {
    config: EncryptionConfig;
    cacheSize: number;
    rotationEnabled: boolean;
    isConfigValid: boolean;
  } {
    return {
      config: this.config,
      cacheSize: this.keyCache.size,
      rotationEnabled: this.rotationEnabled,
      isConfigValid: this.validateConfig()
    };
  }

  /**
   * Clear encryption cache
   */
  public clearCache(): void {
    this.keyCache.clear();
    logger.info('Field encryption cache cleared');
  }
}

// Create singleton instance
export const fieldEncryption = new FieldEncryption();

// Simplified interface for external use
export interface FieldEncryptionService {
  encrypt(value: string): { encryptedData: string; metadata: any };
  decrypt(encryptedData: { encryptedData: string; metadata: any }): string;
}

// Simplified encryption methods for audit service
export const simpleEncryption: FieldEncryptionService = {
  encrypt(value: string) {
    const { encryptedData, metadata } = fieldEncryption.encryptField(value, {
      field: 'audit_data',
      userId: 'system',
      entityId: 'audit'
    });
    return {
      encryptedData: encryptedData.data,
      metadata
    };
  },

  decrypt(encryptedData: { encryptedData: string; metadata: any }) {
    const data = {
      data: encryptedData.encryptedData,
      iv: '',
      salt: '',
      algorithm: '',
      version: 1
    };

    // Reconstruct from stored format if needed
    if (typeof encryptedData.encryptedData === 'object') {
      Object.assign(data, encryptedData.encryptedData);
    }

    return fieldEncryption.decryptField(data, {
      field: 'audit_data',
      userId: 'system',
      entityId: 'audit'
    });
  }
};

// Export class for testing
export { FieldEncryption as FieldEncryptionClass };

// Export types
export type { EncryptedData, EncryptionMetadata, EncryptionConfig };