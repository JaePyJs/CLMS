import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { exportReportToCSV } from '@/lib/export-utils';

interface CustomReportStats {
  summary?: {
    totalCheckIns: number;
    uniqueStudents: number;
    booksBorrowed: number;
    booksReturned: number;
  };
}

export default function CustomReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<CustomReportStats | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!startDate || !endDate) {
      return;
    }
    setLoading(true);
    try {
      const response = await reportsApi.getCustomReport(startDate, endDate);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to generate custom report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Custom Date Range Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={generateReport}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
            {stats && (
              <Button
                variant="outline"
                onClick={() => exportReportToCSV(stats, 'custom')}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Check-Ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.summary?.totalCheckIns || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Unique Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.summary?.uniqueStudents || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Books Borrowed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.summary?.booksBorrowed || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Books Returned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.summary?.booksReturned || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
