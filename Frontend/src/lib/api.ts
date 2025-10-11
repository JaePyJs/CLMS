import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'sonner';

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
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

// API client class
class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3003') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('clms_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        return response;
      },
      (error) => {
        // Handle network errors
        if (!error.response) {
          toast.error('Network error. Please check your connection.');
          return Promise.reject(error);
        }

        // Handle API errors
        const { status, data } = error.response;
        const errorMessage = data?.error || 'An unexpected error occurred';

        switch (status) {
          case 401:
            toast.error('Authentication required');
            // Redirect to login or handle auth
            break;
          case 403:
            toast.error('Access denied');
            break;
          case 404:
            toast.error('Resource not found');
            break;
          case 500:
            toast.error('Server error. Please try again later.');
            break;
          default:
            toast.error(errorMessage);
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic GET request
  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  // Generic POST request
  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
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
  refreshDocumentation: () => apiClient.post('/api/utilities/documentation/refresh'),

  // Get documentation health status
  getDocumentationHealth: () => apiClient.get('/api/utilities/documentation/health'),

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
  getQuickReport: () =>
    apiClient.get('/api/utilities/quick-report'),

  // Quick backup
  quickBackup: () =>
    apiClient.post('/api/utilities/quick-backup'),
};

export default apiClient;
