#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';
import { EncryptionService } from '../src/services/encryptionService';
import { FieldEncryption, DatabaseEncryption } from '../src/utils/encryption';

/**
 * Migration script to apply encryption schema changes and encrypt existing data
 * Usage: npm run migrate:encryption
 */

class EncryptionMigration {
  private prisma: PrismaClient;
  private encryptionService: EncryptionService;

  constructor() {
    this.prisma = new PrismaClient();
    this.encryptionService = EncryptionService.getInstance(this.prisma);
  }

  async run(): Promise<void> {
    try {
      logger.info('Starting comprehensive encryption migration...');

      // Step 1: Initialize encryption system
      logger.info('Step 1: Initializing encryption system...');
      await this.encryptionService.initialize();

      // Step 2: Apply database schema changes
      logger.info('Step 2: Applying database schema changes...');
      await this.applySchemaChanges();

      // Step 3: Encrypt existing sensitive data
      logger.info('Step 3: Encrypting existing sensitive data...');
      await this.encryptExistingData();

      // Step 4: Validate migration
      logger.info('Step 4: Validating migration...');
      await this.validateMigration();

      logger.info('Encryption migration completed successfully!');

    } catch (error) {
      logger.error('Encryption migration failed', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Apply database schema changes for encryption support
   */
  private async applySchemaChanges(): Promise<void> {
    logger.info('Applying schema changes for encrypted fields...');

    try {
      // Execute SQL migration commands
      const migrationSQL = [
        // Add encryption metadata columns to students table
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name_enc JSON COMMENT 'First name encryption metadata'`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name_enc JSON COMMENT 'Last name encryption metadata'`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS student_id_enc JSON COMMENT 'Student ID encryption metadata'`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS section_enc JSON COMMENT 'Section encryption metadata'`,

        // Add encryption metadata columns to users table
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS username_enc JSON COMMENT 'Username encryption metadata'`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_enc JSON COMMENT 'Email encryption metadata'`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name_enc JSON COMMENT 'Full name encryption metadata'`,

        // Add encryption metadata columns to equipment table
        `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS serial_number_enc JSON COMMENT 'Serial number encryption metadata'`,
        `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS asset_tag_enc JSON COMMENT 'Asset tag encryption metadata'`,

        // Add encryption metadata columns to system_config table
        `ALTER TABLE system_config ADD COLUMN IF NOT EXISTS value_enc JSON COMMENT 'Value encryption metadata'`,

        // Add encryption metadata columns to audit_logs table
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address_enc JSON COMMENT 'IP address encryption metadata'`,

        // Create indexes for better performance
        `CREATE INDEX IF NOT EXISTS idx_students_first_name_enc ON students((first_name_enc IS NOT NULL))`,
        `CREATE INDEX IF NOT EXISTS idx_users_email_enc ON users((email_enc IS NOT NULL))`,
        `CREATE INDEX IF NOT EXISTS idx_equipment_serial_number_enc ON equipment((serial_number_enc IS NOT NULL))`,
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address_enc ON audit_logs((ip_address_enc IS NOT NULL))`,

        // Create encryption status table for tracking migration progress
        `CREATE TABLE IF NOT EXISTS encryption_migration_status (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          table_name VARCHAR(100) NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          total_records INT NOT NULL DEFAULT 0,
          encrypted_records INT NOT NULL DEFAULT 0,
          failed_records INT NOT NULL DEFAULT 0,
          status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
          started_at TIMESTAMP NULL,
          completed_at TIMESTAMP NULL,
          error_message TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_table_field (table_name, field_name),
          INDEX idx_migration_status (status),
          INDEX idx_migration_table (table_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      ];

      for (const sql of migrationSQL) {
        try {
          await this.prisma.$executeRawUnsafe(sql);
          logger.debug(`Applied schema change: ${sql.substring(0, 50)}...`);
        } catch (error: any) {
          // Ignore "column already exists" errors
          if (!error.message.includes('already exists') && !error.message.includes('Duplicate column name')) {
            throw error;
          }
        }
      }

      logger.info('Schema changes applied successfully');
    } catch (error) {
      logger.error('Failed to apply schema changes', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Encrypt existing sensitive data in all tables
   */
  private async encryptExistingData(): Promise<void> {
    logger.info('Starting encryption of existing sensitive data...');

    const tables = [
      { name: 'students', fields: ['first_name', 'last_name', 'student_id', 'section'] },
      { name: 'users', fields: ['username', 'email', 'full_name'] },
      { name: 'equipment', fields: ['serial_number', 'asset_tag'] },
      { name: 'system_config', fields: ['value'] },
      { name: 'audit_logs', fields: ['ip_address'] }
    ];

    for (const table of tables) {
      await this.encryptTableData(table.name, table.fields);
    }

    logger.info('All sensitive data encrypted successfully');
  }

  /**
   * Encrypt data for a specific table
   */
  private async encryptTableData(tableName: string, fields: string[]): Promise<void> {
    logger.info(`Encrypting data for table: ${tableName}`);

    for (const field of fields) {
      await this.encryptTableField(tableName, field);
    }
  }

  /**
   * Encrypt a specific field in a table
   */
  private async encryptTableField(tableName: string, fieldName: string): Promise<void> {
    logger.info(`Encrypting ${tableName}.${fieldName}`);

    try {
      // Initialize migration tracking
      await this.initializeMigrationTracking(tableName, fieldName);

      // Get total count
      const countResult = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${fieldName} IS NOT NULL AND ${fieldName} != ''`
      ) as Array<{ count: number }>;

      const totalRecords = countResult[0].count;
      if (totalRecords === 0) {
        logger.info(`No records to encrypt for ${tableName}.${fieldName}`);
        return;
      }

      // Update migration status
      await this.updateMigrationStatus(tableName, fieldName, {
        total_records: totalRecords,
        status: 'in_progress',
        started_at: new Date()
      });

      // Process in batches
      const batchSize = 100;
      let processedRecords = 0;
      let failedRecords = 0;

      for (let offset = 0; offset < totalRecords; offset += batchSize) {
        const records = await this.prisma.$queryRawUnsafe(
          `SELECT id, ${fieldName} FROM ${tableName} WHERE ${fieldName} IS NOT NULL AND ${fieldName} != '' LIMIT ${batchSize} OFFSET ${offset}`
        ) as Array<any>;

        for (const record of records) {
          try {
            // Check if field is already encrypted
            if (this.isFieldAlreadyEncrypted(record[fieldName])) {
              processedRecords++;
              continue;
            }

            // Encrypt the field
            const encryptedValue = this.encryptionService.encryptField(
              record[fieldName],
              tableName,
              fieldName
            );

            // Update the record with encrypted value and metadata
            const metadataField = `${fieldName}_enc`;
            await this.prisma.$executeRawUnsafe(
              `UPDATE ${tableName} SET ${fieldName} = ?, ${metadataField} = ? WHERE id = ?`,
              encryptedValue.data || encryptedValue,
              JSON.stringify(encryptedValue),
              record.id
            );

            processedRecords++;

            // Log progress
            if (processedRecords % 10 === 0) {
              logger.info(`Encryption progress for ${tableName}.${fieldName}: ${processedRecords}/${totalRecords}`);
            }
          } catch (error) {
            logger.error(`Failed to encrypt record ${record.id} in ${tableName}.${fieldName}`, {
              error: (error as Error).message
            });
            failedRecords++;
          }
        }
      }

      // Update final migration status
      await this.updateMigrationStatus(tableName, fieldName, {
        encrypted_records: processedRecords,
        failed_records: failedRecords,
        status: failedRecords > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date()
      });

      logger.info(`Completed encryption of ${tableName}.${fieldName}: ${processedRecords} processed, ${failedRecords} failed`);

    } catch (error) {
      logger.error(`Failed to encrypt ${tableName}.${fieldName}`, {
        error: (error as Error).message
      });

      // Update migration status with error
      await this.updateMigrationStatus(tableName, fieldName, {
        status: 'failed',
        error_message: (error as Error).message,
        completed_at: new Date()
      });

      throw error;
    }
  }

  /**
   * Check if a field is already encrypted
   */
  private isFieldAlreadyEncrypted(value: any): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    return value.encrypted === true;
  }

  /**
   * Initialize migration tracking for a table field
   */
  private async initializeMigrationTracking(tableName: string, fieldName: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT IGNORE INTO encryption_migration_status (table_name, field_name) VALUES (?, ?)`,
        tableName,
        fieldName
      );
    } catch (error) {
      logger.warn(`Failed to initialize migration tracking for ${tableName}.${fieldName}`, {
        error: (error as Error).message
      });
    }
  }

  /**
   * Update migration status
   */
  private async updateMigrationStatus(
    tableName: string,
    fieldName: string,
    updates: Partial<{
      total_records: number;
      encrypted_records: number;
      failed_records: number;
      status: string;
      started_at: Date;
      completed_at: Date;
      error_message: string;
    }>
  ): Promise<void> {
    try {
      const setClause = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(', ');

      const values = Object.values(updates);
      values.push(tableName, fieldName);

      await this.prisma.$executeRawUnsafe(
        `UPDATE encryption_migration_status SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE table_name = ? AND field_name = ?`,
        ...values
      );
    } catch (error) {
      logger.warn(`Failed to update migration status for ${tableName}.${fieldName}`, {
        error: (error as Error).message
      });
    }
  }

  /**
   * Validate the migration by testing encryption/decryption
   */
  private async validateMigration(): Promise<void> {
    logger.info('Validating encryption migration...');

    try {
      // Test student data encryption
      const testStudent = await this.prisma.$queryRawUnsafe(
        'SELECT id, first_name, first_name_enc FROM students WHERE first_name_enc IS NOT NULL LIMIT 1'
      ) as Array<any>;

      if (testStudent.length > 0) {
        const student = testStudent[0];
        const decryptedName = this.encryptionService.decryptField(student.first_name);
        logger.info(`Student encryption validation successful: ${decryptedName}`);
      }

      // Test user data encryption
      const testUser = await this.prisma.$queryRawUnsafe(
        'SELECT id, email, email_enc FROM users WHERE email_enc IS NOT NULL LIMIT 1'
      ) as Array<any>;

      if (testUser.length > 0) {
        const user = testUser[0];
        const decryptedEmail = this.encryptionService.decryptField(user.email);
        logger.info(`User encryption validation successful: ${decryptedEmail}`);
      }

      // Generate migration report
      const migrationReport = await this.generateMigrationReport();
      logger.info('Migration validation completed', migrationReport);

    } catch (error) {
      logger.error('Migration validation failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate migration report
   */
  private async generateMigrationReport(): Promise<any> {
    const migrationStatus = await this.prisma.$queryRawUnsafe(
      `SELECT table_name, field_name, total_records, encrypted_records, failed_records, status, started_at, completed_at
       FROM encryption_migration_status ORDER BY table_name, field_name`
    ) as Array<any>;

    const summary = {
      totalTables: new Set(migrationStatus.map(s => s.table_name)).size,
      totalFields: migrationStatus.length,
      completedFields: migrationStatus.filter(s => s.status === 'completed').length,
      failedFields: migrationStatus.filter(s => s.status === 'failed').length,
      totalRecords: migrationStatus.reduce((sum, s) => sum + s.total_records, 0),
      totalEncrypted: migrationStatus.reduce((sum, s) => sum + s.encrypted_records, 0),
      totalFailed: migrationStatus.reduce((sum, s) => sum + s.failed_records, 0)
    };

    return {
      summary,
      details: migrationStatus
    };
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new EncryptionMigration();
  migration.run().catch((error) => {
    logger.error('Migration script failed', error);
    process.exit(1);
  });
}

export default EncryptionMigration;