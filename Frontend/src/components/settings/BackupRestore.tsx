import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Database,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Trash2,
} from 'lucide-react';
import { settingsApi } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';

interface Backup {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  type: 'MANUAL' | 'AUTOMATIC';
  status: 'COMPLETED' | 'FAILED';
}

export default function BackupRestore() {
  const queryClient = useQueryClient();

  // Fetch backups
  const {
    data: backups = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['backups'],
    queryFn: async (): Promise<Backup[]> => {
      const response = await settingsApi.getBackups();
      return (response.data as Backup[]) || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Create backup mutation
  const createMutation = useMutation({
    mutationFn: () => settingsApi.createBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup created successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to create backup'));
    },
  });

  // Delete backup mutation
  const deleteMutation = useMutation({
    mutationFn: (backupId: string) => settingsApi.deleteBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup deleted successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to delete backup'));
    },
  });

  const handleDelete = (backupId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this backup? This action cannot be undone.'
      )
    ) {
      return;
    }
    deleteMutation.mutate(backupId);
  };

  const handleDownload = async (backupId: string, filename: string) => {
    try {
      const response = await fetch(
        `/api/settings/backups/${backupId}/download`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        toast.error('Failed to download backup');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Backup downloaded successfully!');
    } catch (error) {
      console.error('Failed to download backup:', error);
      toast.error('Failed to download backup');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'MANUAL' ? (
      <Badge variant="default">Manual</Badge>
    ) : (
      <Badge variant="secondary">Automatic</Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading backups...</p>
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
          Failed to load backups. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Backup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Create New Backup
          </CardTitle>
          <CardDescription>
            Create a manual backup of your entire library database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Backs up all students, books, equipment, activities, and system
                settings
              </p>
              <p className="text-sm text-muted-foreground">
                Recommended: Create backups before major system updates
              </p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="ml-4"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Create Backup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Available Backups
            </div>
            <Badge variant="outline">
              {backups.length} {backups.length === 1 ? 'backup' : 'backups'}
            </Badge>
          </CardTitle>
          <CardDescription>Download or delete existing backups</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No backups available</p>
              <p className="text-sm">Create your first backup to get started</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup: Backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-medium">
                        {backup.filename}
                      </TableCell>
                      <TableCell>{getTypeBadge(backup.type)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatSize(backup.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(backup.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(backup.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDownload(backup.id, backup.filename)
                            }
                            disabled={backup.status !== 'COMPLETED'}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(backup.id)}
                            disabled={deleteMutation.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Restore Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Restore Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2">
            <div className="font-semibold">1.</div>
            <div>
              <strong>Download</strong> the backup file you want to restore
            </div>
          </div>
          <div className="flex gap-2">
            <div className="font-semibold">2.</div>
            <div>
              <strong>Stop</strong> the application servers (Backend & Frontend)
            </div>
          </div>
          <div className="flex gap-2">
            <div className="font-semibold">3.</div>
            <div>
              Run the restore script:{' '}
              <code className="bg-muted px-1 py-0.5 rounded">
                npm run restore:backup -- path/to/backup.sql
              </code>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="font-semibold">4.</div>
            <div>
              <strong>Restart</strong> the application servers
            </div>
          </div>
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Restoring a backup will replace all
              current data. This action cannot be undone. Always create a new
              backup before restoring an old one.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
