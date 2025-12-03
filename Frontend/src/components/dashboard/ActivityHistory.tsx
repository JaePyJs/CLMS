import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
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
import {
  History,
  Download,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  BookOpen,
  Monitor,
  Printer,
  Clock,
  AlertCircle,
  LogIn,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';

interface ActivityItem {
  id: string;
  type: string;
  studentId: string;
  studentName: string;
  description: string;
  timestamp: string;
  status: string;
  metadata?: Record<string, unknown>;
}

interface ActivityStats {
  totalActivities: number;
  checkIns: number;
  checkOuts: number;
  bookCheckouts: number;
  equipmentSessions: number;
  printJobs: number;
}

export default function ActivityHistory() {
  const { lastMessage } = useWebSocketContext();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [stats, setStats] = useState<ActivityStats>({
    totalActivities: 0,
    checkIns: 0,
    checkOuts: 0,
    bookCheckouts: 0,
    equipmentSessions: 0,
    printJobs: 0,
  });

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter === 'today') {
        params.append('date', 'today');
      } else if (dateFilter === 'week') {
        params.append('date', 'week');
      } else if (dateFilter === 'month') {
        params.append('date', 'month');
      }

      const response = await apiClient.get(
        `/api/analytics/activities?${params.toString()}`
      );

      if (response.success && response.data) {
        const data = response.data as {
          activities: ActivityItem[];
          stats: ActivityStats;
        };
        setActivities(data.activities || []);
        setStats(
          data.stats || {
            totalActivities: 0,
            checkIns: 0,
            checkOuts: 0,
            bookCheckouts: 0,
            equipmentSessions: 0,
            printJobs: 0,
          }
        );
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      toast.error('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (lastMessage?.type === 'ACTIVITY_LOG') {
      fetchActivities();
    }
  }, [lastMessage, fetchActivities]);

  // Filter activities based on search and type
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      searchQuery === '' ||
      activity.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'ALL' || activity.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleExportCSV = () => {
    if (filteredActivities.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Date/Time',
      'Type',
      'Student ID',
      'Student Name',
      'Description',
      'Status',
    ];
    const rows = filteredActivities.map((a) => [
      format(new Date(a.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      a.type,
      a.studentId,
      a.studentName,
      a.description,
      a.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredActivities.length} records`);
  };

  const handleResetHistory = async () => {
    setResetting(true);
    try {
      const response = await apiClient.delete(
        '/api/analytics/activities/reset'
      );
      if (response.success) {
        toast.success('Activity history has been reset');
        setShowResetDialog(false);
        fetchActivities();
      } else {
        toast.error('Failed to reset history');
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset activity history');
    } finally {
      setResetting(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CHECK_IN':
      case 'LIBRARY_VISIT':
      case 'KIOSK_CHECK_IN':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'CHECK_OUT':
        return <LogOut className="h-4 w-4 text-orange-500" />;
      case 'BOOK_CHECKOUT':
      case 'BOOK_RETURN':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'EQUIPMENT_USE':
        return <Monitor className="h-4 w-4 text-purple-500" />;
      case 'PRINTING':
        return <Printer className="h-4 w-4 text-cyan-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string | undefined | null) => {
    // Handle undefined/null status gracefully
    if (!status) {
      return <Badge variant="outline">Unknown</Badge>;
    }
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-blue-500">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'PAID':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'UNPAID':
        return <Badge variant="destructive">Unpaid</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'OVERDUE':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'RETURNED':
        return <Badge className="bg-blue-500">Returned</Badge>;
      case 'CHECKED_OUT':
        return <Badge className="bg-orange-500">Checked Out</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-900/30 dark:to-purple-900/30 p-6 rounded-xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-md">
              <History className="h-6 w-6 text-white" />
            </div>
            Activity History
          </h2>
          <p className="text-muted-foreground mt-1">
            View and manage all library activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || filteredActivities.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchActivities}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActivities}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Check-ins
            </CardTitle>
            <LogIn className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.checkIns}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Check-outs
            </CardTitle>
            <LogOut className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.checkOuts}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Book Checkouts
            </CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.bookCheckouts}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Equipment
            </CardTitle>
            <Monitor className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.equipmentSessions}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-cyan-50/50 dark:bg-cyan-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
              Print Jobs
            </CardTitle>
            <Printer className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {stats.printJobs}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap md:flex-nowrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, ID, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Activity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="CHECK_IN">Check-ins</SelectItem>
                <SelectItem value="CHECK_OUT">Check-outs</SelectItem>
                <SelectItem value="LIBRARY_VISIT">Library Visits</SelectItem>
                <SelectItem value="BOOK_CHECKOUT">Book Checkouts</SelectItem>
                <SelectItem value="BOOK_RETURN">Book Returns</SelectItem>
                <SelectItem value="EQUIPMENT_USE">Equipment Use</SelectItem>
                <SelectItem value="PRINTING">Printing</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Activities</span>
            <Badge variant="outline">{filteredActivities.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No activities found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Type</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.slice(0, 100).map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{getActivityIcon(activity.type)}</TableCell>
                      <TableCell className="text-sm">
                        {format(
                          new Date(activity.timestamp),
                          'MMM dd, yyyy HH:mm'
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">
                            {activity.studentName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.studentId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {activity.description}
                      </TableCell>
                      <TableCell>{getStatusBadge(activity.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {filteredActivities.length > 100 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Showing first 100 of {filteredActivities.length} records. Export
              to CSV for full data.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Reset Activity History
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all activity records from the
              history. This action cannot be undone. Are you sure you want to
              proceed?
            </DialogDescription>
          </DialogHeader>
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
                  Reset All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
