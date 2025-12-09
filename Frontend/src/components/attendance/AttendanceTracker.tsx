import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { attendanceApi } from '@/lib/api';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import {
  Download,
  Search,
  Calendar as CalendarIcon,
  Clock,
  Users,
  LogIn,
  LogOut,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserX,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: number;
  section?: string;
  checkInTime: string;
  checkOutTime?: string;
  duration?: number;
  status: 'ACTIVE' | 'COMPLETED';
  activityType: string;
}

interface AttendanceSummary {
  totalCheckIns: number;
  totalCheckOuts: number;
  currentlyActive: number;
  averageDuration: number;
  peakHour: string;
  uniqueStudents: number;
}

export default function AttendanceTracker() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [customDateOpen, setCustomDateOpen] = useState(false);

  const { recentActivities } = useWebSocketContext();

  // Fetch attendance data
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = dateRange.from.toISOString();
      const endDate = dateRange.to.toISOString();

      const [dataRes, summaryRes] = await Promise.all([
        attendanceApi.getData(startDate, endDate),
        attendanceApi.getSummary(startDate, endDate),
      ]);

      if (dataRes.success && dataRes.data) {
        // Map the data to our interface
        interface RawAttendanceRecord {
          id: string;
          student_id?: string;
          studentId?: string;
          student_name?: string;
          studentName?: string;
          student?: {
            first_name?: string;
            last_name?: string;
            grade_level?: number;
            section?: string;
          };
          grade_level?: number;
          gradeLevel?: number;
          section?: string;
          start_time?: string;
          checkInTime?: string;
          check_in_time?: string;
          end_time?: string;
          checkOutTime?: string;
          check_out_time?: string;
          duration_minutes?: number;
          duration?: number;
          status?: string;
          activity_type?: string;
          activityType?: string;
        }
        const mappedRecords = (dataRes.data as RawAttendanceRecord[]).map(
          (record) => ({
            id: record.id,
            studentId: record.student_id || record.studentId,
            studentName:
              record.student_name ||
              record.studentName ||
              `${record.student?.first_name || ''} ${record.student?.last_name || ''}`.trim(),
            gradeLevel:
              record.grade_level ||
              record.gradeLevel ||
              record.student?.grade_level ||
              0,
            section: record.section || record.student?.section,
            checkInTime:
              record.start_time || record.checkInTime || record.check_in_time,
            checkOutTime:
              record.end_time || record.checkOutTime || record.check_out_time,
            duration: record.duration_minutes || record.duration,
            status: (record.status === 'ACTIVE' || !record.end_time
              ? 'ACTIVE'
              : 'COMPLETED') as 'ACTIVE' | 'COMPLETED',
            activityType:
              record.activity_type || record.activityType || 'LIBRARY_VISIT',
          })
        );
        setRecords(mappedRecords);
      }

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data as AttendanceSummary);
      }
    } catch (err) {
      console.error('Failed to fetch attendance', err);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Update date range based on tab
  useEffect(() => {
    const today = new Date();
    switch (activeTab) {
      case 'today':
        setDateRange({
          from: startOfDay(today),
          to: endOfDay(today),
        });
        break;
      case 'week':
        setDateRange({
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        });
        break;
      case 'month':
        setDateRange({
          from: startOfMonth(today),
          to: endOfMonth(today),
        });
        break;
      // 'custom' is handled separately
    }
  }, [activeTab]);

  // Fetch data when date range changes
  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Refresh when WebSocket activity comes in
  useEffect(() => {
    if (recentActivities.length > 0 && activeTab === 'today') {
      const latestActivity = recentActivities[0];
      if (
        latestActivity.type === 'CHECK_IN' ||
        latestActivity.type === 'CHECK_OUT'
      ) {
        fetchAttendance();
      }
    }
  }, [recentActivities, activeTab, fetchAttendance]);

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      toast.loading('Generating CSV...');
      const blob = await attendanceApi.exportCSV(
        dateRange.from.toISOString(),
        dateRange.to.toISOString()
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.dismiss();
      toast.success('CSV exported successfully!');
    } catch {
      toast.dismiss();
      toast.error('Failed to export CSV');
    }
  };

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !record.studentName?.toLowerCase().includes(query) &&
          !record.studentId?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Grade filter
      if (
        gradeFilter !== 'all' &&
        record.gradeLevel !== parseInt(gradeFilter)
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [records, searchQuery, gradeFilter, statusFilter]);

  // Format duration
  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Format grade level
  const formatGrade = (grade: number) => {
    if (grade === 0) return 'Kindergarten';
    return `Grade ${grade}`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Check-ins</p>
                <p className="text-2xl font-bold">
                  {summary?.totalCheckIns || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Check-outs</p>
                <p className="text-2xl font-bold">
                  {summary?.totalCheckOuts || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Currently Active
                </p>
                <p className="text-2xl font-bold">
                  {summary?.currentlyActive || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {formatDuration(summary?.averageDuration)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Peak Hour</p>
                <p className="text-2xl font-bold">{summary?.peakHour || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-sm text-muted-foreground">Unique Students</p>
                <p className="text-2xl font-bold">
                  {summary?.uniqueStudents || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Tabs */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Attendance Records
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAttendance}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              <Button variant="default" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>

              {activeTab === 'custom' && (
                <div className="flex items-center gap-2">
                  <DropdownMenu
                    open={customDateOpen}
                    onOpenChange={setCustomDateOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {format(dateRange.from, 'MMM d')} -{' '}
                        {format(dateRange.to, 'MMM d, yyyy')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) => {
                          if (range?.from && range?.to) {
                            setDateRange({
                              from: startOfDay(range.from),
                              to: endOfDay(range.to),
                            });
                            setCustomDateOpen(false);
                          }
                        }}
                        numberOfMonths={2}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  <SelectItem value="0">Kindergarten</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      Grade {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Currently In</SelectItem>
                  <SelectItem value="COMPLETED">Checked Out</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Records Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Check-out Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading attendance records...
                      </TableCell>
                    </TableRow>
                  ) : filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No attendance records found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.studentId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{formatGrade(record.gradeLevel)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <LogIn className="h-4 w-4 text-green-500" />
                            {format(new Date(record.checkInTime), 'h:mm a')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.checkOutTime ? (
                            <div className="flex items-center gap-1">
                              <LogOut className="h-4 w-4 text-blue-500" />
                              {format(new Date(record.checkOutTime), 'h:mm a')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDuration(record.duration)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === 'ACTIVE'
                                ? 'default'
                                : 'secondary'
                            }
                            className={
                              record.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : ''
                            }
                          >
                            {record.status === 'ACTIVE'
                              ? 'In Library'
                              : 'Completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer with count */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>
                Showing {filteredRecords.length} of {records.length} records
              </span>
              <span>
                {format(dateRange.from, 'MMM d, yyyy')} -{' '}
                {format(dateRange.to, 'MMM d, yyyy')}
              </span>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
