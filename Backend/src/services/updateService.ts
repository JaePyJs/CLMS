/**
 * Auto-Update Service - Phase 1
 *
 * Manages application updates with one-click functionality
 * Features:
 * - Version detection and comparison
 * - Automatic update checking
 * - Force update capability
 * - One-click build and deploy
 * - Rollback support
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface VersionInfo {
  current: string;
  latest: string;
  isOutdated: boolean;
  forceUpdate: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  releaseDate?: string;
}

export interface UpdateStatus {
  checking: boolean;
  downloading: boolean;
  installing: boolean;
  completed: boolean;
  error?: string;
  progress?: number;
  status?: string;
}

export interface BuildResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

class UpdateService {
  private updateStatus: UpdateStatus = {
    checking: false,
    downloading: false,
    installing: false,
    completed: false
  };

  private readonly VERSION_FILE = join(process.cwd(), 'version.json');
  private readonly UPDATE_DIR = join(process.cwd(), 'updates');
  private readonly BACKUP_DIR = join(process.cwd(), 'backups');

  /**
   * Get current application version
   */
  async getCurrentVersion(): Promise<string> {
    try {
      const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
      );
      return packageJson.version || '1.0.0';
    } catch (error) {
      logger.error('Failed to read current version:', error);
      return '1.0.0';
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(forceCheck = false): Promise<VersionInfo> {
    logger.info('Checking for updates...');

    this.updateStatus = {
      checking: true,
      status: 'Checking for updates...'
    };

    try {
      const currentVersion = await this.getCurrentVersion();

      // Simulate update check (in production, this would query a remote server)
      const latestVersion = await this.getLatestVersion();

      const isOutdated = this.compareVersions(latestVersion, currentVersion) > 0;

      const versionInfo: VersionInfo = {
        current: currentVersion,
        latest: latestVersion,
        isOutdated,
        forceUpdate: false,
        releaseNotes: await this.getReleaseNotes(latestVersion)
      };

      logger.info('Update check complete:', versionInfo);
      this.updateStatus.checking = false;

      return versionInfo;
    } catch (error) {
      logger.error('Update check failed:', error);
      this.updateStatus.checking = false;
      this.updateStatus.error = error instanceof Error ? error.message : 'Unknown error';

      throw error;
    }
  }

  /**
   * Get latest version from remote (simulated)
   */
  private async getLatestVersion(): Promise<string> {
    try {
      // In production, this would fetch from GitHub releases or update server
      // For now, return a simulated version
      const currentVersion = await this.getCurrentVersion();
      const versionParts = currentVersion.split('.').map(Number);
      versionParts[2]++; // Increment patch version
      return versionParts.join('.');
    } catch (error) {
      logger.error('Failed to get latest version:', error);
      return '1.0.0';
    }
  }

  /**
   * Compare two version strings
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  /**
   * Get release notes for a version
   */
  private async getReleaseNotes(version: string): Promise<string> {
    // In production, fetch from release notes API
    return `Release notes for version ${version}\n\nFeatures:\n- Bug fixes\n- Performance improvements\n- Security updates`;
  }

  /**
   * Perform one-click update with build
   */
  async performUpdate(force = false): Promise<void> {
    logger.info('Starting one-click update process...', { force });

    try {
      // Step 1: Check for updates
      const versionInfo = await this.checkForUpdates(true);

      if (!versionInfo.isOutdated && !force) {
        logger.info('No updates available');
        this.updateStatus.status = 'No updates available';
        return;
      }

      // Step 2: Create backup
      this.updateStatus.status = 'Creating backup...';
      await this.createBackup();

      // Step 3: Build updated code
      this.updateStatus.status = 'Building application...';
      const buildResult = await this.buildApplication();

      if (!buildResult.success) {
        throw new Error(`Build failed: ${buildResult.error}`);
      }

      // Step 4: Install update
      this.updateStatus.status = 'Installing update...';
      await this.installUpdate(versionInfo);

      // Step 5: Restart services
      this.updateStatus.status = 'Restarting services...';
      await this.restartServices();

      this.updateStatus = {
        checking: false,
        downloading: false,
        installing: false,
        completed: true,
        status: 'Update completed successfully!'
      };

      logger.info('One-click update completed successfully');
    } catch (error) {
      logger.error('Update failed:', error);
      this.updateStatus.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateStatus.status = 'Update failed';

      // Rollback on failure
      await this.rollbackUpdate();

      throw error;
    }
  }

  /**
   * Build the application
   */
  async buildApplication(): Promise<BuildResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting application build...');

      // Install dependencies
      logger.info('Installing dependencies...');
      await execAsync('npm ci --production', {
        cwd: process.cwd(),
        timeout: 300000
      });

      // Build TypeScript
      logger.info('Building TypeScript...');
      await execAsync('npm run build', {
        cwd: process.cwd(),
        timeout: 300000
      });

      const duration = Date.now() - startTime;
      logger.info(`Build completed in ${duration}ms`);

      return {
        success: true,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown build error';

      logger.error('Build failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Create a backup of current installation
   */
  async createBackup(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(this.BACKUP_DIR, `backup-${timestamp}`);

      logger.info('Creating backup...');

      // Create backup directory
      await execAsync(`mkdir -p ${backupPath}`);

      // Copy source code
      await execAsync(`cp -r src ${backupPath}/`);
      await execAsync(`cp -r dist ${backupPath}/`);
      await execAsync(`cp package*.json ${backupPath}/`);
      await execAsync(`cp -r node_modules ${backupPath}/`);

      logger.info('Backup created:', backupPath);
    } catch (error) {
      logger.error('Backup failed:', error);
      throw new Error('Failed to create backup');
    }
  }

  /**
   * Install the update
   */
  private async installUpdate(versionInfo: VersionInfo): Promise<void> {
    logger.info('Installing update...');

    try {
      // Update version in package.json
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      packageJson.version = versionInfo.latest;

      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      // Update version file
      const versionData = {
        current: versionInfo.latest,
        updated: new Date().toISOString()
      };

      writeFileSync(this.VERSION_FILE, JSON.stringify(versionData, null, 2));

      logger.info('Update installed successfully');
    } catch (error) {
      logger.error('Update installation failed:', error);
      throw error;
    }
  }

  /**
   * Restart application services
   */
  private async restartServices(): Promise<void> {
    try {
      logger.info('Restarting services...');

      // In a production environment, this would use PM2, systemd, or Docker
      // For now, we'll just log the restart

      logger.info('Services restart triggered (manual restart required in development)');
    } catch (error) {
      logger.error('Service restart failed:', error);
      throw error;
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackUpdate(): Promise<void> {
    try {
      logger.info('Rolling back update...');

      // Find latest backup
      const { stdout } = await execAsync(`ls -t ${this.BACKUP_DIR} | head -1`);
      const latestBackup = stdout.trim();

      if (!latestBackup) {
        throw new Error('No backup found for rollback');
      }

      const backupPath = join(this.BACKUP_DIR, latestBackup);

      // Restore from backup
      await execAsync(`cp -r ${backupPath}/src .`);
      await execAsync(`cp -r ${backupPath}/dist .`);
      await execAsync(`cp ${backupPath}/package*.json .`);
      await execAsync(`cp -r ${backupPath}/node_modules .`);

      logger.info('Rollback completed successfully');
    } catch (error) {
      logger.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get current update status
   */
  getUpdateStatus(): UpdateStatus {
    return { ...this.updateStatus };
  }

  /**
   * Check if update is in progress
   */
  isUpdateInProgress(): boolean {
    return (
      this.updateStatus.checking ||
      this.updateStatus.downloading ||
      this.updateStatus.installing
    );
  }

  /**
   * Get available updates list (for multiple version handling)
   */
  async getAvailableUpdates(): Promise<VersionInfo[]> {
    // In production, this would fetch all available versions
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = await this.getLatestVersion();

    return [{
      current: currentVersion,
      latest: latestVersion,
      isOutdated: this.compareVersions(latestVersion, currentVersion) > 0,
      forceUpdate: false
    }];
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(keepCount = 5): Promise<void> {
    try {
      const { stdout } = await execAsync(`ls -t ${this.BACKUP_DIR}`);
      const backups = stdout.trim().split('\n');

      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);

        for (const backup of toDelete) {
          await execAsync(`rm -rf ${join(this.BACKUP_DIR, backup)}`);
          logger.info('Deleted old backup:', backup);
        }
      }

      logger.info('Backup cleanup completed');
    } catch (error) {
      logger.error('Backup cleanup failed:', error);
    }
  }

  /**
   * Force update without checking
   */
  async forceUpdate(): Promise<void> {
    logger.info('Forcing update...');
    await this.performUpdate(true);
  }

  /**
   * Quick update (skip backup, for minor updates)
   */
  async quickUpdate(): Promise<void> {
    logger.info('Starting quick update...');

    try {
      this.updateStatus.status = 'Building application...';
      const buildResult = await this.buildApplication();

      if (!buildResult.success) {
        throw new Error(`Build failed: ${buildResult.error}`);
      }

      this.updateStatus.status = 'Restarting services...';
      await this.restartServices();

      this.updateStatus.completed = true;
      this.updateStatus.status = 'Quick update completed!';

      logger.info('Quick update completed successfully');
    } catch (error) {
      logger.error('Quick update failed:', error);
      this.updateStatus.error = error instanceof Error ? error.message : 'Unknown error';

      throw error;
    }
  }
}

export const updateService = new UpdateService();
export default updateService;
