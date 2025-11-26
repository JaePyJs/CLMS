import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  History as HistoryIcon,
} from 'lucide-react';

interface AutomationJob {
  id: string;
  name: string;
  type:
    | 'GOOGLE_SHEETS_SYNC'
    | 'DAILY_BACKUP'
    | 'OVERDUE_NOTIFICATIONS'
    | 'FINE_CALCULATION';
  schedule: string;
  isEnabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  lastRunDuration: number | null;
  lastRunResult: string | null;
}

interface JobHistory {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  duration: number | null;
  result: string | null;
  error: string | null;
}

export default function AutomationSettings() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  // Fetch automation jobs
  const {
    data: jobs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['automation-jobs'],
    queryFn: async (): Promise<AutomationJob[]> => {
      const response = await apiClient.get('/api/automation/jobs');
      return (response.data as AutomationJob[]) || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });

  // Fetch job history for selected job
  const { data: jobHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['job-history', selectedJob],
    queryFn: async (): Promise<JobHistory[]> => {
      if (!selectedJob) {
        return [];
      }
      const response = await apiClient.get(
        `/api/automation/jobs/${selectedJob}/history`
      );
      return (response.data as JobHistory[]) || [];
    },
    enabled: !!selectedJob,
    staleTime: 10 * 1000, // 10 seconds
  });

  // Toggle job status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      jobId,
      currentStatus,
    }: {
      jobId: string;
      currentStatus: boolean;
    }) => {
      const endpoint = currentStatus
        ? `/api/automation/jobs/${jobId}/disable`
        : `/api/automation/jobs/${jobId}/enable`;
      const response = await apiClient.post(endpoint);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-jobs'] });
      toast.success(
        `Job ${variables.currentStatus ? 'disabled' : 'enabled'} successfully!`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update job status');
    },
  });

  // Run job now mutation
  const runMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.post(
        `/api/automation/jobs/${jobId}/run`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Job started successfully!');
      // Refresh after 1 second to show updated status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['automation-jobs'] });
      }, 1000);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to run job');
    },
  });

  const formatDate = (date: Date | null) => {
    if (!date) {
      return 'Never';
    }
    return new Date(date).toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) {
      return '-';
    }
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatCron = (cron: string) => {
    const scheduleMap: Record<string, string> = {
      '0 * * * *': 'Every Hour',
      '0 */2 * * *': 'Every 2 Hours',
      '0 */4 * * *': 'Every 4 Hours',
      '0 */6 * * *': 'Every 6 Hours',
      '0 0 * * *': 'Daily at Midnight',
      '0 8 * * *': 'Daily at 8 AM',
      '0 12 * * *': 'Daily at Noon',
      '0 0 * * 0': 'Weekly on Sunday',
    };
    return scheduleMap[cron] || cron;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return (
          <Badge className="bg-blue-500">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Idle
          </Badge>
        );
    }
  };

  const getJobTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      GOOGLE_SHEETS_SYNC: 'Google Sheets Sync',
      DAILY_BACKUP: 'Daily Backup',
      OVERDUE_NOTIFICATIONS: 'Overdue Notifications',
      FINE_CALCULATION: 'Fine Calculation',
    };
    return typeMap[type] || type;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading automation jobs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load automation jobs. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Automation Jobs Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Automation Jobs
          </CardTitle>
          <CardDescription>
            Manage scheduled automation tasks and background jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No automation jobs configured
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job: AutomationJob) => (
                    <TableRow
                      key={job.id}
                      className={`transition-colors duration-200 hover:bg-muted/50 dark:hover:bg-muted/30 ${selectedJob === job.id ? 'bg-muted/50 dark:bg-muted/30' : ''}`}
                      onClick={() => setSelectedJob(job.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell>{getJobTypeName(job.type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3" />
                          {formatCron(job.schedule)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(job.lastRunAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(job.nextRunAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(job.lastRunDuration)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMutation.mutate({
                                jobId: job.id,
                                currentStatus: job.isEnabled,
                              });
                            }}
                            disabled={toggleMutation.isPending}
                            className="transition-all duration-200 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
                          >
                            {job.isEnabled ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              runMutation.mutate(job.id);
                            }}
                            disabled={
                              runMutation.isPending ||
                              job.status === 'RUNNING' ||
                              !job.isEnabled
                            }
                            className="transition-all duration-200 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job History */}
      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5" />
              Job Execution History
            </CardTitle>
            <CardDescription>
              Recent execution history for the selected job
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : jobHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No execution history available
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobHistory.map((history: JobHistory) => (
                      <TableRow key={history.id}>
                        <TableCell className="text-sm">
                          {formatDate(history.startedAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(history.completedAt)}
                        </TableCell>
                        <TableCell>
                          {formatDuration(history.duration)}
                        </TableCell>
                        <TableCell>{getStatusBadge(history.status)}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {history.error || history.result || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Jobs:</span>
              <span className="font-medium">
                {jobs.filter((j: AutomationJob) => j.isEnabled).length} /{' '}
                {jobs.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Running Jobs:</span>
              <span className="font-medium">
                {
                  jobs.filter((j: AutomationJob) => j.status === 'RUNNING')
                    .length
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-refresh:</span>
              <span className="font-medium">Every 30 seconds</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
