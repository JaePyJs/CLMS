import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  UserCheck,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  gradeCategory: string;
  checkInTime: Date;
  checkOutTime: Date | null;
  durationMinutes: number | null;
  status: 'ACTIVE' | 'COMPLETED';
  date: Date;
}

interface AttendanceStats {
  totalVisits: number;
  uniqueStudents: number;
  averageDuration: number;
  peakHour: string;
  gradeBreakdown: {
    [key: string]: number;
  };
}

export default function AttendanceReports() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, gradeFilter]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('date', selectedDate ?? '');
      if (gradeFilter !== 'ALL') {
        params.append('gradeCategory', gradeFilter);
      }

      const response = await fetch(`/api/attendance/daily?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data.records);
        setStats(data.stats);
      } else {
        showMessage('error', 'Failed to load attendance data');
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      showMessage('error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const exportAttendance = async () => {
    try {
      const params = new URLSearchParams();
      params.append('date', selectedDate ?? '');
      if (gradeFilter !== 'ALL') {
        params.append('gradeCategory', gradeFilter);
      }

      const response = await fetch(`/api/attendance/export?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${selectedDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showMessage('success', 'Attendance exported successfully');
      } else {
        showMessage('error', 'Failed to export attendance');
      }
    } catch (error) {
      console.error('Failed to export attendance:', error);
      showMessage('error', 'Failed to export attendance');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage({ type: null, text: '' });
    }, 5000);
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    return status === 'ACTIVE' ? (
      <Badge variant="default" className="bg-blue-500">
        <Clock className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge className="bg-green-500">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Completed
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading attendance...</p>
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

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVisits}</div>
              <p className="text-xs text-muted-foreground">
                Check-ins today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueStudents}</div>
              <p className="text-xs text-muted-foreground">
                Different students
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(stats.averageDuration)}
              </div>
              <p className="text-xs text-muted-foreground">
                Average visit time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.peakHour}</div>
              <p className="text-xs text-muted-foreground">
                Most active time
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grade Breakdown */}
      {stats && Object.keys(stats.gradeBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Grade Level Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(stats.gradeBreakdown).map(([grade, count]) => (
                <div key={grade} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{grade}</span>
                  <Badge variant="outline">{count} visits</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Daily Attendance Report
          </CardTitle>
          <CardDescription>
            View and export student attendance records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {/* Date Picker */}
            <div className="flex-1">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Grade Filter */}
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Grades</SelectItem>
                <SelectItem value="ELEMENTARY">Elementary</SelectItem>
                <SelectItem value="JUNIOR_HIGH">Junior High</SelectItem>
                <SelectItem value="SENIOR_HIGH">Senior High</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button variant="outline" onClick={exportAttendance}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No attendance records for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.studentName}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.studentId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.gradeLevel}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.gradeCategory.replace('_', ' ')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTime(record.checkInTime)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTime(record.checkOutTime)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatDuration(record.durationMinutes)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Footer */}
          {records.length > 0 && (
            <div className="p-4 border-t bg-muted/50">
              <div className="text-sm text-muted-foreground">
                Showing {records.length} attendance record(s) for {selectedDate}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
