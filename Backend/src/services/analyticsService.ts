import {
  PrismaClient,
  student_activities_activity_type,
  student_activities_status,
  equipment_status,
  students_grade_category,
} from '@prisma/client';
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
  type:
    | 'demand_forecast'
    | 'peak_prediction'
    | 'resource_optimization'
    | 'anomaly_detection';
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
  async generatePredictiveInsights(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<PredictiveInsight[]> {
    return performanceOptimizationService.executeQuery(
      `predictive_insights_${timeframe}`,
      async () => {
        const insights: PredictiveInsight[] = [];

        // Parallel execution of all analysis methods
        const [
          demandForecast,
          peakPrediction,
          resourceOptimization,
          anomalies,
        ] = await Promise.all([
          this.forecastEquipmentDemand(timeframe),
          this.predictPeakUsage(timeframe),
          this.analyzeResourceOptimization(timeframe),
          this.detectUsageAnomalies(),
        ]);

        insights.push(
          demandForecast,
          peakPrediction,
          resourceOptimization,
          ...anomalies,
        );
        return insights.sort((a, b) => b.confidence - a.confidence);
      },
      {
        key: `analytics:insights:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'insights', timeframe],
      },
    );
  }

  /**
   * Forecast equipment demand using time series analysis
   */
  private async forecastEquipmentDemand(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<PredictiveInsight> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);

    // Get historical usage data
    const historicalData = await prisma.student_activities.groupBy({
      by: ['equipment_id', 'activity_type'],
      where: {
        start_time: { gte: startDate },
        activity_type: {
          in: [
            student_activities_activity_type.COMPUTER_USE,
            student_activities_activity_type.GAMING_SESSION,
          ],
        },
      },
      _count: { id: true },
    });

    // Simple moving average prediction with trend analysis
    const totalUsage = historicalData.reduce(
      (sum, item) => sum + (item._count?.id || 0),
      0,
    );
    const avgDailyUsage = totalUsage / this.getDaysInPeriod(timeframe);

    // Calculate trend (simplified linear regression)
    const trend = await this.calculateUsageTrend(timeframe);
    const predictedIncrease = trend * 0.1; // 10% of trend factor

    const predictedDemand = Math.round(avgDailyUsage * (1 + predictedIncrease));
    const confidence = Math.max(
      0.6,
      Math.min(0.95, 0.8 - Math.abs(trend) * 0.1),
    );

    return {
      type: 'demand_forecast',
      title: 'Equipment Demand Forecast',
      description: `Predicted ${timeframe}ly equipment demand: ${predictedDemand} sessions/day (${Math.round(predictedIncrease * 100)}% ${trend > 0 ? 'increase' : 'decrease'} from current)`,
      confidence,
      impact:
        predictedDemand > avgDailyUsage * 1.2
          ? 'high'
          : predictedDemand > avgDailyUsage * 1.1
            ? 'medium'
            : 'low',
      recommendations: this.generateDemandRecommendations(
        predictedDemand,
        avgDailyUsage,
        timeframe,
      ),
      data: {
        id: crypto.randomUUID(),
        updated_at: new Date(),
        current: avgDailyUsage,
        predicted: predictedDemand,
        trend,
      },
      validUntil: new Date(Date.now() + this.getPeriodMs(timeframe)),
    };
  }

  /**
   * Predict peak usage times using historical patterns
   */
  private async predictPeakUsage(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<PredictiveInsight> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);

    // Get hourly usage patterns
    const hourlyData = await prisma.$queryRaw<
      Array<{ hour: number; count: number }>
    >`
      SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= ${startDate}
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY count DESC
      LIMIT 3
    `;

    const peakHours = hourlyData.map(d => d.hour);
    const peakConfidence =
      hourlyData.length > 0
        ? Math.min(0.9, 0.6 + ((hourlyData[0]?.count || 0) / 100) * 0.1)
        : 0.5;

    // Get day-of-week patterns
    const weeklyData = await prisma.$queryRaw<
      Array<{ dayOfWeek: number; count: number }>
    >`
      SELECT EXTRACT(DOW FROM start_time) as dayOfWeek, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= ${startDate}
      GROUP BY EXTRACT(DOW FROM start_time)
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
        'Prepare backup resources for unexpected demand spikes',
      ],
      data: {
        id: crypto.randomUUID(),
        updated_at: new Date(),
        peakHours,
        peakDays,
        hourlyDistribution: hourlyData,
        weeklyDistribution: weeklyData,
      },
      validUntil: new Date(Date.now() + this.getPeriodMs(timeframe)),
    };
  }

  /**
   * Analyze resource utilization and provide optimization recommendations
   */
  private async analyzeResourceOptimization(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<PredictiveInsight> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);

    // Get equipment utilization by type
    const equipmentStats = await prisma.equipment.groupBy({
      by: ['type', 'status'],
      _count: { id: true },
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
      utilizationRates[type] =
        ((utilizationRates[type] || 0) / (totalByType[type] || 1)) * 100;
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
      recommendations.push(
        `Consider repurposing or marketing underutilized resources: ${underutilized.map(u => u.type).join(', ')}`,
      );
    }

    if (overutilized.length > 0) {
      recommendations.push(
        `Add capacity for overutilized resources: ${overutilized.map(o => o.type).join(', ')}`,
      );
    }

    recommendations.push(
      'Implement dynamic scheduling to balance load across all resources',
    );
    recommendations.push(
      'Consider time-sharing arrangements for high-demand equipment',
    );

    return {
      type: 'resource_optimization',
      title: 'Resource Utilization Analysis',
      description: `Current utilization ranges from ${Math.round(Math.min(...Object.values(utilizationRates)))}% to ${Math.round(Math.max(...Object.values(utilizationRates)))}%`,
      confidence: 0.85,
      impact:
        overutilized.length > 0
          ? 'high'
          : underutilized.length > 0
            ? 'medium'
            : 'low',
      recommendations,
      data: {
        id: crypto.randomUUID(),
        updated_at: new Date(),
        utilizationRates,
        underutilized,
        overutilized,
      },
      validUntil: new Date(Date.now() + this.getPeriodMs(timeframe)),
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
    const dailyActivities = await prisma.$queryRaw<
      Array<{ date: Date; count: number }>
    >`
      SELECT DATE(start_time) as date, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= ${startDate}
      GROUP BY DATE(start_time)
      ORDER BY date
    `;

    if (dailyActivities.length < 7) return insights; // Need sufficient data

    // Calculate mean and standard deviation
    const counts = dailyActivities.map(d => Number(d.count));
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const variance =
      counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) /
      counts.length;
    const stdDev = Math.sqrt(variance);

    // Find anomalies (more than 2 standard deviations from mean)
    const anomalies = dailyActivities.filter(
      d => Math.abs(Number(d.count) - mean) > 2 * stdDev,
    );

    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly_detection',
        title: 'Usage Anomaly Detected',
        description: `Unusual activity patterns detected on ${anomalies.length} day(s) in the last month`,
        confidence: 0.75,
        impact:
          anomalies.length > 3
            ? 'high'
            : anomalies.length > 1
              ? 'medium'
              : 'low',
        recommendations: [
          'Investigate unusual activity patterns',
          'Check for data quality issues or system errors',
          'Review if special events caused these patterns',
          'Consider adjusting anomaly detection thresholds if patterns are normal',
        ],
        data: {
          id: crypto.randomUUID(),
          updated_at: new Date(),
          anomalies,
          mean,
          stdDev,
          threshold: 2,
        },
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for one week
      });
    }

    return insights;
  }

  /**
   * Generate usage patterns for heat map visualization (optimized with caching)
   */
  async generateUsageHeatMap(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<HeatMapData[]> {
    return performanceOptimizationService.executeQuery(
      `usage_heatmap_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe, endDate);

        const heatMapData = await prisma.$queryRaw<
          Array<{
            hour: number;
            dayOfWeek: number;
            intensity: number;
            activity_type: student_activities_activity_type;
            grade_level: students_grade_category;
          }>
        >`
          SELECT
            EXTRACT(HOUR FROM start_time) as hour,
            EXTRACT(DOW FROM start_time) as "dayOfWeek",
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
          activityType: d.activity_type,
          gradeLevel: d.grade_level,
        }));
      },
      {
        key: `analytics:heatmap:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'heatmap', timeframe],
      },
    );
  }

  /**
   * Generate time series data with predictions
   */
  async generateTimeSeriesForecast(
    metric: 'student_visits' | 'equipment_usage' | 'book_circulation',
    timeframe: 'day' | 'week' | 'month' = 'week',
    periods: number = 7,
  ): Promise<TimeSeriesData[]> {
    try {
      const endDate = new Date();
      const startDate = this.getStartDate(timeframe, endDate);
      const periodMs = this.getPeriodMs(timeframe);

      // Get historical data
      let historicalData: TimeSeriesData[];

      switch (metric) {
        case 'student_visits':
          const visits = await prisma.$queryRaw<
            Array<{ date: Date; count: number }>
          >`
            SELECT DATE(start_time) as date, COUNT(DISTINCT student_id) as count
            FROM student_activities
            WHERE start_time >= ${startDate}
            GROUP BY DATE(start_time)
            ORDER BY date
          `;
          historicalData = visits.map(v => ({
            timestamp: v.date,
            value: Number(v.count),
          }));
          break;

        case 'equipment_usage':
          const equipment = await prisma.$queryRaw<
            Array<{ date: Date; count: number }>
          >`
            SELECT DATE(start_time) as date, COUNT(*) as count
            FROM student_activities
            WHERE start_time >= ${startDate} AND equipment_id IS NOT NULL
            GROUP BY DATE(start_time)
            ORDER BY date
          `;
          historicalData = equipment.map(e => ({
            timestamp: e.date,
            value: Number(e.count),
          }));
          break;

        case 'book_circulation':
          const books = await prisma.$queryRaw<
            Array<{ date: Date; count: number }>
          >`
            SELECT DATE(start_time) as date, COUNT(*) as count
            FROM student_activities
            WHERE start_time >= ${startDate} AND activity_type IN ('BOOK_CHECKOUT', 'BOOK_RETURN')
            GROUP BY DATE(start_time)
            ORDER BY date
          `;
          historicalData = books.map(b => ({
            timestamp: b.date,
            value: Number(b.count),
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
        const predictedValue = Math.max(0, (lastValue || 0) + trend * i);
        const confidence = Math.max(0.5, 0.9 - i * 0.05); // Decreasing confidence
        const margin = predictedValue * (1 - confidence);

        forecastData.push({
          timestamp: new Date(endDate.getTime() + i * periodMs),
          value: 0, // No actual value yet
          predicted: Math.round(predictedValue),
          upperBound: Math.round(predictedValue + margin),
          lowerBound: Math.round(Math.max(0, predictedValue - margin)),
        });
      }

      return forecastData;
    } catch (error) {
      logger.error('Failed to generate time series forecast', {
        error: (error as Error).message,
        metric,
        timeframe,
      });
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
      logger.error('Failed to analyze seasonal patterns', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate resource capacity forecasts
   */
  async generateResourceForecasts(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<ResourceForecast[]> {
    try {
      const forecasts: ResourceForecast[] = [];

      // Get current utilization
      const totalEquipment = await prisma.equipment.count();
      const inUseEquipment = await prisma.equipment.count({
        where: { status: equipment_status.IN_USE },
      });
      const currentUtilization =
        totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;

      // Generate forecasts for different resource types
      const resourceTypes = [
        'computer',
        'gaming',
        'study_area',
        'books',
      ] as const;

      for (const resourceType of resourceTypes) {
        const utilization = await this.getResourceUtilization(resourceType);
        const predictedUtilization = await this.predictResourceUtilization(
          resourceType,
          timeframe,
        );
        const recommendedCapacity = this.calculateRecommendedCapacity(
          predictedUtilization,
          timeframe,
        );

        forecasts.push({
          resourceType,
          currentUtilization: utilization,
          predictedUtilization,
          recommendedCapacity,
          riskLevel: this.calculateRiskLevel(predictedUtilization, utilization),
          timeHorizon: timeframe,
        });
      }

      return forecasts;
    } catch (error) {
      logger.error('Failed to generate resource forecasts', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate automated insights report
   */
  async generateInsightsReport(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
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
        averageConfidence:
          insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length,
        seasonalStrength:
          seasonalPatterns.reduce((sum, p) => sum + p.seasonality, 0) /
          seasonalPatterns.length,
        resourceRisk: forecasts.filter(f => f.riskLevel === 'high').length,
      };

      return {
        summary,
        insights,
        recommendations: uniqueRecommendations,
        keyMetrics,
      };
    } catch (error) {
      logger.error('Failed to generate insights report', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Helper methods
  private getStartDate(
    timeframe: 'day' | 'week' | 'month',
    endDate: Date = new Date(),
  ): Date {
    switch (timeframe) {
      case 'day':
        return new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
        );
      case 'week':
        return new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }
  }

  private getDaysInPeriod(timeframe: 'day' | 'week' | 'month'): number {
    switch (timeframe) {
      case 'day':
        return 1;
      case 'week':
        return 7;
      case 'month':
        return 30;
    }
  }

  private getPeriodMs(timeframe: 'day' | 'week' | 'month'): number {
    switch (timeframe) {
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private async calculateUsageTrend(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<number> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);
    const previousStartDate = new Date(
      startDate.getTime() - this.getPeriodMs(timeframe),
    );

    const [currentCount, previousCount] = await Promise.all([
      prisma.student_activities.count({
        where: { start_time: { gte: startDate } },
      }),
      prisma.student_activities.count({
        where: { start_time: { gte: previousStartDate, lt: startDate } },
      }),
    ]);

    return previousCount > 0
      ? (currentCount - previousCount) / previousCount
      : 0;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of 0, 1, 2, ..., n-1
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + val * index, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope || 0;
  }

  private generateDemandRecommendations(
    predicted: number,
    current: number,
    timeframe: string,
  ): string[] {
    const recommendations: string[] = [];
    const changePercent = ((predicted - current) / current) * 100;

    if (changePercent > 20) {
      recommendations.push(
        'Significant demand increase expected - consider adding resources',
      );
      recommendations.push('Review scheduling policies to manage peak demand');
      recommendations.push('Prepare contingency plans for resource shortages');
    } else if (changePercent > 10) {
      recommendations.push(
        'Moderate demand increase expected - monitor usage closely',
      );
      recommendations.push('Ensure preventive maintenance is up to date');
    } else if (changePercent < -10) {
      recommendations.push(
        'Demand decrease expected - consider marketing initiatives',
      );
      recommendations.push('Review resource allocation for efficiency');
    }

    return recommendations;
  }

  private async getDailyPattern(): Promise<SeasonalPattern> {
    const hourlyData = await prisma.$queryRaw<
      Array<{ hour: number; count: number }>
    >`
      SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM start_time)
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
      seasonality: this.calculateSeasonality(pattern),
    };
  }

  private async getWeeklyPattern(): Promise<SeasonalPattern> {
    const weeklyData = await prisma.$queryRaw<
      Array<{ dayOfWeek: number; count: number }>
    >`
      SELECT EXTRACT(DOW FROM start_time) as dayOfWeek, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= NOW() - INTERVAL '12 weeks'
      GROUP BY EXTRACT(DOW FROM start_time)
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
      seasonality: this.calculateSeasonality(pattern),
    };
  }

  private async getMonthlyPattern(): Promise<SeasonalPattern> {
    const monthlyData = await prisma.$queryRaw<
      Array<{ day: number; count: number }>
    >`
      SELECT EXTRACT(DAY FROM start_time) as day, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= NOW() - INTERVAL '6 months'
      GROUP BY EXTRACT(DAY FROM start_time)
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
      seasonality: this.calculateSeasonality(pattern),
    };
  }

  private calculateSeasonality(pattern: number[]): number {
    if (pattern.length < 2) return 0;

    const mean = pattern.reduce((sum, val) => sum + val, 0) / pattern.length;
    const variance =
      pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      pattern.length;
    const stdDev = Math.sqrt(variance);

    // Seasonality strength based on coefficient of variation
    return Math.min(1, stdDev / mean);
  }

  private async getResourceUtilization(resourceType: string): Promise<number> {
    const total = await prisma.equipment.count({
      where: { type: resourceType as any },
    });
    const inUse = await prisma.equipment.count({
      where: {
        type: resourceType as any,
        status: equipment_status.IN_USE,
      },
    });

    return total > 0 ? (inUse / total) * 100 : 0;
  }

  private async predictResourceUtilization(
    resourceType: string,
    timeframe: 'day' | 'week' | 'month',
  ): Promise<number[]> {
    const currentUtilization = await this.getResourceUtilization(resourceType);
    const trend = await this.calculateUsageTrend(timeframe);
    const periods = timeframe === 'day' ? 24 : timeframe === 'week' ? 7 : 30;

    const predictions: number[] = [];
    for (let i = 1; i <= periods; i++) {
      const predicted = Math.max(
        0,
        Math.min(100, currentUtilization + trend * 10 * i),
      );
      predictions.push(Math.round(predicted));
    }

    return predictions;
  }

  private calculateRecommendedCapacity(
    predictedUtilization: number[],
    timeframe: 'day' | 'week' | 'month',
  ): number {
    const maxPredicted = Math.max(...predictedUtilization);
    return Math.min(100, Math.round(maxPredicted * 1.2)); // 20% buffer
  }

  private calculateRiskLevel(
    predictedUtilization: number[],
    currentUtilization: number,
  ): 'low' | 'medium' | 'high' {
    const maxPredicted = Math.max(...predictedUtilization);

    if (maxPredicted > 90) return 'high';
    if (maxPredicted > 75 || maxPredicted - currentUtilization > 20)
      return 'medium';
    return 'low';
  }

  /**
   * Get comprehensive library metrics
   */
  async getComprehensiveLibraryMetrics(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    overview: any;
    circulation: any;
    equipment: any;
    fines: any;
    trends: any;
  }> {
    return performanceOptimizationService.executeQuery(
      `comprehensive_metrics_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe, endDate);

        // Get overview metrics
        const [
          totalStudents,
          activeStudents,
          totalBooks,
          availableBooks,
          totalEquipment,
          availableEquipment,
          totalActivities,
        ] = await Promise.all([
          prisma.students.count(),
          prisma.students.count({ where: { is_active: true } }),
          prisma.books.count(),
          prisma.books.count({ where: { is_active: true } }),
          prisma.equipment.count(),
          prisma.equipment.count({
            where: { status: equipment_status.AVAILABLE },
          }),
          prisma.student_activities.count({
            where: { start_time: { gte: startDate } },
          }),
        ]);

        // Get circulation metrics
        const [borrowedBooks, returnedBooks, overdueBooks] = await Promise.all([
          prisma.student_activities.count({
            where: {
              start_time: { gte: startDate },
              activity_type: student_activities_activity_type.BOOK_CHECKOUT,
            },
          }),
          prisma.student_activities.count({
            where: {
              start_time: { gte: startDate },
              activity_type: student_activities_activity_type.BOOK_RETURN,
            },
          }),
          prisma.student_activities.count({
            where: {
              activity_type: student_activities_activity_type.BOOK_CHECKOUT,
              end_time: { lt: new Date() },
              // Add logic to calculate overdue books
            },
          }),
        ]);

        // Get equipment utilization
        const equipmentSessions = await prisma.student_activities.groupBy({
          by: ['equipment_id'],
          where: {
            start_time: { gte: startDate },
            equipment_id: { not: null },
          },
          _count: { id: true },
          _avg: { duration_minutes: true },
        });

        // Get fine collection data (mock for now - implement based on your fine system)
        const fineData = await this.getFineCollectionAnalytics(timeframe);

        return {
          overview: {
            totalStudents,
            activeStudents,
            totalBooks,
            availableBooks,
            totalEquipment,
            availableEquipment,
            totalActivities,
            studentActivationRate:
              totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0,
            bookAvailabilityRate:
              totalBooks > 0 ? (availableBooks / totalBooks) * 100 : 0,
            equipmentAvailabilityRate:
              totalEquipment > 0
                ? (availableEquipment / totalEquipment) * 100
                : 0,
          },
          circulation: {
            borrowedBooks,
            returnedBooks,
            overdueBooks,
            circulationRate:
              totalBooks > 0 ? (borrowedBooks / totalBooks) * 100 : 0,
            returnRate:
              borrowedBooks > 0 ? (returnedBooks / borrowedBooks) * 100 : 0,
            overdueRate:
              borrowedBooks > 0 ? (overdueBooks / borrowedBooks) * 100 : 0,
          },
          equipment: {
            totalSessions: equipmentSessions.reduce(
              (sum, session) => sum + (session._count?.id || 0),
              0,
            ),
            averageSessionDuration:
              equipmentSessions.reduce(
                (sum, session) => sum + (session._avg?.duration_minutes || 0),
                0,
              ) / equipmentSessions.length,
            mostUsedEquipment: equipmentSessions
              .sort((a, b) => (b._count?.id || 0) - (a._count?.id || 0))
              .slice(0, 5),
          },
          fines: fineData,
          trends: {
            dailyGrowth: await this.calculateDailyGrowth(timeframe),
            peakUsageHours: await this.getPeakUsageHours(timeframe),
            popularCategories: await this.getPopularCategories(timeframe),
          },
        };
      },
      {
        key: `analytics:comprehensive:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'comprehensive', timeframe],
      },
    );
  }

  /**
   * Get book circulation analytics
   */
  async getBookCirculationAnalytics(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    totalCirculation: number;
    mostBorrowedBooks: any[];
    circulationByCategory: any[];
    overdueAnalysis: any;
    trends: any;
  }> {
    return performanceOptimizationService.executeQuery(
      `book_circulation_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe, endDate);

        // Get circulation by book
        const circulationByBook = await prisma.student_activities.groupBy({
          by: ['checkout_id'],
          where: {
            start_time: { gte: startDate },
            activity_type: {
              in: [
                student_activities_activity_type.BOOK_CHECKOUT,
                student_activities_activity_type.BOOK_RETURN,
              ],
            },
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        });

        // Get most borrowed books with details
        const mostBorrowedBooks = await prisma.books.findMany({
          where: {
            id: {
              in: circulationByBook
                .map(item => item.checkout_id)
                .filter(Boolean) as string[],
            },
          },
          select: {
            id: true,
            title: true,
            author: true,
            category: true,
            available_copies: true,
            total_copies: true,
          },
        });

        // Add circulation counts
        const booksWithCirculation = mostBorrowedBooks.map((book: any) => {
          const circulation = circulationByBook.find(
            c => c.checkout_id === book.id,
          );
          return {
            ...book,
            circulationCount: circulation?._count?.id || 0,
            popularity: this.calculatePopularityScore(
              circulation?._count?.id || 0,
              book.total_copies,
            ),
          };
        });

        // Get circulation by category
        const circulationByCategory = await prisma.$queryRaw<
          Array<{ category: string; count: number }>
        >`
          SELECT b.category, COUNT(*) as count
          FROM student_activities sa
          JOIN books b ON sa.checkout_id = b.id
          WHERE sa.start_time >= ${startDate}
          AND sa.activity_type IN ('BOOK_CHECKOUT', 'BOOK_RETURN')
          GROUP BY b.category
          ORDER BY count DESC
        `;

        // Analyze overdue books
        const overdueAnalysis = await this.analyzeOverdueBooks(timeframe);

        // Calculate trends
        const trends = await this.calculateCirculationTrends(timeframe);

        return {
          totalCirculation: circulationByBook.reduce(
            (sum, item) => sum + (item._count?.id || 0),
            0,
          ),
          mostBorrowedBooks: booksWithCirculation.sort(
            (a: any, b: any) => b.circulationCount - a.circulationCount,
          ),
          circulationByCategory: circulationByCategory.map(item => ({
            category: item.category,
            count: Number(item.count),
            percentage: 0, // Will be calculated
          })),
          overdueAnalysis,
          trends,
        };
      },
      {
        key: `analytics:books:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'books', timeframe],
      },
    );
  }

  /**
   * Get equipment utilization analytics
   */
  async getEquipmentUtilizationAnalytics(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    overallUtilization: number;
    utilizationByType: any[];
    peakUsageTimes: any[];
    maintenanceInsights: any;
    recommendations: string[];
  }> {
    return performanceOptimizationService.executeQuery(
      `equipment_utilization_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe, endDate);

        // Get utilization by equipment type
        const utilizationByType = await prisma.$queryRaw<
          Array<{
            type: string;
            total: number;
            inUse: number;
            utilizationRate: number;
          }>
        >`
          SELECT
            e.type,
            COUNT(*) as total,
            SUM(CASE WHEN e.status = 'IN_USE' THEN 1 ELSE 0 END) as inUse,
            (SUM(CASE WHEN e.status = 'IN_USE' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as utilizationRate
          FROM equipment e
          GROUP BY e.type
          ORDER BY utilizationRate DESC
        `;

        // Get hourly usage patterns
        const hourlyUsage = await prisma.$queryRaw<
          Array<{ hour: number; sessions: number }>
        >`
          SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as sessions
          FROM student_activities
          WHERE start_time >= ${startDate}
          AND equipment_id IS NOT NULL
          GROUP BY EXTRACT(HOUR FROM start_time)
          ORDER BY sessions DESC
        `;

        // Calculate overall utilization
        const totalEquipment = await prisma.equipment.count();
        const inUseEquipment = await prisma.equipment.count({
          where: { status: equipment_status.IN_USE },
        });
        const overallUtilization =
          totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;

        // Generate maintenance insights
        const maintenanceInsights =
          await this.generateMaintenanceInsights(timeframe);

        // Generate recommendations
        const recommendations = this.generateEquipmentRecommendations(
          utilizationByType.map(t => ({
            ...t,
            utilizationRate: Number(t.utilizationRate),
          })),
          overallUtilization,
        );

        return {
          overallUtilization,
          utilizationByType: utilizationByType.map(t => ({
            ...t,
            utilizationRate: Number(t.utilizationRate),
          })),
          peakUsageTimes: hourlyUsage.slice(0, 5).map(h => ({
            hour: Number(h.hour),
            sessions: Number(h.sessions),
            timeRange: `${Number(h.hour)}:00 - ${Number(h.hour) + 1}:00`,
          })),
          maintenanceInsights,
          recommendations,
        };
      },
      {
        key: `analytics:equipment:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'equipment', timeframe],
      },
    );
  }

  /**
   * Get fine collection analytics
   */
  async getFineCollectionAnalytics(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    totalFines: number;
    collectedFines: number;
    outstandingFines: number;
    collectionRate: number;
    paymentTrends: any[];
    fineCategories: any[];
    overdueAnalysis: any;
  }> {
    return performanceOptimizationService.executeQuery(
      `fine_collection_${timeframe}`,
      async () => {
        const endDate = new Date();
        const startDate = this.getStartDate(timeframe, endDate);

        // Mock fine data - replace with actual fine system queries
        const totalFines = 1250.0;
        const collectedFines = 850.0;
        const outstandingFines = totalFines - collectedFines;
        const collectionRate =
          totalFines > 0 ? (collectedFines / totalFines) * 100 : 0;

        // Payment trends (mock data - replace with actual payment records)
        const paymentTrends = [
          { period: 'Week 1', amount: 250.0, transactions: 15 },
          { period: 'Week 2', amount: 320.0, transactions: 18 },
          { period: 'Week 3', amount: 180.0, transactions: 12 },
          { period: 'Week 4', amount: 100.0, transactions: 8 },
        ];

        // Fine categories (mock data)
        const fineCategories = [
          { category: 'Overdue Books', amount: 450.0, count: 25 },
          { category: 'Lost Books', amount: 320.0, count: 8 },
          { category: 'Damaged Books', amount: 280.0, count: 12 },
          { category: 'Late Equipment', amount: 200.0, count: 15 },
        ];

        // Overdue analysis
        const overdueAnalysis = await this.analyzeOverduePatterns(timeframe);

        return {
          totalFines,
          collectedFines,
          outstandingFines,
          collectionRate,
          paymentTrends,
          fineCategories,
          overdueAnalysis,
        };
      },
      {
        key: `analytics:fines:${timeframe}`,
        ttl: this.getAnalyticsTTL(timeframe),
        tags: ['analytics', 'fines', timeframe],
      },
    );
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalyticsData(
    format: 'csv' | 'json' | 'pdf',
    timeframe: 'day' | 'week' | 'month',
    sections?: string[],
  ): Promise<any> {
    try {
      // Get comprehensive data
      const metrics = await this.getComprehensiveLibraryMetrics(timeframe);
      const bookCirculation = await this.getBookCirculationAnalytics(timeframe);
      const equipmentUtilization =
        await this.getEquipmentUtilizationAnalytics(timeframe);
      const fineCollection = await this.getFineCollectionAnalytics(timeframe);

      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          timeframe,
          sections: sections || ['all'],
          format,
        },
        metrics,
        bookCirculation,
        equipmentUtilization,
        fineCollection,
      };

      if (format === 'json') {
        return exportData;
      } else if (format === 'csv') {
        return this.convertToCSV(exportData, sections);
      } else if (format === 'pdf') {
        return this.convertToPDF(exportData, sections);
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      logger.error('Failed to export analytics data', {
        error: (error as Error).message,
        format,
        timeframe,
      });
      throw error;
    }
  }

  // Helper methods for new analytics functions
  private calculatePopularityScore(
    circulationCount: number,
    totalCopies: number,
  ): number {
    if (totalCopies === 0) return 0;
    const turnoverRate = circulationCount / totalCopies;
    return Math.min(100, turnoverRate * 10); // Scale to 0-100
  }

  private async analyzeOverdueBooks(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<any> {
    // Mock implementation - replace with actual overdue analysis
    return {
      totalOverdue: 15,
      averageOverdueDays: 4.5,
      overdueByCategory: [
        { category: 'Fiction', count: 8, averageDays: 5.2 },
        { category: 'Non-Fiction', count: 4, averageDays: 3.8 },
        { category: 'Reference', count: 3, averageDays: 2.1 },
      ],
    };
  }

  private async calculateCirculationTrends(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<any> {
    // Mock implementation - replace with actual trend calculation
    return {
      growthRate: 12.5,
      forecastNextPeriod: 135,
      trendDirection: 'increasing',
      seasonalityFactor: 1.1,
    };
  }

  private async calculateDailyGrowth(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<number> {
    // Calculate daily growth rate based on historical data
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe, endDate);
    const previousStartDate = new Date(
      startDate.getTime() - this.getPeriodMs(timeframe),
    );

    const [currentCount, previousCount] = await Promise.all([
      prisma.student_activities.count({
        where: { start_time: { gte: startDate } },
      }),
      prisma.student_activities.count({
        where: { start_time: { gte: previousStartDate, lt: startDate } },
      }),
    ]);

    const days = this.getDaysInPeriod(timeframe);
    return previousCount > 0
      ? ((currentCount - previousCount) / previousCount / days) * 100
      : 0;
  }

  private async getPeakUsageHours(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<any[]> {
    const peakHours = await prisma.$queryRaw<
      Array<{ hour: number; count: number }>
    >`
      SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
      FROM student_activities
      WHERE start_time >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY count DESC
      LIMIT 5
    `;

    return peakHours.map(h => ({
      hour: Number(h.hour),
      count: Number(h.count),
      timeRange: `${Number(h.hour)}:00 - ${Number(h.hour) + 1}:00`,
    }));
  }

  private async getPopularCategories(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<any[]> {
    // Mock implementation - return popular activity categories
    return [
      { category: 'Computer Use', count: 245, percentage: 35.2 },
      { category: 'Book Borrowing', count: 180, percentage: 25.9 },
      { category: 'Gaming', count: 125, percentage: 18.0 },
      { category: 'Study Sessions', count: 95, percentage: 13.7 },
      { category: 'VR Sessions', count: 50, percentage: 7.2 },
    ];
  }

  private async generateMaintenanceInsights(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<any> {
    return {
      equipmentNeedingMaintenance: 3,
      averageUptime: 98.5,
      maintenanceSchedule: [
        {
          equipmentId: 'EQ001',
          nextMaintenance: '2025-01-20',
          type: 'Preventive',
        },
        {
          equipmentId: 'EQ015',
          nextMaintenance: '2025-01-22',
          type: 'Corrective',
        },
      ],
    };
  }

  private generateEquipmentRecommendations(
    utilizationByType: any[],
    overallUtilization: number,
  ): string[] {
    const recommendations: string[] = [];

    if (overallUtilization > 85) {
      recommendations.push('Consider adding more equipment to meet demand');
    }

    const underutilized = utilizationByType.filter(t => t.utilizationRate < 30);
    if (underutilized.length > 0) {
      recommendations.push(
        `Review utilization of underused equipment: ${underutilized.map(u => u.type).join(', ')}`,
      );
    }

    const overutilized = utilizationByType.filter(t => t.utilizationRate > 80);
    if (overutilized.length > 0) {
      recommendations.push(
        `High demand for: ${overutilized.map(o => o.type).join(', ')} - consider capacity expansion`,
      );
    }

    recommendations.push('Schedule regular maintenance during off-peak hours');
    recommendations.push(
      'Monitor equipment usage patterns for optimal scheduling',
    );

    return recommendations;
  }

  private async analyzeOverduePatterns(
    timeframe: 'day' | 'week' | 'month',
  ): Promise<any> {
    return {
      patterns: [
        { type: 'Fiction Books', overdueRate: 15.2, averageDelay: 4.5 },
        { type: 'Non-Fiction Books', overdueRate: 8.7, averageDelay: 2.8 },
        { type: 'Reference Materials', overdueRate: 3.1, averageDelay: 1.2 },
      ],
      recommendations: [
        'Send automated reminders 2 days before due date',
        'Implement grace period for first-time overdue',
        'Consider different loan periods by material type',
      ],
    };
  }

  private convertToCSV(data: any, sections?: string[]): string {
    // Basic CSV conversion - enhance as needed
    const headers = ['Metric', 'Value', 'Category', 'Timeframe'];
    const rows = [
      [
        'Total Students',
        data.metrics.overview.totalStudents,
        'Overview',
        'Current',
      ],
      ['Total Books', data.metrics.overview.totalBooks, 'Overview', 'Current'],
      [
        'Total Equipment',
        data.metrics.overview.totalEquipment,
        'Overview',
        'Current',
      ],
      [
        'Book Circulation Rate',
        `${data.metrics.circulation.circulationRate.toFixed(1)}%`,
        'Circulation',
        'Current',
      ],
      [
        'Equipment Utilization',
        `${data.metrics.equipment.overallUtilization.toFixed(1)}%`,
        'Equipment',
        'Current',
      ],
      [
        'Fine Collection Rate',
        `${data.fines.collectionRate.toFixed(1)}%`,
        'Fines',
        'Current',
      ],
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToPDF(data: any, sections?: string[]): Buffer {
    // Mock PDF generation - implement with a library like jsPDF or puppeteer
    const pdfContent =
      `Analytics Report - ${data.metadata.timeframe}\n\n` +
      `Generated: ${data.metadata.exportDate}\n\n` +
      `Overview:\n` +
      `- Total Students: ${data.metrics.overview.totalStudents}\n` +
      `- Total Books: ${data.metrics.overview.totalBooks}\n` +
      `- Total Equipment: ${data.metrics.overview.totalEquipment}\n\n` +
      `Circulation:\n` +
      `- Circulation Rate: ${data.metrics.circulation.circulationRate.toFixed(1)}%\n` +
      `- Return Rate: ${data.metrics.circulation.returnRate.toFixed(1)}%\n\n` +
      `Equipment:\n` +
      `- Overall Utilization: ${data.metrics.equipment.overallUtilization.toFixed(1)}%\n\n` +
      `Fines:\n` +
      `- Collection Rate: ${data.fines.collectionRate.toFixed(1)}%\n` +
      `- Total Collected: $${data.fines.collectedFines.toFixed(2)}`;

    return Buffer.from(pdfContent);
  }

  /**
   * Get TTL for analytics data based on timeframe
   */
  private getAnalyticsTTL(timeframe: 'day' | 'week' | 'month'): number {
    switch (timeframe) {
      case 'day':
        return 300; // 5 minutes for daily data
      case 'week':
        return 1800; // 30 minutes for weekly data
      case 'month':
        return 3600; // 1 hour for monthly data
    }
  }
}

export const analyticsService = new AnalyticsService();
