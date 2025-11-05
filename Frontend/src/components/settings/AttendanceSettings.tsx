import React, { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import {
  Clock,
  Users,
  Save,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AttendanceSetting {
  key: string;
  value: string;
  description?: string;
  category: string;
}

export default function AttendanceSettings() {
  const { user: _user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [_settings, setSettings] = useState<AttendanceSetting[]>([]);
  const [minCheckInInterval, setMinCheckInInterval] = useState(10);
  const [defaultSessionTime, setDefaultSessionTime] = useState(30);

  // Date range for export
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default: last 30 days
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/category/attendance', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setSettings(data.data);

        // Extract specific settings
        const minInterval = data.data.find(
          (s: AttendanceSetting) =>
            s.key === 'attendance.min_check_in_interval_minutes'
        );
        const defaultSession = data.data.find(
          (s: AttendanceSetting) =>
            s.key === 'attendance.default_session_time_minutes'
        );

        if (minInterval) {
          setMinCheckInInterval(parseInt(minInterval.value));
        }
        if (defaultSession) {
          setDefaultSessionTime(parseInt(defaultSession.value));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load attendance settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsToUpdate = [
        {
          key: 'attendance.min_check_in_interval_minutes',
          value: minCheckInInterval.toString(),
        },
        {
          key: 'attendance.default_session_time_minutes',
          value: defaultSessionTime.toString(),
        },
      ];

      const response = await fetch('/api/settings/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
        },
        body: JSON.stringify({ settings: settingsToUpdate }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Attendance settings saved successfully');
        // Reload settings to reflect changes
        loadSettings();
      } else {
        throw new Error(data.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save attendance settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitializeDefaults = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initialize settings');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Default attendance settings initialized');
        loadSettings();
      } else {
        throw new Error(data.message || 'Failed to initialize settings');
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
      toast.error('Failed to initialize default settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/attendance-export/export/csv?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clms-attendance-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Attendance data exported to CSV successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Excel (will be CSV that Excel can open)
  const handleExportExcel = async () => {
    // CSV works with Excel, so we use the same function
    await handleExportCSV();
    toast.success('Data exported - open with Microsoft Excel or Google Sheets');
  };

  // Export to Google Sheets (get data that can be copied)
  const handleExportGoogleSheets = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/attendance-export/google-sheets?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get Google Sheets data');
      }

      const data = await response.json();
      if (data.success && data.data) {
        // Create a copyable format
        const { headers, rows } = data.data;
        const csvContent = [
          headers.join('\t'),
          ...rows.map((r: Array<string | number>) => r.join('\t')),
        ].join('\n');

        // Copy to clipboard
        await navigator.clipboard.writeText(csvContent);
        toast.success(
          'Attendance data copied to clipboard! Paste into Google Sheets'
        );
      } else {
        throw new Error(data.message || 'Failed to get data');
      }
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      toast.error('Failed to export to Google Sheets');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Loading attendance settings...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Scanner Settings
          </CardTitle>
          <CardDescription>
            Configure attendance scanner rules and time limits. These settings
            apply to all student check-ins through the library scanner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Minimum Check-In Interval */}
          <div className="space-y-2">
            <Label
              htmlFor="min-check-in-interval"
              className="text-base font-semibold"
            >
              Minimum Time Between Check-Ins (Minutes)
            </Label>
            <p className="text-sm text-muted-foreground">
              Students must wait this amount of time before they can check in
              again after checking out. Default is 10 minutes.
            </p>
            <Input
              id="min-check-in-interval"
              type="number"
              min="1"
              max="60"
              value={minCheckInInterval}
              onChange={(e) =>
                setMinCheckInInterval(parseInt(e.target.value) || 10)
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Current setting:{' '}
              <span className="font-semibold">
                {minCheckInInterval} minute(s)
              </span>
            </p>
          </div>

          {/* Default Session Time */}
          <div className="space-y-2">
            <Label
              htmlFor="default-session-time"
              className="text-base font-semibold"
            >
              Default Session Time (Minutes)
            </Label>
            <p className="text-sm text-muted-foreground">
              Default time limit for student activities when checking in.
              Students can use the library for this duration.
            </p>
            <Input
              id="default-session-time"
              type="number"
              min="5"
              max="180"
              value={defaultSessionTime}
              onChange={(e) =>
                setDefaultSessionTime(parseInt(e.target.value) || 30)
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Current setting:{' '}
              <span className="font-semibold">
                {defaultSessionTime} minute(s)
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleInitializeDefaults}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Attendance Data Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Attendance Data
          </CardTitle>
          <CardDescription>
            Export student attendance records to CSV, Excel, or Google Sheets
            for external analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select Date Range</Label>
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="start-date" className="text-sm font-normal">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="end-date" className="text-sm font-normal">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Export Format</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <Button
                onClick={handleExportCSV}
                disabled={isExporting}
                variant="outline"
                className="gap-2 h-auto py-4"
              >
                {isExporting ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Export CSV</div>
                  <div className="text-xs text-muted-foreground">
                    Download as CSV file
                  </div>
                </div>
              </Button>

              <Button
                onClick={handleExportExcel}
                disabled={isExporting}
                variant="outline"
                className="gap-2 h-auto py-4"
              >
                {isExporting ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Export Excel</div>
                  <div className="text-xs text-muted-foreground">
                    Open with Excel
                  </div>
                </div>
              </Button>

              <Button
                onClick={handleExportGoogleSheets}
                disabled={isExporting}
                variant="outline"
                className="gap-2 h-auto py-4"
              >
                {isExporting ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Google Sheets</div>
                  <div className="text-xs text-muted-foreground">
                    Copy to clipboard
                  </div>
                </div>
              </Button>
            </div>
          </div>

          {/* Export Info */}
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-semibold mb-1">Exported data includes:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Student ID and Name</li>
              <li>Grade Level</li>
              <li>Check-in and Check-out Times</li>
              <li>Duration in Minutes</li>
              <li>Session Status (Active/Completed)</li>
              <li>Activity Type</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Users className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-semibold text-blue-800 dark:text-blue-200">
              Check-In Process:
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300 ml-4">
              <li>Student scans their ID card at the library scanner</li>
              <li>If they don't have an active session, they are checked in</li>
              <li>
                If the minimum time hasn't passed since last check-out, a
                cooldown warning is shown
              </li>
              <li>
                The scanner shows how much time is remaining before they can
                check in again
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-blue-800 dark:text-blue-200">
              Check-Out Process:
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300 ml-4">
              <li>Student scans their ID card again while checked in</li>
              <li>They are automatically checked out</li>
              <li>The cooldown timer starts counting down</li>
              <li>
                They cannot check in again until the cooldown period is over
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
