import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, Download, TrendingUp, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { imageOptimizationService } from '@/services/imageOptimizationService';

interface PerformanceStats {
  totalImages: number;
  averageLoadTime: number;
  averageCompressionRatio: number;
  totalSavings: number;
  formatDistribution: Record<string, number>;
}

interface ImageMetric {
  url: string;
  loadTime: number;
  format: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  timestamp: number;
}

const ImagePerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [detailedMetrics, setDetailedMetrics] = useState<ImageMetric[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'session' | 'hour' | 'day'>('session');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    refreshStats();

    // Set up periodic refresh
    const interval = setInterval(refreshStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      const performanceStats = imageOptimizationService.getPerformanceStats();
      setStats(performanceStats);

      // Get detailed metrics for all tracked images
      const metrics: ImageMetric[] = [];
      // This would need to be enhanced to get actual detailed metrics
      // For now, we'll simulate some data
      setDetailedMetrics(metrics);
    } catch (error) {
      console.error('Failed to refresh image performance stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceGrade = (loadTime: number): { grade: string; color: string } => {
    if (loadTime < 200) return { grade: 'A', color: 'text-green-600' };
    if (loadTime < 500) return { grade: 'B', color: 'text-yellow-600' };
    if (loadTime < 1000) return { grade: 'C', color: 'text-orange-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  const getCompressionEfficiency = (ratio: number): { grade: string; color: string } => {
    if (ratio > 3) return { grade: 'Excellent', color: 'text-green-600' };
    if (ratio > 2) return { grade: 'Good', color: 'text-yellow-600' };
    if (ratio > 1.5) return { grade: 'Fair', color: 'text-orange-600' };
    return { grade: 'Poor', color: 'text-red-600' };
  };

  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      timeRange: selectedTimeRange,
      stats,
      detailedMetrics,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading image performance data...</span>
      </div>
    );
  }

  const formatData = Object.entries(stats.formatDistribution).map(([format, count]) => ({
    name: format.toUpperCase(),
    value: count,
  }));

  const loadTimeData = detailedMetrics.slice(0, 10).map(metric => ({
    name: metric.url.split('/').pop() || 'Unknown',
    loadTime: metric.loadTime,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6" />
            Image Performance Monitor
          </h2>
          <p className="text-muted-foreground">
            Real-time image optimization metrics and performance insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshStats}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImages}</div>
            <p className="text-xs text-muted-foreground">
              Images processed in current session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Load Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(stats.averageLoadTime)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={getPerformanceGrade(stats.averageLoadTime).color}>
                Grade {getPerformanceGrade(stats.averageLoadTime).grade}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compression Ratio</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageCompressionRatio.toFixed(2)}x
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={getCompressionEfficiency(stats.averageCompressionRatio).color}>
                {getCompressionEfficiency(stats.averageCompressionRatio).grade}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(stats.totalSavings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Bandwidth saved through optimization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Format Distribution</CardTitle>
            <CardDescription>
              Image formats used across the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formatData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formatData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Load Times */}
        <Card>
          <CardHeader>
            <CardTitle>Image Load Times</CardTitle>
            <CardDescription>
              Loading performance for recent images
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={loadTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`${value}ms`, 'Load Time']}
                    labelFormatter={(label) => `Image: ${label}`}
                  />
                  <Bar dataKey="loadTime" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No load time data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Recommendations</CardTitle>
          <CardDescription>
            Automated suggestions to improve image performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.averageLoadTime > 500 && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Slow Average Load Time
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Consider increasing compression quality or implementing more aggressive lazy loading.
                  </p>
                </div>
              </div>
            )}

            {stats.averageCompressionRatio < 1.5 && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Low Compression Efficiency
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Images could be compressed more aggressively to save bandwidth.
                  </p>
                </div>
              </div>
            )}

            {stats.totalSavings > 1024 * 1024 && ( // 1MB
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Excellent Bandwidth Savings
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Image optimization is saving significant bandwidth.
                  </p>
                </div>
              </div>
            )}

            {stats.averageLoadTime < 200 && stats.averageCompressionRatio > 2 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Optimal Performance
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Image performance is well optimized.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Time Range Selector */}
      <div className="flex justify-center">
        <div className="flex gap-2">
          {(['session', 'hour', 'day'] as const).map((range) => (
            <Button
              key={range}
              variant={selectedTimeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImagePerformanceMonitor;