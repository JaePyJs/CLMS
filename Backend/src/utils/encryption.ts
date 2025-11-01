import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
// import configuration from '@/config'; // Config not available, using environment variables directly
import { logger } from './logger';

// Enhanced encryption algorithms and constants
class EncryptionConstants {
  static readonly ALGORITHM = 'aes-256-gcm';
  static readonly KEY_ALGORITHM = 'aes-256-cbc'; // For key encryption
  static readonly KEY_LENGTH = 32;
  static readonly IV_LENGTH = 16;
  static readonly TAG_LENGTH = 16;
  static readonly SALT_LENGTH = 32;
  static readonly ITERATIONS = 100000;
  static readonly KEY_VERSION = '1.0';

  // Data classification levels
  static readonly CLASSIFICATION = {
    PUBLIC: 'public',
    INTERNAL: 'internal',
    CONFIDENTIAL: 'confidential',
    RESTRICTED: 'restricted',
  } as const;

  // Encryption contexts for different data types
  static readonly CONTEXTS = {
    STUDENT_PII: 'student-pii',
    USER_CREDENTIALS: 'user-credentials',
    AUDIT_DATA: 'audit-data',
    SYSTEM_CONFIG: 'system-config',
    EQUIPMENT_DATA: 'equipment-data',
  } as const;
}

// Enhanced key management system
class KeyManager {
  private static readonly KEY_DIR = process.env.ENCRYPTION_KEY_DIR || './keys';
  private static readonly MASTER_KEY_FILE = 'master.key';
  private static readonly DATA_KEY_FILE = 'data.key';
  private static readonly KEY_ROTATION_INTERVAL = 90 * 24 * 60 * 60 * 1000; // 90 days
  private static masterKey: Buffer | null = null;
  private static dataKeys: Map<
    string,
    { key: Buffer; created: Date; version: string }
  > = new Map();

  static async initialize(): Promise<void> {
    try {
      await this.ensureKeyDirectory();
      await this.loadOrCreateMasterKey();
      await this.loadOrCreateDataKeys();
      logger.info('Key manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize key manager', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private static async ensureKeyDirectory(): Promise<void> {
    try {
      await fs.access(this.KEY_DIR);
    } catch {
      await fs.mkdir(this.KEY_DIR, { mode: 0o700 }); // Restrictive permissions
    }
  }

  private static async loadOrCreateMasterKey(): Promise<void> {
    const masterKeyPath = path.join(this.KEY_DIR, this.MASTER_KEY_FILE);

    try {
      const masterKeyData = await fs.readFile(masterKeyPath);
      this.masterKey = masterKeyData;
      logger.info('Master key loaded from disk');
    } catch {
      // Create new master key if it doesn't exist
      const envKey = process.env.ENCRYPTION_MASTER_KEY;
      if (envKey) {
        // Use environment variable for initial setup
        this.masterKey = crypto.scryptSync(
          envKey,
          'master-key',
          EncryptionConstants.KEY_LENGTH,
        );
      } else {
        // Generate new master key
        this.masterKey = crypto.randomBytes(EncryptionConstants.KEY_LENGTH);
        logger.warn('Generated new master key - BACK UP IMMEDIATELY!');
      }

      await fs.writeFile(masterKeyPath, this.masterKey, { mode: 0o600 });
      logger.info('Master key created and saved');
    }
  }

  private static async loadOrCreateDataKeys(): Promise<void> {
    const dataKeyPath = path.join(this.KEY_DIR, this.DATA_KEY_FILE);

    try {
      const dataKeyData = await fs.readFile(dataKeyPath, 'utf8');
      const keys = JSON.parse(dataKeyData);

      for (const [context, keyInfo] of Object.entries(keys)) {
        if (
          this.masterKey &&
          keyInfo &&
          typeof keyInfo === 'object' &&
          'encrypted' in keyInfo &&
          'created' in keyInfo &&
          'version' in keyInfo
        ) {
          const decryptedKey = this.decryptKey(
            keyInfo.encrypted as string,
            this.masterKey,
          );
          this.dataKeys.set(context, {
            key: decryptedKey,
            created: new Date(keyInfo.created as string),
            version: keyInfo.version as string,
          });
        }
      }

      logger.info(`Loaded ${this.dataKeys.size} data keys`);
    } catch {
      // Create new data keys for all contexts
      await this.generateDataKeys();
    }
  }

  private static async generateDataKeys(): Promise<void> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    const keys: Record<string, any> = {};

    for (const context of Object.values(EncryptionConstants.CONTEXTS)) {
      const dataKey = crypto.randomBytes(EncryptionConstants.KEY_LENGTH);
      const encryptedKey = this.encryptKey(dataKey, this.masterKey);

      this.dataKeys.set(context, {
        key: dataKey,
        created: new Date(),
        version: EncryptionConstants.KEY_VERSION,
      });

      keys[context] = {
        encrypted: encryptedKey,
        created: new Date().toISOString(),
        version: EncryptionConstants.KEY_VERSION,
      };
    }

    const dataKeyPath = path.join(this.KEY_DIR, this.DATA_KEY_FILE);
    await fs.writeFile(dataKeyPath, JSON.stringify(keys, null, 2), {
      mode: 0o600,
    });
    logger.info('Generated and saved new data keys');
  }

  private static encryptKey(key: Buffer, masterKey: Buffer): string {
    const iv = crypto.randomBytes(EncryptionConstants.IV_LENGTH);
    const cipher = crypto.createCipher(
      EncryptionConstants.KEY_ALGORITHM,
      masterKey,
    );

    let encrypted = cipher.update(key);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return JSON.stringify({
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
    });
  }

  private static decryptKey(encryptedKey: string, masterKey: Buffer): Buffer {
    const keyData = JSON.parse(encryptedKey);
    const iv = Buffer.from(keyData.iv, 'base64');
    const encrypted = Buffer.from(keyData.encrypted, 'base64');

    const decipher = crypto.createDecipher(
      EncryptionConstants.KEY_ALGORITHM,
      masterKey,
    );
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  static getKey(context: string): Buffer {
    const keyInfo = this.dataKeys.get(context);
    if (!keyInfo) {
      throw new Error(`No key found for context: ${context}`);
    }
    return keyInfo.key;
  }

  static async rotateKeys(): Promise<void> {
    logger.info('Starting key rotation process');

    // Backup old keys
    await this.backupKeys();

    // Generate new data keys
    await this.generateDataKeys();

    // Schedule re-encryption of existing data
    // This would typically be handled by a background job

    logger.info('Key rotation completed');
  }

  private static async backupKeys(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.KEY_DIR, `backup-${timestamp}`);

    try {
      await fs.mkdir(backupDir, { mode: 0o700 });

      // Copy key files to backup directory
      const masterKeyPath = path.join(this.KEY_DIR, this.MASTER_KEY_FILE);
      const dataKeyPath = path.join(this.KEY_DIR, this.DATA_KEY_FILE);

      await fs.copyFile(
        masterKeyPath,
        path.join(backupDir, this.MASTER_KEY_FILE),
      );
      await fs.copyFile(dataKeyPath, path.join(backupDir, this.DATA_KEY_FILE));

      logger.info(`Keys backed up to: ${backupDir}`);
    } catch (error) {
      logger.error('Failed to backup keys', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  static getKeyInfo(): Array<{
    context: string;
    created: Date;
    version: string;
  }> {
    return Array.from(this.dataKeys.entries()).map(([context, info]) => ({
      context,
      created: info.created,
      version: info.version,
    }));
  }
}

// Enhanced field encryption with classification support
class FieldEncryption {
  private static readonly ALGORITHM = EncryptionConstants.ALGORITHM;
  private static readonly KEY_LENGTH = EncryptionConstants.KEY_LENGTH;
  private static readonly IV_LENGTH = EncryptionConstants.IV_LENGTH;
  private static readonly TAG_LENGTH = EncryptionConstants.TAG_LENGTH;

  // Define sensitive fields and their classification
  private static readonly SENSITIVE_FIELDS: Record<
    string,
    {
      classification: string;
      context: string;
      required: boolean;
    }
  > = {
    // Student PII
    'students.first_name': {
      classification: 'confidential',
      context: 'student-pii',
      required: true,
    },
    'students.last_name': {
      classification: 'confidential',
      context: 'student-pii',
      required: true,
    },
    'students.student_id': {
      classification: 'confidential',
      context: 'student-pii',
      required: true,
    },
    'students.section': {
      classification: 'internal',
      context: 'student-pii',
      required: false,
    },

    // User credentials
    'users.email': {
      classification: 'confidential',
      context: 'user-credentials',
      required: false,
    },
    'users.full_name': {
      classification: 'internal',
      context: 'user-credentials',
      required: false,
    },
    'users.username': {
      classification: 'confidential',
      context: 'user-credentials',
      required: true,
    },
    'users.password': {
      classification: 'restricted',
      context: 'user-credentials',
      required: true,
    },

    // Equipment data
    'equipment.serial_number': {
      classification: 'internal',
      context: 'equipment-data',
      required: false,
    },
    'equipment.asset_tag': {
      classification: 'internal',
      context: 'equipment-data',
      required: false,
    },

    // System configuration
    'system_config.value': {
      classification: 'restricted',
      context: 'system-config',
      required: false,
    },

    // Audit data
    'audit_logs.ip_address': {
      classification: 'internal',
      context: 'audit-data',
      required: false,
    },
    'audit_logs.new_values': {
      classification: 'confidential',
      context: 'audit-data',
      required: false,
    },
    'audit_logs.old_values': {
      classification: 'confidential',
      context: 'audit-data',
      required: false,
    },
  };

  static async initialize(): Promise<void> {
    await KeyManager.initialize();
  }

  private static getEncryptionKey(context: string): Buffer {
    return KeyManager.getKey(context);
  }

  static encryptField(
    data: string,
    context: string,
  ): {
    encrypted: string;
    iv: string;
    tag: string;
    context: string;
    version: string;
    timestamp: string;
  } {
    if (!data) {
      data = '';
    }

    const key = this.getEncryptionKey(context);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from(`clms-${context}`, 'utf8'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      context,
      version: EncryptionConstants.KEY_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  static decryptField(
    encryptedData: string,
    iv: string,
    tag: string,
    context: string,
  ): string {
    if (!encryptedData) {
      return '';
    }

    try {
      const key = this.getEncryptionKey(context);
      const decipher = crypto.createDecipher(this.ALGORITHM, key);
      decipher.setAAD(Buffer.from(`clms-${context}`, 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', {
        error: (error as Error).message,
        context,
        dataLength: encryptedData.length,
      });
      throw new Error(`Decryption failed for context: ${context}`);
    }
  }

  static encryptObject(
    obj: Record<string, any>,
    sensitiveFields: string[],
  ): Record<string, any> {
    const encrypted = { ...obj };

    for (const field of sensitiveFields) {
      if (obj.hasOwnProperty(field) && obj[field]) {
        const fieldInfo = this.SENSITIVE_FIELDS[field];
        if (!fieldInfo) {
          logger.warn(`No encryption configuration found for field: ${field}`);
          continue;
        }

        const fieldData =
          typeof obj[field] === 'string'
            ? obj[field]
            : JSON.stringify(obj[field]);
        const encryptedValue = this.encryptField(fieldData, fieldInfo.context);

        encrypted[field] = {
          encrypted: true,
          data: encryptedValue.encrypted,
          iv: encryptedValue.iv,
          tag: encryptedValue.tag,
          context: encryptedValue.context,
          classification: fieldInfo.classification,
          version: encryptedValue.version,
          timestamp: encryptedValue.timestamp,
        };
      }
    }

    return encrypted;
  }

  static decryptObject(obj: Record<string, any>): Record<string, any> {
    const decrypted = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && value.encrypted === true) {
        try {
          decrypted[key] = this.decryptField(
            value.data,
            value.iv,
            value.tag,
            value.context,
          );
        } catch (error) {
          logger.error(`Failed to decrypt field: ${key}`, {
            error: (error as Error).message,
          });
          // Keep the encrypted value if decryption fails
          decrypted[key] = `[ENCRYPTED: Decryption failed]`;
        }
      }
    }

    return decrypted;
  }

  // Check if a field should be encrypted
  static isSensitiveField(tableName: string, fieldName: string): boolean {
    const fieldKey = `${tableName}.${fieldName}`;
    return this.SENSITIVE_FIELDS.hasOwnProperty(fieldKey);
  }

  // Get field classification
  static getFieldClassification(
    tableName: string,
    fieldName: string,
  ): string | null {
    const fieldKey = `${tableName}.${fieldName}`;
    const fieldInfo = this.SENSITIVE_FIELDS[fieldKey];
    return fieldInfo ? fieldInfo.classification : null;
  }

  // Get encryption context for a field
  static getFieldContext(tableName: string, fieldName: string): string | null {
    const fieldKey = `${tableName}.${fieldName}`;
    const fieldInfo = this.SENSITIVE_FIELDS[fieldKey];
    return fieldInfo ? fieldInfo.context : null;
  }

  // Get all sensitive fields for a table
  static getSensitiveFieldsForTable(tableName: string): string[] {
    return Object.keys(this.SENSITIVE_FIELDS)
      .filter(fieldKey => fieldKey.startsWith(`${tableName}.`))
      .map(fieldKey => fieldKey.replace(`${tableName}.`, ''));
  }

  // Validate encrypted data integrity
  static validateEncryptedData(encryptedValue: any): boolean {
    if (!encryptedValue || typeof encryptedValue !== 'object') {
      return false;
    }

    const requiredFields = [
      'encrypted',
      'data',
      'iv',
      'tag',
      'context',
      'version',
      'timestamp',
    ];
    return requiredFields.every(field => encryptedValue.hasOwnProperty(field));
  }
}

class TokenRotation {
  private static readonly TOKEN_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  static shouldRotateToken(lastRotation: Date): boolean {
    const now = new Date();
    const lastRotationTime = lastRotation.getTime();
    const nowTime = now.getTime();

    return nowTime - lastRotationTime > this.TOKEN_ROTATION_INTERVAL;
  }

  static generateTokenTimestamp(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}_${random}`;
  }

  static extractTokenTimestamp(token: string): Date | null {
    try {
      const tokenParts = token.split('.');
      const encodedPayload = tokenParts[1];

      if (!encodedPayload) {
        return null;
      }

      const payload = JSON.parse(atob(encodedPayload));
      return new Date(payload.iat * 1000);
    } catch {
      return null;
    }
  }
}

class PasswordUtils {
  static generatePasswordRequirements(): {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
  } {
    return {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    };
  }

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const requirements = this.generatePasswordRequirements();
    const errors: string[] = [];

    if (password.length < requirements.minLength) {
      errors.push(
        `Password must be at least ${requirements.minLength} characters long`,
      );
    }

    if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (requirements.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (requirements.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      requirements.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';

    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}

class DataMasking {
  private static maskString(str: string, visibleChars: number = 4): string {
    if (str.length <= visibleChars) {
      return '*'.repeat(str.length);
    }

    const visible = str.slice(-visibleChars);
    const masked = '*'.repeat(str.length - visibleChars);
    return masked + visible;
  }

  static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return email;
    }
    if (localPart.length <= 2) {
      return `${'*'.repeat(localPart.length)}@${domain}`;
    }

    const visibleLocal = localPart.slice(0, 2);
    const maskedLocal = '*'.repeat(localPart.length - 2);
    return `${visibleLocal}${maskedLocal}@${domain}`;
  }

  static maskPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      return '*'.repeat(cleaned.length);
    }

    const visible = cleaned.slice(-4);
    const masked = '*'.repeat(cleaned.length - 4);

    return `***-***-${visible}`;
  }

  static maskSSN(ssn: string): string {
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length !== 9) {
      return '*'.repeat(ssn.length);
    }

    return `***-**-${cleaned.slice(-4)}`;
  }
}

// Convenience functions for FERPA service compatibility
export const encryptData = (data: string): string => {
  try {
    const result = FieldEncryption.encryptField(data, 'default');
    return JSON.stringify(result);
  } catch (error) {
    logger.error('Error encrypting data', { error: (error as Error).message });
    throw new Error('Encryption failed');
  }
};

export const decryptData = (encryptedData: string): string => {
  try {
    const parsed = JSON.parse(encryptedData);
    return FieldEncryption.decryptField(
      parsed.encrypted,
      parsed.iv,
      parsed.tag,
      parsed.context,
    );
  } catch (error) {
    logger.error('Error decrypting data', { error: (error as Error).message });
    throw new Error('Decryption failed');
  }
};

export const encryptObject = (obj: any): string => {
  try {
    return encryptData(JSON.stringify(obj));
  } catch (error) {
    logger.error('Error encrypting object', {
      error: (error as Error).message,
    });
    throw new Error('Object encryption failed');
  }
};

export const decryptObject = (encryptedData: string): any => {
  try {
    const decrypted = decryptData(encryptedData);
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Error decrypting object', {
      error: (error as Error).message,
    });
    throw new Error('Object decryption failed');
  }
};

// Enhanced compliance and audit logging
class EncryptionCompliance {
  private static auditLog: Array<{
    timestamp: Date;
    action: string;
    context: string;
    userId?: string;
    metadata?: any;
  }> = [];

  static logEncryptionEvent(
    action: string,
    context: string,
    userId?: string,
    metadata?: any,
  ): void {
    const event: (typeof this.auditLog)[number] = {
      timestamp: new Date(),
      action,
      context,
    };

    if (typeof userId === 'string') {
      event.userId = userId;
    }

    if (metadata !== undefined) {
      event.metadata = metadata;
    }

    this.auditLog.push(event);
    logger.info('Encryption audit event', event);

    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  static getAuditLog(limit: number = 100): Array<any> {
    return this.auditLog.slice(-limit);
  }

  static generateEncryptionReport(): {
    totalEvents: number;
    contexts: Record<string, number>;
    actions: Record<string, number>;
    lastEvent: Date | null;
    keyInfo: Array<{ context: string; created: Date; version: string }>;
  } {
    const contexts: Record<string, number> = {};
    const actions: Record<string, number> = {};

    for (const event of this.auditLog) {
      contexts[event.context] = (contexts[event.context] || 0) + 1;
      actions[event.action] = (actions[event.action] || 0) + 1;
    }

    const lastEvent =
      this.auditLog.length > 0
        ? this.auditLog[this.auditLog.length - 1]
        : undefined;

    return {
      totalEvents: this.auditLog.length,
      contexts,
      actions,
      lastEvent: lastEvent ? lastEvent.timestamp : null,
      keyInfo: KeyManager.getKeyInfo(),
    };
  }

  static checkComplianceStatus(): {
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if key manager is initialized
    try {
      const keyInfo = KeyManager.getKeyInfo();
      if (keyInfo.length === 0) {
        issues.push('No encryption keys are available');
      }

      // Check key age
      const now = new Date();
      for (const key of keyInfo) {
        const keyAge = now.getTime() - key.created.getTime();
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
        if (keyAge > maxAge) {
          recommendations.push(
            `Key for context ${key.context} is older than 90 days and should be rotated`,
          );
        }
      }
    } catch (error) {
      issues.push('Key manager is not properly initialized');
    }

    // Check audit log
    if (this.auditLog.length === 0) {
      recommendations.push('No encryption audit events recorded');
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      recommendations,
    };
  }
}

// In-transit encryption utilities
class TransitEncryption {
  // Generate TLS certificate signing request
  static generateCSR(options: {
    commonName: string;
    organization?: string;
    country?: string;
    state?: string;
    locality?: string;
  }): string {
    const {
      commonName,
      organization = 'CLMS Library',
      country = 'US',
      state = '',
      locality = '',
    } = options;

    return `
-----BEGIN CERTIFICATE REQUEST-----
MIIBVjCB...
# This would be a real CSR generated by a proper crypto library
# For production, use a proper certificate management solution
-----END CERTIFICATE REQUEST-----
    `.trim();
  }

  // Validate TLS configuration
  static validateTLSConfig(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check environment variables
    if (!process.env.TLS_CERT_PATH) {
      issues.push('TLS_CERT_PATH environment variable is not set');
    }

    if (!process.env.TLS_KEY_PATH) {
      issues.push('TLS_KEY_PATH environment variable is not set');
    }

    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      recommendations.push('Consider using valid certificates in production');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  // Generate secure headers
  static getSecureHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security':
        'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }
}

// Database encryption utilities
class DatabaseEncryption {
  // Encrypt database field value
  static encryptDatabaseField(
    value: any,
    tableName: string,
    fieldName: string,
  ): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (!FieldEncryption.isSensitiveField(tableName, fieldName)) {
      return value;
    }

    const context = FieldEncryption.getFieldContext(tableName, fieldName);
    if (!context) {
      logger.warn(
        `No encryption context found for field: ${tableName}.${fieldName}`,
      );
      return value;
    }

    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    const encrypted = FieldEncryption.encryptField(stringValue, context);

    return {
      encrypted: true,
      data: encrypted.encrypted,
      iv: encrypted.iv,
      tag: encrypted.tag,
      context: encrypted.context,
      classification: FieldEncryption.getFieldClassification(
        tableName,
        fieldName,
      ),
      version: encrypted.version,
      timestamp: encrypted.timestamp,
    };
  }

  // Decrypt database field value
  static decryptDatabaseField(value: any): any {
    if (!value || typeof value !== 'object' || !value.encrypted) {
      return value;
    }

    try {
      return FieldEncryption.decryptField(
        value.data,
        value.iv,
        value.tag,
        value.context,
      );
    } catch (error) {
      logger.error('Failed to decrypt database field', {
        error: (error as Error).message,
      });
      return '[DECRYPTION_FAILED]';
    }
  }

  // Process entire database record
  static processRecordForStorage(record: any, tableName: string): any {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const processed = { ...record };
    const sensitiveFields =
      FieldEncryption.getSensitiveFieldsForTable(tableName);

    for (const field of sensitiveFields) {
      if (processed.hasOwnProperty(field)) {
        processed[field] = this.encryptDatabaseField(
          processed[field],
          tableName,
          field,
        );
      }
    }

    return processed;
  }

  // Process record for retrieval
  static processRecordForRetrieval(record: any): any {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const processed = { ...record };

    for (const [key, value] of Object.entries(processed)) {
      processed[key] = this.decryptDatabaseField(value);
    }

    return processed;
  }
}

// Migration utilities
class EncryptionMigration {
  static async migrateTableData(
    tableName: string,
    prisma: any,
    batchSize: number = 100,
  ): Promise<{ total: number; processed: number; errors: number }> {
    logger.info(`Starting encryption migration for table: ${tableName}`);
    let total = 0;
    let processed = 0;
    let errors = 0;

    try {
      // Get total count
      const countResult =
        await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${tableName}`;
      total = countResult[0].count;

      logger.info(`Processing ${total} records in ${tableName}`);

      // Process in batches
      for (let offset = 0; offset < total; offset += batchSize) {
        const records =
          await prisma.$queryRaw`SELECT * FROM ${tableName} LIMIT ${batchSize} OFFSET ${offset}`;

        for (const record of records) {
          try {
            const processedRecord = DatabaseEncryption.processRecordForStorage(
              record,
              tableName,
            );

            // Update the record with encrypted fields
            const updateFields: Record<string, unknown> = {};
            const sensitiveFields =
              FieldEncryption.getSensitiveFieldsForTable(tableName);

            for (const field of sensitiveFields) {
              if (
                processedRecord.hasOwnProperty(field) &&
                record[field] !== processedRecord[field]
              ) {
                updateFields[field] = processedRecord[field];
              }
            }

            if (Object.keys(updateFields).length > 0) {
              await prisma[tableName].update({
                where: { id: record.id },
                data: updateFields,
              });
            }

            processed++;

            // Log progress
            if (processed % 10 === 0) {
              logger.info(
                `Migration progress: ${processed}/${total} records processed`,
              );
            }
          } catch (error) {
            logger.error(`Failed to migrate record ${record.id}`, {
              error: (error as Error).message,
            });
            errors++;
          }
        }
      }

      logger.info(
        `Migration completed for ${tableName}: ${processed} processed, ${errors} errors`,
      );

      return { total, processed, errors };
    } catch (error) {
      logger.error(`Migration failed for table ${tableName}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  static async rollbackTableData(
    tableName: string,
    prisma: any,
    batchSize: number = 100,
  ): Promise<{ total: number; processed: number; errors: number }> {
    logger.info(`Starting encryption rollback for table: ${tableName}`);
    let total = 0;
    let processed = 0;
    let errors = 0;

    try {
      // Get total count
      const countResult =
        await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${tableName}`;
      total = countResult[0].count;

      // Process in batches
      for (let offset = 0; offset < total; offset += batchSize) {
        const records =
          await prisma.$queryRaw`SELECT * FROM ${tableName} LIMIT ${batchSize} OFFSET ${offset}`;

        for (const record of records) {
          try {
            const decryptedRecord =
              DatabaseEncryption.processRecordForRetrieval(record);

            // Update the record with decrypted fields
            const updateFields: Record<string, unknown> = {};
            const sensitiveFields =
              FieldEncryption.getSensitiveFieldsForTable(tableName);

            for (const field of sensitiveFields) {
              if (
                record[field]?.encrypted &&
                decryptedRecord[field] !== record[field]
              ) {
                updateFields[field] = decryptedRecord[field];
              }
            }

            if (Object.keys(updateFields).length > 0) {
              await prisma[tableName].update({
                where: { id: record.id },
                data: updateFields,
              });
            }

            processed++;
          } catch (error) {
            logger.error(`Failed to rollback record ${record.id}`, {
              error: (error as Error).message,
            });
            errors++;
          }
        }
      }

      logger.info(
        `Rollback completed for ${tableName}: ${processed} processed, ${errors} errors`,
      );

      return { total, processed, errors };
    } catch (error) {
      logger.error(`Rollback failed for table ${tableName}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

// Enhanced convenience functions with context awareness
export const encryptDataWithCompliance = (
  data: string,
  context: string,
): string => {
  try {
    EncryptionCompliance.logEncryptionEvent('encrypt', context);
    const result = FieldEncryption.encryptField(data, context);
    return JSON.stringify(result);
  } catch (error) {
    logger.error('Error encrypting data', {
      error: (error as Error).message,
      context,
    });
    throw new Error('Encryption failed');
  }
};

export const decryptDataWithCompliance = (encryptedData: string): string => {
  try {
    const parsed = JSON.parse(encryptedData);
    EncryptionCompliance.logEncryptionEvent('decrypt', parsed.context);
    return FieldEncryption.decryptField(
      parsed.encrypted,
      parsed.iv,
      parsed.tag,
      parsed.context,
    );
  } catch (error) {
    logger.error('Error decrypting data', { error: (error as Error).message });
    throw new Error('Decryption failed');
  }
};

export const encryptObjectWithCompliance = (
  obj: any,
  context: string,
): string => {
  try {
    EncryptionCompliance.logEncryptionEvent('encrypt_object', context);
    return encryptDataWithCompliance(JSON.stringify(obj), context);
  } catch (error) {
    logger.error('Error encrypting object', {
      error: (error as Error).message,
      context,
    });
    throw new Error('Object encryption failed');
  }
};

export const decryptObjectWithCompliance = (encryptedData: string): any => {
  try {
    const parsed = JSON.parse(encryptedData);
    EncryptionCompliance.logEncryptionEvent('decrypt_object', parsed.context);
    const decrypted = decryptDataWithCompliance(encryptedData);
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Error decrypting object', {
      error: (error as Error).message,
    });
    throw new Error('Object decryption failed');
  }
};

export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const hashData = (data: string, salt?: string): string => {
  try {
    const hashSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(
      data,
      hashSalt,
      EncryptionConstants.ITERATIONS,
      64,
      'sha512',
    );
    return `${hashSalt}:${hash.toString('hex')}`;
  } catch (error) {
    logger.error('Error hashing data', { error: (error as Error).message });
    throw new Error('Hashing failed');
  }
};

export const verifyHash = (data: string, hashedData: string): boolean => {
  try {
    const parts = hashedData.split(':');
    if (parts.length < 2) return false;

    const [salt, hash] = parts;
    if (!salt || !hash) return false;

    const computedHash = crypto.pbkdf2Sync(
      data,
      salt,
      EncryptionConstants.ITERATIONS,
      64,
      'sha512',
    );
    return computedHash.toString('hex') === hash;
  } catch (error) {
    logger.error('Error verifying hash', { error: (error as Error).message });
    return false;
  }
};

// Export all enhanced classes
export {
  FieldEncryption,
  KeyManager,
  TokenRotation,
  PasswordUtils,
  DataMasking,
  EncryptionCompliance,
  TransitEncryption,
  DatabaseEncryption,
  EncryptionMigration,
  EncryptionConstants,
};
