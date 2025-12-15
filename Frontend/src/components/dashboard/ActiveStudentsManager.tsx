import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Users,
  Clock,
  LogOut,
  Search,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';

interface ActiveSession {
  activityId: string;
  studentId: string;
  studentName: string;
  checkinTime: string;
  autoLogoutAt: string;
  section?: string;
}

export function ActiveStudentsManager() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { recentActivities } = useWebSocketContext();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ActiveSession[]>(
        '/api/students/active-sessions'
      );
      if (res.success && res.data) {
        setSessions(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch active sessions', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    // Poll every minute
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Refresh sessions when a check-in/check-out happens via WebSocket
  useEffect(() => {
    if (recentActivities.length > 0) {
      const latestActivity = recentActivities[0];
      // If there's a new check-in or check-out, refresh the list
      if (
        latestActivity.type === 'CHECK_IN' ||
        latestActivity.type === 'CHECK_OUT'
      ) {
        // Add small delay for checkout to ensure backend commit completes
        const delay = latestActivity.type === 'CHECK_OUT' ? 500 : 0;
        const timeoutId = setTimeout(() => {
          fetchSessions();
        }, delay);
        return () => clearTimeout(timeoutId);
      }
    }
    return undefined;
  }, [recentActivities, fetchSessions]);

  const handleMoveStudent = async (activityId: string, newSection: string) => {
    try {
      const res = await apiClient.put(
        `/api/students/activity/${activityId}/section`,
        {
          section: newSection,
        }
      );

      if (res.success) {
        toast.success('Student moved successfully');
        // Optimistic update
        setSessions((prev) =>
          prev.map((s) =>
            s.activityId === activityId ? { ...s, section: newSection } : s
          )
        );
      } else {
        toast.error('Failed to move student');
      }
    } catch {
      toast.error('Error moving student');
    }
  };

  const handleCheckout = async (studentId: string) => {
    try {
      const res = await apiClient.post(`/api/students/${studentId}/check-out`, {
        reason: 'manual_librarian',
      });

      if (res.success) {
        toast.success('Student checked out');
        setSessions((prev) => prev.filter((s) => s.studentId !== studentId));
      }
    } catch {
      toast.error('Error checking out student');
    }
  };

  const getTimeRemaining = (autoLogoutAt: string) => {
    const now = new Date();
    const logout = new Date(autoLogoutAt);
    const diff = logout.getTime() - now.getTime();

    if (diff <= 0) return { text: 'Overdue', variant: 'destructive' as const };

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    let variant: 'default' | 'secondary' | 'destructive' | 'outline' =
      'outline';
    if (minutes < 15) variant = 'destructive';
    else if (minutes < 30) variant = 'secondary';
    else variant = 'default';

    return {
      text: `${hours}h ${remainingMinutes}m`,
      variant,
    };
  };

  // Check if session has exceeded 15 minutes (attendance expired)
  const isSessionExpired = (checkinTime: string): boolean => {
    const now = new Date();
    const checkin = new Date(checkinTime);
    const diffMinutes = (now.getTime() - checkin.getTime()) / 60000;
    return diffMinutes >= 15;
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const lowerQuery = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.studentName.toLowerCase().includes(lowerQuery) ||
        s.studentId.toLowerCase().includes(lowerQuery)
    );
  }, [sessions, searchQuery]);

  return (
    <Card className="mt-6 shadow-lg border-0 bg-gradient-to-br from-white to-green-50/30 dark:from-slate-800 dark:to-green-950/10">
      <CardHeader className="pb-3 border-b border-green-100 dark:border-green-900/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                <Users className="h-5 w-5 text-white" />
              </div>
              Active Students
              <Badge className="ml-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white font-bold">
                {sessions.length} online
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Manage currently checked-in students and their locations
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student..."
              className="pl-9 border-green-200 dark:border-green-800 focus:ring-green-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="rounded-lg border border-green-100 dark:border-green-900/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <TableHead className="w-[250px] font-semibold text-green-800 dark:text-green-200">
                  Student
                </TableHead>
                <TableHead className="font-semibold text-green-800 dark:text-green-200">
                  Check-in Time
                </TableHead>
                <TableHead className="font-semibold text-green-800 dark:text-green-200">
                  Time Remaining
                </TableHead>
                <TableHead className="w-[200px] font-semibold text-green-800 dark:text-green-200">
                  Location
                </TableHead>
                <TableHead className="text-right font-semibold text-green-800 dark:text-green-200">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center bg-white dark:bg-slate-800"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-3 text-muted-foreground">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
                        <span className="font-medium">
                          Loading active sessions...
                        </span>
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-4">
                        <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
                          <Users className="h-10 w-10 opacity-30" />
                        </div>
                        <p className="font-medium text-lg">
                          No active students
                        </p>
                        <p className="text-sm">
                          Students will appear here when they check in
                        </p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        No students match your search.
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session) => {
                  const timeStatus = getTimeRemaining(session.autoLogoutAt);
                  return (
                    <TableRow
                      key={session.activityId}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {session.studentName}
                            </span>
                            {isSessionExpired(session.checkinTime) && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0 h-4 animate-pulse"
                              >
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                Expired
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {session.studentId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(session.checkinTime).toLocaleTimeString(
                            [],
                            { hour: '2-digit', minute: '2-digit' }
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={timeStatus.variant}
                          className="font-mono text-xs"
                        >
                          {timeStatus.text}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <Select
                            defaultValue={session.section || 'library'}
                            onValueChange={(val) =>
                              handleMoveStudent(session.activityId, val)
                            }
                          >
                            <SelectTrigger className="h-8 w-full bg-background">
                              <SelectValue placeholder="Select Area" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="library">
                                Main Library
                              </SelectItem>
                              <SelectItem value="avr">AVR</SelectItem>
                              <SelectItem value="computer_lab">
                                Computer Lab
                              </SelectItem>
                              <SelectItem value="study_area">
                                Study Area
                              </SelectItem>
                              <SelectItem value="discussion_room">
                                Discussion Room
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-8"
                          onClick={() => handleCheckout(session.studentId)}
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1.5" />
                          Checkout
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
