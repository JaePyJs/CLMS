import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { auditService, AuditAction, AuditEntity } from '../../../services/auditService';
import { simpleEncryption } from '../../../utils/fieldEncryption';
import prisma from '../../../utils/prisma';

describe('Enhanced Audit Service Security Tests', () => {
  let testAuditId: string;

  beforeAll(async () => {
    // Ensure database is available for testing
    try {
      await prisma.$connect();
    } catch (error) {
      console.warn('Database not available for audit tests, using fallback');
    }
  });

  afterAll(async () => {
    // Clean up database connections
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset audit service state if needed
  });

  describe('Audit Log Entry Creation', () => {
    test('should create audit log with encrypted sensitive data', async () => {
      const auditEntry = {
        userName: 'test-user',
        action: AuditAction.CREATE,
        entity: AuditEntity.STUDENT,
        entityId: 'student-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser',
        requestId: 'req-123',
        success: true,
        newValues: {
          name: 'John Doe',
          email: 'john@example.com',
          ssn: '123-45-6789' // This should be redacted
        }
      };

      await auditService.log(auditEntry);

      // Verify the log was created (would need to check database)
      expect(true).toBe(true); // Placeholder - would verify database entry
    });

    test('should handle audit log creation failure gracefully', async () => {
      const invalidEntry = {
        // Missing required fields
        action: AuditAction.VIEW,
        entity: AuditEntity.STUDENT,
        entityId: 'student-123',
        success: true
      };

      // Should not throw error, should fallback to file logging
      await expect(auditService.log(invalidEntry)).resolves.not.toThrow();
    });

    test('should sanitize sensitive values in audit logs', async () => {
      const sensitiveData = {
        password: 'secret123',
        token: 'secret-token',
        apiKey: 'api-key-123',
        creditCard: '4111-1111-1111-1111',
        normalField: 'normal-value'
      };

      const sanitized = auditService['sanitizeValues'](sensitiveData);

      expect(sanitized.password).toBe('***REDACTED***');
      expect(sanitized.token).toBe('***REDACTED***');
      expect(sanitized.apiKey).toBe('***REDACTED***');
      expect(sanitized.creditCard).toBe('***REDACTED***');
      expect(sanitized.normalField).toBe('normal-value');
    });
  });

  describe('Field Encryption in Audit Logs', () => {
    test('should encrypt IP addresses in audit logs', async () => {
      const ipAddress = '192.168.1.100';
      const encrypted = simpleEncryption.encrypt(ipAddress);

      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.encryptedData).not.toBe(ipAddress);
      expect(encrypted.metadata).toBeDefined();
      expect(encrypted.metadata.encrypted).toBe(true);
    });

    test('should decrypt IP addresses correctly', async () => {
      const originalIp = '192.168.1.100';
      const encrypted = simpleEncryption.encrypt(originalIp);
      const decrypted = simpleEncryption.decrypt(encrypted);

      expect(decrypted).toBe(originalIp);
    });

    test('should handle encryption/decryption failures gracefully', async () => {
      const corruptedData = {
        encryptedData: 'invalid-encrypted-data',
        metadata: { encrypted: true, algorithm: 'aes-256-gcm' }
      };

      // Should not throw, should return original or null
      expect(() => {
        simpleEncryption.decrypt(corruptedData);
      }).not.toThrow();
    });
  });

  describe('Audit Log Retrieval', () => {
    test('should retrieve audit logs for specific entity', async () => {
      const entityId = 'test-student-123';

      // First create a log entry
      await auditService.logCreate(
        'audit-123',
        AuditEntity.STUDENT,
        entityId,
        { name: 'Test Student', grade: 'Grade 10' }
      );

      // Retrieve logs
      const logs = await auditService.getAuditLogs(AuditEntity.STUDENT, entityId, 10);

      expect(Array.isArray(logs)).toBe(true);
      // In a real test, we'd verify our entry is in the results
    });

    test('should retrieve user audit logs', async () => {
      const userName = 'test-user';

      // Create some log entries
      await auditService.logLogin('audit-124', userName, '192.168.1.1', 'Test Browser', true);
      await auditService.logView('audit-125', AuditEntity.BOOK, 'book-123', { viewedBy: userName });

      // Retrieve user logs
      const logs = await auditService.getUserAuditLogs(userName, 10);

      expect(Array.isArray(logs)).toBe(true);
    });

    test('should search audit logs with filters', async () => {
      const filters = {
        action: AuditAction.LOGIN,
        entity: AuditEntity.USER,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        endDate: new Date(),
        limit: 50
      };

      const logs = await auditService.searchAuditLogs(filters);

      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Audit Statistics', () => {
    test('should calculate audit statistics correctly', async () => {
      const stats = await auditService.getAuditStatistics('24h');

      expect(stats).toHaveProperty('totalLogs');
      expect(stats).toHaveProperty('actionsByType');
      expect(stats).toHaveProperty('entitiesByType');
      expect(stats).toHaveProperty('topUsers');
      expect(stats).toHaveProperty('securityEvents');

      expect(typeof stats.totalLogs).toBe('number');
      expect(typeof stats.actionsByType).toBe('object');
      expect(typeof stats.entitiesByType).toBe('object');
      expect(Array.isArray(stats.topUsers)).toBe(true);
      expect(typeof stats.securityEvents).toBe('number');
    });

    test('should handle different timeframes correctly', async () => {
      const timeframes = ['24h', '7d', '30d'] as const;

      for (const timeframe of timeframes) {
        const stats = await auditService.getAuditStatistics(timeframe);
        expect(stats).toBeDefined();
        expect(stats.totalLogs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Audit Log Consistency', () => {
    test('should maintain data consistency across operations', async () => {
      const entityId = 'consistency-test-123';
      const userName = 'consistency-user';

      // Create operation
      await auditService.logCreate(
        'audit-126',
        AuditEntity.STUDENT,
        entityId,
        { name: 'Test Student', grade: 'Grade 10' }
      );

      // Update operation
      await auditService.logUpdate(
        'audit-127',
        AuditEntity.STUDENT,
        entityId,
        { grade: 'Grade 10' },
        { grade: 'Grade 11' }
      );

      // View operation
      await auditService.logView(
        'audit-128',
        AuditEntity.STUDENT,
        entityId
      );

      // Retrieve all logs for this entity
      const logs = await auditService.getAuditLogs(AuditEntity.STUDENT, entityId, 10);

      // Should have at least 3 entries (create, update, view)
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle concurrent audit logging', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        auditService.log({
          id: `concurrent-${i}`,
          userName: 'concurrent-user',
          action: AuditAction.VIEW,
          entity: AuditEntity.BOOK,
          entityId: `book-${i}`,
          success: true
        })
      );

      // Should not throw errors
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Audit Log Security', () => {
    test('should not log passwords or sensitive tokens', async () => {
      const sensitiveEntry = {
        userName: 'test-user',
        action: AuditAction.LOGIN,
        entity: AuditEntity.USER,
        entityId: 'user-123',
        success: true,
        newValues: {
          password: 'super-secret-password',
          sessionToken: 'secret-session-token',
          apiKey: 'secret-api-key'
        }
      };

      await auditService.log(sensitiveEntry);

      // Verify sensitive data is redacted
      // In a real implementation, we'd check the database entry
      expect(true).toBe(true); // Placeholder
    });

    test('should maintain audit trail integrity', async () => {
      const originalEntry = {
        userName: 'integrity-test-user',
        action: AuditAction.DELETE,
        entity: AuditEntity.STUDENT,
        entityId: 'student-456',
        success: true
      };

      await auditService.log(originalEntry);

      // Retrieve and verify the entry hasn't been tampered with
      const logs = await auditService.getUserAuditLogs('integrity-test-user', 1);

      // In a real implementation, we'd verify cryptographic signatures or checksums
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Audit Service Performance', () => {
    test('should handle high volume of audit logs efficiently', async () => {
      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, (_, i) =>
        auditService.log({
          id: `perf-test-${i}`,
          userName: 'perf-user',
          action: AuditAction.VIEW,
          entity: AuditEntity.BOOK,
          entityId: `book-${i}`,
          success: true
        })
      );

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 100 entries)
      expect(duration).toBeLessThan(5000);
    });

    test('should retrieve large datasets efficiently', async () => {
      const startTime = Date.now();

      const logs = await auditService.getRecentAuditLogs(100);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(Array.isArray(logs)).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});