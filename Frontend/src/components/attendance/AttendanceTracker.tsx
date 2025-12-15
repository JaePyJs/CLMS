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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { attendanceApi, apiClient } from '@/lib/api';
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
  Trash2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string; // Now a string to support "GRADE 3", "Personnel", etc.
  section?: string;
  checkInTime: string;
  checkOutTime?: string;
  duration?: number;
  status: 'ACTIVE' | 'COMPLETED';
  activityType: string;
  // Metadata fields from import
  designation?: string;
  bookTitle?: string;
  bookAuthor?: string;
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
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetPeriod, setResetPeriod] = useState<string>('today');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('checkInTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
          grade_level?: number | string;
          gradeLevel?: number | string;
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
          // Metadata fields from import
          designation?: string;
          bookTitle?: string;
          bookAuthor?: string;
        }
        const mappedRecords = (dataRes.data as RawAttendanceRecord[]).map(
          (record) => {
            // Handle gradeLevel - can be string from import or number from DB
            let gradeLevel = record.gradeLevel || record.grade_level || '';
            if (typeof gradeLevel === 'number') {
              gradeLevel =
                gradeLevel === 0 ? 'Pre-School' : `Grade ${gradeLevel}`;
            }
            // For Personnel, gradeLevel should be blank/N/A, NOT 'Personnel'
            // Personnel don't have a grade level - that goes in Section instead
            const isPersonnel =
              record.designation === 'Personnel' ||
              record.designation?.toLowerCase() === 'personnel';

            // Section display logic:
            // - For Personnel with no section: show 'Personnel'
            // - For others: show their actual section
            let section = record.section || record.student?.section;
            if (isPersonnel && !section) {
              section = 'Personnel';
            }

            return {
              id: record.id,
              studentId: record.student_id || record.studentId || 'unknown',
              studentName:
                record.student_name ||
                record.studentName ||
                `${record.student?.first_name || ''} ${record.student?.last_name || ''}`.trim() ||
                'Unknown',
              gradeLevel: gradeLevel || (isPersonnel ? 'N/A' : 'Unknown'),
              section: section,
              checkInTime:
                record.start_time ||
                record.checkInTime ||
                record.check_in_time ||
                new Date().toISOString(),
              checkOutTime:
                record.end_time || record.checkOutTime || record.check_out_time,
              duration: record.duration_minutes || record.duration,
              status: (record.status === 'ACTIVE' || !record.end_time
                ? 'ACTIVE'
                : 'COMPLETED') as 'ACTIVE' | 'COMPLETED',
              activityType:
                record.activity_type || record.activityType || 'LIBRARY_VISIT',
              designation: record.designation,
              bookTitle: record.bookTitle,
              bookAuthor: record.bookAuthor,
            };
          }
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

  // Refresh when WebSocket activity comes in (detect scan, print, room, equipment, etc.)
  useEffect(() => {
    if (recentActivities.length > 0 && activeTab === 'today') {
      const latestActivity = recentActivities[0];
      // Listen for all activity types to refresh the list
      const activityTypes = [
        'CHECK_IN',
        'CHECK_OUT',
        'ACTIVITY_LOG',
        'LIBRARY_VISIT',
        'KIOSK_CHECK_IN',
        'BOOK_CHECKOUT',
        'BOOK_RETURN',
        'EQUIPMENT_USE',
        'ROOM_ENTRY',
        'ROOM_EXIT',
        'PRINTING',
        'PRINTING',
        'RECREATION',
        'AVR',
        'COMPUTER_LAB',
        'STUDY_AREA',
        'DISCUSSION_ROOM',
      ];
      if (activityTypes.includes(latestActivity.type)) {
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

  // Reset history with period filter
  const handleResetHistory = async () => {
    setResetting(true);
    try {
      const response = await apiClient.delete(
        `/api/analytics/activities/reset?period=${resetPeriod}`
      );
      if (response.success) {
        const periodLabel =
          resetPeriod === 'today'
            ? "Today's"
            : resetPeriod === 'week'
              ? "This week's"
              : resetPeriod === 'month'
                ? "This month's"
                : 'All';
        toast.success(`${periodLabel} attendance history has been reset`);
        setShowResetDialog(false);
        fetchAttendance();
      } else {
        toast.error('Failed to reset history');
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset attendance history');
    } finally {
      setResetting(false);
    }
  };

  // Get period label for display
  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'today':
        return "today's";
      case 'week':
        return "this week's";
      case 'month':
        return "this month's";
      default:
        return 'all';
    }
  };

  // Filter records
  const filteredRecords = useMemo(() => {
    // Reset to first page when filters change
    setCurrentPage(1);

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
      if (gradeFilter !== 'all') {
        // Match by grade filter (handle "Grade X", "Personnel", etc.)
        const gradeNum = parseInt(gradeFilter);
        if (!isNaN(gradeNum)) {
          // Filter by grade number
          if (
            !record.gradeLevel.includes(`Grade ${gradeNum}`) &&
            !(gradeNum === 0 && record.gradeLevel.includes('Pre-School'))
          ) {
            return false;
          }
        } else if (
          gradeFilter.toLowerCase() !== record.gradeLevel.toLowerCase()
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }

      // Activity type filter
      if (activityTypeFilter !== 'all') {
        // Normalize both values for comparison
        const normalizeType = (type: string) =>
          type?.toLowerCase().replace(/[_\s-]+/g, '') || '';

        const actType = normalizeType(record.activityType);
        const filterType = normalizeType(activityTypeFilter);

        // Handle special cases: 'checkin' matches 'library_visit' too if looking for check-ins
        if (filterType === 'checkin') {
          if (actType !== 'checkin' && actType !== 'libraryvisit') {
            return false;
          }
        } else if (filterType === 'roomuse') {
          const roomTypes = [
            'avr',
            'computer',
            'study',
            'discussion',
            'room',
            'lab',
          ];
          if (!roomTypes.some((t) => actType.includes(t))) {
            return false;
          }
        } else if (!actType.includes(filterType)) {
          return false;
        }
      }

      return true;
    });
  }, [records, searchQuery, gradeFilter, statusFilter, activityTypeFilter]);

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  // Sorted records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let aValue: string | number | Date = '';
      let bValue: string | number | Date = '';

      switch (sortColumn) {
        case 'studentName':
          aValue = a.studentName.toLowerCase();
          bValue = b.studentName.toLowerCase();
          break;
        case 'gradeLevel':
          aValue = a.gradeLevel.toLowerCase();
          bValue = b.gradeLevel.toLowerCase();
          break;
        case 'section':
          aValue = (a.section || '').toLowerCase();
          bValue = (b.section || '').toLowerCase();
          break;
        case 'checkInTime':
          aValue = new Date(a.checkInTime).getTime();
          bValue = new Date(b.checkInTime).getTime();
          break;
        case 'checkOutTime':
          aValue = a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
          bValue = b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        default:
          aValue = new Date(a.checkInTime).getTime();
          bValue = new Date(b.checkInTime).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedRecords.length / pageSize);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

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

  // Format grade level (now a string)
  const formatGrade = (grade: string) => {
    return grade || 'Unknown';
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
                <p className="text-sm text-muted-foreground">Active Today</p>
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
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResetDialog(true)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Reset History
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
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">From:</span>
                    <Input
                      type="date"
                      value={format(dateRange.from, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          setDateRange((prev) => ({
                            from: startOfDay(newDate),
                            to: prev.to < newDate ? endOfDay(newDate) : prev.to,
                          }));
                        }
                      }}
                      className="w-[140px] h-8"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">To:</span>
                    <Input
                      type="date"
                      value={format(dateRange.to, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          setDateRange((prev) => ({
                            from:
                              prev.from > newDate
                                ? startOfDay(newDate)
                                : prev.from,
                            to: endOfDay(newDate),
                          }));
                        }
                      }}
                      className="w-[140px] h-8"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      const today = new Date();
                      setDateRange({
                        from: startOfDay(today),
                        to: endOfDay(today),
                      });
                    }}
                  >
                    Today
                  </Button>
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
                  <SelectItem value="personnel">Personnel</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Currently In</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={activityTypeFilter}
                onValueChange={setActivityTypeFilter}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Activity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CHECK_IN">Check In</SelectItem>
                  <SelectItem value="CHECK_OUT">Check Out</SelectItem>
                  <SelectItem value="BORROWED">Borrowed</SelectItem>
                  <SelectItem value="ROOM_USE">Room Use</SelectItem>
                  <SelectItem value="RECREATION">Recreation</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => setPageSize(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10/page</SelectItem>
                  <SelectItem value="25">25/page</SelectItem>
                  <SelectItem value="50">50/page</SelectItem>
                  <SelectItem value="100">100/page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Records Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('studentName')}
                    >
                      <div className="flex items-center gap-1">
                        Student
                        {sortColumn === 'studentName' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('gradeLevel')}
                    >
                      <div className="flex items-center gap-1">
                        Grade
                        {sortColumn === 'gradeLevel' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('section')}
                    >
                      <div className="flex items-center gap-1">
                        Section
                        {sortColumn === 'section' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('activityType')}
                    >
                      <div className="flex items-center gap-1">
                        Location / Activity
                        {sortColumn === 'activityType' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('checkInTime')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortColumn === 'checkInTime' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('checkOutTime')}
                    >
                      <div className="flex items-center gap-1">
                        Check-out
                        {sortColumn === 'checkOutTime' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('duration')}
                    >
                      <div className="flex items-center gap-1">
                        Duration
                        {sortColumn === 'duration' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Book Info</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading attendance records...
                      </TableCell>
                    </TableRow>
                  ) : paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No attendance records found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecords.map((record) => (
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
                          <span className="text-sm">
                            {record.section || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {format(
                              new Date(record.checkInTime),
                              'MMM d, yyyy'
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <LogIn className="h-4 w-4 text-green-500" />
                            {format(new Date(record.checkInTime), 'h:mm:ss a')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.checkOutTime ? (
                            <div className="flex items-center gap-1">
                              <LogOut className="h-4 w-4 text-blue-500" />
                              {format(
                                new Date(record.checkOutTime),
                                'h:mm:ss a'
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDuration(record.duration)}</TableCell>
                        <TableCell>
                          {record.bookTitle ? (
                            <div className="text-sm">
                              <p
                                className="font-medium truncate max-w-[150px]"
                                title={record.bookTitle}
                              >
                                {record.bookTitle}
                              </p>
                              {record.bookAuthor && (
                                <p
                                  className="text-muted-foreground truncate max-w-[150px]"
                                  title={record.bookAuthor}
                                >
                                  by {record.bookAuthor}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
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

            {/* Footer with count and pagination */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filteredRecords.length)} of{' '}
                {filteredRecords.length} records
                {records.length !== filteredRecords.length &&
                  ` (filtered from ${records.length})`}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {format(dateRange.from, 'MMM d, yyyy')} -{' '}
                  {format(dateRange.to, 'MMM d, yyyy')}
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Reset Attendance History
            </DialogTitle>
            <DialogDescription>
              This will permanently delete attendance records. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Select time period to delete:
            </label>
            <Select value={resetPeriod} onValueChange={setResetPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today's Records</SelectItem>
                <SelectItem value="week">This Week's Records</SelectItem>
                <SelectItem value="month">This Month's Records</SelectItem>
                <SelectItem value="all">All Records</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              You are about to delete {getPeriodLabel(resetPeriod)} attendance
              records.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetHistory}
              disabled={resetting}
            >
              {resetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset Records
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
