import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  fieldEncryption,
  simpleEncryption,
  FieldEncryptionClass,
  type EncryptedData,
  type EncryptionMetadata
} from '../../../utils/fieldEncryption';

describe('Field Encryption Security Tests', () => {
  let encryptionService: FieldEncryptionClass;

  beforeAll(() => {
    // Set up test environment variables if needed
    process.env.FIELD_ENCRYPTION_MASTER_KEY = '0'.repeat(64); // 64 hex chars for AES-256

    encryptionService = new FieldEncryptionClass();
  });

  afterAll(() => {
    // Clean up
    encryptionService.clearCache();
  });

  describe('Basic Encryption/Decryption', () => {
    test('should encrypt and decrypt text correctly', () => {
      const plaintext = 'This is a sensitive field value';
      const context = {
        field: 'test_field',
        userId: 'test-user-123',
        entityId: 'test-entity-456'
      };

      const { encryptedData, metadata } = encryptionService.encryptField(plaintext, context);
      const decrypted = encryptionService.decryptField(encryptedData, context);

      expect(decrypted).toBe(plaintext);
      expect(encryptedData.data).not.toBe(plaintext);
      expect(encryptedData.iv).toBeDefined();
      expect(encryptedData.salt).toBeDefined();
      expect(encryptedData.algorithm).toBeDefined();
      expect(metadata.encrypted).toBe(true);
    });

    test('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'Same value';
      const context = {
        field: 'test_field',
        userId: 'test-user-123',
        entityId: 'test-entity-456'
      };

      const { encryptedData: encrypted1 } = encryptionService.encryptField(plaintext, context);
      const { encryptedData: encrypted2 } = encryptionService.encryptField(plaintext, context);

      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    test('should handle empty and null values', () => {
      const context = {
        field: 'test_field',
        userId: 'test-user-123',
        entityId: 'test-entity-456'
      };

      expect(() => {
        encryptionService.encryptField('', context);
      }).toThrow('Cannot encrypt empty value');

      expect(() => {
        encryptionService.encryptField('   ', context);
      }).toThrow('Cannot encrypt empty value');
    });
  });

  describe('Encryption Security Properties', () => {
    test('should use strong encryption algorithm', () => {
      const plaintext = 'Test value';
      const context = {
        field: 'test_field',
        userId: 'test-user-123'
      };

      const { encryptedData } = encryptionService.encryptField(plaintext, context);

      expect(encryptedData.algorithm).toBe('aes-256-gcm');
      expect(encryptedData.version).toBe(1);
    });

    test('should generate cryptographically secure random values', () => {
      const plaintext = 'Test value';
      const context = {
        field: 'test_field',
        userId: 'test-user-123'
      };

      // Generate multiple encryptions
      const encryptions = Array.from({ length: 10 }, () =>
        encryptionService.encryptField(plaintext, context)
      );

      // All salts should be different
      const salts = encryptions.map(e => e.encryptedData.salt);
      const uniqueSalts = new Set(salts);
      expect(uniqueSalts.size).toBe(10);

      // All IVs should be different
      const ivs = encryptions.map(e => e.encryptedData.iv);
      const uniqueIVs = new Set(ivs);
      expect(uniqueIVs.size).toBe(10);
    });

    test('should include proper metadata', () => {
      const plaintext = 'Test value';
      const context = {
        field: 'test_field',
        userId: 'test-user-123',
        entityId: 'test-entity-456'
      };

      const { metadata } = encryptionService.encryptField(plaintext, context);

      expect(metadata.encrypted).toBe(true);
      expect(metadata.algorithm).toBe('aes-256-gcm');
      expect(metadata.encryptedAt).toBeInstanceOf(Date);
      expect(metadata.encryptedBy).toBe(context.userId);
      expect(metadata.keyId).toBeDefined();
    });
  });

  describe('Multiple Field Encryption', () => {
    test('should encrypt multiple fields in an object', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        publicField: 'public value'
      };

      const fieldsToEncrypt = ['email', 'phone'];
      const context = {
        userId: 'test-user-123',
        entityId: 'person-456'
      };

      const encrypted = encryptionService.encryptFields(data, fieldsToEncrypt, context);

      expect(encrypted.name).toBe(data.name); // Unchanged
      expect(encrypted.publicField).toBe(data.publicField); // Unchanged

      // Encrypted fields should have different structure
      expect(encrypted.email).toHaveProperty('data');
      expect(encrypted.email).toHaveProperty('iv');
      expect(encrypted.email).toHaveProperty('salt');
      expect(encrypted.phone).toHaveProperty('data');

      // Metadata should be stored
      expect(encrypted.email_enc).toBeDefined();
      expect(encrypted.phone_enc).toBeDefined();
    });

    test('should decrypt multiple fields in an object', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        publicField: 'public value'
      };

      const fieldsToEncrypt = ['email', 'phone'];
      const context = {
        userId: 'test-user-123',
        entityId: 'person-456'
      };

      const encrypted = encryptionService.encryptFields(data, fieldsToEncrypt, context);
      const decrypted = encryptionService.decryptFields(encrypted, fieldsToEncrypt, context);

      expect(decrypted.name).toBe(data.name);
      expect(decrypted.email).toBe(data.email);
      expect(decrypted.phone).toBe(data.phone);
      expect(decrypted.publicField).toBe(data.publicField);
    });

    test('should handle partial decryption failures gracefully', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234'
      };

      const fieldsToEncrypt = ['email', 'phone'];
      const context = {
        userId: 'test-user-123',
        entityId: 'person-456'
      };

      const encrypted = encryptionService.encryptFields(data, fieldsToEncrypt, context);

      // Corrupt one of the encrypted fields
      encrypted.email.data = 'corrupted-data';

      const decrypted = encryptionService.decryptFields(encrypted, fieldsToEncrypt, context);

      // Should handle gracefully - corrupted field remains encrypted, others decrypt
      expect(decrypted.phone).toBe(data.phone);
      expect(decrypted.email).toHaveProperty('data'); // Still encrypted
    });
  });

  describe('Key Management', () => {
    test('should derive unique keys for different contexts', () => {
      const context1 = { field: 'email', userId: 'user1', entityId: 'entity1' };
      const context2 = { field: 'email', userId: 'user2', entityId: 'entity1' };
      const context3 = { field: 'phone', userId: 'user1', entityId: 'entity1' };

      const plaintext = 'Test value';

      const encrypted1 = encryptionService.encryptField(plaintext, context1);
      const encrypted2 = encryptionService.encryptField(plaintext, context2);
      const encrypted3 = encryptionService.encryptField(plaintext, context3);

      // All should produce different ciphertext
      expect(encrypted1.encryptedData.data).not.toBe(encrypted2.encryptedData.data);
      expect(encrypted1.encryptedData.data).not.toBe(encrypted3.encryptedData.data);
      expect(encrypted2.encryptedData.data).not.toBe(encrypted3.encryptedData.data);
    });

    test('should cache keys efficiently', () => {
      const context = { field: 'test', userId: 'user1', entityId: 'entity1' };
      const plaintext = 'Test value';

      const initialStats = encryptionService.getStats();

      // Encrypt multiple times with same context
      Array.from({ length: 5 }, () =>
        encryptionService.encryptField(plaintext, context)
      );

      const finalStats = encryptionService.getStats();

      // Cache should be used (size should not grow exponentially)
      expect(finalStats.cacheSize).toBeGreaterThan(0);
      expect(finalStats.cacheSize).toBeLessThan(5); // Should reuse cached keys
    });

    test('should clear key cache properly', () => {
      const context = { field: 'test', userId: 'user1' };
      const plaintext = 'Test value';

      // Generate some keys
      Array.from({ length: 3 }, () =>
        encryptionService.encryptField(plaintext, context)
      );

      expect(encryptionService.getStats().cacheSize).toBeGreaterThan(0);

      encryptionService.clearCache();

      expect(encryptionService.getStats().cacheSize).toBe(0);
    });
  });

  describe('Simple Encryption Interface', () => {
    test('should provide simplified interface for basic usage', () => {
      const plaintext = 'Test value for simple encryption';

      const encrypted = simpleEncryption.encrypt(plaintext);
      const decrypted = simpleEncryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.encryptedData).not.toBe(plaintext);
      expect(encrypted.metadata).toBeDefined();
    });

    test('should handle both object and string encrypted data formats', () => {
      const plaintext = 'Test value';

      // Test with current format
      const encrypted1 = simpleEncryption.encrypt(plaintext);
      expect(simpleEncryption.decrypt(encrypted1)).toBe(plaintext);

      // Test with legacy format (object with encryptedData property)
      const legacyFormat = {
        encryptedData: encrypted1.encryptedData,
        metadata: encrypted1.metadata
      };
      expect(simpleEncryption.decrypt(legacyFormat)).toBe(plaintext);
    });
  });

  describe('Error Handling', () => {
    test('should handle decryption errors gracefully', () => {
      const invalidEncryptedData: EncryptedData = {
        data: 'invalid-base64-data',
        iv: 'invalid-iv',
        salt: 'invalid-salt',
        algorithm: 'aes-256-gcm',
        version: 1
      };

      const context = {
        field: 'test',
        userId: 'test-user',
        entityId: 'test-entity'
      };

      expect(() => {
        encryptionService.decryptField(invalidEncryptedData, context);
      }).toThrow('Field decryption failed');
    });

    test('should validate master key configuration', () => {
      // Test with invalid key length
      process.env.FIELD_ENCRYPTION_MASTER_KEY = 'invalid-key';

      expect(() => {
        new FieldEncryption();
      }).toThrow('Invalid FIELD_ENCRYPTION_MASTER_KEY format');

      // Restore valid key
      process.env.FIELD_ENCRYPTION_MASTER_KEY = '0'.repeat(64);
    });

    test('should handle missing master key', () => {
      delete process.env.FIELD_ENCRYPTION_MASTER_KEY;

      expect(() => {
        new FieldEncryption();
      }).toThrow('FIELD_ENCRYPTION_MASTER_KEY is required');

      // Restore valid key
      process.env.FIELD_ENCRYPTION_MASTER_KEY = '0'.repeat(64);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate encryption configuration', () => {
      const isValid = encryptionService.validateConfig();
      expect(isValid).toBe(true);
    });

    test('should provide encryption statistics', () => {
      const stats = encryptionService.getStats();

      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('rotationEnabled');
      expect(stats).toHaveProperty('isConfigValid');

      expect(typeof stats.config.algorithm).toBe('string');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.rotationEnabled).toBe('boolean');
      expect(typeof stats.isConfigValid).toBe('boolean');
    });
  });

  describe('Performance Tests', () => {
    test('should encrypt and decrypt efficiently', () => {
      const plaintext = 'A reasonably long field value for performance testing';
      const context = {
        field: 'performance_test',
        userId: 'perf-user',
        entityId: 'perf-entity'
      };

      // Test encryption performance
      const encryptStart = Date.now();
      const { encryptedData } = encryptionService.encryptField(plaintext, context);
      const encryptTime = Date.now() - encryptStart;

      // Test decryption performance
      const decryptStart = Date.now();
      encryptionService.decryptField(encryptedData, context);
      const decryptTime = Date.now() - decryptStart;

      // Both should complete quickly (under 100ms each)
      expect(encryptTime).toBeLessThan(100);
      expect(decryptTime).toBeLessThan(100);
    });

    test('should handle bulk encryption efficiently', () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `record-${i}`,
        sensitiveData: `Sensitive data for record ${i}`,
        publicData: `Public data for record ${i}`
      }));

      const fieldsToEncrypt = ['sensitiveData'];
      const context = {
        userId: 'bulk-user',
        entityId: 'bulk-operation'
      };

      const startTime = Date.now();

      const encryptedRecords = records.map(record =>
        encryptionService.encryptFields(record, fieldsToEncrypt, context)
      );

      const encryptionTime = Date.now() - startTime;

      expect(encryptedRecords).toHaveLength(100);
      expect(encryptionTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify all sensitive data is encrypted
      encryptedRecords.forEach(record => {
        expect(record.sensitiveData).toHaveProperty('data');
        expect(record.sensitiveData.data).not.toBe(record.sensitiveData);
        expect(record.publicData).not.toHaveProperty('data'); // Unchanged
      });
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle very long values', () => {
      const longValue = 'A'.repeat(10000); // 10KB string
      const context = {
        field: 'long_field',
        userId: 'test-user'
      };

      const { encryptedData } = encryptionService.encryptField(longValue, context);
      const decrypted = encryptionService.decryptField(encryptedData, context);

      expect(decrypted).toBe(longValue);
    });

    test('should handle Unicode and special characters', () => {
      const unicodeText = 'Test with emoji 🚀 and accents: é, ñ, ü, 中文, العربية';
      const context = {
        field: 'unicode_field',
        userId: 'test-user'
      };

      const { encryptedData } = encryptionService.encryptField(unicodeText, context);
      const decrypted = encryptionService.decryptField(encryptedData, context);

      expect(decrypted).toBe(unicodeText);
    });

    test('should detect encrypted data correctly', () => {
      const plaintext = 'Test value';
      const context = { field: 'test', userId: 'user' };

      const { encryptedData } = encryptionService.encryptField(plaintext, context);

      expect(encryptionService.isEncrypted(encryptedData)).toBe(true);
      expect(encryptionService.isEncrypted(plaintext)).toBe(false);
      expect(encryptionService.isEncrypted(null)).toBe(false);
      expect(encryptionService.isEncrypted({})).toBe(false);
    });
  });
});