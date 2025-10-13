import api from './api';

export interface SelfServiceStudent {
  id: string;
  studentId: string;
  name: string;
  gradeLevel: string;
  section: string;
}

export interface SelfServiceActivity {
  id: string;
  checkInTime: Date;
  timeLimit: number;
  timeRemaining?: number;
}

export interface SelfServiceCheckInResponse {
  success: boolean;
  message: string;
  student?: SelfServiceStudent;
  activity?: SelfServiceActivity;
  cooldownRemaining?: number;
}

export interface SelfServiceStatusResponse {
  success: boolean;
  isCheckedIn: boolean;
  student?: SelfServiceStudent;
  currentActivity?: SelfServiceActivity;
  lastCheckOut?: Date;
  canCheckIn: boolean;
  cooldownRemaining?: number;
}

export interface SelfServiceStatistics {
  success: boolean;
  data: {
    totalCheckIns: number;
    averageTimeSpent: number;
    uniqueStudents: number;
  };
}

export const selfServiceApi = {
  /**
   * Process a student scan (auto check-in or check-out)
   */
  async processScan(scanData: string): Promise<SelfServiceCheckInResponse> {
    const response = await api.post('/self-service/scan', { scanData });
    return response.data;
  },

  /**
   * Get student status
   */
  async getStatus(scanData: string): Promise<SelfServiceStatusResponse> {
    const response = await api.get(`/self-service/status/${scanData}`);
    return response.data;
  },

  /**
   * Check in a student
   */
  async checkIn(scanData: string): Promise<SelfServiceCheckInResponse> {
    const response = await api.post('/self-service/check-in', { scanData });
    return response.data;
  },

  /**
   * Check out a student
   */
  async checkOut(scanData: string): Promise<SelfServiceCheckInResponse> {
    const response = await api.post('/self-service/check-out', { scanData });
    return response.data;
  },

  /**
   * Get self-service statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<SelfServiceStatistics> {
    const params: any = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    const response = await api.get('/self-service/statistics', { params });
    return response.data;
  },
};

export default selfServiceApi;
