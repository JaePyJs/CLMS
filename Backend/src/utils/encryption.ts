import crypto from 'crypto';
import configuration from '@/config';
import { logger } from './logger';

class FieldEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  
  private static getEncryptionKey(): Buffer {
    const key = configuration.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    return crypto.scryptSync(key, 'salt', FieldEncryption.KEY_LENGTH);
  }

  static encryptField(data: string): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    if (!data) {
      data = '';
    }

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from('clms-field', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  static decryptField(
    encryptedData: string, 
    iv: string, 
    tag: string
  ): string {
    if (!encryptedData) {
      return '';
    }

    const key = this.getEncryptionKey();
    const decipher = crypto.createDecipher(this.ALGORITHM, key);
    decipher.setAAD(Buffer.from('clms-field', 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  static encryptObject(obj: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const encrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (obj.hasOwnProperty(field) && obj[field]) {
        const fieldData = typeof obj[field] === 'string' ? obj[field] : JSON.stringify(obj[field]);
        const encryptedValue = this.encryptField(fieldData);
        
        encrypted[field] = {
          encrypted: true,
          data: encryptedValue.encrypted,
          iv: encryptedValue.iv,
          tag: encryptedValue.tag
        };
      }
    }
    
    return encrypted;
  }

  static decryptObject(obj: Record<string, any>): Record<string, any> {
    const decrypted = { ...obj };
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && value.encrypted === true) {
        decrypted[key] = this.decryptField(value.data, value.iv, value.tag);
      }
    }
    
    return decrypted;
  }
}

class TokenRotation {
  private static readonly TOKEN_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  static shouldRotateToken(lastRotation: Date): boolean {
    const now = new Date();
    const lastRotationTime = lastRotation.getTime();
    const nowTime = now.getTime();
    
    return (nowTime - lastRotationTime) > this.TOKEN_ROTATION_INTERVAL;
  }

  static generateTokenTimestamp(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}_${random}`;
  }

  static extractTokenTimestamp(token: string): Date | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
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
      maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
    };
  }

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const requirements = this.generatePasswordRequirements();
    const errors: string[] = [];

    if (password.length < requirements.minLength) {
      errors.push(`Password must be at least ${requirements.minLength} characters long`);
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

    if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
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
    return password.split('').sort(() => Math.random() - 0.5).join('');
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
    const result = FieldEncryption.encryptField(data);
    return JSON.stringify(result);
  } catch (error) {
    logger.error('Error encrypting data', { error: (error as Error).message });
    throw new Error('Encryption failed');
  }
};

export const decryptData = (encryptedData: string): string => {
  try {
    const parsed = JSON.parse(encryptedData);
    return FieldEncryption.decryptField(parsed.encrypted, parsed.iv, parsed.tag);
  } catch (error) {
    logger.error('Error decrypting data', { error: (error as Error).message });
    throw new Error('Decryption failed');
  }
};

export const encryptObject = (obj: any): string => {
  try {
    return encryptData(JSON.stringify(obj));
  } catch (error) {
    logger.error('Error encrypting object', { error: (error as Error).message });
    throw new Error('Object encryption failed');
  }
};

export const decryptObject = (encryptedData: string): any => {
  try {
    const decrypted = decryptData(encryptedData);
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Error decrypting object', { error: (error as Error).message });
    throw new Error('Object decryption failed');
  }
};

export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const hashData = (data: string, salt?: string): string => {
  try {
    const hashSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, hashSalt, 100000, 64, 'sha512');
    return `${hashSalt}:${hash.toString('hex')}`;
  } catch (error) {
    logger.error('Error hashing data', { error: (error as Error).message });
    throw new Error('Hashing failed');
  }
};

export const verifyHash = (data: string, hashedData: string): boolean => {
  try {
    const [salt, hash] = hashedData.split(':');
    const computedHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
    return computedHash.toString('hex') === hash;
  } catch (error) {
    logger.error('Error verifying hash', { error: (error as Error).message });
    return false;
  }
};

export {
  FieldEncryption,
  TokenRotation,
  PasswordUtils,
  DataMasking
};
