import React, { useState, useEffect } from 'react';
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, Bug, CheckCircle, XCircle, AlertCircle, RefreshCw, Download, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ErrorReport {
  id: string;
  timestamp: string;
  message: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  statusCode?: number;
  code?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  assignee?: string;
  tags: string[];
  similarErrors: number;
  impact: {
    usersAffected: number;
    requestsAffected: number;
  };
}

interface ErrorDashboard {
  overview: {
    totalErrors: number;
    unresolvedErrors: number;
    criticalErrors: number;
    errorsLast24h: number;
    errorRate: number;
    uptime: number;
  };
  trends: Array<{
    date: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  topErrors: Array<{
    id: string;
    message: string;
    count: number;
    severity: string;
    lastOccurred: string;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  severityBreakdown: Array<{
    severity: string;
    count: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'new_error' | 'resolved' | 'assigned';
    message: string;
    timestamp: string;
    user?: string;
  }>;
}

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

const CATEGORY_COLORS = {
  AUTHENTICATION: '#8b5cf6',
  AUTHORIZATION: '#06b6d4',
  VALIDATION: '#3b82f6',
  DATABASE: '#ef4444',
  NETWORK: '#f97316',
  EXTERNAL_SERVICE: '#a855f7',
  BUSINESS_LOGIC: '#eab308',
  SYSTEM: '#dc2626',
  PERFORMANCE: '#f59e0b',
};

export const ErrorReportingDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);

  const { data: dashboard, isLoading, error, refetch } = useQuery<ErrorDashboard>({
    queryKey: ['error-dashboard', timeframe],
    queryFn: async () => {
      const response = await api.get(`/api/errors/dashboard?timeframe=${timeframe}`);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: errorReports } = useQuery<ErrorReport[]>({
    queryKey: ['error-reports', filterCategory, filterSeverity, showResolved],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category', filterCategory ?? '');
      if (filterSeverity !== 'all') params.append('severity', filterSeverity ?? '');
      if (!showResolved) params.append('resolved', 'false');

      const response = await api.get(`/api/errors/reports?${params}`);
      return response.data;
    },
  });

  const handleResolveError = async (errorId: string) => {
    try {
      await api.post(`/api/errors/reports/${errorId}/resolve`, {
        resolutionNotes: 'Resolved via dashboard',
      });
      refetch();
    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  };

  const handleAssignError = async (errorId: string, assignee: string) => {
    try {
      await api.post(`/api/errors/reports/${errorId}/assign`, { assignee });
      refetch();
    } catch (error) {
      console.error('Failed to assign error:', error);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format ?? '');
      if (filterCategory !== 'all') params.append('category', filterCategory ?? '');
      if (filterSeverity !== 'all') params.append('severity', filterSeverity ?? '');

      const response = await api.get(`/api/errors/reports/export?${params}`);
      const blob = new Blob([response.data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-reports-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'HIGH':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'MEDIUM':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'LOW':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Bug className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-semibold">Failed to load error dashboard</p>
          <Button onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Error Reporting Dashboard</h1>
          <p className="text-muted-foreground">Monitor and analyze system errors</p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => handleExportData('csv')}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.overview.totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard.overview.errorsLast24h} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.overview.unresolvedErrors}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard.overview.criticalErrors} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboard.overview.errorRate * 100).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard.overview.errorRate > 0.05 ? 'Above threshold' : 'Normal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.overview.uptime}%</div>
            <p className="text-xs text-muted-foreground">
              Last {timeframe === '1h' ? 'hour' : timeframe === '24h' ? '24 hours' : timeframe}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="reports">Error Reports</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Error Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Error Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dashboard.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                    />
                    <Area
                      type="monotone"
                      dataKey="critical"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Error Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboard.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ category, percentage }) => `${category} ${percentage}%`}
                    >
                      {dashboard.categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS] || '#8884d8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Errors */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.topErrors.slice(0, 5).map((error) => (
                    <div
                      key={error.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getSeverityIcon(error.severity)}
                        <div>
                          <p className="font-medium">{error.message}</p>
                          <p className="text-sm text-muted-foreground">
                            {error.count} occurrences • Last: {new Date(error.lastOccurred).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboard.severityBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {dashboard.severityBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={SEVERITY_COLORS[entry.severity as keyof typeof SEVERITY_COLORS]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Category Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard.categoryBreakdown.map((category) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTrendIcon(category.trend)}
                        <span className="font-medium">{category.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {category.count} ({category.percentage}%)
                        </span>
                        <div className="w-16 h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{ width: `${category.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Categories</option>
                  {Object.values(ErrorCategory).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Severities</option>
                  {Object.keys(SEVERITY_COLORS).map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showResolved}
                    onChange={(e) => setShowResolved(e.target.checked)}
                    className="rounded"
                  />
                  Show Resolved
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Error Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle>Error Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {errorReports?.slice(0, 20).map((report) => (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(report.severity)}
                        <div className="flex-1">
                          <p className="font-medium">{report.message}</p>
                          <p className="text-sm text-muted-foreground">
                            {report.category} • {new Date(report.timestamp).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>Users affected: {report.impact.usersAffected}</span>
                            <span>Requests affected: {report.impact.requestsAffected}</span>
                            {report.similarErrors > 0 && (
                              <span>Similar errors: {report.similarErrors}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.resolved ? (
                          <span className="text-green-600 text-sm">Resolved</span>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolveError(report.id)}
                            >
                              Resolve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignError(report.id, 'current_user')}
                            >
                              Assign
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'new_error' ? 'bg-red-100' :
                      activity.type === 'resolved' ? 'bg-green-100' :
                      'bg-blue-100'
                    }`}>
                      {activity.type === 'new_error' && <Bug className="h-4 w-4 text-red-600" />}
                      {activity.type === 'resolved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {activity.type === 'assigned' && <User className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                        {activity.user && ` • ${activity.user}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ErrorReportingDashboard;