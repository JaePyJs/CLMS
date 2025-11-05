import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Users,
  BookOpen,
  Clock,
  Activity,
  Calendar,
  BarChart3,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { reportsApi } from '@/lib/api';

interface DashboardStats {
  today: {
    checkIns: number;
    uniqueStudents: number;
    booksCirculated: number;
    activeNow: number;
  };
  thisWeek: {
    totalVisits: number;
    averageDaily: number;
    topBooks: Array<{ title: string; count: number }>;
    topCategories: Array<{ name: string; count: number }>;
  };
  trends: {
    visitsTrend: number; // percentage change
    booksTrend: number;
    studentsTrend: number;
  };
}

// Add type definitions for API responses
interface DailyStats {
  date: string;
  summary: {
    checkIns: number;
    checkOuts: number;
    uniqueStudents: number;
    booksCirculated: number;
    avgDuration: number;
    peakHour: string;
  };
  details: {
    bookCheckouts: number;
    bookReturns: number;
    computerUse: number;
    gamingSessions: number;
    avrSessions: number;
  };
  gradeLevelBreakdown: {
    [key: string]: number;
  };
}

interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  summary: {
    totalVisits: number;
    uniqueStudents: number;
    totalCheckouts: number;
  };
  popularBooks: Array<{ title: string; count: number }>;
  popularCategories: Array<{ name: string; count: number }>;
  dailyBreakdown: Array<{
    date: string;
    dayOfWeek: string;
    visits: number;
    checkouts: number;
    uniqueStudents: number;
  }>;
}

export default function EnhancedDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch today's report
      const dailyResponse = await reportsApi.getDailyReport();

      // Fetch weekly report
      const weeklyResponse = await reportsApi.getWeeklyReport();

      if (dailyResponse.success && weeklyResponse.success) {
        const dailyData = dailyResponse.data as DailyStats;
        const weeklyData = weeklyResponse.data as WeeklyStats;

        setStats({
          today: {
            checkIns: dailyData.summary.checkIns,
            uniqueStudents: dailyData.summary.uniqueStudents,
            booksCirculated: dailyData.summary.booksCirculated,
            activeNow: dailyData.summary.checkIns - dailyData.summary.checkOuts,
          },
          thisWeek: {
            totalVisits: weeklyData.summary.totalVisits,
            averageDaily: Math.round(weeklyData.summary.totalVisits / 7),
            topBooks: weeklyData.popularBooks?.slice(0, 5) || [],
            topCategories: weeklyData.popularCategories?.slice(0, 5) || [],
          },
          trends: {
            visitsTrend: calculateTrend(weeklyData.dailyBreakdown),
            booksTrend: 0, // Can be calculated if historical data available
            studentsTrend: 0,
          },
        });
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrend = (dailyBreakdown: any[]) => {
    if (!dailyBreakdown || dailyBreakdown.length < 2) {
      return 0;
    }
    const recent =
      dailyBreakdown.slice(-3).reduce((sum, day) => sum + day.visits, 0) / 3;
    const previous =
      dailyBreakdown.slice(0, 3).reduce((sum, day) => sum + day.visits, 0) / 3;
    return previous > 0
      ? Math.round(((recent - previous) / previous) * 100)
      : 0;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) {
      return 'text-green-500';
    }
    if (trend < 0) {
      return 'text-red-500';
    }
    return 'text-gray-500';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return '↑';
    }
    if (trend < 0) {
      return '↓';
    }
    return '→';
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Library overview and statistics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {stats && (
        <>
          {/* Today's Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Today's Check-Ins
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today.checkIns}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.today.uniqueStudents} unique students
                </p>
                {stats.trends.visitsTrend !== 0 && (
                  <p
                    className={`text-xs mt-1 ${getTrendColor(stats.trends.visitsTrend)}`}
                  >
                    {getTrendIcon(stats.trends.visitsTrend)}{' '}
                    {Math.abs(stats.trends.visitsTrend)}% vs last week
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Books Circulated
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.today.booksCirculated}
                </div>
                <p className="text-xs text-muted-foreground">
                  Today's circulation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Now
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {Math.max(0, stats.today.activeNow)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Students in library
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Weekly Average
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.thisWeek.averageDaily}
                </div>
                <p className="text-xs text-muted-foreground">Visits per day</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <Tabs defaultValue="popular" className="space-y-4">
            <TabsList>
              <TabsTrigger value="popular">
                <BarChart3 className="w-4 h-4 mr-2" />
                Popular Items
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="w-4 h-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="popular" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Top Books */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Top Books This Week
                    </CardTitle>
                    <CardDescription>Most borrowed books</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.thisWeek.topBooks.length > 0 ? (
                        stats.thisWeek.topBooks.map((book, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="h-6 w-6 flex items-center justify-center p-0"
                              >
                                {index + 1}
                              </Badge>
                              <span className="text-sm font-medium truncate max-w-[200px]">
                                {book.title}
                              </span>
                            </div>
                            <Badge>{book.count}x</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No data available
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      Top Categories
                    </CardTitle>
                    <CardDescription>
                      Most popular book categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.thisWeek.topCategories.length > 0 ? (
                        stats.thisWeek.topCategories.map((category, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm font-medium">
                              {category.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${stats.thisWeek.topCategories[0] ? (category.count / stats.thisWeek.topCategories[0].count) * 100 : 0}%`,
                                  }}
                                ></div>
                              </div>
                              <Badge variant="outline">{category.count}</Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No data available
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Activity Overview</CardTitle>
                  <CardDescription>
                    Total visits this week: {stats.thisWeek.totalVisits}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Average Daily Visits
                      </span>
                      <span className="font-medium">
                        {stats.thisWeek.averageDaily}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Books Circulated Today
                      </span>
                      <span className="font-medium">
                        {stats.today.booksCirculated}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Current Occupancy
                      </span>
                      <span className="font-medium text-green-500">
                        {Math.max(0, stats.today.activeNow)} students
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-4">
                <Button variant="outline" className="justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Reports
                </Button>
                <Button variant="outline" className="justify-start">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Manage Books
                </Button>
                <Button variant="outline" className="justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Students
                </Button>
                <Button variant="outline" className="justify-start">
                  <Clock className="w-4 h-4 mr-2" />
                  Activity Log
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
