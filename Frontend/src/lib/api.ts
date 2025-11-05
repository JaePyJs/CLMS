import axios from 'axios';

import { setupInterceptors } from './api/interceptors';

// API response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

// Login response interface
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

// API client class
class ApiClient {
  private client: ReturnType<typeof axios.create>;
  private DEFAULT_API_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:3001';

  constructor(baseURL: string = this.DEFAULT_API_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    setupInterceptors(this.client);
  }

  // Generic GET request
  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  // Generic POST request
  async post<T>(
    url: string,
    data?: any,
    config?: any
  ): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  // Generic PUT request
  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  // Generic DELETE request
  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.get('/health');
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// Create and export the API client instance
export const apiClient = new ApiClient();

export {
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from './api/interceptors';

// Specific API services
export const automationApi = {
  // Health check
  health: () => apiClient.get('/health'),

  // Get all automation jobs
  getJobs: () => apiClient.get('/api/automation/jobs'),

  // Get specific job status
  getJob: (id: string) => apiClient.get(`/api/automation/jobs/${id}`),

  // Trigger job manually
  triggerJob: (id: string) =>
    apiClient.post(`/api/automation/jobs/${id}/trigger`),

  // Get queue status
  getQueueStatus: () => apiClient.get('/api/automation/queues/status'),

  // Test Google Sheets connection
  testGoogleSheets: () => apiClient.get('/api/automation/google-sheets/test'),

  // Generate daily report
  getDailyReport: (date?: Date) => {
    const params = date ? { date: date.toISOString() } : undefined;
    return apiClient.get('/api/automation/reports/daily', params);
  },
};

export const studentsApi = {
  // Get all students
  getStudents: () => apiClient.get('/api/students'),

  // Get student by ID
  getStudent: (id: string) => apiClient.get(`/api/students/${id}`),

  // Create new student
  createStudent: (data: any) => apiClient.post('/api/students', data),

  // Update student
  updateStudent: (id: string, data: any) =>
    apiClient.put(`/api/students/${id}`, data),

  // Delete student
  deleteStudent: (id: string) => apiClient.delete(`/api/students/${id}`),

  // Log student activity
  logActivity: (data: any) => apiClient.post('/api/students/activity', data),

  // Import students (enhanced with field mapping)
  importStudents: (
    file: File,
    fieldMappings?: any[],
    dryRun: boolean = false
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (fieldMappings) {
      formData.append('fieldMappings', JSON.stringify(fieldMappings));
    }
    formData.append('dryRun', dryRun.toString());

    return apiClient.post('/api/import/students/enhanced', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Preview import file
  previewImport: (
    file: File,
    importType: string = 'students',
    maxPreviewRows: number = 10
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', importType);
    formData.append('maxPreviewRows', maxPreviewRows.toString());

    return apiClient.post('/api/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Download import template
  downloadTemplate: () => {
    return apiClient.get('/api/import/templates/students');
  },
};

export const equipmentApi = {
  // Get all equipment
  getEquipment: () => apiClient.get('/api/equipment'),

  // Get equipment by ID
  getEquipmentById: (id: string) => apiClient.get(`/api/equipment/${id}`),

  // Start session
  startSession: (
    equipmentId: string,
    studentId: string,
    timeLimitMinutes: number
  ) =>
    apiClient.post('/api/equipment/session', {
      equipmentId,
      studentId,
      timeLimitMinutes,
    }),

  // End session
  endSession: (sessionId: string) =>
    apiClient.post(`/api/equipment/session/${sessionId}/end`),

  // Extend session
  extendSession: (sessionId: string, additionalMinutes: number) =>
    apiClient.post(`/api/equipment/session/${sessionId}/extend`, {
      additionalMinutes,
    }),
};

export const analyticsApi = {
  // Get dashboard metrics
  getMetrics: () => apiClient.get('/api/analytics/metrics'),

  // Get usage statistics
  getUsageStats: (period: 'day' | 'week' | 'month' = 'day') =>
    apiClient.get('/api/analytics/usage', { period }),

  // Get activity timeline
  getTimeline: (limit?: number) =>
    apiClient.get('/api/analytics/timeline', limit ? { limit } : undefined),

  // Get notifications for calendar
  getNotifications: () => apiClient.get('/api/analytics/notifications'),

  // Export data
  exportData: (
    format: 'csv' | 'json' = 'csv',
    dateRange?: { start: Date; end: Date }
  ) => {
    const params: any = { format };
    if (dateRange) {
      params.startDate = dateRange.start.toISOString();
      params.endDate = dateRange.end.toISOString();
    }
    return apiClient.get('/api/analytics/export', params);
  },
};

export const utilitiesApi = {
  // Documentation Methods
  // Get comprehensive documentation information
  getDocumentation: () => apiClient.get('/api/utilities/documentation'),

  // Refresh documentation cache
  refreshDocumentation: () =>
    apiClient.post('/api/utilities/documentation/refresh'),

  // Get documentation health status
  getDocumentationHealth: () =>
    apiClient.get('/api/utilities/documentation/health'),

  // Real-time Documentation Update Methods
  // Get documentation version information
  getDocumentationVersion: () =>
    apiClient.get('/api/utilities/documentation/version'),

  // Get documentation change history
  getDocumentationHistory: (params?: {
    limit?: number;
    offset?: number;
    since?: string;
  }) => apiClient.get('/api/utilities/documentation/history', params),

  // Submit documentation update
  submitDocumentationUpdate: (updateData: {
    type:
      | 'content_change'
      | 'structure_change'
      | 'metadata_update'
      | 'version_update';
    changes: Array<{
      file: string;
      section?: string;
      oldContent?: string;
      newContent?: string;
      changeType: 'added' | 'modified' | 'deleted' | 'moved';
    }>;
    metadata: {
      impactLevel: 'low' | 'medium' | 'high' | 'critical';
      requiresReview: boolean;
      description?: string;
    };
  }) => apiClient.post('/api/utilities/documentation/updates', updateData),

  // Get pending documentation updates
  getPendingUpdates: () =>
    apiClient.get('/api/utilities/documentation/updates/pending'),

  // Approve documentation update
  approveDocumentationUpdate: (
    updateId: string,
    approvalData?: { notes?: string }
  ) =>
    apiClient.post(
      `/api/utilities/documentation/updates/${updateId}/approve`,
      approvalData
    ),

  // Reject documentation update
  rejectDocumentationUpdate: (
    updateId: string,
    rejectionData: { reason: string; notes?: string }
  ) =>
    apiClient.post(
      `/api/utilities/documentation/updates/${updateId}/reject`,
      rejectionData
    ),

  // Get documentation update status
  getUpdateStatus: (updateId: string) =>
    apiClient.get(`/api/utilities/documentation/updates/${updateId}/status`),

  // Rollback documentation to previous version
  rollbackDocumentation: (
    versionHash: string,
    rollbackData?: { reason?: string }
  ) =>
    apiClient.post('/api/utilities/documentation/rollback', {
      versionHash,
      ...rollbackData,
    }),

  // Get documentation conflicts
  getDocumentationConflicts: () =>
    apiClient.get('/api/utilities/documentation/conflicts'),

  // Resolve documentation conflict
  resolveDocumentationConflict: (
    conflictId: string,
    resolution: {
      strategy: 'accept_incoming' | 'accept_current' | 'merge_manual';
      mergedContent?: string;
      notes?: string;
    }
  ) =>
    apiClient.post(
      `/api/utilities/documentation/conflicts/${conflictId}/resolve`,
      resolution
    ),

  // Subscribe to real-time documentation updates
  subscribeToUpdates: (subscriptionData: {
    types: Array<
      | 'content_change'
      | 'structure_change'
      | 'metadata_update'
      | 'version_update'
    >;
    files?: string[];
    impactLevels?: Array<'low' | 'medium' | 'high' | 'critical'>;
  }) =>
    apiClient.post('/api/utilities/documentation/subscribe', subscriptionData),

  // Unsubscribe from real-time documentation updates
  unsubscribeFromUpdates: (subscriptionId: string) =>
    apiClient.delete(
      `/api/utilities/documentation/subscribe/${subscriptionId}`
    ),

  // Validate documentation integrity
  validateDocumentationIntegrity: () =>
    apiClient.post('/api/utilities/documentation/validate'),

  // Get documentation metrics
  getDocumentationMetrics: (params?: {
    period?: 'day' | 'week' | 'month';
    includeDetails?: boolean;
  }) => apiClient.get('/api/utilities/documentation/metrics', params),

  // Sync documentation with external sources
  syncDocumentationSources: (syncData?: {
    sources?: string[];
    forceSync?: boolean;
  }) => apiClient.post('/api/utilities/documentation/sync', syncData),

  // Get documentation sync status
  getDocumentationSyncStatus: () =>
    apiClient.get('/api/utilities/documentation/sync/status'),

  // Create documentation snapshot
  createDocumentationSnapshot: (snapshotData: {
    name: string;
    description?: string;
    tags?: string[];
  }) => apiClient.post('/api/utilities/documentation/snapshots', snapshotData),

  // Get documentation snapshots
  getDocumentationSnapshots: (params?: { limit?: number; offset?: number }) =>
    apiClient.get('/api/utilities/documentation/snapshots', params),

  // Restore from documentation snapshot
  restoreFromSnapshot: (
    snapshotId: string,
    restoreData?: { preserveCurrentAsSnapshot?: boolean }
  ) =>
    apiClient.post(
      `/api/utilities/documentation/snapshots/${snapshotId}/restore`,
      restoreData
    ),

  // Delete documentation snapshot
  deleteDocumentationSnapshot: (snapshotId: string) =>
    apiClient.delete(`/api/utilities/documentation/snapshots/${snapshotId}`),

  // QR Code Methods
  // Generate QR codes for all students
  generateQRCodes: () => apiClient.post('/api/utilities/generate-qr-codes'),

  // Generate QR code for single student
  generateQRCode: (studentId: string) =>
    apiClient.post(`/api/utilities/generate-qr-code/${studentId}`),

  // Get QR generation report
  getQRReport: () => apiClient.get('/api/utilities/qr-generation-report'),

  // Get QR code image URL
  getQRCodeUrl: (studentId: string) => `/api/utilities/qr-code/${studentId}`,

  // Delete QR code
  deleteQRCode: (studentId: string) =>
    apiClient.delete(`/api/utilities/qr-code/${studentId}`),

  // Regenerate QR code
  regenerateQRCode: (studentId: string) =>
    apiClient.post(`/api/utilities/regenerate-qr-code/${studentId}`),

  // Get printable sheet URL
  getPrintableSheetUrl: () => '/api/utilities/qr-codes-sheet',

  // Barcode Methods
  // Generate barcodes for all students
  generateBarcodes: () => apiClient.post('/api/utilities/generate-barcodes'),

  // Generate barcode for single student
  generateBarcode: (studentId: string) =>
    apiClient.post(`/api/utilities/generate-barcode/${studentId}`),

  // Get barcode generation report
  getBarcodeReport: () =>
    apiClient.get('/api/utilities/barcode-generation-report'),

  // Get barcode image URL
  getBarcodeUrl: (studentId: string) => `/api/utilities/barcode/${studentId}`,

  // Delete barcode
  deleteBarcode: (studentId: string) =>
    apiClient.delete(`/api/utilities/barcode/${studentId}`),

  // Regenerate barcode
  regenerateBarcode: (studentId: string) =>
    apiClient.post(`/api/utilities/regenerate-barcode/${studentId}`),

  // Get printable barcodes sheet URL
  getBarcodesSheetUrl: () => '/api/utilities/barcodes-sheet',

  // Quick Actions Methods
  // Quick add student
  quickAddStudent: (studentData: any) =>
    apiClient.post('/api/utilities/quick-add-student', studentData),

  // Quick start session
  quickStartSession: (sessionData: any) =>
    apiClient.post('/api/utilities/quick-start-session', sessionData),

  // Get quick report
  getQuickReport: () => apiClient.get('/api/utilities/quick-report'),

  // Quick backup
  quickBackup: () => apiClient.post('/api/utilities/quick-backup'),
};

// Reports API
export const reportsApi = {
  // Get daily report
  getDailyReport: (date?: string) => {
    const params = date ? { date } : undefined;
    return apiClient.get('/api/reports/daily', params);
  },

  // Get weekly report
  getWeeklyReport: (date?: string) => {
    const params = date ? { date } : undefined;
    return apiClient.get('/api/reports/weekly', params);
  },

  // Get monthly report
  getMonthlyReport: (month?: number, year?: number) => {
    const params: any = {};
    if (month) {
      params.month = month;
    }
    if (year) {
      params.year = year;
    }
    return apiClient.get('/api/reports/monthly', params);
  },

  // Get custom report
  getCustomReport: (startDate: string, endDate: string) => {
    return apiClient.get('/api/reports/custom', {
      start: startDate,
      end: endDate,
    });
  },
};

// Fines API
export const finesApi = {
  // Get all fines
  getFines: (status?: 'outstanding' | 'paid', studentId?: string) => {
    const params: any = {};
    if (status) {
      params.status = status;
    }
    if (studentId) {
      params.studentId = studentId;
    }
    return apiClient.get('/api/fines', params);
  },

  // Get fines for a specific student
  getStudentFines: (studentId: string) => {
    return apiClient.get(`/api/fines/student/${studentId}`);
  },

  // Record fine payment
  recordPayment: (
    checkoutId: string,
    paymentData: { amountPaid: number; paymentMethod?: string; notes?: string }
  ) => {
    return apiClient.post(`/api/fines/${checkoutId}/payment`, paymentData);
  },

  // Waive fine
  waiveFine: (checkoutId: string, reason: string) => {
    return apiClient.post(`/api/fines/${checkoutId}/waive`, { reason });
  },

  // Update fine amount
  updateFineAmount: (checkoutId: string, amount: number) => {
    return apiClient.put(`/api/fines/${checkoutId}/amount`, { amount });
  },
};

// Settings API
export const settingsApi = {
  // System settings
  getSystemSettings: () => apiClient.get('/api/settings/system'),
  updateSystemSettings: (settings: any) =>
    apiClient.put('/api/settings/system', settings),
  resetSystemSettings: () => apiClient.post('/api/settings/system/reset'),

  // Google Sheets configuration
  getGoogleSheetsConfig: () => apiClient.get('/api/settings/google-sheets'),
  updateGoogleSheetsSchedule: (config: any) =>
    apiClient.put('/api/settings/google-sheets/schedule', config),
  testGoogleSheetsConnection: (spreadsheetId: string) =>
    apiClient.post('/api/settings/google-sheets/test', { spreadsheetId }),
  syncGoogleSheets: () => apiClient.post('/api/settings/google-sheets/sync'),

  // Backups
  getBackups: () => apiClient.get('/api/settings/backups'),
  createBackup: () => apiClient.post('/api/settings/backups/create'),
  deleteBackup: (id: string) => apiClient.delete(`/api/settings/backups/${id}`),

  // System logs
  getLogs: (params?: {
    page?: number;
    pageSize?: number;
    level?: string;
    search?: string;
  }) => apiClient.get('/api/settings/logs', params),

  // User management
  getUsers: () => apiClient.get('/api/settings/users'),
  createUser: (userData: any) =>
    apiClient.post('/api/settings/users', userData),
  updateUser: (id: string, userData: any) =>
    apiClient.put(`/api/settings/users/${id}`, userData),
  deleteUser: (id: string) => apiClient.delete(`/api/settings/users/${id}`),
  changePassword: (id: string, password: string) =>
    apiClient.post(`/api/settings/users/${id}/change-password`, {
      newPassword: password,
    }),
};

export default apiClient;
