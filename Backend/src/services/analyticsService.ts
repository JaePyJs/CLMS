import { PrismaClient, student_activities_activity_type, student_activities_status, equipment_status, students_grade_category } from '@prisma/client';
import { logger } from '@/utils/logger';
import { performanceOptimizationService } from './performanceOptimizationService';

const prisma = new PrismaClient();

export interface UsagePattern {
  hour: number;
  dayOfWeek: number;
  studentCount: number;
  equipmentCount: number;
  activity_type: student_activities_activity_type;
  predictedDemand: number;
  confidence: number;
}

export interface PredictiveInsight {
  type: 'demand_forecast' | 'peak_prediction' | 'resource_optimization' | 'anomaly_detection';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
  data: any;
  validUntil: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  predicted?: number;
  upperBound?: number;
  lowerBound?: number;
}

export interface HeatMapData {
  hour: number;
  dayOfWeek: number;
  intensity: number;
  activityType?: student_activities_activity_type;
  gradeLevel?: students_grade_category;
}

export interface SeasonalPattern {
  period: 'daily' | 'weekly' | 'monthly' | 'semester';
  pattern: number[];
  peakTimes: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: number; // 0-1, strength of seasonal pattern
}

export interface ResourceForecast {
  resourceType: 'computer' | 'gaming' | 'study_area' | 'books';
  currentUtilization: number;
  predictedUtilization: number[];
  recommendedCapacity: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeHorizon: 'day' | 'week' | 'month';
}

class AnalyticsService {
  /**
   * Generate predictive insights using statistical analysis and ML algorithms (optimized with caching)
   */
  async generatePredictiveInsights(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<PredictiveInsight[]> {
    return performanceOptimizationService.executeQuery(
      `predictive_insights_${timeframe}`,
      async () => {
        const insights: PredictiveInsight[] = [];

        // Parallel execution of all analysis methods
        const [demandForecast, peakPrediction, resourceOptimization, anomalies] = await Promise.all([
          this.forecastEquipmentDemand(timeframe),
          this.predictPeakUsage(timeframe),
          this.analyzeResourceOptimization(timeframe),
          this.detectUsageAnomalies(),
        ]);

        insights.push(demandForecast, peakPrediction, resourceOptimization, ...anomalies);
        return insights.sort((a, b) => b.confidence - a.confidence);
      },
      {
        key: `analytics:insights:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'insights', timeframe],
      }
    );
  }

  /**
   * Forecast equipment demand using time series analysis
   */
  private async forecastEquipmentDemand(timeframe: 'day' | 'week' | 'month'): Promise<PredictiveInsight> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);

    // Get historical usage data
    const historicalData = await prisma.student_activities.groupBy({
      by: ['equipment_id', 'activityType'],
      where: {
        start_time: { gte: startDate },
        activity_type: { in: [student_activities_activity_type.COMPUTER_USE, student_activities_activity_type.GAMING] }
      },
      _count: { id: true }
    });

    // Simple moving average prediction with trend analysis
    const totalUsage = historicalData.reduce((sum, item) => sum + item._count.id, 0);
    const avgDailyUsage = totalUsage / this.getDaysInPeriod(timeframe);

    // Calculate trend (simplified linear regression)
    const trend = await this.calculateUsageTrend(timeframe);
    const predictedIncrease = trend * 0.1; // 10% of trend factor

    const predictedDemand = Math.round(avgDailyUsage * (1 + predictedIncrease));
    const confidence = Math.max(0.6, Math.min(0.95, 0.8 - Math.abs(trend) * 0.1));

    return {
      type: 'demand_forecast',
      title: 'Equipment Demand Forecast',
      description: `Predicted ${timeframe}ly equipment demand: ${predictedDemand} sessions/day (${Math.round((predictedIncrease * 100))}% ${trend > 0 ? 'increase' : 'decrease'} from current)`,
      confidence,
      impact: predictedDemand > avgDailyUsage * 1.2 ? 'high' : predictedDemand > avgDailyUsage * 1.1 ? 'medium' : 'low',
      recommendations: this.generateDemandRecommendations(predictedDemand, avgDailyUsage, timeframe),
      data: { id: crypto.randomUUID(), updated_at: new Date(),  current: avgDailyUsage, predicted: predictedDemand, trend },
      validUntil: new Date(Date.now() + this.getPeriodMs(timeframe))
    };
  }

  /**
   * Predict peak usage times using historical patterns
   */
  private async predictPeakUsage(timeframe: 'day' | 'week' | 'month'): Promise<PredictiveInsight> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);

    // Get hourly usage patterns
    const hourlyData = await prisma.$queryRaw<Array<{ hour: number; count: number }>>`
      SELECT EXTRACT(HOUR FROM startTime) as hour, COUNT(*) as count
      FROM activities
      WHERE startTime >= ${startDate}
      GROUP BY EXTRACT(HOUR FROM startTime)
      ORDER BY count DESC
      LIMIT 3
    `;

    const peakHours = hourlyData.map(d => d.hour);
    const peakConfidence = hourlyData.length > 0 ? Math.min(0.9, 0.6 + (hourlyData[0].count / 100) * 0.1) : 0.5;

    // Get day-of-week patterns
    const weeklyData = await prisma.$queryRaw<Array<{ dayOfWeek: number; count: number }>>`
      SELECT EXTRACT(DOW FROM startTime) as dayOfWeek, COUNT(*) as count
      FROM activities
      WHERE startTime >= ${startDate}
      GROUP BY EXTRACT(DOW FROM startTime)
      ORDER BY count DESC
      LIMIT 2
    `;

    const peakDays = weeklyData.map(d => parseInt(d.dayOfWeek.toString()));

    return {
      type: 'peak_prediction',
      title: 'Peak Usage Prediction',
      description: `Peak usage expected at ${peakHours.join(', ')}:00 on days ${peakDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`,
      confidence: peakConfidence,
      impact: 'medium',
      recommendations: [
        'Schedule staff breaks before peak hours',
        'Ensure all equipment is operational before peak times',
        'Consider time-based access controls during peak periods',
        'Prepare backup resources for unexpected demand spikes'
      ],
      data: { id: crypto.randomUUID(), updated_at: new Date(),  peakHours, peakDays, hourlyDistribution: hourlyData, weeklyDistribution: weeklyData },
      validUntil: new Date(Date.now() + this.getPeriodMs(timeframe))
    };
  }

  /**
   * Analyze resource utilization and provide optimization recommendations
   */
  private async analyzeResourceOptimization(timeframe: 'day' | 'week' | 'month'): Promise<PredictiveInsight> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);

    // Get equipment utilization by type
    const equipmentStats = await prisma.equipment.groupBy({
      by: ['type', 'status'],
      _count: { id: true }
    });

    const utilizationRates: { [key: string]: number } = {};
    const totalByType: { [key: string]: number } = {};

    equipmentStats.forEach(stat => {
      const type = stat.type || 'unknown';
      if (!totalByType[type]) totalByType[type] = 0;
      totalByType[type] += stat._count.id;

      if (stat.status === equipment_status.IN_USE) {
        utilizationRates[type] = (utilizationRates[type] || 0) + stat._count.id;
      }
    });

    // Calculate utilization percentages
    Object.keys(totalByType).forEach(type => {
      utilizationRates[type] = (utilizationRates[type] / totalByType[type]) * 100;
    });

    // Identify underutilized and overutilized resources
    const underutilized = Object.entries(utilizationRates)
      .filter(([_, rate]) => rate < 30)
      .map(([type, rate]) => ({ type, rate }));

    const overutilized = Object.entries(utilizationRates)
      .filter(([_, rate]) => rate > 80)
      .map(([type, rate]) => ({ type, rate }));

    const recommendations: string[] = [];

    if (underutilized.length > 0) {
      recommendations.push(`Consider repurposing or marketing underutilized resources: ${underutilized.map(u => u.type).join(', ')}`);
    }

    if (overutilized.length > 0) {
      recommendations.push(`Add capacity for overutilized resources: ${overutilized.map(o => o.type).join(', ')}`);
    }

    recommendations.push('Implement dynamic scheduling to balance load across all resources');
    recommendations.push('Consider time-sharing arrangements for high-demand equipment');

    return {
      type: 'resource_optimization',
      title: 'Resource Utilization Analysis',
      description: `Current utilization ranges from ${Math.round(Math.min(...Object.values(utilizationRates)))}% to ${Math.round(Math.max(...Object.values(utilizationRates)))}%`,
      confidence: 0.85,
      impact: overutilized.length > 0 ? 'high' : underutilized.length > 0 ? 'medium' : 'low',
      recommendations,
      data: { id: crypto.randomUUID(), updated_at: new Date(),  utilizationRates, underutilized, overutilized },
      validUntil: new Date(Date.now() + this.getPeriodMs(timeframe))
    };
  }

  /**
   * Detect usage anomalies using statistical methods
   */
  private async detectUsageAnomalies(): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    // Get daily activity counts
    const dailyActivities = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
      SELECT DATE(startTime) as date, COUNT(*) as count
      FROM activities
      WHERE startTime >= ${startDate}
      GROUP BY DATE(startTime)
      ORDER BY date
    `;

    if (dailyActivities.length < 7) return insights; // Need sufficient data

    // Calculate mean and standard deviation
    const counts = dailyActivities.map(d => Number(d.count));
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    // Find anomalies (more than 2 standard deviations from mean)
    const anomalies = dailyActivities.filter(d => Math.abs(Number(d.count) - mean) > 2 * stdDev);

    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly_detection',
        title: 'Usage Anomaly Detected',
        description: `Unusual activity patterns detected on ${anomalies.length} day(s) in the last month`,
        confidence: 0.75,
        impact: anomalies.length > 3 ? 'high' : anomalies.length > 1 ? 'medium' : 'low',
        recommendations: [
          'Investigate unusual activity patterns',
          'Check for data quality issues or system errors',
          'Review if special events caused these patterns',
          'Consider adjusting anomaly detection thresholds if patterns are normal'
        ],
        data: { id: crypto.randomUUID(), updated_at: new Date(),  anomalies, mean, stdDev, threshold: 2 },
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Valid for one week
      });
    }

    return insights;
  }

  /**
   * Generate usage patterns for heat map visualization (optimized with caching)
   */
  async generateUsageHeatMap(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<HeatMapData[]> {
    return performanceOptimizationService.executeQuery(
      `usage_heatmap_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe, endDate);

        const heatMapData = await prisma.$queryRaw<Array<HeatMapData>>`
          SELECT
            EXTRACT(HOUR FROM start_time) as hour,
            EXTRACT(DOW FROM start_time) as dayOfWeek,
            COUNT(*) as intensity,
            activity_type,
            grade_level
          FROM student_activities
          WHERE start_time >= ${startDate}
          GROUP BY EXTRACT(HOUR FROM start_time), EXTRACT(DOW FROM start_time), activity_type, grade_level
          ORDER BY intensity DESC
        `;

        return heatMapData.map(d => ({
          hour: Number(d.hour),
          dayOfWeek: Number(d.dayOfWeek),
          intensity: Number(d.intensity),
          activity_type: d.activity_type as student_activities_activity_type,
          grade_level: d.grade_level as students_grade_category
        }));
      },
      {
        key: `analytics:heatmap:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'heatmap', timeframe],
      }
    );
  }

  /**
   * Generate time series data with predictions
   */
  async generateTimeSeriesForecast(
    metric: 'student_visits' | 'equipment_usage' | 'book_circulation',
    timeframe: 'day' | 'week' | 'month' = 'week',
    periods: number = 7
  ): Promise<TimeSeriesData[]> {
    try {
      const endDate = new Date();
      const startDate = this.getStartDate(timeframe, endDate);
      const periodMs = this.getPeriodMs(timeframe);

      // Get historical data
      let historicalData: TimeSeriesData[];

      switch (metric) {
        case 'student_visits':
          const visits = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
            SELECT DATE(startTime) as date, COUNT(DISTINCT student_id) as count
            FROM activities
            WHERE startTime >= ${startDate}
            GROUP BY DATE(startTime)
            ORDER BY date
          `;
          historicalData = visits.map(v => ({
            timestamp: v.date,
            value: Number(v.count)
          }));
          break;

        case 'equipment_usage':
          const equipment = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
            SELECT DATE(startTime) as date, COUNT(*) as count
            FROM activities
            WHERE startTime >= ${startDate} AND equipment_id IS NOT NULL
            GROUP BY DATE(startTime)
            ORDER BY date
          `;
          historicalData = equipment.map(e => ({
            timestamp: e.date,
            value: Number(e.count)
          }));
          break;

        case 'book_circulation':
          const books = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
            SELECT DATE(startTime) as date, COUNT(*) as count
            FROM activities
            WHERE startTime >= ${startDate} AND activityType IN ('BOOK_BORROW', 'BOOK_RETURN')
            GROUP BY DATE(startTime)
            ORDER BY date
          `;
          historicalData = books.map(b => ({
            timestamp: b.date,
            value: Number(b.count)
          }));
          break;

        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      // Generate predictions using simple exponential smoothing
      const alpha = 0.3; // Smoothing factor
      const forecastData: TimeSeriesData[] = [...historicalData];

      // Calculate last value and trend
      const values = historicalData.map(d => d.value);
      const lastValue = values[values.length - 1];
      const trend = this.calculateTrend(values);

      // Generate predictions
      for (let i = 1; i <= periods; i++) {
        const predictedValue = Math.max(0, lastValue + (trend * i));
        const confidence = Math.max(0.5, 0.9 - (i * 0.05)); // Decreasing confidence
        const margin = predictedValue * (1 - confidence);

        forecastData.push({
          timestamp: new Date(endDate.getTime() + (i * periodMs)),
          value: 0, // No actual value yet
          predicted: Math.round(predictedValue),
          upperBound: Math.round(predictedValue + margin),
          lowerBound: Math.round(Math.max(0, predictedValue - margin))
        });
      }

      return forecastData;
    } catch (error) {
      logger.error('Failed to generate time series forecast', { error: (error as Error).message, metric, timeframe });
      throw error;
    }
  }

  /**
   * Analyze seasonal patterns in usage data
   */
  async analyzeSeasonalPatterns(): Promise<SeasonalPattern[]> {
    try {
      const patterns: SeasonalPattern[] = [];

      // Daily pattern (hourly usage)
      const dailyPattern = await this.getDailyPattern();
      patterns.push(dailyPattern);

      // Weekly pattern (day-of-week usage)
      const weeklyPattern = await this.getWeeklyPattern();
      patterns.push(weeklyPattern);

      // Monthly pattern (day-of-month usage)
      const monthlyPattern = await this.getMonthlyPattern();
      patterns.push(monthlyPattern);

      return patterns;
    } catch (error) {
      logger.error('Failed to analyze seasonal patterns', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Generate resource capacity forecasts
   */
  async generateResourceForecasts(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<ResourceForecast[]> {
    try {
      const forecasts: ResourceForecast[] = [];

      // Get current utilization
      const totalEquipment = await prisma.equipment.count();
      const inUseEquipment = await prisma.equipment.count({ where: { status: equipment_status.IN_USE } });
      const currentUtilization = totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;

      // Generate forecasts for different resource types
      const resourceTypes = ['computer', 'gaming', 'study_area', 'books'] as const;

      for (const resourceType of resourceTypes) {
        const utilization = await this.getResourceUtilization(resourceType);
        const predictedUtilization = await this.predictResourceUtilization(resourceType, timeframe);
        const recommendedCapacity = this.calculateRecommendedCapacity(predictedUtilization, timeframe);

        forecasts.push({
          resourceType,
          currentUtilization: utilization,
          predictedUtilization,
          recommendedCapacity,
          riskLevel: this.calculateRiskLevel(predictedUtilization, utilization),
          timeHorizon: timeframe
        });
      }

      return forecasts;
    } catch (error) {
      logger.error('Failed to generate resource forecasts', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Generate automated insights report
   */
  async generateInsightsReport(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    summary: string;
    insights: PredictiveInsight[];
    recommendations: string[];
    keyMetrics: { [key: string]: any };
  }> {
    try {
      const insights = await this.generatePredictiveInsights(timeframe);
      const seasonalPatterns = await this.analyzeSeasonalPatterns();
      const forecasts = await this.generateResourceForecasts(timeframe);

      // Generate summary
      const highImpactInsights = insights.filter(i => i.impact === 'high');
      const summary = `Analytics report for ${timeframe}: Found ${insights.length} insights with ${highImpactInsights.length} high-priority items requiring attention.`;

      // Aggregate recommendations
      const allRecommendations = insights.flatMap(i => i.recommendations);
      const uniqueRecommendations = [...new Set(allRecommendations)];

      // Extract key metrics
      const keyMetrics = {
        totalInsights: insights.length,
        highImpactCount: highImpactInsights.length,
        averageConfidence: insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length,
        seasonalStrength: seasonalPatterns.reduce((sum, p) => sum + p.seasonality, 0) / seasonalPatterns.length,
        resourceRisk: forecasts.filter(f => f.riskLevel === 'high').length
      };

      return {
        summary,
        insights,
        recommendations: uniqueRecommendations,
        keyMetrics
      };
    } catch (error) {
      logger.error('Failed to generate insights report', { error: (error as Error).message });
      throw error;
    }
  }

  // Helper methods
  private getStartDate(timeframe: 'day' | 'week' | 'month', endDate: Date = new Date()): Date {
    switch (timeframe) {
      case 'day':
        return new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      case 'week':
        return new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }
  }

  private getDaysInPeriod(timeframe: 'day' | 'week' | 'month'): number {
    switch (timeframe) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
    }
  }

  private getPeriodMs(timeframe: 'day' | 'week' | 'month'): number {
    switch (timeframe) {
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private async calculateUsageTrend(timeframe: 'day' | 'week' | 'month'): Promise<number> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);
    const previousStartDate = new Date(startDate.getTime() - this.getPeriodMs(timeframe));

    const [currentCount, previousCount] = await Promise.all([
      prisma.student_activities.count({ where: { start_time: { gte: startDate } } }),
      prisma.student_activities.count({ where: { start_time: { gte: previousStartDate, lt: startDate } } })
    ]);

    return previousCount > 0 ? (currentCount - previousCount) / previousCount : 0;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of 0, 1, 2, ..., n-1
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (val * index), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope || 0;
  }

  private generateDemandRecommendations(predicted: number, current: number, timeframe: string): string[] {
    const recommendations: string[] = [];
    const changePercent = ((predicted - current) / current) * 100;

    if (changePercent > 20) {
      recommendations.push('Significant demand increase expected - consider adding resources');
      recommendations.push('Review scheduling policies to manage peak demand');
      recommendations.push('Prepare contingency plans for resource shortages');
    } else if (changePercent > 10) {
      recommendations.push('Moderate demand increase expected - monitor usage closely');
      recommendations.push('Ensure preventive maintenance is up to date');
    } else if (changePercent < -10) {
      recommendations.push('Demand decrease expected - consider marketing initiatives');
      recommendations.push('Review resource allocation for efficiency');
    }

    return recommendations;
  }

  private async getDailyPattern(): Promise<SeasonalPattern> {
    const hourlyData = await prisma.$queryRaw<Array<{ hour: number; count: number }>>`
      SELECT EXTRACT(HOUR FROM startTime) as hour, COUNT(*) as count
      FROM activities
      WHERE startTime >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM startTime)
      ORDER BY hour
    `;

    const pattern = new Array(24).fill(0);
    hourlyData.forEach(d => {
      pattern[Number(d.hour)] = Number(d.count);
    });

    const peakTimes = pattern
      .map((count, hour) => ({ count, hour }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(p => p.hour);

    return {
      period: 'daily',
      pattern,
      peakTimes,
      trend: 'stable',
      seasonality: this.calculateSeasonality(pattern)
    };
  }

  private async getWeeklyPattern(): Promise<SeasonalPattern> {
    const weeklyData = await prisma.$queryRaw<Array<{ dayOfWeek: number; count: number }>>`
      SELECT EXTRACT(DOW FROM startTime) as dayOfWeek, COUNT(*) as count
      FROM activities
      WHERE startTime >= NOW() - INTERVAL '12 weeks'
      GROUP BY EXTRACT(DOW FROM startTime)
      ORDER BY dayOfWeek
    `;

    const pattern = new Array(7).fill(0);
    weeklyData.forEach(d => {
      pattern[Number(d.dayOfWeek)] = Number(d.count);
    });

    const peakTimes = pattern
      .map((count, day) => ({ count, day }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(p => p.day);

    return {
      period: 'weekly',
      pattern,
      peakTimes,
      trend: 'stable',
      seasonality: this.calculateSeasonality(pattern)
    };
  }

  private async getMonthlyPattern(): Promise<SeasonalPattern> {
    const monthlyData = await prisma.$queryRaw<Array<{ day: number; count: number }>>`
      SELECT EXTRACT(DAY FROM startTime) as day, COUNT(*) as count
      FROM activities
      WHERE startTime >= NOW() - INTERVAL '6 months'
      GROUP BY EXTRACT(DAY FROM startTime)
      ORDER BY day
    `;

    const pattern = new Array(31).fill(0);
    monthlyData.forEach(d => {
      pattern[Number(d.day) - 1] = Number(d.count);
    });

    const peakTimes = pattern
      .map((count, day) => ({ count, day }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => p.day + 1);

    return {
      period: 'monthly',
      pattern,
      peakTimes,
      trend: 'stable',
      seasonality: this.calculateSeasonality(pattern)
    };
  }

  private calculateSeasonality(pattern: number[]): number {
    if (pattern.length < 2) return 0;

    const mean = pattern.reduce((sum, val) => sum + val, 0) / pattern.length;
    const variance = pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pattern.length;
    const stdDev = Math.sqrt(variance);

    // Seasonality strength based on coefficient of variation
    return Math.min(1, stdDev / mean);
  }

  private async getResourceUtilization(resourceType: string): Promise<number> {
    const total = await prisma.equipment.count({
      where: { type: { contains: resourceType, mode: 'insensitive' } }
    });
    const inUse = await prisma.equipment.count({
      where: {
        type: { contains: resourceType, mode: 'insensitive' },
        status: equipment_status.IN_USE
      }
    });

    return total > 0 ? (inUse / total) * 100 : 0;
  }

  private async predictResourceUtilization(resourceType: string, timeframe: 'day' | 'week' | 'month'): Promise<number[]> {
    const currentUtilization = await this.getResourceUtilization(resourceType);
    const trend = await this.calculateUsageTrend(timeframe);
    const periods = timeframe === 'day' ? 24 : timeframe === 'week' ? 7 : 30;

    const predictions: number[] = [];
    for (let i = 1; i <= periods; i++) {
      const predicted = Math.max(0, Math.min(100, currentUtilization + (trend * 10 * i)));
      predictions.push(Math.round(predicted));
    }

    return predictions;
  }

  private calculateRecommendedCapacity(predictedUtilization: number[], timeframe: 'day' | 'week' | 'month'): number {
    const maxPredicted = Math.max(...predictedUtilization);
    return Math.min(100, Math.round(maxPredicted * 1.2)); // 20% buffer
  }

  private calculateRiskLevel(predictedUtilization: number[], currentUtilization: number): 'low' | 'medium' | 'high' {
    const maxPredicted = Math.max(...predictedUtilization);

    if (maxPredicted > 90) return 'high';
    if (maxPredicted > 75 || (maxPredicted - currentUtilization) > 20) return 'medium';
    return 'low';
  }

  /**
   * Get TTL for analytics data based on timeframe
   */
  private getAnalyticsTTL(timeframe: 'day' | 'week' | 'month'): number {
    switch (timeframe) {
      case 'day': return 300; // 5 minutes for daily data
      case 'week': return 1800; // 30 minutes for weekly data
      case 'month': return 3600; // 1 hour for monthly data
    }
  }
}

export const analyticsService = new AnalyticsService();