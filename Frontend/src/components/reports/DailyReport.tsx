import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Users,
  BookOpen,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { exportReportToCSV } from '@/lib/export-utils';

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

export default function DailyReport() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate]);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getDailyReport(selectedDate);
      if (response.success && response.data) {
        setStats(response.data as DailyStats);
      } else {
        showMessage('error', 'Failed to load daily report');
      }
    } catch (error) {
      console.error('Failed to fetch daily report:', error);
      showMessage('error', 'Failed to load daily report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format: 'pdf' | 'csv') => {
    if (!stats) {
      return;
    }

    if (format === 'csv') {
      exportReportToCSV(stats, 'daily');
      showMessage('success', 'Report exported successfully');
    } else if (format === 'pdf') {
      // PDF export will be window.print() for now
      window.print();
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage({ type: null, text: '' });
    }, 5000);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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
            <Calendar className="w-5 h-5" />
            Daily Report
          </CardTitle>
          <CardDescription>
            Comprehensive daily activity summary
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex gap-2">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Check-Ins</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.summary.checkIns}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.summary.uniqueStudents} unique students
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Check-Outs
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.summary.checkOuts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Student departures
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Books</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.details.bookCheckouts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Checked out | {stats.details.bookReturns} returned
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Duration
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(stats.summary.avgDuration)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average visit time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Peak Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Peak Hour
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.summary.peakHour}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Books Circulated
                    </p>
                    <p className="text-xl font-medium">
                      {stats.summary.booksCirculated} books
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Grade Level Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.gradeLevelBreakdown).map(
                    ([grade, count]) => (
                      <div
                        key={grade}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm font-medium">{grade}</span>
                        <Badge variant="outline">{count} visits</Badge>
                      </div>
                    )
                  )}
                  {Object.keys(stats.gradeLevelBreakdown).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p>
                  On <strong>{selectedDate}</strong>, the library recorded{' '}
                  <strong>{stats.summary.checkIns} check-ins</strong> from{' '}
                  <strong>
                    {stats.summary.uniqueStudents} unique students
                  </strong>
                  . The busiest hour was{' '}
                  <strong>{stats.summary.peakHour}</strong>. Students checked
                  out <strong>{stats.details.bookCheckouts} books</strong> and
                  returned <strong>{stats.details.bookReturns} books</strong>.
                  The average visit duration was{' '}
                  <strong>{formatDuration(stats.summary.avgDuration)}</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
