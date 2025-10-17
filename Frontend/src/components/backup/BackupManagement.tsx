import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Shield,
  AlertTriangle,
  FileArchive,
  History,
  Play,
} from 'lucide-react';
import backupApi from '../../services/backupApi';
import type { BackupMetadata, BackupStatistics } from '../../services/backupApi';
import { useToast } from '../ToastContainer';

const BackupManagement: React.FC = () => {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FULL' | 'INCREMENTAL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);

  const toast = useToast();

  useEffect(() => {
    fetchBackups();
    fetchStatistics();
  }, [typeFilter]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (typeFilter !== 'ALL') {
        params.type = typeFilter;
      }

      const response = await backupApi.listBackups(params);
      setBackups(response.data);
    } catch (error) {
      toast.error('Error', 'Failed to fetch backups');
      console.error('Error fetching backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await backupApi.getStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleCreateBackup = async (type: 'FULL' | 'INCREMENTAL', description?: string) => {
    try {
      setCreating(true);

      if (type === 'FULL') {
        await backupApi.createFullBackup(description);
        toast.success('Success', 'Full backup created successfully');
      } else {
        await backupApi.createIncrementalBackup(description);
        toast.success('Success', 'Incremental backup created successfully');
      }

      setShowCreateModal(false);
      fetchBackups();
      fetchStatistics();
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyBackup = async (backup: BackupMetadata) => {
    try {
      const response = await backupApi.verifyBackup(backup.id);

      if (response.data.valid) {
        toast.success('Success', 'Backup verified successfully');
      } else {
        toast.error('Error', 'Backup verification failed');
      }

      fetchBackups();
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to verify backup');
    }
  };

  const handleRestoreBackup = async (backup: BackupMetadata, dryRun: boolean = false) => {
    if (!dryRun) {
      const confirmed = window.confirm(
        `⚠️ WARNING: This will restore the database to the state at ${formatDateTime(backup.createdAt)}.\n\nAll current data will be replaced with the backup data.\n\nAre you absolutely sure you want to proceed?`
      );

      if (!confirmed) return;
    }

    try {
      await backupApi.restoreBackup(backup.id, dryRun);

      if (dryRun) {
        toast.success('Success', 'Dry run completed successfully');
      } else {
        toast.success('Success', 'Database restored successfully');
        window.location.reload(); // Reload to reflect changes
      }

      setShowRestoreModal(false);
      setSelectedBackup(null);
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to restore backup');
    }
  };

  const handleDeleteBackup = async (backup: BackupMetadata) => {
    if (!window.confirm(`Are you sure you want to delete backup "${backup.filename}"?`)) {
      return;
    }

    try {
      await backupApi.deleteBackup(backup.id);
      toast.success('Success', 'Backup deleted successfully');
      fetchBackups();
      fetchStatistics();
    } catch (error: any) {
      toast.error('Error', error.response?.data?.message || 'Failed to delete backup');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: BackupMetadata['status']) => {
    const badges = {
      COMPLETED: {
        color: 'bg-green-100 text-green-800 border-green-300',
        icon: <CheckCircle className="w-3 h-3" />,
        text: 'Completed',
      },
      FAILED: {
        color: 'bg-red-100 text-red-800 border-red-300',
        icon: <XCircle className="w-3 h-3" />,
        text: 'Failed',
      },
      IN_PROGRESS: {
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: <RefreshCw className="w-3 h-3 animate-spin" />,
        text: 'In Progress',
      },
      PENDING: {
        color: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: <Clock className="w-3 h-3" />,
        text: 'Pending',
      },
    };

    const badge = badges[status];

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-gray-600 mt-1">Manage database backups and restore points</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          Create Backup
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Backups</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              </div>
              <Database className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Full Backups</p>
                <p className="text-2xl font-bold text-purple-600">{statistics.fullBackups}</p>
              </div>
              <FileArchive className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Incremental</p>
                <p className="text-2xl font-bold text-green-600">{statistics.incrementalBackups}</p>
              </div>
              <History className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Size</p>
                <p className="text-2xl font-bold text-orange-600">{formatSize(statistics.totalSize)}</p>
              </div>
              <HardDrive className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Last Backup Info */}
      {statistics?.lastBackup && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Last backup: {formatDateTime(statistics.lastBackup.createdAt)}
              </p>
              <p className="text-sm text-gray-600">
                {statistics.lastBackup.type} backup • {formatSize(statistics.lastBackup.size)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="FULL">Full Backups</option>
            <option value="INCREMENTAL">Incremental Backups</option>
          </select>

          <button
            onClick={fetchBackups}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Database className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600">No backups found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
            >
              Create your first backup
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Backup
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{backup.filename}</div>
                        {backup.description && (
                          <div className="text-sm text-gray-500">{backup.description}</div>
                        )}
                        {backup.verified && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                            <Shield className="w-3 h-3" />
                            Verified
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          backup.type === 'FULL'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-green-100 text-green-800 border-green-300'
                        }`}
                      >
                        {backup.type === 'FULL' ? <Database className="w-3 h-3" /> : <History className="w-3 h-3" />}
                        {backup.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(backup.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatSize(backup.size)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(backup.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {backup.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => handleVerifyBackup(backup)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Verify backup"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBackup(backup);
                                setShowRestoreModal(true);
                              }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Restore backup"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteBackup(backup)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <CreateBackupModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBackup}
          creating={creating}
        />
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && selectedBackup && (
        <RestoreBackupModal
          backup={selectedBackup}
          onClose={() => {
            setShowRestoreModal(false);
            setSelectedBackup(null);
          }}
          onRestore={handleRestoreBackup}
        />
      )}
    </div>
  );
};

// Create Backup Modal
const CreateBackupModal: React.FC<{
  onClose: () => void;
  onCreate: (type: 'FULL' | 'INCREMENTAL', description?: string) => void;
  creating: boolean;
}> = ({ onClose, onCreate, creating }) => {
  const [type, setType] = useState<'FULL' | 'INCREMENTAL'>('FULL');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(type, description || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create New Backup</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Backup Type *</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="FULL"
                  checked={type === 'FULL'}
                  onChange={(e) => setType(e.target.value as any)}
                  className="text-blue-600"
                />
                <div>
                  <div className="font-medium">Full Backup</div>
                  <div className="text-sm text-gray-500">Complete database snapshot</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="INCREMENTAL"
                  checked={type === 'INCREMENTAL'}
                  onChange={(e) => setType(e.target.value as any)}
                  className="text-blue-600"
                />
                <div>
                  <div className="font-medium">Incremental Backup</div>
                  <div className="text-sm text-gray-500">Changes since last backup</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Add a description for this backup..."
            />
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Create Backup
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Restore Backup Modal
const RestoreBackupModal: React.FC<{
  backup: BackupMetadata;
  onClose: () => void;
  onRestore: (backup: BackupMetadata, dryRun: boolean) => void;
}> = ({ backup, onClose, onRestore }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-orange-600" />
          <h2 className="text-xl font-bold">Restore Backup</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              <strong>Warning:</strong> This action will replace all current data with the backup data from{' '}
              <strong>{new Date(backup.createdAt).toLocaleString()}</strong>.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Backup:</span>
              <span className="font-medium">{backup.filename}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium">{backup.type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Size:</span>
              <span className="font-medium">{(backup.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
            {backup.description && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Description:</span>
                <span className="font-medium">{backup.description}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-6">
            <button
              onClick={() => onRestore(backup, true)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Dry Run (Test Only)
            </button>
            <button
              onClick={() => onRestore(backup, false)}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Restore Database
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
