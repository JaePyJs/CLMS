import api from './api';

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  gradeLevel: string;
  section: string;
  scanCount: number;
  totalMinutes: number;
  rank: number;
}

export interface Reward {
  id: string;
  studentId: string;
  type: string;
  description: string;
  issuedAt: string;
}

export interface RewardsGenerationResult {
  generated: boolean;
  count: number;
  rewards: Reward[];
}

export interface LeaderboardResetResult {
  success: boolean;
  message: string;
  recordsDeleted: number;
}

export const LeaderboardService = {
  getMonthlyLeaderboard: async (
    year: number,
    month: number,
    gradeLevel?: number,
    section?: string
  ): Promise<LeaderboardEntry[]> => {
    let url = `/leaderboard/monthly?year=${year}&month=${month}&limit=1000`;
    if (gradeLevel !== undefined && gradeLevel !== null) {
      url += `&gradeLevel=${gradeLevel}`;
    }
    if (section) {
      url += `&section=${encodeURIComponent(section)}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  getYearlyLeaderboard: async (
    year: number,
    gradeLevel?: number,
    section?: string
  ): Promise<LeaderboardEntry[]> => {
    let url = `/leaderboard/yearly?year=${year}&limit=1000`;
    if (gradeLevel !== undefined && gradeLevel !== null) {
      url += `&gradeLevel=${gradeLevel}`;
    }
    if (section) {
      url += `&section=${encodeURIComponent(section)}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  generateMonthlyRewards: async (
    year: number,
    month: number
  ): Promise<RewardsGenerationResult> => {
    const response = await api.post('/leaderboard/rewards/generate', {
      year,
      month,
    });
    return response.data;
  },

  resetLeaderboard: async (
    year?: number,
    month?: number
  ): Promise<LeaderboardResetResult> => {
    const response = await api.post('/leaderboard/reset', {
      year,
      month,
    });
    return response.data;
  },
};
