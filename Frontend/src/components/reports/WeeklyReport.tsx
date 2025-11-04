import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, BookOpen, Download, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { exportReportToCSV } from '@/lib/export-utils';

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
  dailyBreakdown: Array<{ date: string; dayOfWeek: string; visits: number; checkouts: number; uniqueStudents: number }>;
}

export default function WeeklyReport() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  useEffect(() => {
    fetchWeeklyReport();
  }, [weekOffset]);

  const fetchWeeklyReport = async () => {
    setLoading(true);
    try {
      // Calculate the date for the week based on offset
      const date = new Date();
      date.setDate(date.getDate() - (weekOffset * 7));
      const dateStr = date.toISOString().split('T')[0];
      
      const response = await reportsApi.getWeeklyReport(dateStr);
      if (response.success && response.data) {
        setStats(response.data as WeeklyStats);
      } else {
        showMessage('error', 'Failed to load weekly report');
      }
    } catch (error) {
      console.error('Failed to fetch weekly report:', error);
      showMessage('error', 'Failed to load weekly report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format: 'pdf' | 'csv') => {
    if (!stats) return;
    
    if (format === 'csv') {
      exportReportToCSV(stats, 'weekly');
      showMessage('success', 'Report exported successfully');
    } else if (format === 'pdf') {
      window.print();
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage({ type: null, text: '' });
    }, 5000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading report...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message.type && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Weekly Report
          </CardTitle>
          <CardDescription>
            {stats && `${stats.weekStart} to ${stats.weekEnd}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setWeekOffset(weekOffset + 1)}
              >
                ← Previous Week
              </Button>
              <Button
                variant="outline"
                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                disabled={weekOffset === 0}
              >
                Next Week →
              </Button>
              <Button
                variant="outline"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
              >
                Current Week
              </Button>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => exportReport('csv')}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => exportReport('pdf')}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Check-Ins</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.totalVisits}</div>
                <p className="text-xs text-muted-foreground">
                  This week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.uniqueStudents}</div>
                <p className="text-xs text-muted-foreground">
                  Different visitors
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Books Circulated</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.totalCheckouts}</div>
                <p className="text-xs text-muted-foreground">
                  Checked out
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Daily Visits</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(stats.summary.totalVisits / 7)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per day average
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Popular Items */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Popular Books
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.popularBooks.slice(0, 5).map((book, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{index + 1}. {book.title}</span>
                      <Badge variant="outline">{book.count}x</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Popular Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.popularCategories.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{cat.name}</span>
                      <Badge variant="outline">{cat.count} books</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.dailyBreakdown.map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{day.dayOfWeek} - {day.date}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline">{day.visits} visits</Badge>
                      <Badge variant="outline">{day.checkouts} checkouts</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
