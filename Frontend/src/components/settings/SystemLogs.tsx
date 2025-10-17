import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { FileText, Search, Download, Trash2, RefreshCw, AlertCircle, Info, AlertTriangle, XCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { settingsApi } from '@/lib/api';

interface SystemLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  details: string | null;
  source: string;
  userId: string | null;
  username: string | null;
  timestamp: Date;
}

interface LogsResponse {
  logs: SystemLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 50;

export default function SystemLogs() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Fetch logs with pagination and filters
  const { data, isLoading, error } = useQuery({
    queryKey: ['system-logs', page, levelFilter, sourceFilter, searchQuery],
    queryFn: async () => {
      const params: any = {
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      };

      if (levelFilter !== 'ALL') params.level = levelFilter;
      if (sourceFilter !== 'ALL') params.source = sourceFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await settingsApi.getLogs(params);
      return response.data as LogsResponse;
    },
    staleTime: 10 * 1000, // 10 seconds
    keepPreviousData: true, // Keep showing old data while fetching new page
  });

  const logs = data?.logs || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  // Clear logs mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/settings/logs/clear', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clear logs');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      toast.success('Logs cleared successfully!');
      setPage(1);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to clear logs');
    },
  });

  const handleClearLogs = () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }
    clearMutation.mutate();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(levelFilter !== 'ALL' && { level: levelFilter }),
        ...(sourceFilter !== 'ALL' && { source: sourceFilter }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/settings/logs/export?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        toast.error('Failed to export logs');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Logs exported successfully!');
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast.error('Failed to export logs');
    }
  };

  const handleSearch = () => {
    setPage(1); // Reset to first page on search
    queryClient.invalidateQueries({ queryKey: ['system-logs'] });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'INFO':
        return (
          <Badge className="bg-blue-500">
            <Info className="w-3 h-3 mr-1" />
            Info
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge className="bg-yellow-500">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Warning
          </Badge>
        );
      case 'ERROR':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge>{level}</Badge>;
    }
  };

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading system logs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load system logs. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            System Logs
          </CardTitle>
          <CardDescription>
            View and manage system logs, errors, and warnings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={levelFilter} onValueChange={(value) => {
              setLevelFilter(value);
              setPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={(value) => {
              setSourceFilter(value);
              setPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                <SelectItem value="API">API</SelectItem>
                <SelectItem value="AUTH">Authentication</SelectItem>
                <SelectItem value="DATABASE">Database</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="AUTOMATION">Automation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['system-logs'] })}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearLogs}
              disabled={clearMutation.isPending || logs.length === 0}
            >
              {clearMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Logs
                </>
              )}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {logs.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}-
              {Math.min(page * PAGE_SIZE, total)} of {total} logs
            </span>
            <span>
              Page {page} of {totalPages}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No logs found</p>
              <p className="text-sm">
                {searchQuery || levelFilter !== 'ALL' || sourceFilter !== 'ALL'
                  ? 'Try adjusting your filters'
                  : 'System logs will appear here'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: SystemLog) => (
                    <TableRow key={log.id}>
                      <TableCell>{getLevelBadge(log.level)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.source}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate">{log.message}</div>
                        {log.details && (
                          <div className="text-xs text-muted-foreground truncate">
                            {log.details}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.username || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground mx-4">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
