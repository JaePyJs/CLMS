import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { settingsApi } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorHandling';
import {
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Database,
  Shield,
} from 'lucide-react';

interface ResetResult {
  activitiesEnded?: number;
  equipmentReset?: number;
  activitiesDeleted?: number;
  equipmentSessionsDeleted?: number;
  checkoutsDeleted?: number;
}

export default function DataManagement() {
  const [showResetAllDialog, setShowResetAllDialog] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [lastResetResult, setLastResetResult] = useState<ResetResult | null>(
    null
  );

  // Reset daily data mutation
  const resetDailyMutation = useMutation({
    mutationFn: () => settingsApi.resetDailyData(),
    onSuccess: (response) => {
      const data = (response as any)?.data || {};
      setLastResetResult(data);
      toast.success('Daily data reset successfully!', {
        description: `Ended ${data.activitiesEnded || 0} sessions, reset ${data.equipmentReset || 0} rooms`,
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to reset daily data'));
    },
  });

  // Reset all data mutation
  const resetAllMutation = useMutation({
    mutationFn: (confirmationCode: string) =>
      settingsApi.resetAllData(confirmationCode),
    onSuccess: (response) => {
      const data = (response as any)?.data || {};
      setLastResetResult(data);
      setShowResetAllDialog(false);
      setConfirmationInput('');
      toast.success('All data reset successfully!', {
        description: `Deleted ${data.activitiesDeleted || 0} activities, ${data.equipmentSessionsDeleted || 0} sessions, ${data.checkoutsDeleted || 0} checkouts`,
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to reset all data'));
    },
  });

  const handleResetDaily = () => {
    if (
      confirm(
        'This will end all active sessions and reset all rooms to available. Continue?'
      )
    ) {
      resetDailyMutation.mutate();
    }
  };

  const handleResetAll = () => {
    if (confirmationInput === 'RESET-ALL-DATA-CONFIRM') {
      resetAllMutation.mutate('RESET-ALL-DATA-CONFIRM');
    } else {
      toast.error('Please enter the correct confirmation code');
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Reset system data when needed. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Admin Only</AlertTitle>
            <AlertDescription>
              These actions are only available to administrators and cannot be
              undone.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Reset Daily Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            Reset Daily Data
          </CardTitle>
          <CardDescription>
            End all active check-ins and room sessions. Use this at the end of
            the day or when starting fresh in the morning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">This will:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>End all active student check-ins (mark as completed)</li>
              <li>Reset all rooms/stations to "Available" status</li>
              <li>End all active equipment/room sessions</li>
            </ul>
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              ✓ Historical data is preserved - only active sessions are affected
            </p>
          </div>

          <Button
            onClick={handleResetDaily}
            disabled={resetDailyMutation.isPending}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${resetDailyMutation.isPending ? 'animate-spin' : ''}`}
            />
            {resetDailyMutation.isPending ? 'Resetting...' : 'Reset Daily Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Reset All Data */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Trash2 className="w-5 h-5" />
            Reset All Data
          </CardTitle>
          <CardDescription>
            <span className="text-destructive font-medium">Danger Zone:</span>{' '}
            Permanently delete all transactional data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: Irreversible Action</AlertTitle>
            <AlertDescription>
              This will permanently delete ALL check-ins, room sessions, and
              book checkouts. This action cannot be undone!
            </AlertDescription>
          </Alert>

          <div className="bg-destructive/10 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">
              This will delete:
            </p>
            <ul className="text-sm text-destructive/80 list-disc list-inside space-y-1">
              <li>All student activity records (check-ins/check-outs)</li>
              <li>All room/equipment session history</li>
              <li>All book borrowing records</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Note: Student and book records will NOT be deleted.
            </p>
          </div>

          <Button
            onClick={() => setShowResetAllDialog(true)}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset All Data...
          </Button>
        </CardContent>
      </Card>

      {/* Last Reset Result */}
      {lastResetResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Last Reset Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {lastResetResult.activitiesEnded !== undefined && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {lastResetResult.activitiesEnded}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sessions Ended
                  </div>
                </div>
              )}
              {lastResetResult.equipmentReset !== undefined && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {lastResetResult.equipmentReset}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rooms Reset
                  </div>
                </div>
              )}
              {lastResetResult.activitiesDeleted !== undefined && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {lastResetResult.activitiesDeleted}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Activities Deleted
                  </div>
                </div>
              )}
              {lastResetResult.checkoutsDeleted !== undefined && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {lastResetResult.checkoutsDeleted}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Checkouts Deleted
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showResetAllDialog} onOpenChange={setShowResetAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirm Complete Data Reset
            </DialogTitle>
            <DialogDescription>
              This action will permanently delete all transactional data. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Type{' '}
                <code className="bg-destructive/20 px-1 rounded">
                  RESET-ALL-DATA-CONFIRM
                </code>{' '}
                to confirm.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirmation Code</Label>
              <Input
                id="confirmation"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="Enter confirmation code"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetAllDialog(false);
                setConfirmationInput('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetAll}
              disabled={
                resetAllMutation.isPending ||
                confirmationInput !== 'RESET-ALL-DATA-CONFIRM'
              }
            >
              {resetAllMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset All Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
