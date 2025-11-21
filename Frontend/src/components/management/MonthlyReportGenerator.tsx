import { useEffect, useState } from 'react';
import { apiClient, analyticsApi } from '@/lib/api';
import { toUserMessage } from '@/utils/error-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadCSV, downloadJSON, printReport } from '@/lib/export-utils';
import { toast } from 'sonner';

interface ReportSummary {
  totalVisits: number;
  uniqueStudents: number;
  booksBorrowed: number;
  booksReturned: number;
  printingTotal: number;
  finesCollected: number;
}

export default function MonthlyReportGenerator() {
  const [month, setMonth] = useState<string>('');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [printing, setPrinting] = useState<any[]>([]);

  const loadData = async () => {
    if (!month) {
      toast.warning('Select month');
      return;
    }
    setBusy(true);
    try {
      const metrics = await analyticsApi.getMetrics();
      const overdueRes = await apiClient.get<any[]>('/api/fines/overdue');
      const printRes = await apiClient.get<any[]>('/api/printing/jobs');
      const s: ReportSummary = {
        totalVisits: (metrics.data as any)?.visits || 0,
        uniqueStudents: (metrics.data as any)?.uniqueStudents || 0,
        booksBorrowed: (metrics.data as any)?.booksBorrowed || 0,
        booksReturned: (metrics.data as any)?.booksReturned || 0,
        printingTotal: (printRes.data || []).reduce(
          (sum: number, j: any) => sum + (j.total_cost || 0),
          0
        ),
        finesCollected: 0,
      };
      setSummary(s);
      setOverdue(overdueRes.data || []);
      setPrinting(printRes.data || []);
      toast.success('Report ready');
    } catch (e) {
      toast.error(toUserMessage(e));
      setSummary({
        totalVisits: 0,
        uniqueStudents: 0,
        booksBorrowed: 0,
        booksReturned: 0,
        printingTotal: 0,
        finesCollected: 0,
      });
      setOverdue([]);
      setPrinting([]);
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => {
    if (!summary) return;
    const data = [
      { Metric: 'Total Visits', Value: summary.totalVisits },
      { Metric: 'Unique Students', Value: summary.uniqueStudents },
      { Metric: 'Books Borrowed', Value: summary.booksBorrowed },
      { Metric: 'Books Returned', Value: summary.booksReturned },
      { Metric: 'Printing Total', Value: summary.printingTotal },
      { Metric: 'Fines Collected', Value: summary.finesCollected },
    ];
    downloadCSV(data, `monthly-summary-${month}`);
  };

  const exportJSONAll = () => {
    const data = { month, summary, overdue, printing };
    downloadJSON(data, `monthly-full-${month}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Report Generator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Button onClick={loadData} disabled={busy}>
            {busy ? 'Generating...' : 'Generate'}
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!summary}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportJSONAll} disabled={!summary}>
            Export JSON
          </Button>
          <Button variant="secondary" onClick={printReport}>
            Print
          </Button>
        </div>
        {summary && (
          <div className="border rounded-md mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Total Visits</TableCell>
                  <TableCell>{summary.totalVisits}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Unique Students</TableCell>
                  <TableCell>{summary.uniqueStudents}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Books Borrowed</TableCell>
                  <TableCell>{summary.booksBorrowed}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Books Returned</TableCell>
                  <TableCell>{summary.booksReturned}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Printing Total</TableCell>
                  <TableCell>{summary.printingTotal}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Fines Collected</TableCell>
                  <TableCell>{summary.finesCollected}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Overdue Student</TableHead>
                  <TableHead>Book</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdue.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      {`${o.student?.first_name || ''} ${o.student?.last_name || ''}`.trim()}
                    </TableCell>
                    <TableCell>{o.book?.title || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Printing Student</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printing.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.student_id}</TableCell>
                    <TableCell>{p.total_cost}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
