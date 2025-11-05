import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TestTube,
  Clock,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { settingsApi } from '@/lib/api';
import { getErrorMessage, hasProperty } from '@/utils/errorHandling';

interface GoogleSheetsConfigData {
  spreadsheetId: string;
  credentialsUploaded: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastSync: Date | null;
  lastSyncRecordCount: number;
  autoSync: boolean;
  syncSchedule: string; // cron expression
}

const SYNC_SCHEDULES = [
  { value: '0 * * * *', label: 'Every Hour' },
  { value: '0 */2 * * *', label: 'Every 2 Hours' },
  { value: '0 */4 * * *', label: 'Every 4 Hours' },
  { value: '0 */6 * * *', label: 'Every 6 Hours' },
  { value: '0 0 * * *', label: 'Daily at Midnight' },
  { value: '0 8 * * *', label: 'Daily at 8 AM' },
  { value: '0 12 * * *', label: 'Daily at Noon' },
];

const DEFAULT_CONFIG: GoogleSheetsConfigData = {
  spreadsheetId: '',
  credentialsUploaded: false,
  connectionStatus: 'disconnected',
  lastSync: null,
  lastSyncRecordCount: 0,
  autoSync: false,
  syncSchedule: '0 */4 * * *',
};

export default function GoogleSheetsConfig() {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] =
    useState<GoogleSheetsConfigData>(DEFAULT_CONFIG);

  // Fetch Google Sheets configuration
  const {
    data: config = DEFAULT_CONFIG,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['google-sheets-config'],
    queryFn: async () => {
      try {
        const response = await settingsApi.getGoogleSheetsConfig();
        const data =
          (response.data as GoogleSheetsConfigData) || DEFAULT_CONFIG;
        setLocalConfig(data);
        return data;
      } catch (err: unknown) {
        // If no config exists yet, use defaults
        if (
          hasProperty(err, 'response') &&
          typeof err.response === 'object' &&
          err.response !== null &&
          hasProperty(err.response, 'status') &&
          err.response.status === 404
        ) {
          toast.info('Google Sheets integration not configured yet');
          return DEFAULT_CONFIG;
        }
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Upload credentials mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('credentials', file);

      const response = await fetch('/api/settings/google-sheets/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload credentials');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-config'] });
      toast.success('Credentials uploaded successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload credentials');
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (spreadsheetId: string) =>
      settingsApi.testGoogleSheetsConnection(spreadsheetId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-config'] });
      const data = response.data as { message?: string };
      toast.success(
        data?.message || 'Successfully connected to Google Sheets!'
      );
      setLocalConfig((prev) => ({ ...prev, connectionStatus: 'connected' }));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to connect to Google Sheets'));
      setLocalConfig((prev) => ({ ...prev, connectionStatus: 'error' }));
    },
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: () => settingsApi.syncGoogleSheets(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-config'] });
      const data = response.data as { recordCount?: number };
      const recordCount = data?.recordCount || 0;
      toast.success(`Successfully synced ${recordCount} records!`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to sync data'));
    },
  });

  // Save schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: (scheduleConfig: {
      autoSync: boolean;
      syncSchedule: string;
      spreadsheetId: string;
    }) => settingsApi.updateGoogleSheetsSchedule(scheduleConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-config'] });
      toast.success('Sync schedule updated successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to save schedule'));
    },
  });

  // Handlers
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.endsWith('.json')) {
      toast.error('Please upload a JSON credentials file');
      return;
    }

    uploadMutation.mutate(file);
    event.target.value = ''; // Reset file input
  };

  const testConnection = () => {
    if (!localConfig.spreadsheetId) {
      toast.error('Please enter a Spreadsheet ID first');
      return;
    }

    if (!localConfig.credentialsUploaded && !config.credentialsUploaded) {
      toast.error('Please upload credentials first');
      return;
    }

    testMutation.mutate(localConfig.spreadsheetId);
  };

  const manualSync = () => {
    if (
      localConfig.connectionStatus !== 'connected' &&
      config.connectionStatus !== 'connected'
    ) {
      toast.error('Please test connection first');
      return;
    }

    syncMutation.mutate();
  };

  const saveSchedule = () => {
    scheduleMutation.mutate({
      autoSync: localConfig.autoSync,
      syncSchedule: localConfig.syncSchedule,
      spreadsheetId: localConfig.spreadsheetId,
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) {
      return 'Never';
    }
    return new Date(date).toLocaleString();
  };

  const getConnectionStatusBadge = () => {
    const status = localConfig.connectionStatus || config.connectionStatus;
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Connected
          </Badge>
        );
    }
  };

  const getScheduleLabel = () => {
    const scheduleValue = localConfig.syncSchedule || config.syncSchedule;
    const schedule = SYNC_SCHEDULES.find((s) => s.value === scheduleValue);
    return schedule?.label || scheduleValue;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading configuration...</p>
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
          Failed to load configuration. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sheet className="w-5 h-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                {getConnectionStatusBadge()}
              </div>
              {(config.credentialsUploaded ||
                localConfig.credentialsUploaded) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Credentials uploaded
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Google Sheets Configuration</CardTitle>
          <CardDescription>
            Configure your Google Sheets integration for data synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spreadsheet ID */}
          <div className="space-y-2">
            <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
            <Input
              id="spreadsheetId"
              placeholder="Enter the spreadsheet ID from the URL"
              value={localConfig.spreadsheetId}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  spreadsheetId: e.target.value,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Google Sheets URL:
              docs.google.com/spreadsheets/d/<strong>[SPREADSHEET_ID]</strong>
              /edit
            </p>
          </div>

          {/* Credentials Upload */}
          <div className="space-y-2">
            <Label htmlFor="credentials">Service Account Credentials</Label>
            <div className="flex items-center gap-2">
              <Input
                id="credentials"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
                className="cursor-pointer"
              />
              {uploadMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload your Google Cloud service account JSON credentials file
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={
                testMutation.isPending ||
                !localConfig.spreadsheetId ||
                (!localConfig.credentialsUploaded &&
                  !config.credentialsUploaded)
              }
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            <Button
              onClick={manualSync}
              disabled={
                syncMutation.isPending ||
                (localConfig.connectionStatus !== 'connected' &&
                  config.connectionStatus !== 'connected')
              }
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto-sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Automatic Synchronization
          </CardTitle>
          <CardDescription>
            Configure automatic data synchronization schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable Auto-sync */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoSync" className="text-base">
                Enable Auto-sync
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync data based on schedule
              </p>
            </div>
            <input
              type="checkbox"
              id="autoSync"
              checked={localConfig.autoSync}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, autoSync: e.target.checked })
              }
              className="h-4 w-4"
              disabled={
                localConfig.connectionStatus !== 'connected' &&
                config.connectionStatus !== 'connected'
              }
            />
          </div>

          {/* Sync Schedule */}
          {localConfig.autoSync && (
            <div className="space-y-2">
              <Label htmlFor="syncSchedule">Sync Schedule</Label>
              <Select
                value={localConfig.syncSchedule}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, syncSchedule: value })
                }
                disabled={
                  localConfig.connectionStatus !== 'connected' &&
                  config.connectionStatus !== 'connected'
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_SCHEDULES.map((schedule) => (
                    <SelectItem key={schedule.value} value={schedule.value}>
                      {schedule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Save Schedule Button */}
          <Button
            onClick={saveSchedule}
            disabled={
              scheduleMutation.isPending ||
              (localConfig.connectionStatus !== 'connected' &&
                config.connectionStatus !== 'connected')
            }
          >
            {scheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
          </Button>
        </CardContent>
      </Card>

      {/* Last Sync Info */}
      {config.lastSync && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Last Synchronization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last synced:</span>
                <span className="font-medium">
                  {formatDate(config.lastSync)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Records synced:</span>
                <span className="font-medium">
                  {config.lastSyncRecordCount}
                </span>
              </div>
              {config.autoSync && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Schedule:</span>
                  <span className="font-medium">{getScheduleLabel()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
