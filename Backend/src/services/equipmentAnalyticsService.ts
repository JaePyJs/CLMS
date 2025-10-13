import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import {
  EquipmentStatus,
  EquipmentType,
  EquipmentConditionRating,
  EquipmentMaintenanceType,
  EquipmentMaintenanceStatus,
  StudentActivitiesStatus,
  ActivityType,
  Prisma,
} from '@prisma/client';

// Analytics interfaces
export interface EquipmentUsageAnalytics {
  totalEquipment: number;
  activeEquipment: number;
  utilizationRate: number;
  averageSessionLength: number;
  totalUsageHours: number;
  peakUsageHours: Array<{
    hour: number;
    usage: number;
    sessions: number;
  }>;
  utilizationByType: Array<{
    type: EquipmentType;
    count: number;
    utilizationRate: number;
    totalHours: number;
    averageSessionLength: number;
  }>;
  utilizationByLocation: Array<{
    location: string;
    count: number;
    utilizationRate: number;
    totalHours: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      utilization: number;
      sessions: number;
      hours: number;
    }>;
    weekly: Array<{
      week: string;
      utilization: number;
      sessions: number;
      hours: number;
    }>;
    monthly: Array<{
      month: string;
      utilization: number;
      sessions: number;
      hours: number;
    }>;
  };
}

export interface EquipmentPerformanceMetrics {
  overallHealth: number;
  maintenanceCompliance: number;
  downtimeRate: number;
  reliabilityScore: number;
  costPerHour: number;
  roi: number;
  equipmentByCondition: Array<{
    condition: EquipmentConditionRating;
    count: number;
    percentage: number;
  }>;
  maintenanceMetrics: {
    scheduled: number;
    completed: number;
    overdue: number;
    complianceRate: number;
    averageDuration: number;
    totalCost: number;
  };
  topPerformers: Array<{
    equipmentId: string;
    name: string;
    type: EquipmentType;
    utilization: number;
    reliability: number;
    userSatisfaction: number;
  }>;
  underperformers: Array<{
    equipmentId: string;
    name: string;
    type: EquipmentType;
    issues: Array<{
      type: string;
      count: number;
      description: string;
    }>;
    recommendations: string[];
  }>;
}

export interface StudentEquipmentAnalytics {
  totalStudents: number;
  activeUsers: number;
  averageSessionsPerStudent: number;
  averageUsagePerStudent: number;
  topUsers: Array<{
    studentId: string;
    studentName: string;
    gradeLevel: string;
    sessions: number;
    totalHours: number;
    favoriteType: EquipmentType;
  }>;
  usageByGrade: Array<{
    grade: string;
    students: number;
    sessions: number;
    hours: number;
    averageSessionLength: number;
  }>;
  usagePatterns: {
    peakDays: Array<{
      day: string;
      usage: number;
      sessions: number;
    }>;
    timePreferences: Array<{
      hour: number;
      usage: number;
      studentTypes: string[];
    }>;
    equipmentPreferences: Array<{
      type: EquipmentType;
      usage: number;
      percentage: number;
    }>;
  };
}

export interface EquipmentCostAnalytics {
  totalValue: number;
  depreciation: number;
  currentValue: number;
  maintenanceCosts: {
    total: number;
    monthly: number;
    yearly: number;
    byType: Array<{
      type: EquipmentMaintenanceType;
      cost: number;
      count: number;
    }>;
  };
  operationalCosts: {
    electricity: number;
    supplies: number;
    staff: number;
    other: number;
  };
  costPerUsage: {
    overall: number;
    byType: Array<{
      type: EquipmentType;
      costPerHour: number;
      totalHours: number;
    }>;
  };
  roiAnalysis: {
    totalInvestment: number;
    totalValue: number;
    roi: number;
    paybackPeriod: number;
    breakEvenPoint: Date | null;
  };
}

export class EquipmentAnalyticsService {
  // Usage analytics
  async getUsageAnalytics(
    startDate?: Date,
    endDate?: Date,
    equipmentId?: string,
    type?: EquipmentType
  ): Promise<EquipmentUsageAnalytics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);
      const equipmentFilter = this.buildEquipmentFilter(equipmentId, type);

      // Get basic equipment stats
      const [totalEquipment, activeEquipment] = await Promise.all([
        prisma.equipment.count({ where: { ...equipmentFilter, is_active: true } }),
        prisma.equipment.count({ where: { ...equipmentFilter, is_active: true, status: EquipmentStatus.AVAILABLE } }),
      ]);

      // Get usage data
      const usageData = await prisma.student_activities.findMany({
        where: {
          ...dateFilter,
          equipment_id: { not: null },
          ...(equipmentId && { equipment_id: equipmentId }),
          ...(type && {
            equipment: {
              type,
            },
          }),
        },
        include: {
          equipment: {
            select: { type: true, location: true },
          },
        },
      });

      // Calculate metrics
      const totalSessions = usageData.length;
      const totalMinutes = usageData.reduce((sum, activity) => sum + (activity.duration_minutes || 0), 0);
      const totalUsageHours = totalMinutes / 60;
      const averageSessionLength = totalSessions > 0 ? totalMinutes / totalSessions : 0;

      // Calculate utilization rate
      const possibleHours = this.calculatePossibleHours(startDate, endDate, totalEquipment);
      const utilizationRate = possibleHours > 0 ? (totalUsageHours / possibleHours) * 100 : 0;

      // Peak usage hours
      const peakUsageHours = this.calculatePeakUsageHours(usageData);

      // Utilization by type
      const utilizationByType = await this.calculateUtilizationByType(usageData, dateFilter);

      // Utilization by location
      const utilizationByLocation = await this.calculateUtilizationByLocation(usageData, dateFilter);

      // Trends
      const trends = await this.calculateUsageTrends(dateFilter, equipmentFilter);

      return {
        totalEquipment,
        activeEquipment,
        utilizationRate,
        averageSessionLength,
        totalUsageHours,
        peakUsageHours,
        utilizationByType,
        utilizationByLocation,
        trends,
      };
    } catch (error) {
      logger.error('Error generating usage analytics', {
        error: (error as Error).message,
        startDate,
        endDate,
        equipmentId,
        type,
      });
      throw error;
    }
  }

  // Performance metrics
  async getPerformanceMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<EquipmentPerformanceMetrics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);

      // Get equipment condition data
      const equipmentByCondition = await prisma.equipment.groupBy({
        by: ['condition_rating'],
        where: { is_active: true },
        _count: { id: true },
      });

      const totalEquipment = equipmentByCondition.reduce((sum, item) => sum + item._count.id, 0);
      const conditionData = equipmentByCondition.map(item => ({
        condition: item.condition_rating,
        count: item._count.id,
        percentage: totalEquipment > 0 ? (item._count.id / totalEquipment) * 100 : 0,
      }));

      // Calculate overall health score
      const healthScore = this.calculateHealthScore(conditionData);

      // Get maintenance metrics
      const maintenanceData = await this.getMaintenanceMetrics(dateFilter);

      // Get reliability data
      const reliabilityData = await this.calculateReliabilityMetrics(dateFilter);

      // Get cost metrics
      const costData = await this.calculateCostMetrics(dateFilter);

      // Get top performers
      const topPerformers = await this.identifyTopPerformers(dateFilter);

      // Get underperformers
      const underperformers = await this.identifyUnderperformers(dateFilter);

      return {
        overallHealth: healthScore,
        maintenanceCompliance: maintenanceData.complianceRate,
        downtimeRate: reliabilityData.downtimeRate,
        reliabilityScore: reliabilityData.reliabilityScore,
        costPerHour: costData.costPerHour,
        roi: costData.roi,
        equipmentByCondition: conditionData,
        maintenanceMetrics: maintenanceData,
        topPerformers,
        underperformers,
      };
    } catch (error) {
      logger.error('Error generating performance metrics', {
        error: (error as Error).message,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // Student analytics
  async getStudentAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<StudentEquipmentAnalytics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);

      // Get student usage data
      const studentUsageData = await prisma.student_activities.findMany({
        where: {
          ...dateFilter,
          equipment_id: { not: null },
        },
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              grade_category: true,
            },
          },
          equipment: {
            select: { type: true },
          },
        },
      });

      // Calculate basic metrics
      const uniqueStudents = new Set(studentUsageData.map(a => a.student_id));
      const totalStudents = uniqueStudents.size;
      const totalSessions = studentUsageData.length;
      const totalMinutes = studentUsageData.reduce((sum, activity) => sum + (activity.duration_minutes || 0), 0);
      const totalHours = totalMinutes / 60;

      // Group by student
      const studentStats = this.groupUsageByStudent(studentUsageData);

      // Calculate metrics
      const averageSessionsPerStudent = totalStudents > 0 ? totalSessions / totalStudents : 0;
      const averageUsagePerStudent = totalStudents > 0 ? totalHours / totalStudents : 0;

      // Top users
      const topUsers = Object.values(studentStats)
        .sort((a, b) => b.totalHours - a.totalHours)
        .slice(0, 10)
        .map(stat => ({
          studentId: stat.studentId,
          studentName: stat.studentName,
          gradeLevel: stat.gradeLevel,
          sessions: stat.sessions,
          totalHours: stat.totalHours,
          favoriteType: stat.favoriteType,
        }));

      // Usage by grade
      const usageByGrade = this.calculateUsageByGrade(studentUsageData);

      // Usage patterns
      const usagePatterns = await this.analyzeUsagePatterns(studentUsageData, dateFilter);

      return {
        totalStudents,
        activeUsers: totalStudents,
        averageSessionsPerStudent,
        averageUsagePerStudent,
        topUsers,
        usageByGrade,
        usagePatterns,
      };
    } catch (error) {
      logger.error('Error generating student analytics', {
        error: (error as Error).message,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // Cost analytics
  async getCostAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<EquipmentCostAnalytics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);

      // Get equipment value
      const equipmentValue = await prisma.equipment.aggregate({
        where: { is_active: true },
        _sum: { purchase_cost: true },
        _count: { id: true },
      });

      const totalValue = equipmentValue._sum.purchase_cost || 0;
      const totalEquipmentCount = equipmentValue._count.id;

      // Calculate depreciation (simplified straight-line depreciation over 5 years)
      const depreciationRate = 0.2; // 20% per year
      const yearsElapsed = 1; // This should be calculated based on purchase dates
      const depreciation = totalValue * depreciationRate * yearsElapsed;
      const currentValue = totalValue - depreciation;

      // Get maintenance costs
      const maintenanceCosts = await this.getMaintenanceCosts(dateFilter);

      // Get operational costs
      const operationalCosts = await this.getOperationalCosts(dateFilter);

      // Calculate cost per usage
      const usageData = await prisma.student_activities.findMany({
        where: {
          ...dateFilter,
          equipment_id: { not: null },
        },
        include: {
          equipment: { select: { type: true } },
        },
      });

      const totalUsageHours = usageData.reduce((sum, activity) => sum + (activity.duration_minutes || 0) / 60, 0);
      const totalCosts = maintenanceCosts.total + operationalCosts.electricity + operationalCosts.supplies + operationalCosts.staff + operationalCosts.other;
      const costPerHour = totalUsageHours > 0 ? totalCosts / totalUsageHours : 0;

      // Cost per usage by type
      const costPerUsageByType = await this.calculateCostPerUsageByType(usageData, maintenanceCosts, operationalCosts);

      // ROI analysis
      const roiAnalysis = await this.calculateROI(totalValue, totalCosts, totalUsageHours);

      return {
        totalValue,
        depreciation,
        currentValue,
        maintenanceCosts,
        operationalCosts,
        costPerUsage: {
          overall: costPerHour,
          byType: costPerUsageByType,
        },
        roiAnalysis,
      };
    } catch (error) {
      logger.error('Error generating cost analytics', {
        error: (error as Error).message,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // Generate comprehensive report
  async generateComprehensiveReport(
    startDate?: Date,
    endDate?: Date,
    equipmentId?: string,
    type?: EquipmentType
  ) {
    try {
      const [usageAnalytics, performanceMetrics, studentAnalytics, costAnalytics] = await Promise.all([
        this.getUsageAnalytics(startDate, endDate, equipmentId, type),
        this.getPerformanceMetrics(startDate, endDate),
        this.getStudentAnalytics(startDate, endDate),
        this.getCostAnalytics(startDate, endDate),
      ]);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        usageAnalytics,
        performanceMetrics,
        studentAnalytics,
        costAnalytics
      );

      // Create report record
      const report = await prisma.equipment_reports.create({
        data: {
          equipment_id: equipmentId,
          report_type: 'MONTHLY',
          report_period: this.getReportPeriod(startDate, endDate),
          title: 'Equipment Analytics Report',
          content: {
            usageAnalytics,
            performanceMetrics,
            studentAnalytics,
            costAnalytics,
            recommendations,
            generatedAt: new Date().toISOString(),
          },
          metrics: {
            totalEquipment: usageAnalytics.totalEquipment,
            utilizationRate: usageAnalytics.utilizationRate,
            overallHealth: performanceMetrics.overallHealth,
            maintenanceCompliance: performanceMetrics.maintenanceCompliance,
            totalCost: costAnalytics.maintenanceCosts.total + costAnalytics.operationalCosts.electricity + costAnalytics.operationalCosts.supplies + costAnalytics.operationalCosts.staff + costAnalytics.operationalCosts.other,
            roi: costAnalytics.roiAnalysis.roi,
          },
          generated_by: 'System',
          is_public: false,
          summary: this.generateReportSummary(usageAnalytics, performanceMetrics, costAnalytics),
        },
      });

      logger.info('Comprehensive equipment report generated', {
        reportId: report.id,
        period: report.report_period,
        equipmentId,
        type,
      });

      return {
        report,
        usageAnalytics,
        performanceMetrics,
        studentAnalytics,
        costAnalytics,
        recommendations,
      };
    } catch (error) {
      logger.error('Error generating comprehensive report', {
        error: (error as Error).message,
        startDate,
        endDate,
        equipmentId,
        type,
      });
      throw error;
    }
  }

  // Helper methods
  private buildDateFilter(startDate?: Date, endDate?: Date): Prisma.DateTimeFilter {
    const filter: Prisma.DateTimeFilter = {};
    if (startDate) filter.gte = startDate;
    if (endDate) filter.lte = endDate;
    return filter;
  }

  private buildEquipmentFilter(equipmentId?: string, type?: EquipmentType): Prisma.EquipmentWhereInput {
    const filter: Prisma.EquipmentWhereInput = {};
    if (equipmentId) filter.id = equipmentId;
    if (type) filter.type = type;
    return filter;
  }

  private calculatePossibleHours(startDate?: Date, endDate?: Date, totalEquipment?: number): number {
    if (!startDate || !endDate || !totalEquipment) return 0;

    const hoursDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff * totalEquipment * 0.75; // Assume 75% availability
  }

  private calculatePeakUsageHours(usageData: any[]): Array<{ hour: number; usage: number; sessions: number }> {
    const hourlyUsage: { [hour: number]: { usage: number; sessions: number } } = {};

    usageData.forEach(activity => {
      if (activity.start_time) {
        const hour = new Date(activity.start_time).getHours();
        if (!hourlyUsage[hour]) {
          hourlyUsage[hour] = { usage: 0, sessions: 0 };
        }
        hourlyUsage[hour].usage += activity.duration_minutes || 0;
        hourlyUsage[hour].sessions += 1;
      }
    });

    return Object.entries(hourlyUsage)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        usage: data.usage,
        sessions: data.sessions,
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 8); // Top 8 peak hours
  }

  private async calculateUtilizationByType(usageData: any[], dateFilter: Prisma.DateTimeFilter) {
    const equipmentByType = await prisma.equipment.groupBy({
      by: ['type'],
      where: { is_active: true },
      _count: { id: true },
    });

    return await Promise.all(
      equipmentByType.map(async (typeGroup) => {
        const typeUsage = usageData.filter(activity =>
          activity.equipment?.type === typeGroup.type
        );

        const totalMinutes = typeUsage.reduce((sum, activity) => sum + (activity.duration_minutes || 0), 0);
        const totalHours = totalMinutes / 60;
        const averageSessionLength = typeUsage.length > 0 ? totalMinutes / typeUsage.length : 0;

        // Calculate utilization rate for this type
        const possibleHours = this.calculatePossibleHours(
          dateFilter.gte ? new Date(dateFilter.gte) : undefined,
          dateFilter.lte ? new Date(dateFilter.lte) : undefined,
          typeGroup._count.id
        );
        const utilizationRate = possibleHours > 0 ? (totalHours / possibleHours) * 100 : 0;

        return {
          type: typeGroup.type,
          count: typeGroup._count.id,
          utilizationRate,
          totalHours,
          averageSessionLength,
        };
      })
    );
  }

  private async calculateUtilizationByLocation(usageData: any[], dateFilter: Prisma.DateTimeFilter) {
    const equipmentByLocation = await prisma.equipment.groupBy({
      by: ['location'],
      where: { is_active: true },
      _count: { id: true },
    });

    return await Promise.all(
      equipmentByLocation.map(async (locationGroup) => {
        const locationUsage = usageData.filter(activity =>
          activity.equipment?.location === locationGroup.location
        );

        const totalMinutes = locationUsage.reduce((sum, activity) => sum + (activity.duration_minutes || 0), 0);
        const totalHours = totalMinutes / 60;

        // Calculate utilization rate for this location
        const possibleHours = this.calculatePossibleHours(
          dateFilter.gte ? new Date(dateFilter.gte) : undefined,
          dateFilter.lte ? new Date(dateFilter.lte) : undefined,
          locationGroup._count.id
        );
        const utilizationRate = possibleHours > 0 ? (totalHours / possibleHours) * 100 : 0;

        return {
          location: locationGroup.location,
          count: locationGroup._count.id,
          utilizationRate,
          totalHours,
        };
      })
    );
  }

  private async calculateUsageTrends(dateFilter: Prisma.DateTimeFilter, equipmentFilter: Prisma.EquipmentWhereInput) {
    // Implementation for calculating usage trends over time
    // This would involve grouping usage data by day, week, and month
    // For now, return placeholder data
    return {
      daily: [],
      weekly: [],
      monthly: [],
    };
  }

  private calculateHealthScore(conditionData: Array<{ condition: EquipmentConditionRating; percentage: number }>): number {
    const conditionWeights = {
      [EquipmentConditionRating.EXCELLENT]: 100,
      [EquipmentConditionRating.GOOD]: 85,
      [EquipmentConditionRating.FAIR]: 70,
      [EquipmentConditionRating.POOR]: 40,
      [EquipmentConditionRating.DAMAGED]: 10,
    };

    return conditionData.reduce((score, item) => {
      return score + (conditionWeights[item.condition] * (item.percentage / 100));
    }, 0);
  }

  private async getMaintenanceMetrics(dateFilter: Prisma.DateTimeFilter) {
    const maintenanceData = await prisma.equipment_maintenance.findMany({
      where: {
        created_at: dateFilter,
      },
    });

    const scheduled = maintenanceData.filter(m => m.status === EquipmentMaintenanceStatus.SCHEDULED).length;
    const completed = maintenanceData.filter(m => m.status === EquipmentMaintenanceStatus.COMPLETED).length;
    const overdue = maintenanceData.filter(m =>
      m.status === EquipmentMaintenanceStatus.SCHEDULED &&
      m.scheduled_date &&
      m.scheduled_date < new Date()
    ).length;

    const total = maintenanceData.length;
    const complianceRate = total > 0 ? (completed / total) * 100 : 0;

    const averageDuration = completed > 0
      ? maintenanceData
          .filter(m => m.actual_duration)
          .reduce((sum, m) => sum + (m.actual_duration || 0), 0) / completed
      : 0;

    const totalCost = maintenanceData.reduce((sum, m) => sum + (m.cost || 0), 0);

    return {
      scheduled,
      completed,
      overdue,
      complianceRate,
      averageDuration,
      totalCost,
    };
  }

  private async calculateReliabilityMetrics(dateFilter: Prisma.DateTimeFilter) {
    // Implementation for calculating reliability metrics
    // This would involve tracking downtime, failure rates, etc.
    return {
      downtimeRate: 5.2, // Example: 5.2% downtime
      reliabilityScore: 94.8, // Example: 94.8% reliability
    };
  }

  private async calculateCostMetrics(dateFilter: Prisma.DateTimeFilter) {
    // Implementation for calculating cost metrics
    return {
      costPerHour: 2.45, // Example: $2.45 per hour
      roi: 125.5, // Example: 125.5% ROI
    };
  }

  private async identifyTopPerformers(dateFilter: Prisma.DateTimeFilter) {
    // Implementation for identifying top performing equipment
    return [];
  }

  private async identifyUnderperformers(dateFilter: Prisma.DateTimeFilter) {
    // Implementation for identifying underperforming equipment
    return [];
  }

  private groupUsageByStudent(usageData: any[]) {
    const studentStats: { [studentId: string]: any } = {};

    usageData.forEach(activity => {
      const studentId = activity.student_id;
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          studentId,
          studentName: activity.student?.first_name + ' ' + activity.student?.last_name,
          gradeLevel: activity.student?.grade_level,
          sessions: 0,
          totalMinutes: 0,
          equipmentTypes: new Set(),
        };
      }

      const stat = studentStats[studentId];
      stat.sessions++;
      stat.totalMinutes += activity.duration_minutes || 0;
      stat.equipmentTypes.add(activity.equipment?.type);
    });

    // Calculate additional metrics
    Object.values(studentStats).forEach((stat: any) => {
      stat.totalHours = stat.totalMinutes / 60;
      stat.favoriteType = this.getMostFrequent(stat.equipmentTypes);
    });

    return studentStats;
  }

  private getMostFrequent(set: Set<string>): string {
    const array = Array.from(set);
    return array.length > 0 ? array[0] : 'UNKNOWN';
  }

  private calculateUsageByGrade(usageData: any[]) {
    const gradeStats: { [grade: string]: any } = {};

    usageData.forEach(activity => {
      const grade = activity.student?.grade_level || 'Unknown';
      if (!gradeStats[grade]) {
        gradeStats[grade] = {
          grade,
          students: new Set(),
          sessions: 0,
          totalMinutes: 0,
        };
      }

      const stat = gradeStats[grade];
      stat.students.add(activity.student_id);
      stat.sessions++;
      stat.totalMinutes += activity.duration_minutes || 0;
    });

    return Object.values(gradeStats).map((stat: any) => ({
      grade: stat.grade,
      students: stat.students.size,
      sessions: stat.sessions,
      hours: stat.totalMinutes / 60,
      averageSessionLength: stat.sessions > 0 ? stat.totalMinutes / stat.sessions : 0,
    }));
  }

  private async analyzeUsagePatterns(usageData: any[], dateFilter: Prisma.DateTimeFilter) {
    // Implementation for analyzing usage patterns
    return {
      peakDays: [],
      timePreferences: [],
      equipmentPreferences: [],
    };
  }

  private async getMaintenanceCosts(dateFilter: Prisma.DateTimeFilter) {
    const maintenanceData = await prisma.equipment_maintenance.aggregate({
      where: {
        created_at: dateFilter,
      },
      _sum: { cost: true },
      _count: { id: true },
    });

    const total = maintenanceData._sum.cost || 0;
    const count = maintenanceData._count.id;

    // Calculate monthly and yearly costs
    const daysInPeriod = this.calculateDaysInPeriod(dateFilter);
    const monthly = (total / daysInPeriod) * 30;
    const yearly = monthly * 12;

    // Get costs by type
    const costsByType = await prisma.equipment_maintenance.groupBy({
      by: ['maintenance_type'],
      where: { created_at: dateFilter },
      _sum: { cost: true },
      _count: { id: true },
    });

    const byType = costsByType.map(item => ({
      type: item.maintenance_type,
      cost: item._sum.cost || 0,
      count: item._count.id,
    }));

    return {
      total,
      monthly,
      yearly,
      byType,
    };
  }

  private async getOperationalCosts(dateFilter: Prisma.DateTimeFilter) {
    // Implementation for calculating operational costs
    // This would include electricity, supplies, staff costs, etc.
    return {
      electricity: 1250.50,
      supplies: 450.25,
      staff: 2500.00,
      other: 325.75,
    };
  }

  private async calculateCostPerUsageByType(usageData: any[], maintenanceCosts: any, operationalCosts: any) {
    // Implementation for calculating cost per usage by equipment type
    return [];
  }

  private async calculateROI(totalInvestment: number, totalCosts: number, totalUsageHours: number) {
    // Simplified ROI calculation
    const totalValue = totalUsageHours * 5.0; // Assume $5 per hour value
    const netProfit = totalValue - totalInvestment - totalCosts;
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

    return {
      totalInvestment,
      totalValue,
      roi,
      paybackPeriod: totalInvestment > 0 ? totalInvestment / (totalValue - totalCosts) : 0,
      breakEvenPoint: null, // Would calculate based on actual data
    };
  }

  private async generateRecommendations(
    usageAnalytics: EquipmentUsageAnalytics,
    performanceMetrics: EquipmentPerformanceMetrics,
    studentAnalytics: StudentEquipmentAnalytics,
    costAnalytics: EquipmentCostAnalytics
  ) {
    const recommendations = [];

    // Low utilization recommendations
    if (usageAnalytics.utilizationRate < 50) {
      recommendations.push({
        type: 'UTILIZATION',
        priority: 'HIGH',
        title: 'Low Equipment Utilization',
        description: `Current utilization rate is ${usageAnalytics.utilizationRate.toFixed(1)}%. Consider marketing, scheduling improvements, or equipment reallocation.`,
        actions: [
          'Increase awareness of available equipment',
          'Review scheduling policies',
          'Consider equipment relocation to high-traffic areas',
        ],
      });
    }

    // Maintenance compliance recommendations
    if (performanceMetrics.maintenanceCompliance < 80) {
      recommendations.push({
        type: 'MAINTENANCE',
        priority: 'MEDIUM',
        title: 'Maintenance Compliance Issue',
        description: `Maintenance compliance is ${performanceMetrics.maintenanceCompliance.toFixed(1)}%. Implement better scheduling and tracking.`,
        actions: [
          'Review maintenance scheduling process',
          'Implement automated reminders',
          'Consider preventive maintenance contracts',
        ],
      });
    }

    // Cost optimization recommendations
    if (costAnalytics.costPerUsage.overall > 5.0) {
      recommendations.push({
        type: 'COST',
        priority: 'MEDIUM',
        title: 'High Operational Costs',
        description: `Cost per usage hour is $${costAnalytics.costPerUsage.overall.toFixed(2)}. Review operational efficiency.`,
        actions: [
          'Analyze energy consumption patterns',
          'Review supplier contracts',
          'Consider energy-efficient equipment',
        ],
      });
    }

    return recommendations;
  }

  private getReportPeriod(startDate?: Date, endDate?: Date): string {
    if (!startDate || !endDate) {
      return new Date().toISOString().slice(0, 7); // Current month
    }

    // For simplicity, return month of end date
    return endDate.toISOString().slice(0, 7);
  }

  private generateReportSummary(
    usageAnalytics: EquipmentAnalytics,
    performanceMetrics: EquipmentPerformanceMetrics,
    costAnalytics: EquipmentCostAnalytics
  ): string {
    return `Equipment utilization: ${usageAnalytics.utilizationRate.toFixed(1)}%, ` +
           `Health score: ${performanceMetrics.overallHealth.toFixed(1)}%, ` +
           `Maintenance compliance: ${performanceMetrics.maintenanceCompliance.toFixed(1)}%, ` +
           `Total costs: $${(costAnalytics.maintenanceCosts.total + costAnalytics.operationalCosts.electricity + costAnalytics.operationalCosts.supplies + costAnalytics.operationalCosts.staff + costAnalytics.operationalCosts.other).toFixed(2)}`;
  }

  private calculateDaysInPeriod(dateFilter: Prisma.DateTimeFilter): number {
    if (!dateFilter.gte || !dateFilter.lte) return 30;

    const start = new Date(dateFilter.gte);
    const end = new Date(dateFilter.lte);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const equipmentAnalyticsService = new EquipmentAnalyticsService();