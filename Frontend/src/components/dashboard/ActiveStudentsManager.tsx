import { useState, useEffect, useMemo } from 'react';
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
import { Users, Clock, LogOut, Search, MapPin } from 'lucide-react';

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

  const fetchSessions = async () => {
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
  };

  useEffect(() => {
    fetchSessions();
    // Poll every minute
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, []);

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
    <Card className="mt-6 shadow-md border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Active Students
              <Badge variant="secondary" className="ml-2 px-2.5 py-0.5">
                {sessions.length}
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
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[250px]">Student</TableHead>
                <TableHead>Check-in Time</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead className="w-[200px]">Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        Loading active sessions...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-20" />
                        <p>No active students currently checked in.</p>
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
                          <span className="font-medium">
                            {session.studentName}
                          </span>
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
