import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';

interface SessionTimeoutWarningProps {
  /** Warning time before actual timeout (in milliseconds) */
  warningTime?: number;
  /** Total session timeout duration (in milliseconds) */
  sessionTimeout?: number;
}

/**
 * SessionTimeoutWarning - Displays a warning modal before session expires
 *
 * Shows a countdown warning before the session times out, allowing users to
 * extend their session or log out gracefully.
 */
export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  warningTime = 5 * 60 * 1000, // 5 minutes warning by default
  sessionTimeout = 60 * 60 * 1000, // 60 minutes total session
}) => {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!user) {
      setShowWarning(false);
      return;
    }

    // Set timer to show warning before timeout
    const warningTimer = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.floor(warningTime / 1000));
    }, sessionTimeout - warningTime);

    // Cleanup on unmount or user change
    return () => {
      clearTimeout(warningTimer);
    };
  }, [user, warningTime, sessionTimeout]);

  useEffect(() => {
    if (!showWarning || countdown <= 0) {
      return;
    }

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up - auto logout
          clearInterval(countdownInterval);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [showWarning, countdown]);

  const handleExtendSession = () => {
    // Close the warning dialog
    setShowWarning(false);
    setCountdown(0);

    // The auto-refresh mechanism in AuthContext will handle the actual refresh
    // We just need to close the modal and reset the warning timer
    // No need to reload the page
  };

  const handleLogout = () => {
    setShowWarning(false);
    logout();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return null;
  }

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="text-2xl">⏰</span>
            Session Timeout Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Your session is about to expire due to inactivity.</p>
            <p className="text-lg font-semibold text-foreground">
              Time remaining: {formatTime(countdown)}
            </p>
            <p className="text-sm text-muted-foreground">
              Click "Stay Logged In" to continue your session, or "Log Out" to
              end your session now.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleLogout} className="sm:mr-auto">
            Log Out
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleExtendSession}>
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionTimeoutWarning;
