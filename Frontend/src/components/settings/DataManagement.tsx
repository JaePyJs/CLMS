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
import { useWebSocketContext } from '@/contexts/WebSocketContext';
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
  activitiesAffected?: number;
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
  const { refreshDashboard } = useWebSocketContext();
  const [deleteTodaysActivities, setDeleteTodaysActivities] = useState(false);

  // Reset daily data mutation
  const resetDailyMutation = useMutation({
    mutationFn: (deleteToday?: boolean) =>
      settingsApi.resetDailyData(deleteToday),
    onSuccess: (response) => {
      const data = (response as any)?.data || {};
      setLastResetResult(data);
      // Refresh dashboard data so UI updates
      try {
        refreshDashboard('overview');
        refreshDashboard('activities');
      } catch (err) {
        // ignore if not available
      }
      toast.success('Daily data reset successfully!', {
        description: `Activities affected: ${data.activitiesAffected || 0}, Rooms reset: ${data.equipmentReset || 0}, Sessions deleted: ${data.equipmentSessionsDeleted || 0}`,
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
      // Refresh dashboard data
      try {
        refreshDashboard('overview');
        refreshDashboard('activities');
      } catch (err) {
        // ignore
      }
      toast.success('All data reset successfully!', {
        description: `Deleted ${data.activitiesDeleted || 0} activities, ${data.equipmentSessionsDeleted || 0} sessions, ${data.checkoutsDeleted || 0} checkouts`,
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to reset all data'));
    },
  });

  const [showNuclearResetDialog, setShowNuclearResetDialog] = useState(false);
  const [nuclearConfirmationInput, setNuclearConfirmationInput] = useState('');

  // Nuclear reset mutation
  const nuclearResetMutation = useMutation({
    mutationFn: (confirmationCode: string) =>
      settingsApi.resetDatabaseCompletely(confirmationCode),
    onSuccess: (response) => {
      const data = (response as any)?.data || {};
      setLastResetResult(data);
      setShowNuclearResetDialog(false);
      setNuclearConfirmationInput('');
      // Refresh dashboard data
      try {
        refreshDashboard('overview');
        refreshDashboard('activities');
      } catch (err) {
        // ignore
      }
      toast.success('Database completely reset!', {
        description: `Deleted ${data.studentsDeleted || 0} students, ${data.booksDeleted || 0} books, and all activity records.`,
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to reset database'));
    },
  });

  const handleResetDaily = () => {
    let confirmMsg =
      'This will reset all rooms to available and clear active sessions.';
    if (deleteTodaysActivities) {
      confirmMsg +=
        ' It will also delete all activities that started today (history for today will be cleared).';
    }
    confirmMsg += ' Continue?';

    if (confirm(confirmMsg)) {
      resetDailyMutation.mutate(deleteTodaysActivities);
    }
  };

  const handleResetAll = () => {
    if (confirmationInput === 'RESET-ALL-DATA-CONFIRM') {
      resetAllMutation.mutate('RESET-ALL-DATA-CONFIRM');
    } else {
      toast.error('Please enter the correct confirmation code');
    }
  };

  const handleNuclearReset = () => {
    if (nuclearConfirmationInput === 'DELETE-EVERYTHING-PERMANENTLY') {
      nuclearResetMutation.mutate('DELETE-EVERYTHING-PERMANENTLY');
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
            <AlertTitle>Admin or Librarian Access</AlertTitle>
            <AlertDescription>
              These actions are only available to administrators and librarians
              and cannot be undone.
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
              <li>
                {deleteTodaysActivities
                  ? 'Delete all student check-ins today (history cleared for today)'
                  : 'End all active student check-ins (mark as completed)'}
              </li>
              <li>Reset all rooms/stations to "Available" status</li>
              <li>End all active equipment/room sessions</li>
            </ul>
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              ✓ Historical data is preserved - only active sessions are affected
            </p>
          </div>

          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <input
                id="deleteToday"
                type="checkbox"
                checked={deleteTodaysActivities}
                onChange={(e) => setDeleteTodaysActivities(e.target.checked)}
                className="rounded border"
              />
              <label htmlFor="deleteToday" className="text-sm">
                Delete today's activities as well
              </label>
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
              {resetDailyMutation.isPending
                ? 'Resetting...'
                : 'Reset Daily Data'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset All Data */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Trash2 className="w-5 h-5" />
            Reset All Data (Keep Students/Books)
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

      {/* NUCLEAR RESET */}
      <Card className="border-red-600 bg-red-50 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-500">
            <Trash2 className="w-5 h-5" />
            NUCLEAR RESET (Delete Everything)
          </CardTitle>
          <CardDescription className="text-red-600/80 dark:text-red-400/80">
            <span className="font-bold">EXTREME DANGER:</span> Permanently
            delete EVERYTHING including students and books.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 space-y-2 border border-red-200 dark:border-red-800">
            <p className="text-sm font-bold text-red-700 dark:text-red-400">
              This will delete:
            </p>
            <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
              <li>❌ All Students</li>
              <li>❌ All Books</li>
              <li>❌ All Activity Records</li>
              <li>❌ All Checkouts</li>
              <li>❌ All Sessions</li>
            </ul>
            <p className="text-sm font-medium text-red-700 dark:text-red-400 mt-2">
              Use this only if you want to start completely fresh (e.g. before
              re-importing CSVs).
            </p>
          </div>

          <Button
            onClick={() => setShowNuclearResetDialog(true)}
            variant="destructive"
            className="w-full sm:w-auto bg-red-700 hover:bg-red-800"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            NUCLEAR RESET...
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
              {lastResetResult.activitiesAffected !== undefined && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {lastResetResult.activitiesAffected}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Activities Affected
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
              {lastResetResult.equipmentSessionsDeleted !== undefined && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {lastResetResult.equipmentSessionsDeleted}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Equipment Sessions Deleted
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

      {/* Nuclear Confirmation Dialog */}
      <Dialog
        open={showNuclearResetDialog}
        onOpenChange={setShowNuclearResetDialog}
      >
        <DialogContent className="border-red-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm NUCLEAR RESET
            </DialogTitle>
            <DialogDescription className="text-red-600 font-medium">
              This action will permanently delete EVERYTHING including Students
              and Books. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert
              variant="destructive"
              className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
            >
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-600">
                Type{' '}
                <code className="bg-red-200 dark:bg-red-900 px-1 rounded font-bold">
                  DELETE-EVERYTHING-PERMANENTLY
                </code>{' '}
                to confirm.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="nuclearConfirmation">Confirmation Code</Label>
              <Input
                id="nuclearConfirmation"
                value={nuclearConfirmationInput}
                onChange={(e) => setNuclearConfirmationInput(e.target.value)}
                placeholder="Enter confirmation code"
                className="font-mono border-red-300 focus:ring-red-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNuclearResetDialog(false);
                setNuclearConfirmationInput('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleNuclearReset}
              disabled={
                nuclearResetMutation.isPending ||
                nuclearConfirmationInput !== 'DELETE-EVERYTHING-PERMANENTLY'
              }
              className="bg-red-700 hover:bg-red-800"
            >
              {nuclearResetMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  NUKE IT...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  NUCLEAR RESET
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
