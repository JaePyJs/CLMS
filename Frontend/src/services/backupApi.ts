import api from './api';

export interface BackupMetadata {
  id: string;
  filename: string;
  size: number;
  checksum: string;
  createdAt: string;
  type: 'FULL' | 'INCREMENTAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  verified: boolean;
  cloudSynced?: boolean;
  description?: string;
}

export interface BackupStatistics {
  total: number;
  fullBackups: number;
  incrementalBackups: number;
  totalSize: number;
  lastBackup: BackupMetadata | null;
  averageSize: number;
}

export const backupApi = {
  // List all backups
  async listBackups(params?: {
    type?: 'FULL' | 'INCREMENTAL';
    status?: string;
    limit?: number;
  }) {
    const response = await api.get('/backups', { params });
    return response.data;
  },

  // Get backup statistics
  async getStatistics() {
    const response = await api.get('/backups/statistics');
    return response.data;
  },

  // Get backup by ID
  async getBackup(backupId: string) {
    const response = await api.get(`/backups/${backupId}`);
    return response.data;
  },

  // Create full backup
  async createFullBackup(description?: string) {
    const response = await api.post('/backups/full', { description });
    return response.data;
  },

  // Create incremental backup
  async createIncrementalBackup(description?: string) {
    const response = await api.post('/backups/incremental', { description });
    return response.data;
  },

  // Verify backup
  async verifyBackup(backupId: string) {
    const response = await api.post(`/backups/${backupId}/verify`);
    return response.data;
  },

  // Restore from backup
  async restoreBackup(backupId: string, dryRun: boolean = false) {
    const response = await api.post(`/backups/${backupId}/restore`, { dryRun });
    return response.data;
  },

  // Delete backup
  async deleteBackup(backupId: string) {
    const response = await api.delete(`/backups/${backupId}`);
    return response.data;
  },
};

export default backupApi;
