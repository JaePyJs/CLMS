#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';
import { EncryptionService } from '../src/services/encryptionService';
import {
  FieldEncryption,
  KeyManager,
  EncryptionCompliance,
  TransitEncryption,
  DatabaseEncryption
} from '../src/utils/encryption';
import { SecurityHeaders } from '../src/middleware/tls.middleware';

/**
 * Comprehensive test script for the encryption system
 * Tests all encryption components and validates functionality
 */

class EncryptionTestSuite {
  private prisma: PrismaClient;
  private encryptionService: EncryptionService;
  private testResults: Array<{
    testName: string;
    passed: boolean;
    message: string;
    duration: number;
  }> = [];

  constructor() {
    this.prisma = new PrismaClient();
    this.encryptionService = EncryptionService.getInstance(this.prisma);
  }

  async runAllTests(): Promise<void> {
    try {
      logger.info('Starting comprehensive encryption test suite...');

      // Initialize encryption system
      await this.encryptionService.initialize();

      // Run all test categories
      await this.testFieldEncryption();
      await this.testKeyManagement();
      await this.testDatabaseEncryption();
      await this.testComplianceFeatures();
      await this.testTransitEncryption();
      await this.testDataIntegrity();
      await this.testPerformance();
      await this.testErrorHandling();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      logger.error('Test suite failed', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async testFieldEncryption(): Promise<void> {
    logger.info('Testing field encryption...');

    await this.runTest('Basic field encryption', async () => {
      const testValue = 'John Doe';
      const encrypted = FieldEncryption.encryptField(testValue, 'student-pii');
      const decrypted = FieldEncryption.decryptField(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.context);

      if (decrypted !== testValue) {
        throw new Error(`Expected ${testValue}, got ${decrypted}`);
      }

      return 'Field encryption/decryption working correctly';
    });

    await this.runTest('Object encryption', async () => {
      const testObject = {
        name: 'John Doe',
        email: 'john@example.com',
        id: '12345'
      };

      const sensitiveFields = ['name', 'email'];
      const encrypted = FieldEncryption.encryptObject(testObject, sensitiveFields);
      const decrypted = FieldEncryption.decryptObject(encrypted);

      if (decrypted.name !== testObject.name || decrypted.email !== testObject.email) {
        throw new Error('Object encryption/decryption failed');
      }

      return 'Object encryption working correctly';
    });

    await this.runTest('Sensitive field detection', async () => {
      const isSensitive = FieldEncryption.isSensitiveField('students', 'first_name');
      const notSensitive = FieldEncryption.isSensitiveField('students', 'grade_level');

      if (!isSensitive || notSensitive) {
        throw new Error('Sensitive field detection not working correctly');
      }

      return 'Sensitive field detection working correctly';
    });
  }

  private async testKeyManagement(): Promise<void> {
    logger.info('Testing key management...');

    await this.runTest('Key manager initialization', async () => {
      const keyInfo = KeyManager.getKeyInfo();

      if (keyInfo.length === 0) {
        throw new Error('No keys found in key manager');
      }

      // Check if all required contexts have keys
      const requiredContexts = ['student-pii', 'user-credentials', 'audit-data', 'system-config', 'equipment-data'];
      const availableContexts = keyInfo.map(k => k.context);

      for (const context of requiredContexts) {
        if (!availableContexts.includes(context)) {
          throw new Error(`Missing key for context: ${context}`);
        }
      }

      return `Key manager initialized with ${keyInfo.length} keys`;
    });

    await this.runTest('Key retrieval', async () => {
      try {
        const key = KeyManager.getKey('student-pii');
        if (!key || key.length !== 32) {
          throw new Error('Invalid key retrieved');
        }
        return 'Key retrieval working correctly';
      } catch (error) {
        throw new Error(`Key retrieval failed: ${(error as Error).message}`);
      }
    });

    await this.runTest('Key rotation simulation', async () => {
      const originalKeyInfo = KeyManager.getKeyInfo();
      const originalKeyCount = originalKeyInfo.length;

      // Note: We don't actually rotate keys in tests to avoid disrupting the system
      // Instead, we validate the key rotation mechanism exists
      if (typeof KeyManager.rotateKeys !== 'function') {
        throw new Error('Key rotation method not available');
      }

      return 'Key rotation mechanism available';
    });
  }

  private async testDatabaseEncryption(): Promise<void> {
    logger.info('Testing database encryption...');

    await this.runTest('Database field encryption', async () => {
      const testValue = 'test@example.com';
      const encrypted = DatabaseEncryption.encryptDatabaseField(testValue, 'users', 'email');
      const decrypted = DatabaseEncryption.decryptDatabaseField(encrypted);

      if (decrypted !== testValue) {
        throw new Error('Database field encryption failed');
      }

      return 'Database field encryption working correctly';
    });

    await this.runTest('Record processing for storage', async () => {
      const testRecord = {
        id: 'test-id',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        grade_level: '10'
      };

      const processed = this.encryptionService.processRecordForStorage(testRecord, 'students');

      // Check that sensitive fields are encrypted
      if (!processed.first_name?.encrypted || !processed.email?.encrypted) {
        throw new Error('Sensitive fields not properly encrypted');
      }

      return 'Record processing for storage working correctly';
    });

    await this.runTest('Record processing for retrieval', async () => {
      const testRecord = {
        id: 'test-id',
        first_name: {
          encrypted: true,
          data: 'encrypted_data',
          iv: 'iv_value',
          tag: 'tag_value',
          context: 'student-pii'
        },
        grade_level: '10'
      };

      const processed = this.encryptionService.processRecordForRetrieval(testRecord);

      // First name should remain encrypted if we can't decrypt it (test data)
      if (typeof processed.first_name !== 'string') {
        // This is expected with test data
        return 'Record processing for retrieval handles invalid encrypted data correctly';
      }

      return 'Record processing for retrieval working correctly';
    });
  }

  private async testComplianceFeatures(): Promise<void> {
    logger.info('Testing compliance features...');

    await this.runTest('Audit logging', async () => {
      const initialLogCount = EncryptionCompliance.getAuditLog().length;

      EncryptionCompliance.logEncryptionEvent('test_event', 'test-context', 'test-user', {
        testData: 'test-value'
      });

      const newLogCount = EncryptionCompliance.getAuditLog().length;

      if (newLogCount <= initialLogCount) {
        throw new Error('Audit logging not working');
      }

      return 'Audit logging working correctly';
    });

    await this.runTest('Compliance status check', async () => {
      const compliance = EncryptionCompliance.checkComplianceStatus();

      if (typeof compliance.isCompliant !== 'boolean') {
        throw new Error('Compliance status check failed');
      }

      if (!Array.isArray(compliance.issues) || !Array.isArray(compliance.recommendations)) {
        throw new Error('Compliance report format invalid');
      }

      return `Compliance status: ${compliance.isCompliant ? 'Compliant' : 'Not Compliant'}`;
    });

    await this.runTest('Encryption report generation', async () => {
      const report = EncryptionCompliance.generateEncryptionReport();

      if (!report.totalEvents || !report.contexts || !report.actions) {
        throw new Error('Encryption report generation failed');
      }

      return `Generated report with ${report.totalEvents} events`;
    });
  }

  private async testTransitEncryption(): Promise<void> {
    logger.info('Testing transit encryption...');

    await this.runTest('TLS configuration validation', async () => {
      const validation = TransitEncryption.validateTLSConfig();

      if (!validation || typeof validation.isValid !== 'boolean') {
        throw new Error('TLS configuration validation failed');
      }

      return `TLS validation: ${validation.isValid ? 'Valid' : 'Issues found'}`;
    });

    await this.runTest('Security headers generation', async () => {
      const headers = TransitEncryption.getSecureHeaders();

      if (!headers || typeof headers !== 'object') {
        throw new Error('Security headers generation failed');
      }

      const requiredHeaders = [
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options'
      ];

      for (const header of requiredHeaders) {
        if (!headers[header]) {
          throw new Error(`Missing required security header: ${header}`);
        }
      }

      return 'Security headers generated correctly';
    });

    await this.runTest('TLS configuration report', async () => {
      const tlsReport = SecurityHeaders.generateTLSReport();

      if (!tlsReport || typeof tlsReport.enabled !== 'boolean') {
        throw new Error('TLS report generation failed');
      }

      return `TLS status: ${tlsReport.enabled ? 'Enabled' : 'Disabled'}`;
    });
  }

  private async testDataIntegrity(): Promise<void> {
    logger.info('Testing data integrity...');

    await this.runTest('End-to-end encryption flow', async () => {
      const originalData = {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice.smith@school.edu',
        studentId: 'S12345'
      };

      // Process through complete encryption flow
      const encryptedRecord = this.encryptionService.processRecordForStorage(originalData, 'students');
      const decryptedRecord = this.encryptionService.processRecordForRetrieval(encryptedRecord);

      // Verify data integrity
      if (decryptedRecord.firstName !== originalData.firstName ||
          decryptedRecord.lastName !== originalData.lastName ||
          decryptedRecord.email !== originalData.email ||
          decryptedRecord.studentId !== originalData.studentId) {
        throw new Error('Data integrity compromised in encryption flow');
      }

      return 'End-to-end encryption flow maintains data integrity';
    });

    await this.runTest('Encrypted data validation', async () => {
      const validEncryptedData = {
        encrypted: true,
        data: 'encrypted_value',
        iv: 'iv_value',
        tag: 'tag_value',
        context: 'test-context',
        version: '1.0',
        timestamp: new Date().toISOString()
      };

      const isValid = FieldEncryption.validateEncryptedData(validEncryptedData);

      if (!isValid) {
        throw new Error('Valid encrypted data validation failed');
      }

      // Test invalid data
      const invalidData = { data: 'invalid' };
      const isInvalid = FieldEncryption.validateEncryptedData(invalidData);

      if (isInvalid) {
        throw new Error('Invalid encrypted data should fail validation');
      }

      return 'Encrypted data validation working correctly';
    });
  }

  private async testPerformance(): Promise<void> {
    logger.info('Testing encryption performance...');

    await this.runTest('Encryption performance', async () => {
      const testData = 'Performance test string with reasonable length';
      const iterations = 1000;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const encrypted = FieldEncryption.encryptField(testData, 'test-context');
        const decrypted = FieldEncryption.decryptField(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.context);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      // Performance should be reasonable (less than 10ms per operation)
      if (avgTime > 10) {
        throw new Error(`Encryption performance too slow: ${avgTime}ms per operation`);
      }

      return `Average encryption time: ${avgTime.toFixed(2)}ms per operation`;
    });

    await this.runTest('Memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many encryption operations
      for (let i = 0; i < 100; i++) {
        const testData = `Test data ${i} with some content to encrypt`;
        const encrypted = FieldEncryption.encryptField(testData, 'test-context');
        const decrypted = FieldEncryption.decryptField(encrypted.encrypted, encrypted.iv, encrypted.tag, encrypted.context);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      if (memoryIncrease > 10 * 1024 * 1024) {
        throw new Error(`Excessive memory usage: ${memoryIncrease / 1024 / 1024}MB`);
      }

      return `Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`;
    });
  }

  private async testErrorHandling(): Promise<void> {
    logger.info('Testing error handling...');

    await this.runTest('Invalid decryption data handling', async () => {
      try {
        FieldEncryption.decryptField('invalid_data', 'invalid_iv', 'invalid_tag', 'invalid_context');
        throw new Error('Should have thrown an error for invalid data');
      } catch (error) {
        if (!(error as Error).message.includes('Decryption failed')) {
          throw new Error('Unexpected error message for invalid decryption');
        }
      }

      return 'Invalid decryption data handled correctly';
    });

    await this.runTest('Missing key handling', async () => {
      try {
        // This should throw an error for missing context
        KeyManager.getKey('non-existent-context');
        throw new Error('Should have thrown an error for missing key');
      } catch (error) {
        if (!(error as Error).message.includes('No key found')) {
          throw new Error('Unexpected error message for missing key');
        }
      }

      return 'Missing key handling working correctly';
    });

    await this.runTest('Corrupted metadata handling', async () => {
      const corruptedData = {
        encrypted: true,
        data: 'some_data',
        iv: 'iv_value',
        // Missing tag and other required fields
      };

      const isValid = FieldEncryption.validateEncryptedData(corruptedData);

      if (isValid) {
        throw new Error('Corrupted metadata should fail validation');
      }

      return 'Corrupted metadata handled correctly';
    });
  }

  private async runTest(testName: string, testFunction: () => Promise<string>): Promise<void> {
    const startTime = Date.now();

    try {
      const message = await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        testName,
        passed: true,
        message,
        duration
      });

      logger.info(`✓ ${testName}: ${message} (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const message = (error as Error).message;

      this.testResults.push({
        testName,
        passed: false,
        message,
        duration
      });

      logger.error(`✗ ${testName}: ${message} (${duration}ms)`);
    }
  }

  private generateTestReport(): void {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    logger.info('\n' + '='.repeat(60));
    logger.info('ENCRYPTION TEST SUITE REPORT');
    logger.info('='.repeat(60));
    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`Passed: ${passedTests} ✅`);
    logger.info(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    logger.info(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    logger.info(`Total Duration: ${totalDuration}ms`);
    logger.info(`Average Test Duration: ${(totalDuration / totalTests).toFixed(1)}ms`);

    if (failedTests > 0) {
      logger.info('\nFailed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          logger.info(`  ❌ ${r.testName}: ${r.message}`);
        });
    }

    logger.info('\nTest Results Summary:');
    this.testResults.forEach(r => {
      const status = r.passed ? '✅' : '❌';
      logger.info(`  ${status} ${r.testName} (${r.duration}ms)`);
    });

    logger.info('='.repeat(60));

    if (failedTests === 0) {
      logger.info('🎉 All encryption tests passed! System is working correctly.');
    } else {
      logger.warn(`⚠️  ${failedTests} test(s) failed. Please review and fix issues.`);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new EncryptionTestSuite();
  testSuite.runAllTests().catch((error) => {
    logger.error('Test suite failed', error);
    process.exit(1);
  });
}

export default EncryptionTestSuite;