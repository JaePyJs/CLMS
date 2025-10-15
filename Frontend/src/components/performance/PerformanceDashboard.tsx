'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Database,
  Monitor,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { usePerformanceMetrics, usePerformanceLogs, usePerformanceSession } from './PerformanceProvider';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: 'green' | 'yellow' | 'red' | 'blue';
}

function MetricCard({ title, value, change, icon, color = 'blue' }: MetricCardProps) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${colorClasses[color]}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground">
            {change > 0 ? (
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
            )}
            {Math.abs(change)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PerformanceDashboard() {
  const metrics = usePerformanceMetrics();
  const logs = usePerformanceLogs();
  const { sessionId, flush, getSummary } = usePerformanceSession();
  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate derived metrics
  const summary = getSummary();
  const recentMetrics = metrics.slice(-50);
  const recentLogs = logs.slice(-20);

  // Core Web Vitals
  const lcpMetric = metrics.find(m => m.name === 'largest_contentful_paint');
  const fidMetric = metrics.find(m => m.name === 'first_input_delay');
  const fcpMetric = metrics.find(m => m.name === 'first-contentful-paint');

  // Resource metrics
  const resourceMetrics = metrics.filter(m => m.name.startsWith('resource_'));
  const totalResources = metrics.filter(m => m.name === 'resource_duration').length;
  const avgResourceTime = resourceMetrics.length > 0
    ? resourceMetrics.reduce((sum, m) => sum + m.value, 0) / resourceMetrics.length
    : 0;

  // Error tracking
  const errorLogs = logs.filter(log => log.level === 'error');
  const warnLogs = logs.filter(log => log.level === 'warn');

  const handleRefresh = () => {
    flush();
    setRefreshKey(prev => prev + 1);
  };

  const handleClear = () => {
    performanceMonitor.clear();
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Session: {sessionId.slice(-8)}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Metrics"
          value={summary.metricsCount}
          icon={<Activity className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Active Timers"
          value={summary.activeEntriesCount}
          icon={<Clock className="h-4 w-4" />}
          color="yellow"
        />
        <MetricCard
          title="Errors"
          value={errorLogs.length}
          change={errorLogs.length > 0 ? 10 : -5}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={errorLogs.length > 0 ? 'red' : 'green'}
        />
        <MetricCard
          title="Resources"
          value={totalResources}
          icon={<Database className="h-4 w-4" />}
          color="blue"
        />
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
          <TabsTrigger value="vitals">Core Web Vitals</TabsTrigger>
          <TabsTrigger value="resources">Resource Analysis</TabsTrigger>
        </TabsList>

        {/* Performance Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentMetrics.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No metrics available yet
                  </p>
                ) : (
                  recentMetrics.map((metric, index) => (
                    <div key={`${metric.name}-${metric.timestamp}-${index}`} className="flex items-center justify-between p-2 border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="font-medium">{metric.name}</span>
                        {metric.tags && Object.keys(metric.tags).length > 0 && (
                          <div className="flex gap-1">
                            {Object.entries(metric.tags).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {metric.value.toFixed(2)} {metric.unit || ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(metric.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No logs available yet
                  </p>
                ) : (
                  recentLogs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="flex items-start gap-3 p-2 border-b">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        log.level === 'error' ? 'bg-red-500' :
                        log.level === 'warn' ? 'bg-yellow-500' :
                        log.level === 'info' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            log.level === 'error' ? 'destructive' :
                            log.level === 'warn' ? 'secondary' :
                            log.level === 'info' ? 'default' :
                            'outline'
                          }>
                            {log.level.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{log.message}</span>
                        </div>
                        {log.context && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {JSON.stringify(log.context, null, 2)}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Core Web Vitals Tab */}
        <TabsContent value="vitals" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              title="Largest Contentful Paint"
              value={lcpMetric ? `${lcpMetric.value.toFixed(0)}ms` : 'N/A'}
              icon={<Monitor className="h-4 w-4" />}
              color={lcpMetric && lcpMetric.value > 2500 ? 'red' : lcpMetric && lcpMetric.value > 1000 ? 'yellow' : 'green'}
            />
            <MetricCard
              title="First Input Delay"
              value={fidMetric ? `${fidMetric.value.toFixed(0)}ms` : 'N/A'}
              icon={<Zap className="h-4 w-4" />}
              color={fidMetric && fidMetric.value > 100 ? 'red' : fidMetric && fidMetric.value > 50 ? 'yellow' : 'green'}
            />
            <MetricCard
              title="First Contentful Paint"
              value={fcpMetric ? `${fcpMetric.value.toFixed(0)}ms` : 'N/A'}
              icon={<CheckCircle className="h-4 w-4" />}
              color={fcpMetric && fcpMetric.value > 1800 ? 'red' : fcpMetric && fcpMetric.value > 1000 ? 'yellow' : 'green'}
            />
            <MetricCard
              title="Avg Resource Time"
              value={`${avgResourceTime.toFixed(0)}ms`}
              icon={<Database className="h-4 w-4" />}
              color={avgResourceTime > 500 ? 'red' : avgResourceTime > 200 ? 'yellow' : 'green'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <h4 className="font-medium mb-2">LCP</h4>
                    <div className={`text-2xl font-bold ${
                      lcpMetric && lcpMetric.value > 2500 ? 'text-red-500' :
                      lcpMetric && lcpMetric.value > 1000 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {lcpMetric ? `${lcpMetric.value.toFixed(0)}ms` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lcpMetric && lcpMetric.value > 2500 ? 'Poor' :
                       lcpMetric && lcpMetric.value > 1000 ? 'Needs Improvement' :
                       lcpMetric ? 'Good' : 'No Data'}
                    </div>
                  </div>
                  <div className="text-center">
                    <h4 className="font-medium mb-2">FID</h4>
                    <div className={`text-2xl font-bold ${
                      fidMetric && fidMetric.value > 100 ? 'text-red-500' :
                      fidMetric && fidMetric.value > 50 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {fidMetric ? `${fidMetric.value.toFixed(0)}ms` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fidMetric && fidMetric.value > 100 ? 'Poor' :
                       fidMetric && fidMetric.value > 50 ? 'Needs Improvement' :
                       fidMetric ? 'Good' : 'No Data'}
                    </div>
                  </div>
                  <div className="text-center">
                    <h4 className="font-medium mb-2">FCP</h4>
                    <div className={`text-2xl font-bold ${
                      fcpMetric && fcpMetric.value > 1800 ? 'text-red-500' :
                      fcpMetric && fcpMetric.value > 1000 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {fcpMetric ? `${fcpMetric.value.toFixed(0)}ms` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fcpMetric && fcpMetric.value > 1800 ? 'Poor' :
                       fcpMetric && fcpMetric.value > 1000 ? 'Needs Improvement' :
                       fcpMetric ? 'Good' : 'No Data'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resource Analysis Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Resource Timing Distribution</h4>
                    <div className="space-y-2">
                      {['script', 'stylesheet', 'image', 'font'].map(type => {
                        const typeMetrics = resourceMetrics.filter(m => m.tags?.type === type);
                        const avgTime = typeMetrics.length > 0
                          ? typeMetrics.reduce((sum, m) => sum + m.value, 0) / typeMetrics.length
                          : 0;

                        return (
                          <div key={type} className="flex items-center justify-between">
                            <span className="capitalize">{type}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{typeMetrics.length} files</Badge>
                              <span className="font-mono text-sm">{avgTime.toFixed(0)}ms</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Slow Resources</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {resourceMetrics
                        .filter(m => m.value > 500)
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 10)
                        .map((metric, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[200px]">
                              {metric.tags?.name || 'Unknown'}
                            </span>
                            <Badge variant={metric.value > 1000 ? 'destructive' : 'secondary'}>
                              {metric.value.toFixed(0)}ms
                            </Badge>
                          </div>
                        ))}
                      {resourceMetrics.filter(m => m.value > 500).length === 0 && (
                        <p className="text-muted-foreground text-sm">No slow resources detected</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceDashboard;