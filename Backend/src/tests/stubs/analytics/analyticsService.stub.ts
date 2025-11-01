// Stub for '@/services/analyticsService' matching commonly used API surface
// Keeps shapes minimal but consistent with routes usage.

export type PredictiveInsight = {
  type: 'demand_forecast' | 'peak_prediction' | 'resource_optimization' | 'anomaly_detection';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
  data: any;
  validUntil: Date;
};

export type HeatMapData = {
  hour: number;
  dayOfWeek: number;
  intensity: number;
  activityType?: string;
  gradeLevel?: string;
};

export type SeasonalPattern = {
  period: 'daily' | 'weekly' | 'monthly' | 'semester';
  pattern: number[];
  peakTimes: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: number;
};

export type ResourceForecast = {
  resourceType: 'computer' | 'gaming' | 'study_area' | 'books';
  currentUtilization: number;
  predictedUtilization: number[];
  recommendedCapacity: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeHorizon: 'day' | 'week' | 'month';
};

class AnalyticsServiceStub {
  async generatePredictiveInsights(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<PredictiveInsight[]> {
    return [
      {
        type: 'demand_forecast',
        title: 'Stub Demand Forecast',
        description: `Stub insights for ${timeframe}`,
        confidence: 0.9,
        impact: 'medium',
        recommendations: ['Increase capacity during peak hours'],
        data: { id: 'stub', updated_at: new Date() },
        validUntil: new Date(Date.now() + 3600_000)
      }
    ];
  }

  async generateUsageHeatMap(_timeframe: 'day' | 'week' | 'month' = 'week'): Promise<HeatMapData[]> {
    return [
      { hour: 10, dayOfWeek: 2, intensity: 0.7 },
      { hour: 14, dayOfWeek: 3, intensity: 0.85 }
    ];
  }

  async analyzeSeasonalPatterns(): Promise<SeasonalPattern[]> {
    return [
      { period: 'weekly', pattern: [0.5, 0.6, 0.7], peakTimes: [14], trend: 'stable', seasonality: 0.6 }
    ];
  }

  async generateResourceForecasts(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<ResourceForecast[]> {
    return [
      {
        resourceType: 'computer',
        currentUtilization: 65,
        predictedUtilization: [60, 62, 64],
        recommendedCapacity: 80,
        riskLevel: 'medium',
        timeHorizon: timeframe
      }
    ];
  }

  async getComprehensiveLibraryMetrics(_timeframe: 'day' | 'week' | 'month' = 'week') {
    return {
      utilization: { occupancyRate: 75, equipmentAvailabilityRate: 85 },
      circulation: { borrowedBooks: 120, returnedBooks: 110, overdueBooks: 10, circulationRate: 15, returnRate: 91.6, overdueRate: 8.3 },
      equipment: { totalSessions: 50, averageSessionDuration: 45, mostUsedEquipment: [] },
      fines: { totalFines: 1000, collectedFines: 600, outstandingFines: 400, collectionRate: 60, paymentTrends: [], fineCategories: [], overdueAnalysis: {} },
      trends: { dailyGrowth: 1.02, peakUsageHours: [14], popularCategories: [] }
    };
  }

  async getBookCirculationAnalytics(_timeframe: 'day' | 'week' | 'month' = 'week') {
    return {
      topBorrowers: [],
      topBooks: [],
      circulationByCategory: [],
      overdueAnalysis: {},
      trends: {}
    };
  }

  async getFineCollectionAnalytics(_timeframe: 'day' | 'week' | 'month' = 'week') {
    return {
      totalFines: 1000,
      collectedFines: 600,
      outstandingFines: 400,
      collectionRate: 60,
      paymentTrends: [],
      fineCategories: [],
      overdueAnalysis: {}
    };
  }

  async getEquipmentUtilizationAnalytics(_timeframe: 'day' | 'week' | 'month' = 'week') {
    return {
      overallUtilization: 70,
      utilizationByType: [],
      peakUsageTimes: [],
      maintenanceInsights: [],
      recommendations: []
    };
  }
}

export const analyticsService = new AnalyticsServiceStub();
export default analyticsService;