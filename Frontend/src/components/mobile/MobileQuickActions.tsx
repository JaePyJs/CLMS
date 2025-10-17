import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useTouchOptimization } from '@/hooks/useMobileOptimization';
import { toast } from 'sonner';
import { Zap, ArrowRight } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  onClick: () => void | Promise<void>;
  badge?: number;
  shortcut?: string;
  requiresAuth?: boolean;
  isPrimary?: boolean;
}

interface MobileQuickActionsProps {
  onActionClick?: (actionId: string) => void;
  customActions?: QuickAction[];
}

export const MobileQuickActions: React.FC<MobileQuickActionsProps> = ({
  onActionClick,
  customActions,
}) => {
  const { isMobile, isTablet } = useMobileOptimization();
  const { queueAction, isOnline } = useOfflineSync();
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Default quick actions
  const defaultActions: QuickAction[] = [
    {
      id: 'quick-checkout',
      label: 'Quick Checkout',
      description: 'Fast book checkout',
      icon: Library,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      onClick: async () => {
        await handleQuickCheckout();
      },
      isPrimary: true,
      shortcut: '1',
    },
    {
      id: 'quick-checkin',
      label: 'Quick Check-in',
      description: 'Fast book return',
      icon: BookOpen,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      onClick: async () => {
        await handleQuickCheckin();
      },
      shortcut: '2',
    },
    {
      id: 'student-lookup',
      label: 'Student Lookup',
      description: 'Find student info',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      onClick: () => {
        // Navigate to student search
        window.location.hash = '#students?search=true';
      },
      shortcut: '3',
    },
    {
      id: 'quick-scan',
      label: 'Quick Scan',
      description: 'Scan barcode/QR',
      icon: Camera,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      onClick: () => {
        // Navigate to scanner
        window.location.hash = '#scan';
      },
      isPrimary: true,
      shortcut: '4',
    },
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'activity-log',
      label: 'Activity Log',
      description: 'Recent activities',
      icon: Clock,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-900/20',
      onClick: () => {
        window.location.hash = '#analytics?tab=activities';
      },
      shortcut: '5',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Overview',
      icon: BarChart3,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
      onClick: () => {
        window.location.hash = '#dashboard';
      },
      shortcut: '6',
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'App settings',
      icon: Settings,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/20',
      onClick: () => {
        window.location.hash = '#settings';
      },
      shortcut: '7',
    },
    {
      id: 'add-item',
      label: 'Add Item',
      description: 'Add book/student',
      icon: Plus,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-100 dark:bg-teal-900/20',
      onClick: () => {
        toast.info('Choose what to add (book, student, equipment)');
      },
      shortcut: '8',
    },
  ];

  const actions = [...defaultActions, ...(customActions || []), ...secondaryActions];

  // Quick checkout handler
  const handleQuickCheckout = useCallback(async () => {
    if (actionInProgress) return;

    try {
      setActionInProgress('quick-checkout');

      // Simulate quick checkout flow
      toast.info('Scanning for checkout...');

      // In a real app, this would open a scanner interface
      setTimeout(() => {
        const mockBookId = `BOOK-${Date.now().toString(36)}`;
        const mockStudentId = `STU-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

        toast.success(`Checked out ${mockBookId} to Student ${mockStudentId}`);

        // Queue action if offline
        if (!isOnline) {
          queueAction({
            type: 'create',
            endpoint: '/api/activities',
            data: {
              action: 'checkout',
              bookId: mockBookId,
              studentId: mockStudentId,
              timestamp: Date.now(),
            },
          });
        }
      }, 1500);
    } catch (error) {
      console.error('[MobileQuickActions] Quick checkout failed:', error);
      toast.error('Quick checkout failed');
    } finally {
      setActionInProgress(null);
    }
  }, [actionInProgress, isOnline, queueAction]);

  // Quick checkin handler
  const handleQuickCheckin = useCallback(async () => {
    if (actionInProgress) return;

    try {
      setActionInProgress('quick-checkin');

      toast.info('Scanning for check-in...');

      setTimeout(() => {
        const mockBookId = `BOOK-${Date.now().toString(36)}`;

        toast.success(`Checked in ${mockBookId}`);

        // Queue action if offline
        if (!isOnline) {
          queueAction({
            type: 'create',
            endpoint: '/api/activities',
            data: {
              action: 'checkin',
              bookId: mockBookId,
              timestamp: Date.now(),
            },
          });
        }
      }, 1500);
    } catch (error) {
      console.error('[MobileQuickActions] Quick checkin failed:', error);
      toast.error('Quick checkin failed');
    } finally {
      setActionInProgress(null);
    }
  }, [actionInProgress, isOnline, queueAction]);

  // Handle action click
  const handleActionClick = useCallback(async (action: QuickAction) => {
    if (actionInProgress === action.id) return;

    try {
      // Provide haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      // Execute action
      await action.onClick();

      // Notify parent
      onActionClick?.(action.id);
    } catch (error) {
      console.error('[MobileQuickActions] Action failed:', error);
      toast.error(`Failed to execute ${action.label}`);
    }
  }, [actionInProgress, onActionClick]);

  // Don't show on desktop
  if (!isMobile && !isTablet) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Primary Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {defaultActions.map((action) => {
              const Icon = action.icon;
              const isLoading = actionInProgress === action.id;

              return (
                <Button
                  key={action.id}
                  variant="outline"
                  className={`h-auto p-4 flex flex-col items-center gap-2 rounded-xl border-2 transition-all ${
                    action.isPrimary
                      ? 'border-primary/20 hover:border-primary/40 hover:bg-primary/5'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  onClick={() => handleActionClick(action)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  disabled={isLoading}
                >
                  <div className={`p-3 rounded-full ${action.bgColor}`}>
                    <Icon className={`h-6 w-6 ${action.color} ${isLoading ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {action.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {action.description}
                    </p>
                  </div>
                  {action.shortcut && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {action.shortcut}
                    </Badge>
                  )}
                  {action.badge && action.badge > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {action.badge}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Secondary Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">More Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {secondaryActions.map((action) => {
              const Icon = action.icon;
              const isLoading = actionInProgress === action.id;

              return (
                <Button
                  key={action.id}
                  variant="ghost"
                  className="w-full justify-between h-auto p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleActionClick(action)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${action.bgColor}`}>
                      <Icon className={`h-4 w-4 ${action.color}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {action.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {action.shortcut && (
                      <Badge variant="outline" className="text-[10px]">
                        {action.shortcut}
                      </Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Status */}
      {actionInProgress && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Processing action...
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  This will be synced when you're back online
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileQuickActions;