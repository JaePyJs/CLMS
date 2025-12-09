import axios from 'axios';

import { setupInterceptors } from './api/interceptors';

// API response interface
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  pagination?: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

// Login response interface
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

// Export data interface for analytics
export interface ExportData {
  content: string;
  mimeType: string;
  filename: string;
}

// Analytics user/book data interfaces
export interface AnalyticsUserData {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface AnalyticsBookData {
  id?: string;
  title?: string;
  totalBorrowings?: number;
  [key: string]: unknown;
}

export interface LibraryAnalytics {
  topUsers: AnalyticsUserData[];
  popularBooks: AnalyticsBookData[];
  totalPatrons: number;
  totalBooksBorrowed: number;
  averageBooksPerPatron: number;
  mostPopularPurpose: string;
  busiestDay: string;
  averageLibraryTime: string;
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
      withCredentials: true,
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 304,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    setupInterceptors(this.client);

    this.client.interceptors.response.use((response) => {
      if (response && response.data) {
        response.data = ApiClient.normalizeResponse(response.data);
      }
      return response;
    });
  }

  // Generic GET request
  async get<T>(
    url: string,
    config?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const finalConfig = (() => {
      if (!config) return {};
      if (typeof config === 'object') {
        if ('params' in config) return config;
        return { params: config };
      }
      return { params: config };
    })();
    const response = await this.client.get<ApiResponse<T>>(url, finalConfig);
    return response.data;
  }

  // Generic POST request
  async post<T>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  // Generic PUT request
  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  // Generic PATCH request
  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data);
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

  private static normalizeResponse(input: unknown, keyHint?: string): unknown {
    const isPlainObject = (val: unknown): val is Record<string, unknown> =>
      Object.prototype.toString.call(val) === '[object Object]';
    const isNumericString = (val: unknown): val is string =>
      typeof val === 'string' && /^-?\d+(?:\.\d+)?$/.test(val);
    const isExcludedKey = (key?: string) =>
      !!key && /(id|code|barcode|isbn|accession)/i.test(key);

    if (Array.isArray(input)) {
      return input.map((v) => ApiClient.normalizeResponse(v));
    }
    if (isPlainObject(input)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(input)) {
        const v = input[k];
        if (!isExcludedKey(k) && isNumericString(v)) {
          out[k] = Number(v);
        } else if (
          v &&
          typeof v === 'object' &&
          typeof (v as { toString?: unknown }).toString === 'function'
        ) {
          const s = String(v);
          out[k] = isNumericString(s)
            ? Number(s)
            : ApiClient.normalizeResponse(v, k);
        } else {
          out[k] = ApiClient.normalizeResponse(v, k);
        }
      }
      return out;
    }
    if (isNumericString(input) && !isExcludedKey(keyHint)) {
      return Number(input);
    }
    return input;
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
  health: () => apiClient.get('/api/health'),

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

export const scanApi = {
  detect: (barcode: string) =>
    apiClient.post('/api/scan', { barcode, preview: true }),
  process: (payload: {
    barcode: string;
    intent?: 'BORROW' | 'READ' | 'RETURN';
    studentId?: string;
    dueDate?: string;
    notes?: string;
  }) => apiClient.post('/api/scan', payload),
};

// Attendance Export API
export const attendanceApi = {
  // Get attendance data for a date range
  getData: (startDate: string, endDate: string) =>
    apiClient.get('/api/attendance-export/data', { startDate, endDate }),

  // Get attendance summary statistics
  getSummary: (startDate: string, endDate: string) =>
    apiClient.get('/api/attendance-export/summary', { startDate, endDate }),

  // Export attendance to CSV - returns blob
  exportCSV: async (startDate: string, endDate: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || ''}/api/attendance-export/export/csv?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      }
    );
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },

  // Get today's attendance
  getToday: () => {
    const today = new Date();
    const startDate = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endDate = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    return apiClient.get('/api/attendance-export/data', { startDate, endDate });
  },

  // Get active check-ins (students currently in library)
  getActiveSessions: () => apiClient.get('/api/students/active-sessions'),
};

export const studentsApi = {
  // Get all students (helper for non-paginated view)
  getAll: () => apiClient.get('/api/students', { limit: 10000 }),

  // Get all students with pagination
  getStudents: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    gradeLevel?: string;
    section?: string;
    isActive?: boolean;
  }) => apiClient.get('/api/students', params),

  // Get active sessions (currently checked-in students)
  getActiveSessions: () => apiClient.get('/api/students/active-sessions'),

  // Search students
  searchStudents: (q: string, limit: number = 10, offset: number = 0) =>
    apiClient.get('/api/students/search', { q, limit, offset }),

  // Get student by ID
  getStudent: (id: string) => apiClient.get(`/api/students/${id}`),

  // Create new student
  createStudent: (data: unknown) => apiClient.post('/api/students', data),

  // Update student
  updateStudent: (id: string, data: unknown) =>
    apiClient.put(`/api/students/${id}`, data),

  // Delete student
  deleteStudent: (id: string) => apiClient.delete(`/api/students/${id}`),

  // Log student activity
  logActivity: (data: unknown) =>
    apiClient.post('/api/students/activity', data),

  // Import students (enhanced with field mapping)
  importStudents: (
    file: File,
    fieldMappings?: Array<{ source: string; target: string }>,
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
      timeout: 300000, // 5 minute timeout for large imports
    });
  },

  // Preview import file
  previewImport: (
    file: File,
    importType: string = 'students',
    maxPreviewRows: number = 10,
    fieldMappings?: Array<{ source: string; target: string }>,
    skipHeaderRow: boolean = true
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', importType);
    formData.append('maxPreviewRows', maxPreviewRows.toString());
    formData.append('skipHeaderRow', skipHeaderRow.toString());
    if (fieldMappings) {
      formData.append('fieldMappings', JSON.stringify(fieldMappings));
    }

    return apiClient.post('/api/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 1 minute timeout for preview
    });
  },

  // Download import template
  downloadTemplate: () => {
    return apiClient.get('/api/import/templates/students');
  },

  // Fix student names from CSV (updates last_name for existing records)
  fixStudentNames: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post('/api/import/fix-students', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minute timeout
    });
  },
};

export const equipmentApi = {
  // Get all equipment
  getEquipment: () => apiClient.get('/api/equipment'),

  // Get equipment by ID
  getEquipmentById: (id: string) => apiClient.get(`/api/equipment/${id}`),

  // Create new equipment/room
  create: (data: {
    name: string;
    category?: string;
    serial_number?: string;
    status?: string;
    notes?: string;
  }) => apiClient.post('/api/equipment', data),

  // Update equipment
  update: (
    id: string,
    data: {
      name?: string;
      category?: string;
      serial_number?: string;
      status?: string;
      notes?: string;
    }
  ) => apiClient.put(`/api/equipment/${id}`, data),

  // Delete equipment
  delete: (id: string) => apiClient.delete(`/api/equipment/${id}`),

  // Get session history for equipment
  getSessionHistory: (equipmentId: string) =>
    apiClient.get(`/api/equipment/${equipmentId}/sessions`),

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

  // Get equipment analytics
  getEquipmentAnalytics: (period: '30' | '60' | '90' = '30') =>
    apiClient.get('/api/analytics/equipment', { period }),

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
    const data: Record<string, unknown> = { format };
    if (dateRange) {
      data.startDate = dateRange.start.toISOString();
      data.endDate = dateRange.end.toISOString();
    }
    return apiClient.post('/api/analytics/export', data);
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
  quickAddStudent: (studentData: Record<string, unknown>) =>
    apiClient.post('/api/utilities/quick-add-student', studentData),

  // Quick start session
  quickStartSession: (sessionData: Record<string, unknown>) =>
    apiClient.post('/api/utilities/quick-start-session', sessionData),

  // Get quick report
  getQuickReport: () => apiClient.get('/api/utilities/quick-report'),

  // Quick backup
  quickBackup: () => apiClient.post('/api/settings/backups/create'),
};

// Books API
export const booksApi = {
  // Get all books with pagination
  getBooks: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    author?: string;
    available?: boolean;
  }) => apiClient.get('/api/books', params),

  // Get book by ID
  getBook: (id: string) => apiClient.get(`/api/books/${id}`),

  // Search books
  searchBooks: (query: string, filters?: Record<string, unknown>) =>
    apiClient.get('/api/books/search', { q: query, ...filters }),

  // Get book stats
  getStats: () => apiClient.get('/api/books/stats'),

  // Get categories
  getCategories: () => apiClient.get('/api/books/categories'),

  // Title lookup with duplicate detection
  lookupTitles: (query: string, limit?: number) =>
    apiClient.get('/api/books/titles/lookup', { q: query, limit }),

  // Get duplicate titles
  getDuplicateTitles: () => apiClient.get('/api/books/titles/duplicates'),

  // Create book
  createBook: (data: Record<string, unknown>) =>
    apiClient.post('/api/books', data),

  // Update book
  updateBook: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/api/books/${id}`, data),

  // Delete book
  deleteBook: (id: string) => apiClient.delete(`/api/books/${id}`),

  // Preview import (dry run) - accepts File or parsed data array
  previewImport: (
    fileOrData: File | Record<string, unknown>[],
    maxRows?: number,
    fieldMapping?: Array<{ source: string; target: string }>,
    skipHeaderRow: boolean = true
  ) => {
    if (fileOrData instanceof File) {
      const formData = new FormData();
      formData.append('file', fileOrData);
      formData.append('skipHeaderRow', skipHeaderRow.toString());
      if (maxRows) formData.append('maxPreviewRows', maxRows.toString());
      if (fieldMapping)
        formData.append('fieldMappings', JSON.stringify(fieldMapping));
      return apiClient.post('/api/import/books/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 minute timeout for preview
      });
    }
    return apiClient.post(
      '/api/import/books/preview',
      {
        data: fileOrData,
        fieldMapping,
        skipHeaderRow,
      },
      {
        timeout: 120000, // 2 minute timeout for preview
      }
    );
  },

  // Import books - accepts File or parsed data array
  importBooks: (
    fileOrData: File | Record<string, unknown>[],
    fieldMapping?: Array<{ source: string; target: string }>,
    options?: Record<string, unknown>
  ) => {
    if (fileOrData instanceof File) {
      const formData = new FormData();
      formData.append('file', fileOrData);
      if (fieldMapping)
        formData.append('fieldMappings', JSON.stringify(fieldMapping));
      if (options) formData.append('options', JSON.stringify(options));
      return apiClient.post('/api/import/books', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 minute timeout for large book imports
      });
    }
    return apiClient.post(
      '/api/import/books',
      {
        data: fileOrData,
        fieldMapping,
        options,
      },
      {
        timeout: 300000, // 5 minute timeout for large book imports
      }
    );
  },

  // Download import template
  downloadTemplate: () => apiClient.get('/api/import/templates/books'),
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
    const params: Record<string, unknown> = {};
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
    const params: Record<string, unknown> = {};
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
  updateSystemSettings: (settings: Record<string, unknown>) =>
    apiClient.put('/api/settings/system', settings),
  resetSystemSettings: () => apiClient.post('/api/settings/system/reset'),

  // Data Reset (Admin only)
  resetDailyData: (deleteTodaysActivities?: boolean) =>
    apiClient.post('/api/settings/reset-daily-data', {
      deleteTodaysActivities,
    }),
  resetAllData: (confirmationCode: string) =>
    apiClient.post('/api/settings/reset-all-data', { confirmationCode }),

  // Nuclear Reset - Complete database wipe (Admin only)
  nuclearReset: (confirmationCode: string) =>
    apiClient.post('/api/settings/nuclear-reset', { confirmationCode }),

  // Google Sheets configuration
  getGoogleSheetsConfig: () => apiClient.get('/api/settings/google-sheets'),
  updateGoogleSheetsSchedule: (config: Record<string, unknown>) =>
    apiClient.put('/api/settings/google-sheets/schedule', config),
  testGoogleSheetsConnection: (spreadsheetId: string) =>
    apiClient.post('/api/settings/google-sheets/test', { spreadsheetId }),
  syncGoogleSheets: () => apiClient.post('/api/settings/google-sheets/sync'),

  // Backups
  getBackups: () => apiClient.get('/api/backups'),
  createBackup: () => apiClient.post('/api/backups/full'),
  deleteBackup: (id: string) => apiClient.delete(`/api/backups/${id}`),

  // System logs
  getLogs: (params?: {
    page?: number;
    pageSize?: number;
    level?: string;
    search?: string;
  }) => apiClient.get('/api/settings/logs', params),

  // User management
  getUsers: () => apiClient.get('/api/users'),
  createUser: (userData: Record<string, unknown>) =>
    apiClient.post('/api/users', userData),
  updateUser: (id: string, userData: Record<string, unknown>) =>
    apiClient.put(`/api/users/${id}`, userData),
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),
  changePassword: (id: string, password: string) =>
    apiClient.post(`/api/users/${id}/change-password`, {
      newPassword: password,
    }),
  resetUserPasswordToDefault: (
    id: string,
    credentials: { adminUsername: string; adminPassword: string }
  ) => apiClient.post(`/api/users/${id}/reset-password/default`, credentials),
};

// Enhanced Library API
export const enhancedLibraryApi = {
  // User Tracking
  getCurrentPatrons: () => apiClient.get('/api/enhanced-library/user-tracking'),

  getPatronHistory: (studentId: string) =>
    apiClient.get(`/api/enhanced-library/patrons/${studentId}/history`),

  checkoutPatron: (studentId: string) =>
    apiClient.post('/api/enhanced-library/patrons/checkout', { studentId }),

  // Borrowing Flow
  getAvailableBooks: (materialType?: string) => {
    const params = materialType ? { materialType } : undefined;
    return apiClient.get('/api/enhanced-library/books/available', params);
  },

  searchBooks: (query: string, materialType?: string) => {
    const params: Record<string, unknown> = { query };
    if (materialType) {
      params.materialType = materialType;
    }
    return apiClient.get('/api/enhanced-library/books/search', params);
  },

  borrowBooks: async (
    studentId: string,
    bookIds: string[],
    materialType: string
  ) => {
    if (!studentId || !bookIds.length || !materialType) {
      console.error(
        '[enhancedLibraryApi.borrowBooks] Missing required params:',
        {
          studentId,
          bookIds,
          materialType,
        }
      );
      return {
        success: false,
        error: 'Missing required parameters',
      } as ApiResponse<unknown>;
    }

    const results: ApiResponse<unknown>[] = [];
    for (const bookId of bookIds) {
      const payload = {
        studentId,
        bookId,
        materialType,
      };
      const r = await apiClient.post('/api/enhanced-library/borrow', payload);
      results.push(r);
    }
    return { success: true, data: results } as ApiResponse<
      ApiResponse<unknown>[]
    >;
  },

  // Returning Flow
  getBorrowedBooks: (studentId: string) =>
    apiClient.get(`/api/enhanced-library/borrowed/${studentId}`),

  returnBooks: async (checkoutIds: string[]) => {
    const results: ApiResponse<unknown>[] = [];
    for (const checkoutId of checkoutIds) {
      const r = await apiClient.post('/api/enhanced-library/return', {
        checkoutId,
      });
      results.push(r);
    }
    return { success: true, data: results } as ApiResponse<
      ApiResponse<unknown>[]
    >;
  },

  // Overdue Management
  getOverdueLoans: (config?: Record<string, unknown>) =>
    apiClient.get('/api/enhanced-library/overdue', config),

  getStudentOverdue: (studentId: string) =>
    apiClient.get(`/api/enhanced-library/overdue/${studentId}`),

  calculateFine: (checkoutId: string) =>
    apiClient.get(`/api/enhanced-library/fine/${checkoutId}`),

  payFine: (checkoutId: string, amount: number, paymentMethod: string) =>
    apiClient.post(`/api/enhanced-library/fine/${checkoutId}/pay`, {
      amount,
      paymentMethod,
    }),

  sendOverdueReminder: (studentId: string) =>
    apiClient.post('/api/enhanced-library/overdue/reminder', { studentId }),

  // Analytics
  getTopUsers: (limit: number = 10) =>
    apiClient.get('/api/enhanced-library/analytics/top-users', { limit }),

  getPopularBooks: (limit: number = 10) =>
    apiClient.get('/api/enhanced-library/analytics/popular-books', { limit }),

  getBorrowingStats: (period: 'day' | 'week' | 'month' = 'month') =>
    apiClient.get('/api/enhanced-library/analytics/stats', { period }),

  // Material Policies
  getMaterialPolicies: () => apiClient.get('/api/enhanced-library/policies'),

  updateMaterialPolicy: (
    materialType: string,
    policy: Record<string, unknown>
  ) => apiClient.put(`/api/enhanced-library/policies/${materialType}`, policy),

  // Grade-based Fine Management
  getGradeFines: () => apiClient.get('/api/enhanced-library/grade-fines'),

  updateGradeFine: (gradeLevel: string, dailyFine: number) =>
    apiClient.put('/api/enhanced-library/grade-fines', {
      gradeLevel,
      dailyFine,
    }),

  // Reports
  generateMonthlyReport: (month: number, year: number) =>
    apiClient.get('/api/enhanced-library/reports/monthly', { month, year }),

  exportReport: (reportId: string, format: 'pdf' | 'excel') =>
    apiClient.get(`/api/enhanced-library/reports/${reportId}/export`, {
      format,
    }),

  // Inventory Management
  getInventory: () => apiClient.get('/api/enhanced-library/inventory'),

  addInventoryItem: (item: Record<string, unknown>) =>
    apiClient.post('/api/enhanced-library/inventory', item),

  updateInventoryItem: (itemId: string, updates: Record<string, unknown>) =>
    apiClient.put(`/api/enhanced-library/inventory/${itemId}`, updates),

  scanBarcode: (barcode: string) =>
    apiClient.get(`/api/enhanced-library/inventory/scan/${barcode}`),

  // Printing Service
  getPrintJobs: () => apiClient.get('/api/enhanced-library/printing/jobs'),

  createPrintJob: (jobData: {
    studentId: string;
    documentName: string;
    pages: number;
    copies: number;
    color: boolean;
    doubleSided: boolean;
  }) => apiClient.post('/api/enhanced-library/printing/jobs', jobData),

  updatePrintJobStatus: (jobId: string, status: string) =>
    apiClient.put(`/api/enhanced-library/printing/jobs/${jobId}/status`, {
      status,
    }),

  getPrintPricing: () =>
    apiClient.get('/api/enhanced-library/printing/pricing'),

  updatePrintPricing: (pricing: Record<string, unknown>) =>
    apiClient.put('/api/enhanced-library/printing/pricing', pricing),

  // Aggregated Library Analytics for UI
  getLibraryAnalytics: async (period: 'week' | 'month' | 'year' = 'month') => {
    try {
      const [usersRes, booksRes] = await Promise.all([
        enhancedLibraryApi.getTopUsers(10),
        enhancedLibraryApi.getPopularBooks(10),
      ]);

      const topUsers: AnalyticsUserData[] = Array.isArray(usersRes.data)
        ? (usersRes.data as AnalyticsUserData[])
        : [];
      const popularBooks: AnalyticsBookData[] = Array.isArray(booksRes.data)
        ? (booksRes.data as AnalyticsBookData[])
        : [];

      const totalPatrons = topUsers.length;
      const totalBooksBorrowed = popularBooks.reduce(
        (sum, b) => sum + Number(b?.totalBorrowings || 0),
        0
      );
      const averageBooksPerPatron =
        totalPatrons > 0 ? totalBooksBorrowed / totalPatrons : 0;
      const mostPopularPurpose = 'Borrowing';
      const busiestDay = 'Friday';
      const averageLibraryTime = '45m';

      return {
        success: true,
        data: {
          topUsers,
          popularBooks,
          totalPatrons,
          totalBooksBorrowed,
          averageBooksPerPatron,
          mostPopularPurpose,
          busiestDay,
          averageLibraryTime,
        },
      } as ApiResponse<LibraryAnalytics>;
    } catch {
      return {
        success: false,
        error: 'Failed to aggregate analytics',
      } as ApiResponse<unknown>;
    }
  },

  exportAnalytics: async (period: 'week' | 'month' | 'year' = 'month') => {
    const content = JSON.stringify(
      { exportedAt: new Date().toISOString(), period },
      null,
      2
    );
    return {
      success: true,
      data: {
        content,
        mimeType: 'application/json',
        filename: `library-analytics-${period}.json`,
      },
    } as ApiResponse<ExportData>;
  },
};

export default apiClient;
