import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import {
  FieldEncryption,
  KeyManager,
  EncryptionCompliance,
  DatabaseEncryption,
  EncryptionMigration,
  TransitEncryption
} from '@/utils/encryption';
import { SecurityHeaders } from '@/middleware/tls.middleware';
import WebSocketEncryption from '@/websocket/websocket-encryption.middleware';

/**
 * Comprehensive encryption service for CLMS system
 * Manages all encryption operations, key management, and compliance
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private prisma: PrismaClient;
  private isInitialized: boolean = false;

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get singleton instance
   */
  static getInstance(prisma?: PrismaClient): EncryptionService {
    if (!EncryptionService.instance) {
      if (!prisma) {
        throw new Error('Prisma client required for first initialization');
      }
      EncryptionService.instance = new EncryptionService(prisma);
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize the complete encryption system
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        logger.warn('Encryption service already initialized');
        return;
      }

      logger.info('Initializing comprehensive encryption system...');

      // Initialize field encryption and key management
      await FieldEncryption.initialize();

      // Initialize TLS configuration
      await SecurityHeaders.initialize();

      // Initialize WebSocket encryption
      await WebSocketEncryption.initialize();

      // Log successful initialization
      EncryptionCompliance.logEncryptionEvent('system_init', 'system');

      this.isInitialized = true;
      logger.info('Encryption system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize encryption system', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Encrypt sensitive data for a specific table and field
   */
  encryptField(value: any, tableName: string, fieldName: string): any {
    try {
      return DatabaseEncryption.encryptDatabaseField(value, tableName, fieldName);
    } catch (error) {
      logger.error('Failed to encrypt field', {
        error: (error as Error).message,
        tableName,
        fieldName
      });
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptField(value: any): any {
    try {
      return DatabaseEncryption.decryptDatabaseField(value);
    } catch (error) {
      logger.error('Failed to decrypt field', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process record for database storage (encrypt sensitive fields)
   */
  processRecordForStorage(record: any, tableName: string): any {
    try {
      return DatabaseEncryption.processRecordForStorage(record, tableName);
    } catch (error) {
      logger.error('Failed to process record for storage', {
        error: (error as Error).message,
        tableName
      });
      throw error;
    }
  }

  /**
   * Process record for retrieval (decrypt sensitive fields)
   */
  processRecordForRetrieval(record: any): any {
    try {
      return DatabaseEncryption.processRecordForRetrieval(record);
    } catch (error) {
      logger.error('Failed to process record for retrieval', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Migrate all sensitive data to encrypted format
   */
  async migrateAllTables(): Promise<{
    totalTables: number;
    results: Array<{
      tableName: string;
      total: number;
      processed: number;
      errors: number;
    }>;
    success: boolean;
  }> {
    const tables = [
      'students',
      'users',
      'equipment',
      'audit_logs',
      'system_config'
    ];

    const results = [];
    let overallSuccess = true;

    logger.info('Starting comprehensive encryption migration');

    for (const tableName of tables) {
      try {
        const result = await EncryptionMigration.migrateTableData(tableName, this.prisma);
        results.push({ tableName, ...result });

        if (result.errors > 0) {
          overallSuccess = false;
        }

        logger.info(`Migration completed for ${tableName}`, {
          total: result.total,
          processed: result.processed,
          errors: result.errors
        });
      } catch (error) {
        logger.error(`Migration failed for ${tableName}`, {
          error: (error as Error).message
        });
        results.push({
          tableName,
          total: 0,
          processed: 0,
          errors: 1
        });
        overallSuccess = false;
      }
    }

    logger.info('Encryption migration completed', {
      totalTables: tables.length,
      success: overallSuccess
    });

    return {
      totalTables: tables.length,
      results,
      success: overallSuccess
    };
  }

  /**
   * Rollback encryption (decrypt all data)
   */
  async rollbackAllTables(): Promise<{
    totalTables: number;
    results: Array<{
      tableName: string;
      total: number;
      processed: number;
      errors: number;
    }>;
    success: boolean;
  }> {
    const tables = [
      'students',
      'users',
      'equipment',
      'audit_logs',
      'system_config'
    ];

    const results = [];
    let overallSuccess = true;

    logger.warn('Starting encryption rollback - DECRYPTING ALL DATA');

    for (const tableName of tables) {
      try {
        const result = await EncryptionMigration.rollbackTableData(tableName, this.prisma);
        results.push({ tableName, ...result });

        if (result.errors > 0) {
          overallSuccess = false;
        }

        logger.warn(`Rollback completed for ${tableName}`, {
          total: result.total,
          processed: result.processed,
          errors: result.errors
        });
      } catch (error) {
        logger.error(`Rollback failed for ${tableName}`, {
          error: (error as Error).message
        });
        results.push({
          tableName,
          total: 0,
          processed: 0,
          errors: 1
        });
        overallSuccess = false;
      }
    }

    logger.warn('Encryption rollback completed', {
      totalTables: tables.length,
      success: overallSuccess
    });

    return {
      totalTables: tables.length,
      results,
      success: overallSuccess
    };
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<void> {
    try {
      logger.warn('Starting encryption key rotation');

      // Backup current keys
      await KeyManager.backupKeys();

      // Generate new keys
      await KeyManager.rotateKeys();

      // Log key rotation
      EncryptionCompliance.logEncryptionEvent('key_rotation', 'system');

      logger.warn('Encryption key rotation completed');
    } catch (error) {
      logger.error('Key rotation failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive encryption status report
   */
  generateStatusReport(): {
    systemStatus: {
      initialized: boolean;
      keyManager: boolean;
      tlsEnabled: boolean;
      webSocketEnabled: boolean;
    };
    compliance: {
      isCompliant: boolean;
      issues: string[];
      recommendations: string[];
    };
    keyInfo: Array<{
      context: string;
      created: Date;
      version: string;
      age: number; // days
    }>;
    tlsConfig: any;
    auditLog: {
      totalEvents: number;
      recentEvents: Array<any>;
      actionsByType: Record<string, number>;
    };
    sensitiveFields: {
      total: number;
      byTable: Record<string, string[]>;
      byClassification: Record<string, string[]>;
    };
  } {
    // System status
    const systemStatus = {
      initialized: this.isInitialized,
      keyManager: KeyManager.getKeyInfo().length > 0,
      tlsEnabled: SecurityHeaders.isTLSEnabled(),
      webSocketEnabled: WebSocketEncryption.generateEncryptionReport().enabled
    };

    // Compliance status
    const compliance = EncryptionCompliance.checkComplianceStatus();

    // Key information
    const keyInfo = KeyManager.getKeyInfo().map(key => ({
      ...key,
      age: Math.floor((new Date().getTime() - key.created.getTime()) / (1000 * 60 * 60 * 24))
    }));

    // TLS configuration
    const tlsConfig = SecurityHeaders.generateTLSReport();

    // Audit log
    const auditReport = EncryptionCompliance.generateEncryptionReport();
    const auditLog = {
      totalEvents: auditReport.totalEvents,
      recentEvents: EncryptionCompliance.getAuditLog(10),
      actionsByType: auditReport.actions
    };

    // Sensitive fields information
    const sensitiveFields = this.analyzeSensitiveFields();

    return {
      systemStatus,
      compliance,
      keyInfo,
      tlsConfig,
      auditLog,
      sensitiveFields
    };
  }

  /**
   * Analyze sensitive fields across all tables
   */
  private analyzeSensitiveFields(): {
    total: number;
    byTable: Record<string, string[]>;
    byClassification: Record<string, string[]>;
  } {
    const tables = ['students', 'users', 'equipment', 'audit_logs', 'system_config'];
    const byTable: Record<string, string[]> = {};
    const byClassification: Record<string, string[]> = {};
    let total = 0;

    for (const table of tables) {
      const fields = FieldEncryption.getSensitiveFieldsForTable(table);
      byTable[table] = fields;
      total += fields.length;

      for (const field of fields) {
        const classification = FieldEncryption.getFieldClassification(table, field);
        if (classification && !byClassification[classification]) {
          byClassification[classification] = [];
        }
        if (classification) {
          byClassification[classification].push(`${table}.${field}`);
        }
      }
    }

    return {
      total,
      byTable,
      byClassification
    };
  }

  /**
   * Validate encryption configuration
   */
  async validateConfiguration(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    tests: {
      fieldEncryption: boolean;
      keyManager: boolean;
      tlsConfig: boolean;
      dataIntegrity: boolean;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const tests = {
      fieldEncryption: false,
      keyManager: false,
      tlsConfig: false,
      dataIntegrity: false
    };

    try {
      // Test field encryption
      const testValue = 'test-encryption-value';
      const encrypted = this.encryptField(testValue, 'students', 'first_name');
      const decrypted = this.decryptField(encrypted);
      tests.fieldEncryption = (decrypted === testValue);

      if (!tests.fieldEncryption) {
        errors.push('Field encryption test failed');
      }

      // Test key manager
      const keyInfo = KeyManager.getKeyInfo();
      tests.keyManager = (keyInfo.length > 0);

      if (!tests.keyManager) {
        errors.push('Key manager not properly initialized');
      }

      // Test TLS configuration
      const tlsTest = await SecurityHeaders.testTLSConfiguration();
      tests.tlsConfig = tlsTest.success;

      if (!tests.tlsConfig) {
        errors.push(...tlsTest.errors);
      }

      // Test data integrity
      const testRecord = {
        id: 'test-id',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      };

      const processedForStorage = this.processRecordForStorage(testRecord, 'users');
      const processedForRetrieval = this.processRecordForRetrieval(processedForStorage);
      tests.dataIntegrity = (
        processedForRetrieval.first_name === testRecord.first_name &&
        processedForRetrieval.last_name === testRecord.last_name &&
        processedForRetrieval.email === testRecord.email
      );

      if (!tests.dataIntegrity) {
        errors.push('Data integrity test failed');
      }

      // Check for warnings
      if (keyInfo.some(key => key.age > 60)) {
        warnings.push('Some encryption keys are older than 60 days');
      }

      if (!SecurityHeaders.isTLSEnabled()) {
        warnings.push('TLS is not enabled for in-transit encryption');
      }

    } catch (error) {
      errors.push(`Configuration validation failed: ${(error as Error).message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      tests
    };
  }

  /**
   * Get encryption statistics
   */
  getStatistics(): {
    totalKeys: number;
    oldestKeyAge: number;
    newestKeyAge: number;
    totalAuditEvents: number;
    encryptionEventsByContext: Record<string, number>;
    systemUptime: number;
  } {
    const keyInfo = KeyManager.getKeyInfo();
    const now = new Date().getTime();

    const keyAges = keyInfo.map(key => Math.floor((now - key.created.getTime()) / (1000 * 60 * 60 * 24)));
    const auditReport = EncryptionCompliance.generateEncryptionReport();

    return {
      totalKeys: keyInfo.length,
      oldestKeyAge: keyAges.length > 0 ? Math.max(...keyAges) : 0,
      newestKeyAge: keyAges.length > 0 ? Math.min(...keyAges) : 0,
      totalAuditEvents: auditReport.totalEvents,
      encryptionEventsByContext: auditReport.contexts,
      systemUptime: process.uptime()
    };
  }
}

export default EncryptionService;