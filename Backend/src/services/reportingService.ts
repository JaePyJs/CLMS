import {
  Prisma,
  student_activities_activity_type,
  equipment_status,
  equipment_type,
  students_grade_category,
} from '@prisma/client';
import { logger } from '@/utils/logger';
import {
  analyticsService,
  type PredictiveInsight,
  type ResourceForecast,
  type HeatMapData,
  type SeasonalPattern,
} from './analyticsService';
import { transporter } from '@/utils/email';
import {
  StudentsRepository,
  BooksRepository,
  EquipmentRepository,
  UsersRepository,
} from '@/repositories';
import { prisma } from '@/utils/prisma';
import fs from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';

export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  type:
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'quarterly'
    | 'yearly'
    | 'on_demand'
    | 'custom';
  category:
    | 'operational'
    | 'strategic'
    | 'administrative'
    | 'financial'
    | 'performance';
  recipients: string[];
  includeInsights: boolean;
  includeForecasts: boolean;
  includeHeatMaps: boolean;
  includeROI: boolean;
  includeBenchmarks: boolean;
  includeReadingPatterns: boolean;
  includeSpaceUtilization: boolean;
  format: 'html' | 'pdf' | 'excel' | 'csv' | 'json';
  is_active: boolean;
  schedule?: string;
  filters?: {
    gradeLevel?: students_grade_category;
    activityType?: student_activities_activity_type;
    resourceType?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
    customFilters?: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
  };
  sections?: ReportSection[];
  templates?: string[];
  branding?: {
    logo?: string;
    colors?: {
      primary: string;
      secondary: string;
    };
    footer?: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type ReportSectionConfig = Record<string, unknown>;

export interface ReportSection {
  id: string;
  type:
    | 'overview'
    | 'kpi'
    | 'chart'
    | 'table'
    | 'insights'
    | 'heatmap'
    | 'forecast'
    | 'roi'
    | 'benchmark'
    | 'reading_patterns'
    | 'space_utilization';
  title: string;
  description?: string;
  config?: ReportSectionConfig;
  order: number;
  enabled: boolean;
  customizations?: {
    chartType?: string;
    metrics?: string[];
    timeframes?: string[];
  };
}

export interface AdvancedAnalyticsData {
  roiAnalysis: ROIAnalysis;
  readingPatterns: StudentReadingPattern[];
  spaceUtilization: SpaceUtilizationData[];
  benchmarks: BenchmarkData[];
  technologyAdoption: TechnologyAdoptionMetrics;
  serviceQuality: ServiceQualityMetrics;
}

export interface ROIAnalysis {
  totalInvestment: number;
  totalValue: number;
  roi: number;
  paybackPeriod: number;
  costPerStudent: number;
  valuePerStudent: number;
  utilizationRate: number;
  operationalEfficiency: number;
  breakdown: {
    category: string;
    cost: number;
    value: number;
    roi: number;
  }[];
  monthlyTrend: Array<{
    month: string;
    investment: number;
    value: number;
    roi: number;
  }>;
}

export interface StudentReadingPattern {
  studentId: string;
  studentName: string;
  gradeLevel: students_grade_category;
  totalBooksRead: number;
  averageReadingTime: number;
  preferredGenres: string[];
  readingFrequency: string;
  readingTrend: 'increasing' | 'decreasing' | 'stable';
  comprehensionScore?: number;
  lastActive: Date;
  readingStreak: number;
  bookDiversity: number;
}

export interface SpaceUtilizationData {
  area: string;
  totalCapacity: number;
  currentOccupancy: number;
  utilizationRate: number;
  peakHours: number[];
  averageStayDuration: number;
  popularActivities: string[];
  equipmentDistribution: {
    type: string;
    count: number;
    utilizationRate: number;
  }[];
  hourlyUtilization: Array<{
    hour: number;
    occupancy: number;
    activities: number;
  }>;
  recommendations: string[];
}

export interface BenchmarkData {
  metric: string;
  currentValue: number;
  benchmarkValue: number;
  percentile: number;
  comparison: 'above' | 'below' | 'equal';
  industry: string;
  librarySize: 'small' | 'medium' | 'large';
  lastUpdated: Date;
  trend: 'improving' | 'declining' | 'stable';
}

export interface TechnologyAdoptionMetrics {
  digitalResourceUsage: number;
  onlineCatalogUsage: number;
  selfServiceCheckouts: number;
  mobileAppUsage: number;
  digitalLiteracyPrograms: number;
  technologySatisfaction: number;
  adoptionTrend: Array<{
    month: string;
    adoptionRate: number;
  }>;
}

export interface ServiceQualityMetrics {
  waitTimeAverage: number;
  serviceSatisfaction: number;
  resourceAvailability: number;
  staffHelpfulness: number;
  facilityCleanliness: number;
  overallQuality: number;
  monthlyTrend: Array<{
    month: string;
    quality: number;
    satisfaction: number;
  }>;
  improvementAreas: string[];
}

export interface AlertConfig {
  id: string;
  name: string;
  type:
    | 'usage_spike'
    | 'resource_shortage'
    | 'anomaly_detected'
    | 'system_health';
  threshold: number;
  operators: 'greater_than' | 'less_than' | 'equals';
  recipients: string[];
  is_active: boolean;
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
}

type UsageSpikeAlertData = {
  type: 'usage_spike';
  current: number;
  threshold: number;
};

type ResourceShortageAlertData = {
  type: 'resource_shortage';
  current: number;
  threshold: number;
  inUse: number;
  total: number;
};

type SystemHealthAlertData = {
  type: 'system_health';
  current: number;
  threshold: number;
  memoryUsage: NodeJS.MemoryUsage;
};

type AlertData =
  | UsageSpikeAlertData
  | ResourceShortageAlertData
  | SystemHealthAlertData
  | { type: 'unknown'; [key: string]: unknown };

export interface GeneratedReport {
  id: string;
  configId: string;
  name: string;
  type: string;
  generated_at: Date;
  filePath?: string;
  summary: string;
  insights: PredictiveInsight[];
  metrics: ReportMetrics;
  status: 'generating' | 'completed' | 'failed';
  advancedAnalytics?: AdvancedAnalyticsData;
  sectionData?: SectionDataMap;
}

type ReportFilters = ReportConfig['filters'];

export interface ReportMetrics {
  students: {
    total: number;
    active: number;
  };
  activities: {
    today: number;
    week: number;
  };
  generated_at: string;
}

interface OverviewSectionData {
  totalStudents: number;
  activeStudents: number;
  totalActivities: number;
  totalBooks: number;
  totalEquipment: number;
  studentEngagementRate: number;
  period: string;
  dateRange: {
    start: Date;
    end: Date;
  };
}

type KPIStatus = 'good' | 'warning' | 'critical';

interface KPIEntry {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: KPIStatus;
  target: number;
}

interface KPISectionData {
  kpis: KPIEntry[];
}

interface ChartDataPoint {
  date: string;
  students: number;
  computers: number;
  gaming: number;
}

interface ChartSectionData {
  chartData: ChartDataPoint[];
}

type ActivityWithRelations = Prisma.student_activitiesGetPayload<{
  include: {
    students: {
      select: {
        id: true;
        first_name: true;
        last_name: true;
        grade_level: true;
      };
    };
    equipment: {
      select: {
        id: true;
        name: true;
        type: true;
      };
    };
  };
}>;

interface TableActivityStudent {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
}

type TableActivity = Omit<ActivityWithRelations, 'students'> & {
  student: TableActivityStudent | null;
  duration: number | null;
};

interface TableSectionData {
  activities: TableActivity[];
}

interface HeatMapSectionData {
  heatMapData: HeatMapData[];
}

interface ForecastSectionData {
  forecasts: ResourceForecast[];
  seasonalPatterns: SeasonalPattern[];
}

type SectionData =
  | OverviewSectionData
  | KPISectionData
  | ChartSectionData
  | TableSectionData
  | HeatMapSectionData
  | ForecastSectionData;

type SectionDataMap = Record<string, SectionData>;

interface ReadingActivity {
  start_time: Date;
  end_time: Date | null;
  activity_type: student_activities_activity_type;
}

interface HourlyUtilizationPoint {
  hour: number;
  occupancy: number;
  activities: number;
}

type WeeklyReadingActivity = ReadingActivity[];

const isTableSectionData = (
  section: SectionData,
): section is TableSectionData =>
  (section as TableSectionData).activities !== undefined;

const isKPISectionData = (section: SectionData): section is KPISectionData =>
  (section as KPISectionData).kpis !== undefined;

const isOverviewSectionData = (
  section: SectionData,
): section is OverviewSectionData =>
  (section as OverviewSectionData).totalStudents !== undefined;

const isChartSectionData = (
  section: SectionData,
): section is ChartSectionData =>
  (section as ChartSectionData).chartData !== undefined;

const isHeatMapSectionData = (
  section: SectionData,
): section is HeatMapSectionData =>
  (section as HeatMapSectionData).heatMapData !== undefined;

const isForecastSectionData = (
  section: SectionData,
): section is ForecastSectionData =>
  (section as ForecastSectionData).forecasts !== undefined;

class ReportingService {
  private activeReports: Map<string, NodeJS.Timeout> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  // Initialize repositories
  private studentsRepository = new StudentsRepository();
  private booksRepository = new BooksRepository();
  private equipmentRepository = new EquipmentRepository();
  private usersRepository = new UsersRepository();

  /**
   * Initialize scheduled reports
   */
  async initializeScheduledReports(): Promise<void> {
    try {
      const reportConfigs = await this.getReportConfigs();

      for (const config of reportConfigs.filter(c => c.is_active)) {
        if (config.type === 'daily') {
          this.scheduleReport(config, '0 8 * * *'); // 8 AM daily
        } else if (config.type === 'weekly') {
          this.scheduleReport(config, '0 8 * * 1'); // 8 AM Monday
        } else if (config.type === 'monthly') {
          this.scheduleReport(config, '0 8 1 * *'); // 8 AM first day of month
        } else if (config.schedule) {
          this.scheduleReport(config, config.schedule);
        }
      }

      logger.info(`Initialized ${reportConfigs.length} report configurations`);
    } catch (error) {
      logger.error('Failed to initialize scheduled reports', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Initialize monitoring for alerts
   */
  async initializeAlertMonitoring(): Promise<void> {
    try {
      const alertConfigs = await this.getAlertConfigs();

      // Set up monitoring every 5 minutes
      setInterval(
        async () => {
          await this.checkAlerts(alertConfigs.filter(c => c.is_active));
        },
        5 * 60 * 1000,
      );

      logger.info(`Initialized ${alertConfigs.length} alert configurations`);
    } catch (error) {
      logger.error('Failed to initialize alert monitoring', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Generate a comprehensive analytics report
   */
  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info(`Generating report: ${config.name} (${reportId})`);

      // Generate basic analytics data
      const insights: PredictiveInsight[] = config.includeInsights
        ? await analyticsService.generatePredictiveInsights('week')
        : [];
      const forecasts: ResourceForecast[] = config.includeForecasts
        ? await analyticsService.generateResourceForecasts('week')
        : [];

      // Generate advanced analytics data
      let advancedAnalytics: AdvancedAnalyticsData | undefined;
      if (
        config.includeROI ||
        config.includeBenchmarks ||
        config.includeReadingPatterns ||
        config.includeSpaceUtilization
      ) {
        advancedAnalytics = await this.generateAdvancedAnalytics(config);
      }

      // Get base metrics
      const metrics = await this.getReportMetrics(config.filters);

      // Generate section-specific data
      const sectionData = await this.generateSectionData(config);

      // Generate summary
      const summary = this.generateEnhancedReportSummary(
        insights,
        metrics,
        forecasts,
        advancedAnalytics,
      );

      // Create report object
      const report: GeneratedReport = {
        id: reportId,
        configId: config.id,
        name: config.name,
        type: config.type,
        generated_at: new Date(),
        summary,
        insights,
        metrics,
        status: 'completed',
      };

      // Add advanced data to report
      if (advancedAnalytics) {
        report.advancedAnalytics = advancedAnalytics;
      }
      if (sectionData && Object.keys(sectionData).length > 0) {
        report.sectionData = sectionData;
      }

      // Generate file if requested
      if (config.format !== 'json') {
        report.filePath = await this.generateEnhancedReportFile(report, config);
      }

      // Save report to database
      await this.saveReportToDatabase(report);

      // Send email if recipients are configured
      if (config.recipients.length > 0) {
        await this.sendReportEmail(report, config);
      }

      logger.info(
        `Report generated successfully: ${config.name} (${reportId})`,
      );
      return report;
    } catch (error) {
      logger.error(`Failed to generate report: ${config.name}`, {
        error: (error as Error).message,
        reportId,
      });

      const failedReport: GeneratedReport = {
        id: reportId,
        configId: config.id,
        name: config.name,
        type: config.type,
        generated_at: new Date(),
        summary: 'Report generation failed',
        insights: [],
        metrics: {
          students: { total: 0, active: 0 },
          activities: { today: 0, week: 0 },
          generated_at: new Date().toISOString(),
        },
        status: 'failed',
      };

      await this.saveReportToDatabase(failedReport);
      throw error;
    }
  }

  /**
   * Generate advanced analytics data
   */
  private async generateAdvancedAnalytics(
    config: ReportConfig,
  ): Promise<AdvancedAnalyticsData> {
    const [
      roiAnalysis,
      readingPatterns,
      spaceUtilization,
      benchmarks,
      technologyAdoption,
      serviceQuality,
    ] = await Promise.all([
      config.includeROI
        ? this.calculateROIAnalysis(config.filters)
        : Promise.resolve({} as ROIAnalysis),
      config.includeReadingPatterns
        ? this.analyzeStudentReadingPatterns(config.filters)
        : Promise.resolve([]),
      config.includeSpaceUtilization
        ? this.analyzeSpaceUtilization(config.filters)
        : Promise.resolve([]),
      config.includeBenchmarks
        ? this.getBenchmarkData(config.filters)
        : Promise.resolve([]),
      this.getTechnologyAdoptionMetrics(config.filters),
      this.getServiceQualityMetrics(config.filters),
    ]);

    return {
      roiAnalysis,
      readingPatterns,
      spaceUtilization,
      benchmarks,
      technologyAdoption,
      serviceQuality,
    };
  }

  /**
   * Generate section-specific data
   */
  private async generateSectionData(
    config: ReportConfig,
  ): Promise<SectionDataMap> {
    if (!config.sections) return {} as SectionDataMap;

    const sectionData: SectionDataMap = {};

    for (const section of config.sections.filter(s => s.enabled)) {
      switch (section.type) {
        case 'overview':
          sectionData[section.id] = await this.getOverviewData(section.config);
          break;
        case 'kpi':
          sectionData[section.id] = await this.getKPIData(section.config);
          break;
        case 'chart':
          sectionData[section.id] = await this.getChartData(section.config);
          break;
        case 'table':
          sectionData[section.id] = await this.getTableData(section.config);
          break;
        case 'heatmap':
          sectionData[section.id] = await this.getHeatMapData(section.config);
          break;
        case 'forecast':
          sectionData[section.id] = await this.getForecastData(section.config);
          break;
        default:
          logger.warn('Unknown report section type', { type: section.type });
      }
    }

    return sectionData;
  }

  /**
   * Calculate ROI Analysis
   */
  private async calculateROIAnalysis(
    filters?: ReportFilters,
  ): Promise<ROIAnalysis> {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), 0, 1); // Start of year

    // Get financial data (mock implementation - would connect to financial systems)
    const totalInvestment = 150000; // Annual library budget
    const [userStats, totalActivities, booksResult] = await Promise.all([
      this.usersRepository.getUserStatistics(),
      prisma.student_activities.count({
        where: {
          start_time: { gte: startDate },
          ...(filters?.activityType && { activity_type: filters.activityType }),
        },
      }),
      this.booksRepository.getBooks({ isActive: true, limit: 1000 }), // Use a high limit to get all books
    ]);

    const totalStudents = userStats.active;
    const totalBooks = booksResult.pagination.total;

    // Calculate value based on usage and outcomes
    const valuePerActivity = 35; // Estimated value per library activity
    const valuePerBook = 50; // Estimated value per book in collection
    const totalValue =
      totalActivities * valuePerActivity + totalBooks * valuePerBook;

    const roi = ((totalValue - totalInvestment) / totalInvestment) * 100;
    const costPerStudent = totalInvestment / totalStudents;
    const valuePerStudent = totalValue / totalStudents;
    const utilizationRate = (totalActivities / (totalStudents * 20)) * 100; // Assuming 20 visits per student per year
    const operationalEfficiency = Math.min(100, (totalActivities / 2000) * 100);

    // Generate monthly trend data
    const monthlyTrend = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(endDate.getFullYear(), i, 1);
      const monthEnd = new Date(endDate.getFullYear(), i + 1, 0);

      const monthActivities = await prisma.student_activities.count({
        where: {
          start_time: { gte: monthStart, lt: monthEnd },
        },
      });

      const monthInvestment = totalInvestment / 12;
      const monthValue = monthActivities * valuePerActivity;
      const monthROI = ((monthValue - monthInvestment) / monthInvestment) * 100;

      monthlyTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        investment: monthInvestment,
        value: monthValue,
        roi: monthROI,
      });
    }

    return {
      totalInvestment,
      totalValue,
      roi,
      paybackPeriod: totalInvestment / (totalValue / 12), // months
      costPerStudent,
      valuePerStudent,
      utilizationRate,
      operationalEfficiency,
      breakdown: [
        { category: 'Staff Costs', cost: 90000, value: 45000, roi: -50 },
        {
          category: 'Technology & Equipment',
          cost: 35000,
          value: 50000,
          roi: 43,
        },
        {
          category: 'Collections & Resources',
          cost: 15000,
          value: 35000,
          roi: 133,
        },
        {
          category: 'Facilities & Operations',
          cost: 10000,
          value: 20000,
          roi: 100,
        },
      ],
      monthlyTrend,
    };
  }

  /**
   * Analyze student reading patterns
   */
  private async analyzeStudentReadingPatterns(
    filters?: ReportFilters,
  ): Promise<StudentReadingPattern[]> {
    const patterns: StudentReadingPattern[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days

    const readingActivityTypes: student_activities_activity_type[] = [
      student_activities_activity_type.BOOK_CHECKOUT,
      student_activities_activity_type.BOOK_RETURN,
    ];

    const gradeFilter = filters?.gradeLevel;

    // Get students with reading activity
    const studentsWithReading = await prisma.students.findMany({
      where: {
        student_activities: {
          some: {
            activity_type: { in: readingActivityTypes },
            start_time: { gte: startDate },
          },
        },
        ...(gradeFilter && { grade_category: gradeFilter }),
      },
      include: {
        student_activities: {
          where: {
            activity_type: { in: readingActivityTypes },
            start_time: { gte: startDate },
          },
          orderBy: { start_time: 'desc' },
          take: 50,
        },
      },
      take: 100,
    });

    for (const student of studentsWithReading) {
      const bookActivities = student.student_activities.filter(
        a =>
          a.activity_type === student_activities_activity_type.BOOK_CHECKOUT ||
          a.activity_type === student_activities_activity_type.BOOK_RETURN,
      );

      const readingActivities: ReadingActivity[] = bookActivities.map(
        activity => ({
          start_time: activity.start_time,
          end_time: activity.end_time,
          activity_type: activity.activity_type,
        }),
      );

      const totalBooksRead = bookActivities.filter(
        a => a.activity_type === student_activities_activity_type.BOOK_CHECKOUT,
      ).length;

      // Calculate reading frequency and trend
      const weeklyActivity = this.groupActivitiesByWeek(readingActivities);
      const readingFrequency = this.calculateReadingFrequency(weeklyActivity);
      const readingTrend = this.calculateReadingTrend(weeklyActivity);

      // Calculate reading streak
      const readingStreak = this.calculateReadingStreak(readingActivities);

      // Calculate book diversity (mock implementation)
      const bookDiversity = Math.min(10, Math.floor(totalBooksRead / 3));

      patterns.push({
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        gradeLevel: student.grade_category,
        totalBooksRead,
        averageReadingTime: 45, // Mock calculation - would track actual reading time
        preferredGenres: ['Fiction', 'Non-Fiction', 'Science'], // Mock data
        readingFrequency,
        readingTrend,
        lastActive: readingActivities[0]?.start_time || new Date(),
        readingStreak,
        bookDiversity,
      });
    }

    return patterns.sort((a, b) => b.totalBooksRead - a.totalBooksRead);
  }

  /**
   * Analyze space utilization
   */
  private async analyzeSpaceUtilization(
    _filters?: ReportFilters,
  ): Promise<SpaceUtilizationData[]> {
    const utilizationData: SpaceUtilizationData[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last week

    // Define library areas
    const areas = [
      {
        name: 'Computer Lab',
        categoryKeywords: ['computer', 'desktop', 'laptop'],
      },
      { name: 'Gaming Zone', categoryKeywords: ['gaming', 'console', 'vr'] },
      {
        name: 'Study Area',
        categoryKeywords: ['study', 'desk', 'collaborative'],
      },
      {
        name: 'Reading Lounge',
        categoryKeywords: ['reading', 'sofa', 'quiet'],
      },
    ];

    for (const area of areas) {
      // Get equipment for this area
      const equipment = await prisma.equipment.findMany({
        where: {
          OR: area.categoryKeywords.map(keyword => ({
            category: { contains: keyword, mode: 'insensitive' },
          })),
        },
      });

      const totalCapacity = equipment.length;
      const currentOccupancy = equipment.filter(
        e => e.status === equipment_status.IN_USE,
      ).length;
      const utilizationRate =
        totalCapacity > 0 ? (currentOccupancy / totalCapacity) * 100 : 0;

      // Get hourly utilization data
      const hourlyUtilization = await this.getHourlySpaceUtilization(
        area.name,
        startDate,
        endDate,
      );

      // Calculate peak hours
      const peakHours = hourlyUtilization
        .sort((a, b) => b.occupancy - a.occupancy)
        .slice(0, 3)
        .map(h => h.hour);

      // Generate recommendations
      const recommendations = this.generateSpaceRecommendations(
        area.name,
        utilizationRate,
        peakHours,
      );

      utilizationData.push({
        area: area.name,
        totalCapacity,
        currentOccupancy,
        utilizationRate,
        peakHours,
        averageStayDuration: this.calculateAverageStayDuration(
          area.name,
          startDate,
          endDate,
        ),
        popularActivities: await this.getPopularActivities(
          area.name,
          startDate,
          endDate,
        ),
        equipmentDistribution: equipment.reduce(
          (acc, item) => {
            const existing = acc.find(e => e.type === item.type);
            if (existing) {
              existing.count++;
              if (item.status === equipment_status.IN_USE) {
                existing.utilizationRate = (existing.utilizationRate + 100) / 2;
              }
            } else {
              acc.push({
                type: item.type || 'unknown',
                count: 1,
                utilizationRate:
                  item.status === equipment_status.IN_USE ? 100 : 0,
              });
            }
            return acc;
          },
          [] as { type: string; count: number; utilizationRate: number }[],
        ),
        hourlyUtilization,
        recommendations,
      });
    }

    return utilizationData;
  }

  /**
   * Get benchmark data
   */
  private async getBenchmarkData(
    _filters?: ReportFilters,
  ): Promise<BenchmarkData[]> {
    const benchmarks: BenchmarkData[] = [];
    const [totalStudents, totalActivities] = await Promise.all([
      prisma.students.count({ where: { is_active: true } }),
      prisma.student_activities.count({
        where: {
          start_time: {
            gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Industry benchmarks for K-12 libraries
    const industryBenchmarks = [
      {
        metric: 'Visits per Student',
        benchmark: 8.5,
        industry: 'K-12 Libraries',
      },
      {
        metric: 'Book Circulation per Student',
        benchmark: 15.2,
        industry: 'K-12 Libraries',
      },
      {
        metric: 'Computer Usage Rate',
        benchmark: 65.0,
        industry: 'K-12 Libraries',
      },
      {
        metric: 'Program Attendance Rate',
        benchmark: 25.0,
        industry: 'K-12 Libraries',
      },
      {
        metric: 'Digital Resource Usage',
        benchmark: 45.0,
        industry: 'K-12 Libraries',
      },
      {
        metric: 'Staff per Student',
        benchmark: 0.01,
        industry: 'K-12 Libraries',
      },
    ];

    for (const benchmark of industryBenchmarks) {
      let currentValue = 0;
      let comparison: 'above' | 'below' | 'equal' = 'equal';

      switch (benchmark.metric) {
        case 'Visits per Student':
          currentValue =
            totalStudents > 0 ? totalActivities / totalStudents : 0;
          break;
        case 'Book Circulation per Student':
          const bookCirculation = await prisma.student_activities.count({
            where: {
              start_time: {
                gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
              },
              activity_type: {
                in: [
                  student_activities_activity_type.BOOK_CHECKOUT,
                  student_activities_activity_type.BOOK_RETURN,
                ],
              },
            },
          });
          currentValue =
            totalStudents > 0 ? bookCirculation / totalStudents : 0;
          break;
        case 'Computer Usage Rate':
          const totalComputers = await prisma.equipment.count({
            where: { type: equipment_type.COMPUTER },
          });
          const inUseComputers = await prisma.equipment.count({
            where: {
              type: equipment_type.COMPUTER,
              status: equipment_status.IN_USE,
            },
          });
          currentValue =
            totalComputers > 0 ? (inUseComputers / totalComputers) * 100 : 0;
          break;
        default:
          currentValue = Math.random() * 100; // Mock data for other metrics
      }

      comparison =
        currentValue > benchmark.benchmark * 1.1
          ? 'above'
          : currentValue < benchmark.benchmark * 0.9
            ? 'below'
            : 'equal';

      benchmarks.push({
        metric: benchmark.metric,
        currentValue,
        benchmarkValue: benchmark.benchmark,
        percentile: Math.min(
          99,
          Math.max(
            1,
            Math.round((currentValue / benchmark.benchmark) * 50 + 50),
          ),
        ),
        comparison,
        industry: benchmark.industry,
        librarySize:
          totalStudents > 500
            ? 'large'
            : totalStudents > 200
              ? 'medium'
              : 'small',
        lastUpdated: new Date(),
        trend:
          Math.random() > 0.5
            ? 'improving'
            : Math.random() > 0.5
              ? 'stable'
              : 'declining',
      });
    }

    return benchmarks;
  }

  /**
   * Get technology adoption metrics
   */
  private async getTechnologyAdoptionMetrics(
    _filters?: ReportFilters,
  ): Promise<TechnologyAdoptionMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate various technology adoption metrics
    const digitalActivityTypes: student_activities_activity_type[] = [
      student_activities_activity_type.COMPUTER_USE,
      student_activities_activity_type.STUDY,
      student_activities_activity_type.OTHER,
    ];

    const [totalActivities, digitalActivities] = await Promise.all([
      prisma.student_activities.count({
        where: { start_time: { gte: startDate } },
      }),
      prisma.student_activities.count({
        where: {
          start_time: { gte: startDate },
          activity_type: { in: digitalActivityTypes },
        },
      }),
    ]);

    const digitalResourceUsage =
      totalActivities > 0 ? (digitalActivities / totalActivities) * 100 : 0;
    const onlineCatalogUsage = Math.random() * 80; // Mock data
    const selfServiceCheckouts = Math.random() * 60; // Mock data
    const mobileAppUsage = Math.random() * 40; // Mock data
    const digitalLiteracyPrograms = Math.random() * 70; // Mock data
    const technologySatisfaction = 70 + Math.random() * 25; // Mock satisfaction score

    // Generate adoption trend
    const adoptionTrend = [];
    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(
        endDate.getTime() - i * 30 * 24 * 60 * 60 * 1000,
      );
      adoptionTrend.push({
        month: trendDate.toLocaleString('default', { month: 'short' }),
        adoptionRate: digitalResourceUsage + (Math.random() - 0.5) * 20,
      });
    }

    return {
      digitalResourceUsage,
      onlineCatalogUsage,
      selfServiceCheckouts,
      mobileAppUsage,
      digitalLiteracyPrograms,
      technologySatisfaction,
      adoptionTrend,
    };
  }

  /**
   * Get service quality metrics
   */
  private async getServiceQualityMetrics(
    _filters?: ReportFilters,
  ): Promise<ServiceQualityMetrics> {
    // Mock implementation - would integrate with survey systems
    const waitTimeAverage = 5 + Math.random() * 10; // 5-15 minutes
    const serviceSatisfaction = 70 + Math.random() * 25; // 70-95%
    const resourceAvailability = 80 + Math.random() * 15; // 80-95%
    const staffHelpfulness = 75 + Math.random() * 20; // 75-95%
    const facilityCleanliness = 85 + Math.random() * 10; // 85-95%
    const overallQuality =
      (serviceSatisfaction +
        resourceAvailability +
        staffHelpfulness +
        facilityCleanliness) /
      4;

    // Generate monthly trend
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(
        new Date().getTime() - i * 30 * 24 * 60 * 60 * 1000,
      );
      monthlyTrend.push({
        month: trendDate.toLocaleString('default', { month: 'short' }),
        quality: overallQuality + (Math.random() - 0.5) * 10,
        satisfaction: serviceSatisfaction + (Math.random() - 0.5) * 10,
      });
    }

    const improvementAreas = [];
    if (waitTimeAverage > 10) improvementAreas.push('Reduce wait times');
    if (serviceSatisfaction < 80)
      improvementAreas.push('Improve service satisfaction');
    if (resourceAvailability < 85)
      improvementAreas.push('Increase resource availability');

    return {
      waitTimeAverage,
      serviceSatisfaction,
      resourceAvailability,
      staffHelpfulness,
      facilityCleanliness,
      overallQuality,
      monthlyTrend,
      improvementAreas,
    };
  }

  // Section data methods
  private async getOverviewData(
    _config?: ReportSectionConfig,
  ): Promise<OverviewSectionData> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last week

    const [
      totalStudents,
      activeStudents,
      totalActivities,
      totalBooks,
      totalEquipment,
    ] = await Promise.all([
      prisma.students.count(),
      prisma.students.count({ where: { is_active: true } }),
      prisma.student_activities.count({
        where: { start_time: { gte: startDate } },
      }),
      prisma.books.count({ where: { is_active: true } }),
      prisma.equipment.count(),
    ]);

    return {
      totalStudents,
      activeStudents,
      totalActivities,
      totalBooks,
      totalEquipment,
      studentEngagementRate:
        totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0,
      period: 'Last 7 days',
      dateRange: { start: startDate, end: endDate },
    };
  }

  private async getKPIData(
    _config?: ReportSectionConfig,
  ): Promise<KPISectionData> {
    const [totalStudents, activeStudents, totalEquipment, inUseEquipment] =
      await Promise.all([
        prisma.students.count(),
        prisma.students.count({ where: { is_active: true } }),
        prisma.equipment.count(),
        prisma.equipment.count({ where: { status: equipment_status.IN_USE } }),
      ]);

    const engagementRate =
      totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0;
    const utilizationRate =
      totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;

    return {
      kpis: [
        {
          id: 'student_engagement',
          name: 'Student Engagement Rate',
          value: Math.round(engagementRate),
          unit: '%',
          status:
            engagementRate > 70
              ? 'good'
              : engagementRate > 50
                ? 'warning'
                : 'critical',
          target: 80,
        },
        {
          id: 'equipment_utilization',
          name: 'Equipment Utilization',
          value: Math.round(utilizationRate),
          unit: '%',
          status:
            utilizationRate > 60
              ? 'good'
              : utilizationRate > 40
                ? 'warning'
                : 'critical',
          target: 75,
        },
      ],
    };
  }

  private async getChartData(
    _config?: ReportSectionConfig,
  ): Promise<ChartSectionData> {
    // Mock chart data - would integrate with actual analytics
    return {
      chartData: [
        { date: '2024-01-01', students: 45, computers: 30, gaming: 15 },
        { date: '2024-01-02', students: 52, computers: 35, gaming: 17 },
        { date: '2024-01-03', students: 48, computers: 32, gaming: 16 },
      ],
    };
  }

  private async getTableData(
    _config?: ReportSectionConfig,
  ): Promise<TableSectionData> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activities = (await prisma.student_activities.findMany({
      take: 100,
      where: {
        start_time: { gte: startDate },
      },
      include: {
        students: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
          },
        },
        equipment: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { start_time: 'desc' },
    })) as ActivityWithRelations[];

    const tableActivities: TableActivity[] = activities.map(
      ({ students: activityStudent, ...activityData }) => {
        const computedDuration =
          activityData.end_time && activityData.start_time
            ? Math.round(
                (activityData.end_time.getTime() -
                  activityData.start_time.getTime()) /
                  60000,
              )
            : (activityData.duration_minutes ?? null);

        const student: TableActivityStudent | null = activityStudent
          ? {
              id: activityStudent.id,
              firstName: activityStudent.first_name,
              lastName: activityStudent.last_name,
              gradeLevel: activityStudent.grade_level,
            }
          : null;

        return {
          ...activityData,
          student,
          duration: computedDuration,
        };
      },
    );

    return { activities: tableActivities };
  }

  private async getHeatMapData(
    _config?: ReportSectionConfig,
  ): Promise<HeatMapSectionData> {
    const heatMapData: HeatMapData[] =
      await analyticsService.generateUsageHeatMap('week');
    return { heatMapData };
  }

  private async getForecastData(
    _config?: ReportSectionConfig,
  ): Promise<ForecastSectionData> {
    const forecasts = await analyticsService.generateResourceForecasts('week');
    const seasonalPatterns = await analyticsService.analyzeSeasonalPatterns();
    return { forecasts, seasonalPatterns };
  }

  // Helper methods for advanced analytics
  private groupActivitiesByWeek(
    activities: ReadingActivity[],
  ): WeeklyReadingActivity[] {
    const weeklyData: Record<string, WeeklyReadingActivity> = {};

    activities.forEach(activity => {
      const weekKey = this.getWeekKey(activity.start_time);
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = [];
      }
      weeklyData[weekKey].push(activity);
    });

    return Object.values(weeklyData);
  }

  private getWeekKey(date: Date): string {
    const d = new Date(date);
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    return `Week ${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
  }

  private calculateReadingFrequency(
    weeklyActivity: WeeklyReadingActivity[],
  ): string {
    const activeWeeks = weeklyActivity.filter(week => week.length > 0).length;
    if (activeWeeks >= 10) return 'Daily';
    if (activeWeeks >= 6) return 'Weekly';
    if (activeWeeks >= 3) return 'Bi-weekly';
    return 'Monthly';
  }

  private calculateReadingTrend(
    weeklyActivity: WeeklyReadingActivity[],
  ): 'increasing' | 'decreasing' | 'stable' {
    if (weeklyActivity.length < 3) return 'stable';

    const recent = weeklyActivity
      .slice(-3)
      .reduce((sum, week) => sum + week.length, 0);
    const previous = weeklyActivity
      .slice(-6, -3)
      .reduce((sum, week) => sum + week.length, 0);

    if (recent > previous * 1.2) return 'increasing';
    if (recent < previous * 0.8) return 'decreasing';
    return 'stable';
  }

  private calculateReadingStreak(activities: ReadingActivity[]): number {
    if (activities.length === 0) return 0;

    let streak = 1;
    const sortedActivities = activities.sort(
      (a, b) => b.start_time.getTime() - a.start_time.getTime(),
    );

    for (let i = 1; i < sortedActivities.length; i++) {
      const previousActivity = sortedActivities[i - 1];
      const currentActivity = sortedActivities[i];
      if (!previousActivity || !currentActivity) {
        continue;
      }

      const daysDiff =
        (previousActivity.start_time.getTime() -
          currentActivity.start_time.getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysDiff <= 7) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async getHourlySpaceUtilization(
    _areaName: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<HourlyUtilizationPoint[]> {
    const hourlyData: HourlyUtilizationPoint[] = [];

    for (let hour = 0; hour < 24; hour++) {
      // This would query actual utilization data for the specific area
      // Mock implementation for now
      hourlyData.push({
        hour,
        occupancy: Math.floor(Math.random() * 20),
        activities: Math.floor(Math.random() * 15),
      });
    }

    return hourlyData;
  }

  private calculateAverageStayDuration(
    _areaName: string,
    _startDate: Date,
    _endDate: Date,
  ): number {
    // Mock calculation - would track actual session durations
    return 30 + Math.random() * 60; // 30-90 minutes
  }

  private calculateHourlyUsage(
    _sessions: ReadonlyArray<ReadingActivity>,
  ): HourlyUtilizationPoint[] {
    // Create hourly usage data
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      occupancy: 0,
      activities: 0,
    }));

    // Fill with mock data
    return hourlyData.map(hour => ({
      ...hour,
      occupancy: Math.floor(Math.random() * 10),
      activities: Math.floor(Math.random() * 5),
    }));
  }

  private async getPopularActivities(
    _areaName: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<string[]> {
    // Mock implementation - would analyze actual activity data
    const activities = [
      'Computer Use',
      'Study',
      'Research',
      'Gaming',
      'Social Media',
      'Reading',
    ];
    return activities.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  private generateSpaceRecommendations(
    areaName: string,
    utilizationRate: number,
    peakHours: number[],
  ): string[] {
    const recommendations: string[] = [];

    if (utilizationRate > 85) {
      recommendations.push(
        'Consider expanding capacity or adding more resources',
      );
      recommendations.push('Implement time-sharing policies during peak hours');
    } else if (utilizationRate < 30) {
      recommendations.push('Promote this area more to increase usage');
      recommendations.push('Consider repurposing space for better utilization');
    }

    if (peakHours.includes(12) || peakHours.includes(13)) {
      recommendations.push('Extend lunch hour staffing to cover peak demand');
    }

    return recommendations;
  }

  /**
   * Check and trigger alerts based on conditions
   */
  async checkAlerts(alertConfigs: AlertConfig[]): Promise<void> {
    const now = new Date();

    for (const alertConfig of alertConfigs) {
      try {
        // Check cooldown period
        const lastTriggered = this.alertCooldowns.get(alertConfig.id);
        if (
          lastTriggered &&
          now.getTime() - lastTriggered.getTime() <
            alertConfig.cooldownPeriod * 60 * 1000
        ) {
          continue;
        }

        const shouldTrigger = await this.evaluateAlertCondition(alertConfig);

        if (shouldTrigger) {
          await this.triggerAlert(alertConfig);
          this.alertCooldowns.set(alertConfig.id, now);
        }
      } catch (error) {
        logger.error(`Failed to check alert: ${alertConfig.name}`, {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Create a new report configuration
   */
  async createReportConfig(
    config: Omit<ReportConfig, 'id'>,
  ): Promise<ReportConfig> {
    try {
      const newConfig: ReportConfig = {
        ...config,
        id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      await this.saveReportConfig(newConfig);

      // Schedule if active
      if (newConfig.is_active && newConfig.type !== 'on_demand') {
        if (newConfig.type === 'daily') {
          this.scheduleReport(newConfig, '0 8 * * *');
        } else if (newConfig.type === 'weekly') {
          this.scheduleReport(newConfig, '0 8 * * 1');
        } else if (newConfig.type === 'monthly') {
          this.scheduleReport(newConfig, '0 8 1 * *');
        } else if (newConfig.schedule) {
          this.scheduleReport(newConfig, newConfig.schedule);
        }
      }

      logger.info(`Created report configuration: ${newConfig.name}`);
      return newConfig;
    } catch (error) {
      logger.error('Failed to create report configuration', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Create a new alert configuration
   */
  async createAlertConfig(
    config: Omit<AlertConfig, 'id'>,
  ): Promise<AlertConfig> {
    try {
      const newConfig: AlertConfig = {
        ...config,
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      await this.saveAlertConfig(newConfig);
      logger.info(`Created alert configuration: ${newConfig.name}`);
      return newConfig;
    } catch (error) {
      logger.error('Failed to create alert configuration', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get report history
   */
  async getReportHistory(
    _limit: number = 50,
    _offset: number = 0,
  ): Promise<GeneratedReport[]> {
    try {
      // This would typically query a database table for reports
      // For now, return a mock implementation
      return [];
    } catch (error) {
      logger.error('Failed to get report history', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Private helper methods

  private async getReportConfigs(): Promise<ReportConfig[]> {
    // This would typically query a database table for report configurations
    // For now, return default configurations
    const now = new Date();

    return [
      {
        id: 'default_daily',
        name: 'Daily Analytics Summary',
        description:
          'Snapshot of key operational metrics for daily monitoring.',
        type: 'daily',
        category: 'operational',
        recipients: ['admin@library.edu'],
        includeInsights: true,
        includeForecasts: false,
        includeHeatMaps: false,
        includeROI: false,
        includeBenchmarks: false,
        includeReadingPatterns: true,
        includeSpaceUtilization: false,
        format: 'html',
        is_active: true,
        schedule: '0 8 * * *',
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default_weekly',
        name: 'Weekly Analytics Report',
        description:
          'Comprehensive weekly performance review with forecasts and heat maps.',
        type: 'weekly',
        category: 'strategic',
        recipients: ['admin@library.edu', 'manager@library.edu'],
        includeInsights: true,
        includeForecasts: true,
        includeHeatMaps: true,
        includeROI: true,
        includeBenchmarks: true,
        includeReadingPatterns: true,
        includeSpaceUtilization: true,
        format: 'html',
        is_active: true,
        schedule: '0 9 * * MON',
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private async getAlertConfigs(): Promise<AlertConfig[]> {
    // This would typically query a database table for alert configurations
    // For now, return default configurations
    return [
      {
        id: 'high_usage_alert',
        name: 'High Usage Alert',
        type: 'usage_spike',
        threshold: 100,
        operators: 'greater_than',
        recipients: ['admin@library.edu'],
        is_active: true,
        cooldownPeriod: 30,
      },
      {
        id: 'resource_shortage_alert',
        name: 'Resource Shortage Alert',
        type: 'resource_shortage',
        threshold: 80,
        operators: 'greater_than',
        recipients: ['admin@library.edu'],
        is_active: true,
        cooldownPeriod: 15,
      },
    ];
  }

  private scheduleReport(config: ReportConfig, cronExpression: string): void {
    // Simple scheduling implementation - in production, use a proper cron library
    logger.info(
      `Scheduled report: ${config.name} with cron: ${cronExpression}`,
    );

    // For demo purposes, schedule for next execution based on type
    let delayMs: number;

    switch (config.type) {
      case 'daily':
        delayMs = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'weekly':
        delayMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'monthly':
        delayMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        delayMs = 24 * 60 * 60 * 1000; // Default to daily
    }

    const timeout = setTimeout(async () => {
      try {
        await this.generateReport(config);
        // Reschedule for next execution
        this.scheduleReport(config, cronExpression);
      } catch (error) {
        logger.error(`Scheduled report failed: ${config.name}`, {
          error: (error as Error).message,
        });
      }
    }, delayMs);

    this.activeReports.set(config.id, timeout);
  }

  private async getReportMetrics(
    filters?: ReportFilters,
  ): Promise<ReportMetrics> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalStudents, activeStudents, todayActivities, weekActivities] =
      await Promise.all([
        prisma.students.count(),
        prisma.students.count({ where: { is_active: true } }),
        prisma.student_activities.count({
          where: {
            start_time: { gte: todayStart },
            ...(filters?.activityType && {
              activity_type: filters.activityType,
            }),
          },
        }),
        prisma.student_activities.count({
          where: {
            start_time: { gte: weekStart },
            ...(filters?.activityType && {
              activity_type: filters.activityType,
            }),
          },
        }),
      ]);

    return {
      students: { total: totalStudents, active: activeStudents },
      activities: { today: todayActivities, week: weekActivities },
      generated_at: now.toISOString(),
    };
  }

  private generateReportSummary(
    insights: PredictiveInsight[],
    metrics: ReportMetrics,
    forecasts: ResourceForecast[],
  ): string {
    const highImpactInsights = insights.filter(i => i.impact === 'high');
    const avgConfidence =
      insights.reduce((sum, insight) => sum + insight.confidence, 0) /
      (insights.length || 1);

    return `
Analytics Report Summary
========================

Generated: ${new Date().toLocaleString()}

Key Metrics:
- Total Students: ${metrics.students?.total || 0}
- Active Students: ${metrics.students?.active || 0}
- Today's Activities: ${metrics.activities?.today || 0}
- Weekly Activities: ${metrics.activities?.week || 0}

Predictive Insights:
- Total Insights: ${insights.length}
- High Priority Items: ${highImpactInsights.length}
- Average Confidence: ${Math.round(avgConfidence * 100)}%

${
  forecasts.length > 0
    ? `
Resource Forecasts:
${forecasts
  .map(
    forecast =>
      `- ${forecast.resourceType}: ${Math.round(forecast.currentUtilization)}% → ${Math.round(
        forecast.predictedUtilization[
          forecast.predictedUtilization.length - 1
        ] || 0,
      )}%`,
  )
  .join('\n')}
`
    : ''
}

${
  highImpactInsights.length > 0
    ? `
High Priority Recommendations:
${highImpactInsights
  .map(
    (insight, index) =>
      `${index + 1}. ${insight.title}: ${insight.description}`,
  )
  .join('\n')}
`
    : ''
}

This report was automatically generated by the CLMS Analytics System.
    `.trim();
  }

  private generateEnhancedReportSummary(
    insights: PredictiveInsight[],
    metrics: ReportMetrics,
    forecasts: ResourceForecast[],
    advancedAnalytics?: AdvancedAnalyticsData,
  ): string {
    const highImpactInsights = insights.filter(i => i.impact === 'high');
    const avgConfidence =
      insights.reduce((sum, insight) => sum + insight.confidence, 0) /
      (insights.length || 1);

    let summary = `
Enhanced Analytics Report Summary
=================================

Generated: ${new Date().toLocaleString()}

Key Performance Indicators:
- Total Students: ${metrics.students.total}
- Active Students: ${metrics.students.active}
- Today's Activities: ${metrics.activities.today}
- Weekly Activities: ${metrics.activities.week}

Predictive Analytics:
- Total Insights: ${insights.length}
- High Priority Items: ${highImpactInsights.length}
- Average Confidence: ${Math.round(avgConfidence * 100)}%
`;

    if (advancedAnalytics?.roiAnalysis) {
      summary += `
Financial Performance:
- Total Investment: $${advancedAnalytics.roiAnalysis.totalInvestment.toLocaleString()}
- Total Value Generated: $${advancedAnalytics.roiAnalysis.totalValue.toLocaleString()}
- ROI: ${advancedAnalytics.roiAnalysis.roi.toFixed(1)}%
- Cost per Student: $${advancedAnalytics.roiAnalysis.costPerStudent.toFixed(2)}
- Value per Student: $${advancedAnalytics.roiAnalysis.valuePerStudent.toFixed(2)}
- Payback Period: ${advancedAnalytics.roiAnalysis.paybackPeriod.toFixed(1)} months
`;
    }

    const readingPatterns = advancedAnalytics?.readingPatterns ?? [];
    if (readingPatterns.length > 0) {
      const totalBooksRead = readingPatterns.reduce(
        (sum, pattern) => sum + pattern.totalBooksRead,
        0,
      );
      const activeReaders = readingPatterns.filter(
        p => p.readingFrequency === 'Daily' || p.readingFrequency === 'Weekly',
      ).length;

      summary += `
Reading Analytics:
- Total Books Read: ${totalBooksRead}
- Active Readers: ${activeReaders} of ${readingPatterns.length}
- Average Reading Streak: ${Math.round(readingPatterns.reduce((sum, p) => sum + p.readingStreak, 0) / readingPatterns.length)} days
`;
    }

    const spaceUtilization = advancedAnalytics?.spaceUtilization ?? [];
    if (spaceUtilization.length > 0) {
      const avgUtilization =
        spaceUtilization.reduce(
          (sum, space) => sum + space.utilizationRate,
          0,
        ) / spaceUtilization.length;

      summary += `
Space Utilization:
- Average Utilization Rate: ${avgUtilization.toFixed(1)}%
- Peak Areas: ${
        spaceUtilization
          .filter(s => s.utilizationRate > 70)
          .map(s => s.area)
          .join(', ') || 'None'
      }
- Underutilized Areas: ${
        spaceUtilization
          .filter(s => s.utilizationRate < 30)
          .map(s => s.area)
          .join(', ') || 'None'
      }
`;
    }

    const benchmarkData = advancedAnalytics?.benchmarks ?? [];
    if (benchmarkData.length > 0) {
      const aboveBenchmark = benchmarkData.filter(
        b => b.comparison === 'above',
      ).length;
      const belowBenchmark = benchmarkData.filter(
        b => b.comparison === 'below',
      ).length;

      summary += `
Industry Benchmarks:
- Above Industry Standards: ${aboveBenchmark} of ${benchmarkData.length} metrics
- Below Industry Standards: ${belowBenchmark} of ${benchmarkData.length} metrics
- Overall Performance: ${aboveBenchmark > belowBenchmark ? 'Excellent' : aboveBenchmark === belowBenchmark ? 'Average' : 'Needs Improvement'}
`;
    }

    if (forecasts.length > 0) {
      summary += `
Resource Forecasts:
${forecasts
  .map(
    forecast =>
      `- ${forecast.resourceType}: ${Math.round(forecast.currentUtilization)}% → ${Math.round(
        forecast.predictedUtilization[
          forecast.predictedUtilization.length - 1
        ] || 0,
      )}%`,
  )
  .join('\n')}
`;
    }

    if (highImpactInsights.length > 0) {
      summary += `
High Priority Recommendations:
${highImpactInsights
  .map(
    (insight, index) =>
      `${index + 1}. ${insight.title}: ${insight.description}`,
  )
  .join('\n')}
`;
    }

    summary += `

This enhanced report was automatically generated by the CLMS Advanced Analytics System.
`;

    return summary.trim();
  }

  private async generateReportFile(
    report: GeneratedReport,
    format: 'html' | 'pdf',
  ): Promise<string> {
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const fileName = `${report.name.replace(/\s+/g, '_')}_${report.id}.${format}`;
    const filePath = path.join(reportsDir, fileName);

    if (format === 'html') {
      const htmlContent = this.generateHTMLReport(report);
      await fs.writeFile(filePath, htmlContent, 'utf8');
    } else if (format === 'pdf') {
      // PDF generation would require a library like puppeteer
      // For now, create a placeholder
      await fs.writeFile(filePath, report.summary, 'utf8');
    }

    return filePath;
  }

  private async generateEnhancedReportFile(
    report: GeneratedReport,
    config: ReportConfig,
  ): Promise<string> {
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const fileName = `${report.name.replace(/\s+/g, '_')}_${report.id}.${config.format}`;
    const filePath = path.join(reportsDir, fileName);

    switch (config.format) {
      case 'json':
        await this.generateJSONReport(filePath, report);
        break;
      case 'csv':
        await this.generateCSVReport(filePath, report);
        break;
      case 'excel':
        await this.generateExcelReport(filePath, report);
        break;
      case 'html':
        const htmlContent = this.generateEnhancedHTMLReport(report, config);
        await fs.writeFile(filePath, htmlContent, 'utf8');
        break;
      case 'pdf':
        // PDF generation would require a library like puppeteer
        // For now, create a placeholder with the summary
        await fs.writeFile(filePath, report.summary, 'utf8');
        break;
      default:
        throw new Error(`Unsupported report format: ${config.format}`);
    }

    return filePath;
  }

  // Multi-format export methods
  private async generateJSONReport(
    filePath: string,
    data: GeneratedReport,
  ): Promise<void> {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf8');
  }

  private async generateCSVReport(
    filePath: string,
    data: GeneratedReport,
  ): Promise<void> {
    const csvData: Array<Record<string, unknown>> = [];

    // Extract tabular data from report
    if (data.sectionData) {
      Object.values(data.sectionData).forEach(section => {
        if (isTableSectionData(section)) {
          section.activities.forEach(activity => {
            csvData.push({
              timestamp: activity.start_time,
              student:
                `${activity.student?.firstName || ''} ${activity.student?.lastName || ''}`.trim(),
              grade: activity.student?.gradeLevel ?? '',
              activity: activity.activity_type,
              equipment: activity.equipment?.name ?? '',
              duration: activity.duration ?? '',
            });
          });
        }
      });
    }

    // Add advanced analytics data
    if (data.advancedAnalytics) {
      const { advancedAnalytics } = data;

      // Reading patterns
      if (advancedAnalytics.readingPatterns) {
        advancedAnalytics.readingPatterns.forEach(pattern => {
          csvData.push({
            category: 'Reading Pattern',
            student: pattern.studentName,
            grade: pattern.gradeLevel,
            books_read: pattern.totalBooksRead,
            reading_frequency: pattern.readingFrequency,
            reading_streak: pattern.readingStreak,
            last_active: pattern.lastActive,
          });
        });
      }

      // Space utilization
      if (advancedAnalytics.spaceUtilization) {
        advancedAnalytics.spaceUtilization.forEach(space => {
          csvData.push({
            category: 'Space Utilization',
            area: space.area,
            capacity: space.totalCapacity,
            current_occupancy: space.currentOccupancy,
            utilization_rate: `${space.utilizationRate.toFixed(1)}%`,
            peak_hours: space.peakHours.join(', '),
          });
        });
      }
    }

    // Convert to CSV using XLSX
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    await fs.writeFile(filePath, csv, 'utf8');
  }

  private async generateExcelReport(
    filePath: string,
    data: GeneratedReport,
  ): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData: Array<Array<string | number>> = [
      ['Report Title', data.name],
      ['Generated', new Date(data.generated_at).toLocaleString()],
      ['Type', data.type],
      ['Status', data.status],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // KPI sheet
    if (data.sectionData) {
      Object.entries(data.sectionData).forEach(([sectionId, section]) => {
        if (isKPISectionData(section)) {
          const kpiData = section.kpis.map(kpi => [
            kpi.name,
            kpi.value,
            kpi.unit ?? '',
            kpi.status ?? '',
            kpi.target ?? '',
          ]);
          const kpiSheet = XLSX.utils.aoa_to_sheet([
            ['KPI', 'Value', 'Unit', 'Status', 'Target'],
            ...kpiData,
          ]);
          XLSX.utils.book_append_sheet(workbook, kpiSheet, `KPIs_${sectionId}`);
        }
      });
    }

    // Advanced Analytics sheets
    if (data.advancedAnalytics) {
      const { advancedAnalytics } = data;

      // ROI Analysis sheet
      if (advancedAnalytics.roiAnalysis) {
        const roiData: Array<Array<string | number>> = [
          ['Metric', 'Value'],
          ['Total Investment', advancedAnalytics.roiAnalysis.totalInvestment],
          ['Total Value Generated', advancedAnalytics.roiAnalysis.totalValue],
          ['ROI %', advancedAnalytics.roiAnalysis.roi],
          ['Cost per Student', advancedAnalytics.roiAnalysis.costPerStudent],
          ['Value per Student', advancedAnalytics.roiAnalysis.valuePerStudent],
          [
            'Payback Period (months)',
            advancedAnalytics.roiAnalysis.paybackPeriod,
          ],
          ['Utilization Rate %', advancedAnalytics.roiAnalysis.utilizationRate],
          [
            'Operational Efficiency %',
            advancedAnalytics.roiAnalysis.operationalEfficiency,
          ],
        ];

        // Add breakdown
        roiData.push([''], ['Cost Breakdown']);
        advancedAnalytics.roiAnalysis.breakdown.forEach(item => {
          roiData.push([item.category, item.cost, item.value, `${item.roi}%`]);
        });

        const roiSheet = XLSX.utils.aoa_to_sheet(roiData);
        XLSX.utils.book_append_sheet(workbook, roiSheet, 'ROI Analysis');
      }

      // Reading Patterns sheet
      if (advancedAnalytics.readingPatterns?.length > 0) {
        const readingData: Array<Array<string | number>> = [
          [
            'Student Name',
            'Grade Level',
            'Books Read',
            'Reading Frequency',
            'Reading Trend',
            'Reading Streak',
            'Book Diversity',
            'Last Active',
          ],
        ];
        advancedAnalytics.readingPatterns.forEach(pattern => {
          readingData.push([
            pattern.studentName,
            pattern.gradeLevel,
            pattern.totalBooksRead,
            pattern.readingFrequency,
            pattern.readingTrend,
            pattern.readingStreak,
            pattern.bookDiversity,
            new Date(pattern.lastActive).toLocaleDateString(),
          ]);
        });
        const readingSheet = XLSX.utils.aoa_to_sheet(readingData);
        XLSX.utils.book_append_sheet(
          workbook,
          readingSheet,
          'Reading Patterns',
        );
      }

      // Space Utilization sheet
      if (advancedAnalytics.spaceUtilization?.length > 0) {
        const spaceData: Array<Array<string | number>> = [
          [
            'Area',
            'Total Capacity',
            'Current Occupancy',
            'Utilization Rate %',
            'Average Stay Duration',
            'Peak Hours',
          ],
        ];
        advancedAnalytics.spaceUtilization.forEach(space => {
          spaceData.push([
            space.area,
            space.totalCapacity,
            space.currentOccupancy,
            space.utilizationRate.toFixed(1),
            `${space.averageStayDuration} min`,
            space.peakHours.join(', '),
          ]);
        });
        const spaceSheet = XLSX.utils.aoa_to_sheet(spaceData);
        XLSX.utils.book_append_sheet(workbook, spaceSheet, 'Space Utilization');
      }

      // Benchmarks sheet
      if (advancedAnalytics.benchmarks?.length > 0) {
        const benchmarkData: Array<Array<string | number>> = [
          [
            'Metric',
            'Current Value',
            'Benchmark Value',
            'Percentile',
            'Comparison',
            'Industry',
            'Trend',
          ],
        ];
        advancedAnalytics.benchmarks.forEach(benchmark => {
          benchmarkData.push([
            benchmark.metric,
            benchmark.currentValue,
            benchmark.benchmarkValue,
            `${benchmark.percentile}%`,
            benchmark.comparison,
            benchmark.industry,
            benchmark.trend,
          ]);
        });
        const benchmarkSheet = XLSX.utils.aoa_to_sheet(benchmarkData);
        XLSX.utils.book_append_sheet(workbook, benchmarkSheet, 'Benchmarks');
      }
    }

    // Activities sheet
    if (data.sectionData) {
      Object.values(data.sectionData).forEach(section => {
        if (isTableSectionData(section)) {
          const activityData: Array<Array<string | number>> = [
            [
              'Timestamp',
              'Student Name',
              'Grade',
              'Activity Type',
              'Equipment',
              'Duration (min)',
              'Notes',
            ],
          ];
          section.activities.forEach(activity => {
            activityData.push([
              new Date(activity.start_time).toLocaleString(),
              `${activity.student?.firstName || ''} ${activity.student?.lastName || ''}`.trim(),
              activity.student?.gradeLevel || '',
              activity.activity_type,
              activity.equipment?.name || '',
              String(activity.duration ?? ''),
              activity.notes || '',
            ]);
          });
          const activitySheet = XLSX.utils.aoa_to_sheet(activityData);
          XLSX.utils.book_append_sheet(workbook, activitySheet, 'Activities');
        }
      });
    }

    XLSX.writeFile(workbook, filePath);
  }

  private renderSectionHtml(
    sectionConfig: ReportSection,
    data: SectionData,
  ): string {
    const title = sectionConfig.title ?? 'Section Overview';
    let content = '';

    switch (sectionConfig.type) {
      case 'kpi':
        if (isKPISectionData(data)) {
          const cards = data.kpis
            .map(
              kpi => `
                        <div class="metric-card">
                            <h3>${kpi.name}</h3>
                            <div class="value">${kpi.value}${kpi.unit ?? ''}</div>
                            ${
                              kpi.target
                                ? `<div class="unit">Target: ${kpi.target}${kpi.unit ?? ''}</div>`
                                : ''
                            }
                            ${
                              kpi.status
                                ? `<span class="badge ${kpi.status}">${kpi.status.toUpperCase()}</span>`
                                : ''
                            }
                        </div>
                    `,
            )
            .join('');
          content = `
                    <div class="metrics-grid">
                        ${cards}
                    </div>
                `;
        }
        break;
      case 'table':
        if (isTableSectionData(data)) {
          const rows = data.activities
            .slice(0, 20)
            .map(
              activity => `
                        <tr>
                            <td>${new Date(activity.start_time).toLocaleString()}</td>
                            <td>${activity.student?.firstName ?? ''} ${activity.student?.lastName ?? ''}</td>
                            <td>${activity.student?.gradeLevel ?? ''}</td>
                            <td>${activity.activity_type}</td>
                            <td>${activity.equipment?.name ?? 'N/A'}</td>
                            <td>${activity.duration ? `${activity.duration} min` : 'N/A'}</td>
                        </tr>
                    `,
            )
            .join('');
          content = `
                    <h3>Recent Activities</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Student</th>
                                <th>Grade</th>
                                <th>Activity</th>
                                <th>Equipment</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                `;
        }
        break;
      case 'overview':
        if (isOverviewSectionData(data)) {
          content = this.renderOverviewMetrics(data);
        }
        break;
      case 'chart':
        if (isChartSectionData(data)) {
          content = this.renderChartSummary(data);
        }
        break;
      case 'heatmap':
        if (isHeatMapSectionData(data)) {
          content = this.renderHeatMapSummary(data);
        }
        break;
      case 'forecast':
        if (isForecastSectionData(data)) {
          content = this.renderForecastSummary(data);
        }
        break;
      default:
        break;
    }

    if (!content) {
      content = '<p>No data available for this section.</p>';
    }

    return `
                <div class="section">
                    <h2>${title}</h2>
                    ${content}
                </div>
            `;
  }

  private renderOverviewMetrics(data: OverviewSectionData): string {
    const metrics = [
      { label: 'Total Students', value: data.totalStudents.toLocaleString() },
      { label: 'Active Students', value: data.activeStudents.toLocaleString() },
      {
        label: 'Total Activities',
        value: data.totalActivities.toLocaleString(),
      },
      { label: 'Total Books', value: data.totalBooks.toLocaleString() },
      { label: 'Total Equipment', value: data.totalEquipment.toLocaleString() },
      {
        label: 'Student Engagement Rate',
        value: `${data.studentEngagementRate.toFixed(1)}%`,
      },
    ];

    const cards = metrics
      .map(
        metric => `
                    <div class="metric-card">
                        <h3>${metric.label}</h3>
                        <div class="value">${metric.value}</div>
                    </div>
                `,
      )
      .join('');

    return `
                <div class="metrics-grid">
                    ${cards}
                </div>
                <p>Period: ${data.dateRange.start.toLocaleDateString()} – ${data.dateRange.end.toLocaleDateString()}</p>
            `;
  }

  private renderChartSummary(data: ChartSectionData): string {
    const items = data.chartData
      .slice(0, 10)
      .map(
        point => `
                <li>${point.date}: ${point.students} students, ${point.computers} computer sessions, ${point.gaming} gaming sessions</li>
            `,
      )
      .join('');

    return `
                <div class="chart-placeholder">
                    Chart data available for ${data.chartData.length} data points.
                </div>
                <ul>${items}</ul>
            `;
  }

  private renderHeatMapSummary(data: HeatMapSectionData): string {
    const rows = data.heatMapData
      .slice(0, 10)
      .map(
        entry => `
                <tr>
                    <td>${entry.dayOfWeek}</td>
                    <td>${entry.hour}:00</td>
                    <td>${entry.intensity.toFixed(2)}</td>
                    <td>${entry.activityType ?? 'N/A'}</td>
                </tr>
            `,
      )
      .join('');

    return `
                <h3>Heat Map Highlights</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Hour</th>
                            <th>Intensity</th>
                            <th>Activity Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
  }

  private renderForecastSummary(data: ForecastSectionData): string {
    const forecastItems = data.forecasts
      .map(
        forecast => `
                <li>
                    <strong>${forecast.resourceType}:</strong>
                    ${Math.round(forecast.currentUtilization)}% → ${Math.round(
                      forecast.predictedUtilization[
                        forecast.predictedUtilization.length - 1
                      ] || 0,
                    )}% (Risk: ${forecast.riskLevel})
                </li>
            `,
      )
      .join('');

    const seasonalItems = data.seasonalPatterns
      .map(
        pattern => `
                <li>${pattern.period} pattern: ${pattern.trend} (seasonality ${(pattern.seasonality * 100).toFixed(0)}%)</li>
            `,
      )
      .join('');

    return `
                <h3>Resource Forecasts</h3>
                <ul>${forecastItems}</ul>
                <h3>Seasonal Patterns</h3>
                <ul>${seasonalItems}</ul>
            `;
  }

  private renderAdvancedAnalyticsSection(
    analytics: AdvancedAnalyticsData,
  ): string {
    const roiSection = analytics.roiAnalysis
      ? `
                <h3>Return on Investment Analysis</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Total Investment</h3>
                        <div class="value">$${analytics.roiAnalysis.totalInvestment.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Total Value</h3>
                        <div class="value">$${analytics.roiAnalysis.totalValue.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <h3>ROI</h3>
                        <div class="value">${analytics.roiAnalysis.roi.toFixed(1)}%</div>
                        <div class="unit">Annual Return</div>
                    </div>
                    <div class="metric-card">
                        <h3>Cost per Student</h3>
                        <div class="value">$${analytics.roiAnalysis.costPerStudent.toFixed(2)}</div>
                    </div>
                </div>
            `
      : '';

    const readingSection = analytics.readingPatterns.length
      ? `
                <h3>Student Reading Patterns</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Grade Level</th>
                            <th>Books Read</th>
                            <th>Reading Frequency</th>
                            <th>Reading Streak</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analytics.readingPatterns
                          .slice(0, 10)
                          .map(
                            pattern => `
                                <tr>
                                    <td>${pattern.studentName}</td>
                                    <td>${pattern.gradeLevel}</td>
                                    <td>${pattern.totalBooksRead}</td>
                                    <td>${pattern.readingFrequency}</td>
                                    <td>${pattern.readingStreak} days</td>
                                </tr>
                            `,
                          )
                          .join('')}
                    </tbody>
                </table>
            `
      : '';

    const spaceSection = analytics.spaceUtilization.length
      ? `
                <h3>Space Utilization Analysis</h3>
                <div class="metrics-grid">
                    ${analytics.spaceUtilization
                      .map(
                        space => `
                            <div class="metric-card">
                                <h3>${space.area}</h3>
                                <div class="value">${space.utilizationRate.toFixed(1)}%</div>
                                <div class="unit">Utilization Rate</div>
                                <div style="margin-top: 10px; font-size: 0.9rem; color: #64748b;">
                                    Capacity: ${space.currentOccupancy}/${space.totalCapacity}<br>
                                    Peak Hours: ${space.peakHours.join(', ')}
                                </div>
                            </div>
                        `,
                      )
                      .join('')}
                </div>
            `
      : '';

    const benchmarkSection = analytics.benchmarks.length
      ? `
                <h3>Industry Benchmarking</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Current Value</th>
                            <th>Benchmark</th>
                            <th>Percentile</th>
                            <th>Comparison</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analytics.benchmarks
                          .map(
                            benchmark => `
                                <tr>
                                    <td>${benchmark.metric}</td>
                                    <td>${benchmark.currentValue.toFixed(2)}</td>
                                    <td>${benchmark.benchmarkValue.toFixed(2)}</td>
                                    <td>${benchmark.percentile}%</td>
                                    <td><span class="badge ${
                                      benchmark.comparison === 'above'
                                        ? 'good'
                                        : benchmark.comparison === 'below'
                                          ? 'critical'
                                          : 'warning'
                                    }">${benchmark.comparison.toUpperCase()}</span></td>
                                </tr>
                            `,
                          )
                          .join('')}
                    </tbody>
                </table>
            `
      : '';

    return [roiSection, readingSection, spaceSection, benchmarkSection]
      .filter(Boolean)
      .join('\n');
  }

  private renderInsightsSection(insights: PredictiveInsight[]): string {
    if (insights.length === 0) {
      return '';
    }

    const insightCards = insights
      .map(
        insight => `
                    <div class="insight ${
                      insight.impact === 'high' ? 'high-impact' : ''
                    }">
                        <h3>${insight.title}</h3>
                        <p><strong>Type:</strong> ${insight.type.replace('_', ' ')}</p>
                        <p><strong>Impact:</strong> ${insight.impact}</p>
                        <p><strong>Confidence:</strong> ${Math.round(insight.confidence * 100)}%</p>
                        <p>${insight.description}</p>
                        ${
                          insight.recommendations.length > 0
                            ? `
                                <h4>Recommendations:</h4>
                                <ul>
                                    ${insight.recommendations
                                      .map(rec => `<li>${rec}</li>`)
                                      .join('')}
                                </ul>
                            `
                            : ''
                        }
                    </div>
                `,
      )
      .join('');

    return `
                <div class="section">
                    <h2>Predictive Insights</h2>
                    ${insightCards}
                </div>
            `;
  }

  private generateEnhancedHTMLReport(
    report: GeneratedReport,
    config: ReportConfig,
  ): string {
    const brandColors = config.branding?.colors || {
      primary: '#2563eb',
      secondary: '#64748b',
    };

    const sectionsHtml =
      config.sections && report.sectionData
        ? config.sections
            .filter(section => section.enabled)
            .map(section => {
              const sectionContent = report.sectionData
                ? report.sectionData[section.id]
                : undefined;
              if (!sectionContent) {
                return '';
              }
              return this.renderSectionHtml(section, sectionContent);
            })
            .join('')
        : '';

    const advancedAnalyticsHtml = report.advancedAnalytics
      ? `
                <div class="section">
                    <h2>Advanced Analytics</h2>
                    ${this.renderAdvancedAnalyticsSection(report.advancedAnalytics)}
                </div>
            `
      : '';

    const insightsHtml = this.renderInsightsSection(report.insights);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            background-color: #f8fafc;
            color: #1e293b;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .header {
            background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary});
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .header h1 { margin: 0; font-size: 2.5rem; font-weight: 700; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 1.1rem; }
        .content { padding: 30px; }
        .section { margin-bottom: 40px; }
        .section h2 { color: ${brandColors.primary}; border-bottom: 2px solid ${brandColors.primary}; padding-bottom: 10px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid ${brandColors.primary};
        }
        .metric-card h3 { margin: 0 0 10px 0; color: #475569; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .metric-card .value { font-size: 2rem; font-weight: 700; color: ${brandColors.primary}; }
        .metric-card .unit { font-size: 0.9rem; color: #64748b; }
        .insight {
            background: #f0f9ff;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #0ea5e9;
        }
        .insight.high-impact {
            background: #fef2f2;
            border-left-color: #ef4444;
        }
        .insight h3 { margin: 0 0 10px 0; color: #1e40af; }
        .insight.high-impact h3 { color: #991b1b; }
        .insight p { margin: 5px 0; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .table th { background-color: #f8fafc; font-weight: 600; color: #374151; }
        .table tr:hover { background-color: #f9fafb; }
        .chart-placeholder {
            background: #f3f4f6;
            border: 2px dashed #d1d5db;
            height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            border-radius: 8px;
            margin: 20px 0;
        }
        .footer {
            background: #f8fafc;
            padding: 20px 30px;
            border-top: 1px solid #e2e8f0;
            border-radius: 0 0 8px 8px;
            text-align: center;
            color: #64748b;
            font-size: 0.9rem;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .badge.good { background: #dcfce7; color: #166534; }
        .badge.warning { background: #fef3c7; color: #92400e; }
        .badge.critical { background: #fee2e2; color: #991b1b; }
        @media (max-width: 768px) {
            .metrics-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 2rem; }
            .content { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${report.name}</h1>
            <p>Generated: ${new Date(report.generated_at).toLocaleString()} | Status: ${report.status}</p>
            ${config.description ? `<p>${config.description}</p>` : ''}
        </div>

        <div class="content">
            <div class="section">
                <h2>Executive Summary</h2>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; white-space: pre-wrap;">${report.summary}</div>
            </div>

      ${sectionsHtml}
      ${advancedAnalyticsHtml}
      ${insightsHtml}
        </div>

        <div class="footer">
            <p>This report was automatically generated by the CLMS Advanced Analytics System.</p>
            <p>Report ID: ${report.id} | Generated: ${new Date(report.generated_at).toLocaleString()}</p>
            ${config.branding?.footer ? `<p>${config.branding.footer}</p>` : ''}
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  private generateHTMLReport(report: GeneratedReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .insight { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #007cba; }
        .high-impact { border-left-color: #d32f2f; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e3f2fd; border-radius: 3px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.name}</h1>
        <p>Generated: ${new Date(report.generated_at).toLocaleString()}</p>
        <p>Status: ${report.status}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px;">${report.summary}</pre>
    </div>

    <div class="section">
        <h2>Key Metrics</h2>
        <div class="metric"><strong>Total Students:</strong> ${report.metrics.students.total}</div>
        <div class="metric"><strong>Active Students:</strong> ${report.metrics.students.active}</div>
        <div class="metric"><strong>Today's Activities:</strong> ${report.metrics.activities.today}</div>
        <div class="metric"><strong>Weekly Activities:</strong> ${report.metrics.activities.week}</div>
    </div>

    ${
      report.insights.length > 0
        ? `
    <div class="section">
        <h2>Predictive Insights</h2>
        ${report.insights
          .map(
            insight => `
            <div class="insight ${insight.impact === 'high' ? 'high-impact' : ''}">
                <h3>${insight.title}</h3>
                <p><strong>Type:</strong> ${insight.type}</p>
                <p><strong>Impact:</strong> ${insight.impact}</p>
                <p><strong>Confidence:</strong> ${Math.round(insight.confidence * 100)}%</p>
                <p>${insight.description}</p>
                ${
                  insight.recommendations.length > 0
                    ? `
                    <h4>Recommendations:</h4>
                    <ul>
                        ${insight.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                `
                    : ''
                }
            </div>
        `,
          )
          .join('')}
    </div>
    `
        : ''
    }

    <div class="footer">
        <p>This report was automatically generated by the CLMS Analytics System.</p>
        <p>Report ID: ${report.id}</p>
    </div>
</body>
</html>
    `.trim();
  }

  private async saveReportToDatabase(report: GeneratedReport): Promise<void> {
    // This would typically save to a database table
    // For now, just log the report
    logger.info(`Report saved to database: ${report.id}`);
  }

  private async saveReportConfig(config: ReportConfig): Promise<void> {
    // This would typically save to a database table
    // For now, just log the configuration
    logger.info(`Report configuration saved: ${config.id}`);
  }

  private async saveAlertConfig(config: AlertConfig): Promise<void> {
    // This would typically save to a database table
    // For now, just log the configuration
    logger.info(`Alert configuration saved: ${config.id}`);
  }

  private async sendReportEmail(
    report: GeneratedReport,
    config: ReportConfig,
  ): Promise<void> {
    try {
      const emailContent = {
        from: process.env.EMAIL_FROM || 'noreply@clms.edu',
        to: config.recipients.join(', '),
        subject: `${report.name} - ${new Date(report.generated_at).toLocaleDateString()}`,
        text: report.summary,
        html:
          config.format === 'html'
            ? await fs.readFile(report.filePath || '', 'utf8')
            : undefined,
        attachments: report.filePath
          ? [
              {
                filename: `${report.name}.html`,
                path: report.filePath,
              },
            ]
          : undefined,
      };

      await transporter.sendMail(emailContent);
      logger.info(
        `Report email sent: ${report.name} to ${config.recipients.join(', ')}`,
      );
    } catch (error) {
      logger.error(`Failed to send report email: ${report.name}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async evaluateAlertCondition(
    alertConfig: AlertConfig,
  ): Promise<boolean> {
    try {
      // Validate alertConfig before proceeding
      if (!alertConfig || typeof alertConfig !== 'object') {
        logger.error('Invalid alert configuration provided');
        return false;
      }

      let currentValue: number;

      switch (alertConfig.type) {
        case 'usage_spike':
          // Get today's activity count
          const todayActivities = await prisma.student_activities.count({
            where: {
              start_time: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          });
          currentValue = todayActivities;
          break;

        case 'resource_shortage':
          // Get equipment utilization rate
          const totalEquipment = await prisma.equipment.count();
          const inUseEquipment = await prisma.equipment.count({
            where: { status: 'IN_USE' },
          });
          currentValue =
            totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;
          break;

        case 'system_health':
          // Get memory usage percentage
          const memoryUsage = process.memoryUsage();
          currentValue = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
          break;

        default:
          return false;
      }

      switch (alertConfig.operators) {
        case 'greater_than':
          return currentValue > alertConfig.threshold;
        case 'less_than':
          return currentValue < alertConfig.threshold;
        case 'equals':
          return Math.abs(currentValue - alertConfig.threshold) < 0.01;
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Failed to evaluate alert condition: ${alertConfig.name}`, {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private async triggerAlert(alertConfig: AlertConfig): Promise<void> {
    try {
      logger.info(`Triggering alert: ${alertConfig.name}`);

      const alertData = await this.getAlertData(alertConfig);
      const emailContent = {
        from: process.env.EMAIL_FROM || 'noreply@clms.edu',
        to: alertConfig.recipients.join(', '),
        subject: `🚨 Alert: ${alertConfig.name}`,
        html: this.generateAlertEmail(alertConfig, alertData),
      };

      await transporter.sendMail(emailContent);
      logger.info(
        `Alert email sent: ${alertConfig.name} to ${alertConfig.recipients.join(', ')}`,
      );
    } catch (error) {
      logger.error(`Failed to trigger alert: ${alertConfig.name}`, {
        error: (error as Error).message,
      });
    }
  }

  private async getAlertData(alertConfig: AlertConfig): Promise<AlertData> {
    const now = new Date();

    switch (alertConfig.type) {
      case 'usage_spike':
        const todayActivities = await prisma.student_activities.count({
          where: {
            start_time: { gte: new Date(now.setHours(0, 0, 0, 0)) },
          },
        });
        return {
          type: 'usage_spike',
          current: todayActivities,
          threshold: alertConfig.threshold,
        };

      case 'resource_shortage':
        const totalEquipment = await prisma.equipment.count();
        const inUseEquipment = await prisma.equipment.count({
          where: { status: 'IN_USE' },
        });
        const utilization =
          totalEquipment > 0 ? (inUseEquipment / totalEquipment) * 100 : 0;
        return {
          type: 'resource_shortage',
          current: utilization,
          threshold: alertConfig.threshold,
          inUse: inUseEquipment,
          total: totalEquipment,
        };

      case 'system_health':
        const memoryUsage = process.memoryUsage();
        const memoryPercent =
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        return {
          type: 'system_health',
          current: memoryPercent,
          threshold: alertConfig.threshold,
          memoryUsage,
        };

      default:
        return { type: 'unknown' };
    }
  }

  private generateAlertEmail(
    alertConfig: AlertConfig,
    alertData: AlertData,
  ): string {
    const currentValue =
      'current' in alertData && typeof alertData.current === 'number'
        ? alertData.current
        : 'N/A';

    const resourceDetails =
      alertData.type === 'resource_shortage'
        ? `
            <p><strong>Equipment In Use:</strong> ${alertData.inUse} / ${alertData.total}</p>
        `
        : '';

    const memoryDetails =
      alertData.type === 'system_health'
        ? `
            <p><strong>Memory Usage:</strong> ${Math.round(alertData.memoryUsage.heapUsed / 1024 / 1024)} MB / ${Math.round(alertData.memoryUsage.heapTotal / 1024 / 1024)} MB</p>
        `
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Alert: ${alertConfig.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .alert { background: #ffebee; border: 1px solid #f44336; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .data { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="alert">
        <h1>🚨 Alert: ${alertConfig.name}</h1>
        <p><strong>Triggered:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Type:</strong> ${alertConfig.type.replace('_', ' ')}</p>
    </div>

    <div class="data">
        <h2>Alert Details</h2>
    <p><strong>Current Value:</strong> ${currentValue}</p>
        <p><strong>Threshold:</strong> ${alertConfig.threshold}</p>
        <p><strong>Condition:</strong> ${alertConfig.operators.replace('_', ' ')} ${alertConfig.threshold}</p>

    ${resourceDetails}

    ${memoryDetails}
    </div>

    <div class="data">
        <h2>Recommended Actions</h2>
        ${this.getAlertRecommendations(alertConfig.type)}
    </div>

    <div class="footer">
        <p>This alert was automatically generated by the CLMS Monitoring System.</p>
        <p>Alert ID: ${alertConfig.id}</p>
    </div>
</body>
</html>
    `.trim();
  }

  private getAlertRecommendations(alertType: string): string {
    switch (alertType) {
      case 'usage_spike':
        return `
            <ul>
                <li>Check if additional staff resources are needed</li>
                <li>Verify all equipment is operational</li>
                <li>Review if this is expected usage or unusual activity</li>
                <li>Consider temporary access controls if resources are limited</li>
            </ul>
        `;

      case 'resource_shortage':
        return `
            <ul>
                <li>Check for equipment that may be stuck in 'in-use' status</li>
                <li>Review if maintenance is needed on any equipment</li>
                <li>Consider implementing time limits if resources are overutilized</li>
                <li>Communicate availability to users</li>
            </ul>
        `;

      case 'system_health':
        return `
            <ul>
                <li>Check system logs for unusual activity</li>
                <li>Restart services if necessary</li>
                <li>Monitor database connections</li>
                <li>Contact system administrator if issues persist</li>
            </ul>
        `;

      default:
        return '<p>Review system status and investigate the trigger condition.</p>';
    }
  }

  /**
   * Clean up scheduled reports
   */
  async cleanup(): Promise<void> {
    for (const [, timeout] of this.activeReports) {
      clearTimeout(timeout);
    }
    this.activeReports.clear();
    this.alertCooldowns.clear();
  }
}

export const reportingService = new ReportingService();
