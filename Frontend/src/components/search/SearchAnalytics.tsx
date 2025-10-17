import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
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
import { Search, TrendingUp, Clock, Zap, Database, Users, BookOpen, Monitor, Activity, AlertTriangle, CheckCircle, Target, BarChart3, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface SearchAnalytics {
  totalSearches: number;
  averageResponseTime: number;
  popularSearchTerms: Array<{
    term: string;
    count: number;
    entityType: string;
  }>;
  searchTrends: Array<{
    date: string;
    count: number;
    entityType: string;
  }>;
  failedSearches: number;
  cacheHitRate: number;
  entityBreakdown: Array<{
    entityType: string;
    count: number;
    percentage: number;
  }>;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  slowestQueries: Array<{
    query: string;
    responseTime: number;
    timestamp: string;
  }>;
  fastestQueries: Array<{
    query: string;
    responseTime: number;
    timestamp: string;
  }>;
  cacheHitRate: number;
  errorRate: number;
}

interface UserBehavior {
  totalSearches: number;
  averageSearchesPerDay: number;
  mostSearchedEntities: Array<{
    entityType: string;
    count: number;
  }>;
  favoriteSearchTerms: Array<{
    term: string;
    count: number;
  }>;
  searchActivityPattern: Array<{
    hour: number;
    count: number;
  }>;
  topSavedSearches: Array<{
    name: string;
    useCount: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function SearchAnalytics() {
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [userBehavior, setUserBehavior] = useState<UserBehavior | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, performanceRes, behaviorRes] = await Promise.all([
        apiClient.get('/api/analytics/search', { params: { days: timeRange } }),
        apiClient.get('/api/analytics/search/performance'),
        apiClient.get('/api/analytics/search/behavior', { params: { days: timeRange } }),
      ]);

      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }

      if (performanceRes.success) {
        setPerformanceMetrics(performanceRes.data);
      }

      if (behaviorRes.success) {
        setUserBehavior(behaviorRes.data);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      toast.error('Failed to load search analytics');
    } finally {
      setLoading(false);
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'books':
        return <BookOpen className="w-4 h-4" />;
      case 'students':
        return <Users className="w-4 h-4" />;
      case 'equipment':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getPerformanceColor = (responseTime: number) => {
    if (responseTime < 100) return 'text-green-600';
    if (responseTime < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Search Analytics
          </h1>
          <p className="text-muted-foreground">
            Monitor search performance, user behavior, and system usage patterns
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadAnalyticsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5" />
                Total Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalSearches.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">
                {analytics.averageSearchesPerDay?.toFixed(1) || 0} searches per day
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Avg Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPerformanceColor(analytics.averageResponseTime)}`}>
                {analytics.averageResponseTime.toFixed(0)}ms
              </div>
              <p className="text-sm text-muted-foreground">
                Across all search types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5" />
                Cache Hit Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analytics.cacheHitRate > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                {analytics.cacheHitRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                Search results from cache
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analytics.failedSearches === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {((analytics.totalSearches - analytics.failedSearches) / analytics.totalSearches * 100).toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {analytics.failedSearches} failed searches
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Zap className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="behavior">
            <Users className="w-4 h-4 mr-2" />
            User Behavior
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {analytics && (
            <>
              {/* Search Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Search Trends Over Time</CardTitle>
                  <CardDescription>
                    Daily search volume by entity type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.searchTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Entity Breakdown */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5" />
                      Search Distribution
                    </CardTitle>
                    <CardDescription>
                      Searches by entity type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.entityBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {analytics.entityBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Popular Search Terms
                    </CardTitle>
                    <CardDescription>
                      Most frequently searched terms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.popularSearchTerms.slice(0, 10).map((term, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getEntityIcon(term.entityType)}
                            <span className="font-medium">{term.term}</span>
                            <Badge variant="outline">{term.entityType}</Badge>
                          </div>
                          <Badge variant="secondary">{term.count} searches</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {performanceMetrics && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>
                      Response time and cache performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Average Response Time</span>
                        <span className={`font-medium ${getPerformanceColor(performanceMetrics.averageResponseTime)}`}>
                          {performanceMetrics.averageResponseTime.toFixed(0)}ms
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Cache Hit Rate</span>
                        <span className={`font-medium ${performanceMetrics.cacheHitRate > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {performanceMetrics.cacheHitRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Error Rate</span>
                        <span className={`font-medium ${performanceMetrics.errorRate < 1 ? 'text-green-600' : 'text-red-600'}`}>
                          {performanceMetrics.errorRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Response Time Distribution</CardTitle>
                    <CardDescription>
                      How fast searches are responding
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-green-600">
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                          Fast (&lt;100ms)
                        </span>
                        <Badge variant="outline">Good</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-yellow-600">
                          <Clock className="w-4 h-4 inline mr-2" />
                          Medium (100-500ms)
                        </span>
                        <Badge variant="outline">OK</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-red-600">
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          Slow (&gt;500ms)
                        </span>
                        <Badge variant="outline">Needs Attention</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Slowest Queries</CardTitle>
                    <CardDescription>
                      Queries that need optimization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performanceMetrics.slowestQueries.slice(0, 5).map((query, index) => (
                        <div key={index} className="p-3 border rounded">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm truncate">{query.query}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(query.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="destructive">
                              {query.responseTime.toFixed(0)}ms
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fastest Queries</CardTitle>
                    <CardDescription>
                      Well-optimized queries
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performanceMetrics.fastestQueries.slice(0, 5).map((query, index) => (
                        <div key={index} className="p-3 border rounded">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm truncate">{query.query}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(query.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <Badge className="bg-green-500">
                              {query.responseTime.toFixed(0)}ms
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          {userBehavior && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Search Activity</CardTitle>
                    <CardDescription>
                      User search patterns by hour of day
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={userBehavior.searchActivityPattern}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Most Searched Entities</CardTitle>
                    <CardDescription>
                      Popular search categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userBehavior.mostSearchedEntities.map((entity, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getEntityIcon(entity.entityType)}
                            <span className="capitalize">{entity.entityType}</span>
                          </div>
                          <Badge variant="secondary">{entity.count} searches</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Favorite Search Terms</CardTitle>
                    <CardDescription>
                      Most frequently searched terms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userBehavior.favoriteSearchTerms.slice(0, 10).map((term, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="font-medium">{term.term}</span>
                          <Badge variant="outline">{term.count} times</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Saved Searches</CardTitle>
                    <CardDescription>
                      Most used saved searches
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userBehavior.topSavedSearches.map((search, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="font-medium">{search.name}</span>
                          <Badge variant="outline">{search.useCount} uses</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}