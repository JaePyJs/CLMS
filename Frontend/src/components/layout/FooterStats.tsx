import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  Users,
  Database,
  HardDrive,
  BookOpen,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface DashboardStats {
  activeStudents: number;
  totalBooks: number;
  todayCheckouts: number;
  todayReturns: number;
}

export function FooterStats() {
  const { isConnected, lastMessage } = useWebSocketContext();
  const { isAuthenticated } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    activeStudents: 0,
    totalBooks: 0,
    todayCheckouts: 0,
    todayReturns: 0,
  });
  const [dbStatus, setDbStatus] = useState<'healthy' | 'warning' | 'error'>(
    'healthy'
  );
  const appStartTimeRef = useRef(Date.now());
  const [uptime, setUptime] = useState('0m');

  // Calculate uptime
  useEffect(() => {
    const updateUptime = () => {
      const diff = Date.now() - appStartTimeRef.current;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 0) {
        setUptime(`${hours}h ${minutes}m`);
      } else {
        setUptime(`${minutes}m`);
      }
    };

    updateUptime();
    const timer = setInterval(updateUptime, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch stats
  const fetchStats = async () => {
    if (!isAuthenticated) return;

    try {
      // Fetch active sessions
      const activeRes = await apiClient.get('/api/students/active-sessions');
      const activeData = (activeRes as any)?.data || activeRes;
      const activeCount =
        activeData?.count ||
        (Array.isArray(activeData?.data) ? activeData.data.length : 0);

      // Fetch dashboard stats
      const dashRes = await apiClient.get('/api/analytics/dashboard-stats');
      const dashData = (dashRes as any)?.data || dashRes;

      setStats({
        activeStudents: activeCount,
        totalBooks: dashData?.totalBooks || 0,
        todayCheckouts: dashData?.todayStats?.checkouts || 0,
        todayReturns: dashData?.todayStats?.returns || 0,
      });

      setDbStatus('healthy');
    } catch {
      setDbStatus('warning');
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Listen for real-time updates
  useEffect(() => {
    if (!lastMessage) return;
    if (
      lastMessage.type === 'STUDENT_SCAN' ||
      lastMessage.type === 'ACTIVITY_LOG' ||
      lastMessage.type === 'DASHBOARD_UPDATE' ||
      lastMessage.type === 'student_checkin' ||
      lastMessage.type === 'student_checkout'
    ) {
      fetchStats();
    }
  }, [lastMessage]);

  const StatusDot = ({
    status,
  }: {
    status: 'online' | 'offline' | 'warning';
  }) => (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        status === 'online' && 'bg-green-500 animate-pulse',
        status === 'offline' && 'bg-red-500',
        status === 'warning' && 'bg-yellow-500'
      )}
    />
  );

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        {/* Main stats row */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
          {/* Left side - Connection & System status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              )}
              <StatusDot status={isConnected ? 'online' : 'offline'} />
              <span
                className={cn(
                  'font-medium',
                  isConnected
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-500'
                )}
              >
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-blue-500" />
              <StatusDot
                status={
                  dbStatus === 'healthy'
                    ? 'online'
                    : dbStatus === 'warning'
                      ? 'warning'
                      : 'offline'
                }
              />
              <span className="text-slate-600 dark:text-slate-400">
                Database
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <HardDrive className="h-3.5 w-3.5" />
              <span>Session: {uptime}</span>
            </div>
          </div>

          {/* Center - Quick stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-semibold text-blue-700 dark:text-blue-300">
                {stats.activeStudents}
              </span>
              <span className="text-blue-600/70 dark:text-blue-400/70">
                active
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/30">
              <BookOpen className="h-3.5 w-3.5 text-purple-500" />
              <span className="font-semibold text-purple-700 dark:text-purple-300">
                {stats.totalBooks.toLocaleString()}
              </span>
              <span className="text-purple-600/70 dark:text-purple-400/70">
                books
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/30">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-700 dark:text-green-300">
                <span className="font-semibold">{stats.todayCheckouts}</span>{' '}
                out
              </span>
              <span className="text-slate-400 mx-0.5">•</span>
              <span className="text-green-700 dark:text-green-300">
                <span className="font-semibold">{stats.todayReturns}</span> in
              </span>
            </div>
          </div>

          {/* Right side - Date & Version */}
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />

            <span className="font-medium">
              CLMS{' '}
              <span className="text-blue-600 dark:text-blue-400">v1.0.3</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
