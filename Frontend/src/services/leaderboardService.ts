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
    month: number
  ): Promise<LeaderboardEntry[]> => {
    const response = await api.get(
      `/leaderboard/monthly?year=${year}&month=${month}`
    );
    return response.data;
  },

  getYearlyLeaderboard: async (year: number): Promise<LeaderboardEntry[]> => {
    const response = await api.get(`/leaderboard/yearly?year=${year}`);
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
