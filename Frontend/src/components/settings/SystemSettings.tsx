import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { settingsApi } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorHandling';
import {
  Save,
  RotateCcw,
  Clock,
  DollarSign,
  BookOpen,
  Calendar,
  AlertCircle,
  Users,
  Building2,
} from 'lucide-react';

interface SystemConfig {
  libraryName?: string;
  fineRatePerDay: number;
  defaultCheckoutPeriod: number;
  overdueGracePeriod: number;
  maxBooksPerStudent: number;
  sessionTimeout: number;
  libraryHours: {
    open: string;
    close: string;
  };
  sessionLimits?: {
    PRIMARY: number;
    GRADE_SCHOOL: number;
    JUNIOR_HIGH: number;
    SENIOR_HIGH: number;
  };
}

const DEFAULT_CONFIG: SystemConfig = {
  libraryName: 'School Library',
  fineRatePerDay: 5.0,
  defaultCheckoutPeriod: 7,
  overdueGracePeriod: 0,
  maxBooksPerStudent: 5,
  sessionTimeout: 30,
  libraryHours: {
    open: '08:00',
    close: '18:00',
  },
  sessionLimits: {
    PRIMARY: 30,
    GRADE_SCHOOL: 60,
    JUNIOR_HIGH: 90,
    SENIOR_HIGH: 120,
  },
};

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings with TanStack Query
  const {
    data: settingsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const response = await settingsApi.getSystemSettings();
      return (response.data as SystemConfig) || DEFAULT_CONFIG;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (newSettings: SystemConfig) =>
      settingsApi.updateSystemSettings(newSettings),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Settings saved successfully!');
      if (response.data) {
        setSettings(response.data as SystemConfig);
      }
      setHasChanges(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to save settings'));
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => settingsApi.resetSystemSettings(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Settings reset to defaults');
      setSettings((response.data as SystemConfig) || DEFAULT_CONFIG);
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Failed to reset settings');
    },
  });

  // Initialize settings from query data
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  // Track changes
  useEffect(() => {
    if (settingsData) {
      const changed = JSON.stringify(settings) !== JSON.stringify(settingsData);
      setHasChanges(changed);
    }
  }, [settings, settingsData]);

  const saveSettings = () => {
    updateMutation.mutate(settings);
  };

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetMutation.mutate();
    }
  };

  const handleInputChange = (
    field: keyof SystemConfig,
    value: string | number | boolean | Record<string, number>
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLibraryHoursChange = (field: 'open' | 'close', value: string) => {
    setSettings((prev) => ({
      ...prev,
      libraryHours: {
        ...prev.libraryHours,
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load settings. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}

      {/* Library Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Library Information
          </CardTitle>
          <CardDescription>
            Configure your library's basic information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="libraryName">Library Name</Label>
            <Input
              id="libraryName"
              type="text"
              value={settings.libraryName || ''}
              onChange={(e) => handleInputChange('libraryName', e.target.value)}
              placeholder="School Library"
            />
            <p className="text-xs text-muted-foreground">
              Your library's display name shown throughout the system
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Fine Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Fine Configuration
          </CardTitle>
          <CardDescription>
            Configure fine rates and grace periods for overdue books
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fineRate">Fine Rate (per day)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₱
                </span>
                <Input
                  id="fineRate"
                  type="number"
                  min="0"
                  step="0.5"
                  value={settings.fineRatePerDay}
                  onChange={(e) =>
                    handleInputChange(
                      'fineRatePerDay',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Amount charged per day for overdue books
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gracePeriod">Grace Period</Label>
              <div className="relative">
                <Input
                  id="gracePeriod"
                  type="number"
                  min="0"
                  value={settings.overdueGracePeriod}
                  onChange={(e) =>
                    handleInputChange(
                      'overdueGracePeriod',
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  days
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Days before fines start accumulating
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Checkout Configuration
          </CardTitle>
          <CardDescription>
            Set default checkout periods and borrowing limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkoutPeriod">Default Checkout Period</Label>
              <div className="relative">
                <Input
                  id="checkoutPeriod"
                  type="number"
                  min="1"
                  value={settings.defaultCheckoutPeriod}
                  onChange={(e) =>
                    handleInputChange(
                      'defaultCheckoutPeriod',
                      parseInt(e.target.value) || 7
                    )
                  }
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  days
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Default number of days for book checkouts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxBooks">Max Books Per Student</Label>
              <Input
                id="maxBooks"
                type="number"
                min="1"
                value={settings.maxBooksPerStudent}
                onChange={(e) =>
                  handleInputChange(
                    'maxBooksPerStudent',
                    parseInt(e.target.value) || 5
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum books a student can borrow simultaneously
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Library Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Library Hours
          </CardTitle>
          <CardDescription>Set your library's operating hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="openTime">Opening Time</Label>
              <Input
                id="openTime"
                type="time"
                value={settings.libraryHours.open}
                onChange={(e) =>
                  handleLibraryHoursChange('open', e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeTime">Closing Time</Label>
              <Input
                id="closeTime"
                type="time"
                value={settings.libraryHours.close}
                onChange={(e) =>
                  handleLibraryHoursChange('close', e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Session Configuration
          </CardTitle>
          <CardDescription>
            Configure session timeout and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout</Label>
              <div className="relative">
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="5"
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    handleInputChange(
                      'sessionTimeout',
                      parseInt(e.target.value) || 30
                    )
                  }
                  className="pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  minutes
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Time before inactive users are logged out
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Session Limits by Grade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Student Session Limits
          </CardTitle>
          <CardDescription>
            Configure maximum session time limits for different grade levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryLimit">Primary (Preschool)</Label>
              <div className="relative">
                <Input
                  id="primaryLimit"
                  type="number"
                  min="15"
                  max="120"
                  value={settings.sessionLimits?.PRIMARY || 30}
                  onChange={(e) => {
                    const newLimits = {
                      ...settings.sessionLimits,
                      PRIMARY: parseInt(e.target.value) || 30,
                    };
                    handleInputChange('sessionLimits', newLimits);
                  }}
                  className="pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  minutes
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gradeSchoolLimit">Grade School (1-6)</Label>
              <div className="relative">
                <Input
                  id="gradeSchoolLimit"
                  type="number"
                  min="15"
                  max="180"
                  value={settings.sessionLimits?.GRADE_SCHOOL || 60}
                  onChange={(e) => {
                    const newLimits = {
                      ...settings.sessionLimits,
                      GRADE_SCHOOL: parseInt(e.target.value) || 60,
                    };
                    handleInputChange('sessionLimits', newLimits);
                  }}
                  className="pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  minutes
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="juniorHighLimit">Junior High (7-10)</Label>
              <div className="relative">
                <Input
                  id="juniorHighLimit"
                  type="number"
                  min="15"
                  max="180"
                  value={settings.sessionLimits?.JUNIOR_HIGH || 90}
                  onChange={(e) => {
                    const newLimits = {
                      ...settings.sessionLimits,
                      JUNIOR_HIGH: parseInt(e.target.value) || 90,
                    };
                    handleInputChange('sessionLimits', newLimits);
                  }}
                  className="pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  minutes
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniorHighLimit">Senior High (11-12)</Label>
              <div className="relative">
                <Input
                  id="seniorHighLimit"
                  type="number"
                  min="15"
                  max="240"
                  value={settings.sessionLimits?.SENIOR_HIGH || 120}
                  onChange={(e) => {
                    const newLimits = {
                      ...settings.sessionLimits,
                      SENIOR_HIGH: parseInt(e.target.value) || 120,
                    };
                    handleInputChange('sessionLimits', newLimits);
                  }}
                  className="pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  minutes
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum time students can use computers/equipment per session based
            on their grade level
          </p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t">
        <Button
          variant="outline"
          onClick={resetToDefaults}
          disabled={resetMutation.isPending || updateMutation.isPending}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {resetMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
        </Button>

        <div className="flex gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              Unsaved changes
            </span>
          )}
          <Button
            onClick={saveSettings}
            disabled={
              updateMutation.isPending || resetMutation.isPending || !hasChanges
            }
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
