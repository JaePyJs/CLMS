import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Users, BookOpen, Download, TrendingUp } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { exportReportToCSV } from '@/lib/export-utils';

export default function MonthlyReport() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMonthlyReport();
  }, [month, year]);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getMonthlyReport(month, year);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch monthly report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Report - {stats?.monthName} {stats?.year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              className="ml-auto"
              onClick={() => stats && exportReportToCSV(stats, 'monthly')}
              disabled={!stats}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary?.totalVisits || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Books Borrowed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary?.booksBorrowed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary?.uniqueStudents || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
