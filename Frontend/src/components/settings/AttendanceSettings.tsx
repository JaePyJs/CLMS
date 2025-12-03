import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Clock, Save, RotateCcw, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AttendanceSettingsData {
  minCheckInInterval: number;
  defaultSessionTime: number;
  primaryTimeLimit: number;
  gradeSchoolTimeLimit: number;
  juniorHighTimeLimit: number;
  seniorHighTimeLimit: number;
  autoCheckoutEnabled: boolean;
  autoCheckoutTime: string;
  cooldownEnabled: boolean;
}

const DEFAULT_SETTINGS: AttendanceSettingsData = {
  minCheckInInterval: 10,
  defaultSessionTime: 30,
  primaryTimeLimit: 15,
  gradeSchoolTimeLimit: 30,
  juniorHighTimeLimit: 45,
  seniorHighTimeLimit: 60,
  autoCheckoutEnabled: true,
  autoCheckoutTime: '17:00',
  cooldownEnabled: true,
};

export default function AttendanceSettings() {
  const [settings, setSettings] =
    useState<AttendanceSettingsData>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<AttendanceSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // Check if settings have changed
    const changed =
      JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/api/settings/category/attendance');
      if (response.success && response.data) {
        // Transform array of settings to object
        const settingsObj: Partial<AttendanceSettingsData> = {};
        const dataArray = Array.isArray(response.data) ? response.data : [];
        dataArray.forEach((setting: { key: string; value: string }) => {
          const key = setting.key.replace('attendance.', '');
          const value = setting.value;

          switch (key) {
            case 'min_check_in_interval_minutes':
              settingsObj.minCheckInInterval =
                parseInt(value) || DEFAULT_SETTINGS.minCheckInInterval;
              break;
            case 'default_session_time_minutes':
              settingsObj.defaultSessionTime =
                parseInt(value) || DEFAULT_SETTINGS.defaultSessionTime;
              break;
            case 'primary_time_limit':
              settingsObj.primaryTimeLimit =
                parseInt(value) || DEFAULT_SETTINGS.primaryTimeLimit;
              break;
            case 'grade_school_time_limit':
              settingsObj.gradeSchoolTimeLimit =
                parseInt(value) || DEFAULT_SETTINGS.gradeSchoolTimeLimit;
              break;
            case 'junior_high_time_limit':
              settingsObj.juniorHighTimeLimit =
                parseInt(value) || DEFAULT_SETTINGS.juniorHighTimeLimit;
              break;
            case 'senior_high_time_limit':
              settingsObj.seniorHighTimeLimit =
                parseInt(value) || DEFAULT_SETTINGS.seniorHighTimeLimit;
              break;
            case 'auto_checkout_enabled':
              settingsObj.autoCheckoutEnabled = value === 'true';
              break;
            case 'auto_checkout_time':
              settingsObj.autoCheckoutTime =
                value || DEFAULT_SETTINGS.autoCheckoutTime;
              break;
            case 'cooldown_enabled':
              settingsObj.cooldownEnabled = value !== 'false';
              break;
          }
        });

        const merged = { ...DEFAULT_SETTINGS, ...settingsObj };
        setSettings(merged);
        setOriginalSettings(merged);
      }
    } catch (error) {
      console.error('Failed to load attendance settings:', error);
      toast.error('Failed to load attendance settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Save each setting
      const settingsToSave = [
        {
          key: 'attendance.min_check_in_interval_minutes',
          value: String(settings.minCheckInInterval),
        },
        {
          key: 'attendance.default_session_time_minutes',
          value: String(settings.defaultSessionTime),
        },
        {
          key: 'attendance.primary_time_limit',
          value: String(settings.primaryTimeLimit),
        },
        {
          key: 'attendance.grade_school_time_limit',
          value: String(settings.gradeSchoolTimeLimit),
        },
        {
          key: 'attendance.junior_high_time_limit',
          value: String(settings.juniorHighTimeLimit),
        },
        {
          key: 'attendance.senior_high_time_limit',
          value: String(settings.seniorHighTimeLimit),
        },
        {
          key: 'attendance.auto_checkout_enabled',
          value: String(settings.autoCheckoutEnabled),
        },
        {
          key: 'attendance.auto_checkout_time',
          value: settings.autoCheckoutTime,
        },
        {
          key: 'attendance.cooldown_enabled',
          value: String(settings.cooldownEnabled),
        },
      ];

      await Promise.all(
        settingsToSave.map((setting) =>
          apiClient.put('/api/settings', {
            key: setting.key,
            value: setting.value,
            category: 'attendance',
          })
        )
      );

      setOriginalSettings(settings);
      toast.success('Attendance settings saved successfully');
    } catch (error) {
      console.error('Failed to save attendance settings:', error);
      toast.error('Failed to save attendance settings');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleNumberChange = (
    field: keyof AttendanceSettingsData,
    value: string
  ) => {
    const num = parseInt(value) || 0;
    setSettings((prev) => ({ ...prev, [field]: num }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Attendance Settings
              </CardTitle>
              <CardDescription>
                Configure check-in/check-out behavior and time limits
              </CardDescription>
            </div>
            {hasChanges && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-600"
              >
                Unsaved Changes
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Check-in Interval */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              Check-in Cooldown
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Prevents students from checking in multiple times in quick
                    succession
                  </p>
                </TooltipContent>
              </Tooltip>
            </h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="cooldown-enabled">Enable cooldown period</Label>
              <Switch
                id="cooldown-enabled"
                checked={settings.cooldownEnabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, cooldownEnabled: checked }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="min-interval">
                Minimum check-in interval (minutes)
              </Label>
              <Input
                id="min-interval"
                type="number"
                min={1}
                max={60}
                value={settings.minCheckInInterval}
                onChange={(e) =>
                  handleNumberChange('minCheckInInterval', e.target.value)
                }
                disabled={!settings.cooldownEnabled}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Students must wait this long before checking in again
              </p>
            </div>
          </div>

          <Separator />

          {/* Time Limits by Grade */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              Session Time Limits by Grade Level
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Maximum time a student can stay in the library before being
                    flagged as overdue
                  </p>
                </TooltipContent>
              </Tooltip>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-limit">Primary (Grades 1-3)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primary-limit"
                    type="number"
                    min={5}
                    max={120}
                    value={settings.primaryTimeLimit}
                    onChange={(e) =>
                      handleNumberChange('primaryTimeLimit', e.target.value)
                    }
                    className="max-w-[100px]"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade-school-limit">
                  Grade School (Grades 4-6)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grade-school-limit"
                    type="number"
                    min={5}
                    max={120}
                    value={settings.gradeSchoolTimeLimit}
                    onChange={(e) =>
                      handleNumberChange('gradeSchoolTimeLimit', e.target.value)
                    }
                    className="max-w-[100px]"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="junior-high-limit">Junior High</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="junior-high-limit"
                    type="number"
                    min={5}
                    max={180}
                    value={settings.juniorHighTimeLimit}
                    onChange={(e) =>
                      handleNumberChange('juniorHighTimeLimit', e.target.value)
                    }
                    className="max-w-[100px]"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senior-high-limit">Senior High</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="senior-high-limit"
                    type="number"
                    min={5}
                    max={240}
                    value={settings.seniorHighTimeLimit}
                    onChange={(e) =>
                      handleNumberChange('seniorHighTimeLimit', e.target.value)
                    }
                    className="max-w-[100px]"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-time">
                Default session time (minutes)
              </Label>
              <Input
                id="default-time"
                type="number"
                min={5}
                max={120}
                value={settings.defaultSessionTime}
                onChange={(e) =>
                  handleNumberChange('defaultSessionTime', e.target.value)
                }
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Used when grade level cannot be determined
              </p>
            </div>
          </div>

          <Separator />

          {/* Auto Checkout */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              Automatic Checkout
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Automatically check out all students at a specific time</p>
                </TooltipContent>
              </Tooltip>
            </h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-checkout">Enable automatic checkout</Label>
              <Switch
                id="auto-checkout"
                checked={settings.autoCheckoutEnabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoCheckoutEnabled: checked,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout-time">Auto checkout time</Label>
              <Input
                id="checkout-time"
                type="time"
                value={settings.autoCheckoutTime}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoCheckoutTime: e.target.value,
                  }))
                }
                disabled={!settings.autoCheckoutEnabled}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                All students will be automatically checked out at this time
              </p>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>

            <Button onClick={saveSettings} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
