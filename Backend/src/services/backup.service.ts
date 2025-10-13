import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface BackupMetadata {
  id: string;
  filename: string;
  size: number;
  checksum: string;
  created_at: Date;
  type: 'FULL' | 'INCREMENTAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  verified: boolean;
  cloudSynced?: boolean;
  description?: string;
}

interface RestoreOptions {
  backupId: string;
  pointInTime?: Date;
  tables?: string[];
  dryRun?: boolean;
}

export const backupService = {
  backupDir: path.join(process.cwd(), 'backups'),
  maxBackups: parseInt(process.env.MAX_BACKUPS || '30'),

  /**
   * Initialize backup service
   */
  async initialize() {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Create backups table if needed (metadata storage)
      await this.ensureBackupMetadataTable();

      console.log('Backup service initialized');
    } catch (error) {
      console.error('Failed to initialize backup service:', error);
      throw error;
    }
  },

  /**
   * Create backup metadata table
   */
  async ensureBackupMetadataTable() {
    // This would be handled by Prisma migrations in production
    // For now, we'll store metadata in a JSON file
  },

  /**
   * Create a full database backup
   */
  async createFullBackup(description?: string): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `clms_backup_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    const metadata: BackupMetadata = {
      id: crypto.randomUUID(),
      filename,
      size: 0,
      checksum: '',
      created_at: new Date(),
      type: 'FULL',
      status: 'IN_PROGRESS',
      verified: false,
      description,
    };

    try {
      // Save initial metadata
      await this.saveMetadata(metadata);

      // Create MySQL dump
      const dumpCommand = `mysqldump -h ${process.env.DB_HOST || 'localhost'} -P ${process.env.DB_PORT || '3308'} -u ${process.env.DB_USER || 'clms_user'} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME || 'clms_database'} > "${filepath}"`;

      await execAsync(dumpCommand);

      // Compress the backup
      await this.compressBackup(filepath);
      const compressedPath = `${filepath}.gz`;

      // Calculate checksum
      const checksum = await this.calculateChecksum(compressedPath);

      // Get file size
      const stats = await fs.stat(compressedPath);

      // Update metadata
      metadata.size = stats.size;
      metadata.checksum = checksum;
      metadata.status = 'COMPLETED';

      await this.saveMetadata(metadata);

      // Clean up old backups
      await this.cleanupOldBackups();

      // Delete uncompressed file
      await fs.unlink(filepath);

      return metadata;
    } catch (error) {
      metadata.status = 'FAILED';
      await this.saveMetadata(metadata);
      throw error;
    }
  },

  /**
   * Create incremental backup (changes since last backup)
   */
  async createIncrementalBackup(description?: string): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `clms_incremental_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    const metadata: BackupMetadata = {
      id: crypto.randomUUID(),
      filename: `${filename}.gz`,
      size: 0,
      checksum: '',
      created_at: new Date(),
      type: 'INCREMENTAL',
      status: 'IN_PROGRESS',
      verified: false,
      description,
    };

    try {
      await this.saveMetadata(metadata);

      // Get last backup time
      const lastBackup = await this.getLastBackup();
      const sinceTime = lastBackup?.created_at || new Date(0);

      // Create incremental dump (audit logs since last backup)
      // This is a simplified version - in production, use binlog or change data capture
      const auditLogs = await prisma.audit_logs.findMany({
        where: {
          created_at: {
            gte: sinceTime,
          },
        },
      });

      // Write audit logs to file
      await fs.writeFile(filepath, JSON.stringify(auditLogs, null, 2));

      // Compress
      await this.compressBackup(filepath);
      const compressedPath = `${filepath}.gz`;

      // Calculate checksum
      const checksum = await this.calculateChecksum(compressedPath);
      const stats = await fs.stat(compressedPath);

      metadata.size = stats.size;
      metadata.checksum = checksum;
      metadata.status = 'COMPLETED';

      await this.saveMetadata(metadata);

      // Delete uncompressed file
      await fs.unlink(filepath);

      return metadata;
    } catch (error) {
      metadata.status = 'FAILED';
      await this.saveMetadata(metadata);
      throw error;
    }
  },

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error('Backup not found');
      }

      const filepath = path.join(this.backupDir, metadata.filename);

      // Check if file exists
      try {
        await fs.access(filepath);
      } catch {
        return false;
      }

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(filepath);
      const isValid = currentChecksum === metadata.checksum;

      // Update metadata
      metadata.verified = isValid;
      await this.saveMetadata(metadata);

      return isValid;
    } catch (error) {
      console.error('Error verifying backup:', error);
      return false;
    }
  },

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const metadata = await this.getBackupMetadata(options.backupId);
    if (!metadata) {
      throw new Error('Backup not found');
    }

    if (options.dryRun) {
      console.log('Dry run: Would restore from', metadata.filename);
      return;
    }

    const filepath = path.join(this.backupDir, metadata.filename);

    // Verify backup before restoring
    const isValid = await this.verifyBackup(options.backupId);
    if (!isValid) {
      throw new Error('Backup verification failed');
    }

    try {
      // Decompress backup
      const decompressedPath = filepath.replace('.gz', '');
      await this.decompressBackup(filepath);

      // Restore database
      const restoreCommand = `mysql -h ${process.env.DB_HOST || 'localhost'} -P ${process.env.DB_PORT || '3308'} -u ${process.env.DB_USER || 'clms_user'} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME || 'clms_database'} < "${decompressedPath}"`;

      await execAsync(restoreCommand);

      // Clean up decompressed file
      await fs.unlink(decompressedPath);

      console.log('Database restored successfully from', metadata.filename);
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw error;
    }
  },

  /**
   * List all backups
   */
  async listBackups(filters?: {
    type?: 'FULL' | 'INCREMENTAL';
    status?: string;
    limit?: number;
  }): Promise<BackupMetadata[]> {
    try {
      const metadataFile = path.join(this.backupDir, 'metadata.json');
      const data = await fs.readFile(metadataFile, 'utf-8');
      let backups: BackupMetadata[] = JSON.parse(data);

      // Apply filters
      if (filters?.type) {
        backups = backups.filter((b) => b.type === filters.type);
      }

      if (filters?.status) {
        backups = backups.filter((b) => b.status === filters.status);
      }

      // Sort by date (newest first)
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply limit
      if (filters?.limit) {
        backups = backups.slice(0, filters.limit);
      }

      return backups;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  },

  /**
   * Get backup metadata
   */
  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const backups = await this.listBackups();
    return backups.find((b) => b.id === backupId) || null;
  },

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new Error('Backup not found');
    }

    const filepath = path.join(this.backupDir, metadata.filename);

    try {
      await fs.unlink(filepath);

      // Remove from metadata
      const backups = await this.listBackups();
      const updatedBackups = backups.filter((b) => b.id !== backupId);
      await this.saveAllMetadata(updatedBackups);
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw error;
    }
  },

  /**
   * Get last backup
   */
  async getLastBackup(): Promise<BackupMetadata | null> {
    const backups = await this.listBackups({ limit: 1 });
    return backups[0] || null;
  },

  /**
   * Calculate file checksum (SHA-256)
   */
  async calculateChecksum(filepath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const fileBuffer = await fs.readFile(filepath);
    hash.update(fileBuffer);
    return hash.digest('hex');
  },

  /**
   * Compress backup file
   */
  async compressBackup(filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gzip = zlib.createGzip();
      const input = require('fs').createReadStream(filepath);
      const output = require('fs').createWriteStream(`${filepath}.gz`);

      input
        .pipe(gzip)
        .pipe(output)
        .on('finish', resolve)
        .on('error', reject);
    });
  },

  /**
   * Decompress backup file
   */
  async decompressBackup(filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gunzip = zlib.createGunzip();
      const input = require('fs').createReadStream(filepath);
      const output = require('fs').createWriteStream(filepath.replace('.gz', ''));

      input
        .pipe(gunzip)
        .pipe(output)
        .on('finish', resolve)
        .on('error', reject);
    });
  },

  /**
   * Save backup metadata
   */
  async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const backups = await this.listBackups();
    const index = backups.findIndex((b) => b.id === metadata.id);

    if (index >= 0) {
      backups[index] = metadata;
    } else {
      backups.push(metadata);
    }

    await this.saveAllMetadata(backups);
  },

  /**
   * Save all metadata
   */
  async saveAllMetadata(backups: BackupMetadata[]): Promise<void> {
    const metadataFile = path.join(this.backupDir, 'metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify(backups, null, 2));
  },

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();

    if (backups.length > this.maxBackups) {
      const toDelete = backups
        .filter((b) => b.status === 'COMPLETED')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, backups.length - this.maxBackups);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  },

  /**
   * Get backup statistics
   */
  async getStatistics() {
    const backups = await this.listBackups();

    const total = backups.length;
    const fullBackups = backups.filter((b) => b.type === 'FULL').length;
    const incrementalBackups = backups.filter((b) => b.type === 'INCREMENTAL').length;
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const lastBackup = backups[0];

    return {
      total,
      fullBackups,
      incrementalBackups,
      totalSize,
      lastBackup,
      averageSize: total > 0 ? totalSize / total : 0,
    };
  },

  /**
   * Schedule automated backups
   */
  scheduleBackups(schedule: {
    full?: string; // cron expression
    incremental?: string; // cron expression
  }) {
    // This would typically use node-cron or similar
    console.log('Backup schedule configured:', schedule);
  },
};

export default backupService;
