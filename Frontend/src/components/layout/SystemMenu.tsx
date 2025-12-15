import React from 'react';
import {
  Settings,
  Monitor,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
// Placeholder until we confirming exact theme path
import { useWebSocketContext } from '@/contexts/WebSocketContext';

// Define a simple hook if we can't find the real one instantly
// But we saw ThemeContext.tsx so we will try to use it

export const SystemMenu: React.FC = () => {
  const { isConnected, disconnect, connect } = useWebSocketContext();
  const { user } = useAuth();

  const handleClearCache = () => {
    // Simple cache clear - reload page
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    localStorage.removeItem('clms-app-storage'); // Example
    toast.success('System cache cleared');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleReconnect = () => {
    disconnect();
    setTimeout(() => connect(), 1000);
    toast.info('Reconnecting to system...');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
          title="System Settings"
          data-testid="system-menu-trigger"
        >
          <Settings className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Monitor className="w-4 h-4" />
          System Control
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Connection Status */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted/50 mx-1 rounded flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            {isConnected ? 'System Online' : 'Offline Mode'}
          </span>
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-blue-500" />
            v1.2.0
          </span>
        </div>

        <DropdownMenuSeparator />

        {/* Theme Toggle */}

        {/* Quick Actions */}
        <DropdownMenuItem onClick={handleReconnect}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reconnect Services
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleClearCache}
          className="text-orange-600 focus:text-orange-600 dark:text-orange-400"
        >
          <Database className="mr-2 h-4 w-4" />
          Clear Cache & Reload
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-default focus:bg-transparent">
          <div className="flex flex-col gap-1 w-full">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Current User
            </span>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.username || 'Guest'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {user?.role || 'Viewer'}
                </span>
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
