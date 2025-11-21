import { apiClient } from '@/lib/api';

export interface KioskStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  section?: string;
}

export interface TapInResponse {
  success: boolean;
  message: string;
  student?: KioskStudent;
  canCheckIn: boolean;
  cooldownRemaining?: number;
}

export interface ConfirmCheckInResponse {
  success: boolean;
  message: string;
  activity?: {
    id: string;
    purpose: string;
    checkInTime: string;
  };
}

export const kioskApi = {
  tapIn: async (scanData: string) => {
    const response = await apiClient.post<TapInResponse>('/api/kiosk/tap-in', {
      scanData,
    });
    return response.data;
  },

  confirmCheckIn: async (
    studentId: string,
    purposes: string[],
    scanData: string
  ) => {
    const response = await apiClient.post<ConfirmCheckInResponse>(
      '/api/kiosk/confirm-check-in',
      {
        studentId,
        purposes,
        scanData,
      }
    );
    return response.data;
  },

  checkout: async (studentId: string) => {
    const response = await apiClient.post('/api/kiosk/checkout', {
      studentId,
      reason: 'manual',
    });
    return response.data;
  },

  getAnnouncements: async () => {
    // Fetch recent active announcements for the idle screen
    const response = await apiClient.get('/api/announcements/recent', {
      is_active: 'true',
      limit: 5,
    });
    return response.data;
  },
};
