import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Zap,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Play,
  Pause,
  FileText,
  BarChart3,
  Monitor,
  Gauge,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';
import type {
  PerformanceReport,
  ComponentPerformance,
} from '@/services/performanceMonitoringService';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  target?: number;
  actual?: number;
  icon: React.ReactNode;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  target,
  actual,
  icon,
  color = 'text-blue-600',
}) => {
  const percentage = target && actual ? (actual / target) * 100 : null;
  const trendColor =
    trend === 'up'
      ? 'text-red-600'
      : trend === 'down'
        ? 'text-green-600'
        : 'text-gray-600';
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={color}>{icon}</div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <p className="text-2xl font-bold">
                {value}
                {unit && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {unit}
                  </span>
                )}
              </p>
            </div>
          </div>
          {trend && (
            <div className={`flex items-center space-x-1 ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
            </div>
          )}
        </div>
        {percentage !== null && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Performance</span>
              <span>{percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface PerformanceGradeProps {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
}

const PerformanceGrade: React.FC<PerformanceGradeProps> = ({
  grade,
  score,
}) => {
  const gradeColors = {
    A: 'text-green-600 bg-green-50',
    B: 'text-blue-600 bg-blue-50',
    C: 'text-yellow-600 bg-yellow-50',
    D: 'text-orange-600 bg-orange-50',
    F: 'text-red-600 bg-red-50',
  };

  const gradeIcons = {
    A: CheckCircle,
    B: CheckCircle,
    C: AlertTriangle,
    D: AlertTriangle,
    F: AlertTriangle,
  };

  const Icon = gradeIcons[grade];

  return (
    <div className="flex items-center space-x-4">
      <div className={`p-3 rounded-full ${gradeColors[grade]}`}>
        <Icon className="h-8 w-8" />
      </div>
      <div>
        <div className="text-3xl font-bold">{grade}</div>
        <div className="text-sm text-muted-foreground">
          Score: {score.toFixed(1)}/100
        </div>
      </div>
    </div>
  );
};

const PerformanceMonitor: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentReport, setCurrentReport] = useState<PerformanceReport | null>(
    null
  );
  const [componentMetrics, setComponentMetrics] = useState<
    ComponentPerformance[]
  >([]);
  const [insights, setInsights] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Load existing data
    setComponentMetrics(performanceMonitoringService.getComponentMetrics());

    const latestReport = performanceMonitoringService.getLatestReport();
    if (latestReport) {
      setCurrentReport(latestReport);
    }

    // Get insights
    setInsights(performanceMonitoringService.getPerformanceInsights());

    // Set up monitoring status
    setIsMonitoring(true);
  }, []);

  const startMonitoring = useCallback(() => {
    performanceMonitoringService.startMonitoring();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    performanceMonitoringService.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const generateReport = useCallback(() => {
    const report = performanceMonitoringService.generateReport();
    setCurrentReport(report);
    setInsights(performanceMonitoringService.getPerformanceInsights());
  }, []);

  const exportData = useCallback(() => {
    const data = performanceMonitoringService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const runLighthouseAudit = useCallback(async () => {
    try {
      // This would require Lighthouse to be available
      // For now, we'll simulate it
      console.log('Running Lighthouse audit...');
      // const result = await performanceMonitoringService.runLighthouseAudit();
    } catch (error) {
      console.error('Lighthouse audit failed:', error);
    }
  }, []);

  // Format time values
  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format memory values
  const formatMemory = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    if (mb < 1024) {
      return `${mb.toFixed(1)}MB`;
    }
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  if (!currentReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Generating performance report...
          </p>
          <Button onClick={generateReport} className="mt-4">
            Generate Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Performance Monitor
          </h2>
          <p className="text-muted-foreground">
            Real-time performance monitoring and analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isMonitoring ? 'destructive' : 'default'}
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
          >
            {isMonitoring ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Monitoring
              </>
            )}
          </Button>
          <Button onClick={generateReport} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Performance Grade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <PerformanceGrade
              grade={currentReport.grade}
              score={currentReport.score}
            />
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="text-sm">
                {new Date(currentReport.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Largest Contentful Paint"
              value={formatTime(currentReport.metrics.lcp)}
              icon={<Target className="h-5 w-5" />}
              target={2500}
              actual={currentReport.metrics.lcp}
              color={
                currentReport.metrics.lcp < 2500
                  ? 'text-green-600'
                  : 'text-red-600'
              }
            />
            <MetricCard
              title="First Input Delay"
              value={formatTime(currentReport.metrics.fid)}
              icon={<Zap className="h-5 w-5" />}
              target={100}
              actual={currentReport.metrics.fid}
              color={
                currentReport.metrics.fid < 100
                  ? 'text-green-600'
                  : 'text-red-600'
              }
            />
            <MetricCard
              title="Cumulative Layout Shift"
              value={currentReport.metrics.cls.toFixed(3)}
              icon={<Activity className="h-5 w-5" />}
              target={0.1}
              actual={currentReport.metrics.cls}
              color={
                currentReport.metrics.cls < 0.1
                  ? 'text-green-600'
                  : 'text-red-600'
              }
            />
            <MetricCard
              title="Memory Usage"
              value={formatMemory(
                currentReport.metrics.memoryUsage * 1024 * 1024
              )}
              icon={<Database className="h-5 w-5" />}
              target={50 * 1024 * 1024}
              actual={currentReport.metrics.memoryUsage * 1024 * 1024}
              color={
                currentReport.metrics.memoryUsage < 50
                  ? 'text-green-600'
                  : 'text-orange-600'
              }
            />
          </div>

          {/* Performance Trends */}
          {insights && insights.trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Trends
                </CardTitle>
                <CardDescription>Performance metrics over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={insights.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString()
                      }
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleString()
                      }
                      formatter={(value: number, name: string) => [
                        name === 'score'
                          ? `${value.toFixed(1)}`
                          : formatTime(value),
                        name === 'score' ? 'Score' : name.toUpperCase(),
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Performance Score"
                    />
                    <Line
                      type="monotone"
                      dataKey="lcp"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="LCP"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Navigation Timing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Navigation Timing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>DOM Content Loaded</span>
                  <span className="font-mono">
                    {formatTime(currentReport.metrics.domContentLoaded)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Load Complete</span>
                  <span className="font-mono">
                    {formatTime(currentReport.metrics.loadComplete)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time to First Byte</span>
                  <span className="font-mono">
                    {formatTime(currentReport.metrics.ttfb)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>First Contentful Paint</span>
                  <span className="font-mono">
                    {formatTime(currentReport.metrics.fcp)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Resource Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Resource Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Resource Count</span>
                  <span className="font-mono">
                    {currentReport.metrics.resourceCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Size</span>
                  <span className="font-mono">
                    {formatMemory(currentReport.metrics.totalResourceSize)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Transfer Size</span>
                  <span className="font-mono">
                    {formatMemory(currentReport.metrics.totalTransferSize)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>API Response Time</span>
                  <span className="font-mono">
                    {formatTime(currentReport.metrics.apiResponseTime)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-6">
          {componentMetrics.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Component Performance
                </CardTitle>
                <CardDescription>
                  Performance metrics for React components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {componentMetrics
                    .sort((a, b) => b.averageTime - a.averageTime)
                    .slice(0, 10)
                    .map((component) => (
                      <div
                        key={component.name}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{component.name}</h4>
                          <div
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              component.averageTime > 16
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {component.averageTime.toFixed(2)}ms avg
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Renders:
                            </span>
                            <div className="font-semibold">
                              {component.renders}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Slowest:
                            </span>
                            <div className="font-semibold">
                              {component.slowestRender.toFixed(2)}ms
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Fastest:
                            </span>
                            <div className="font-semibold">
                              {component.fastestRender === Infinity
                                ? 'N/A'
                                : `${component.fastestRender.toFixed(2)}ms`}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Mount Time:
                            </span>
                            <div className="font-semibold">
                              {component.mountTime.toFixed(2)}ms
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">
                  No component metrics available yet
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Performance Recommendations
              </CardTitle>
              <CardDescription>
                Actionable suggestions to improve performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentReport.recommendations.map((recommendation, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      recommendation.includes('excellent')
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {recommendation.includes('excellent') ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      )}
                      <p className="text-sm">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Additional Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={runLighthouseAudit} variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Run Lighthouse Audit
                </Button>
                <Button onClick={exportData} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Full Report
                </Button>
                <Button
                  onClick={() => window.open('/stats.html', '_blank')}
                  variant="outline"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  View Bundle Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceMonitor;
