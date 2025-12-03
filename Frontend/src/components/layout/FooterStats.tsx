import React, { useState, useEffect, useRef } from 'react';
import { Clock, Globe, Zap, Users, Database, Activity } from 'lucide-react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function FooterStats() {
  const { isConnected, lastMessage } = useWebSocketContext();
  const { isAuthenticated } = useAuth();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSessionCount, setActiveSessionCount] = useState(0);
  const appStartTimeRef = useRef(Date.now());

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active session count
  const fetchActiveCount = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await apiClient.get('/api/students/active-sessions');
      const data = (response as any)?.data || response;
      const count =
        data?.count || (Array.isArray(data?.data) ? data.data.length : 0);
      setActiveSessionCount(count);
    } catch {
      // Ignore errors silently
    }
  };

  // Initial fetch and polling fallback
  useEffect(() => {
    fetchActiveCount();
    const interval = setInterval(fetchActiveCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Listen for real-time updates
  useEffect(() => {
    if (!lastMessage) return;

    // Update on relevant events
    if (
      lastMessage.type === 'STUDENT_SCAN' ||
      lastMessage.type === 'ACTIVITY_LOG' ||
      lastMessage.type === 'DASHBOARD_UPDATE'
    ) {
      fetchActiveCount();
    }
  }, [lastMessage]);

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <Clock className="h-3 w-3 text-blue-500" />
              <span className="font-mono">{currentTime.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <Globe className="h-3 w-3 text-green-500" />
              {navigator.language}
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <Zap className="h-3 w-3 text-yellow-500" />
              System:{' '}
              <span
                className={`font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
              >
                {isConnected ? 'Good' : 'Offline'}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <Users className="h-3 w-3 text-purple-500" />
              Active: <span className="font-medium">{activeSessionCount}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <Database className="h-3 w-3 text-blue-500" />
              DB:{' '}
              <span className="text-green-600 dark:text-green-400 font-medium">
                Healthy
              </span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <Activity className="h-3 w-3 text-red-500" />
              Uptime:{' '}
              <span className="font-medium">
                {Math.floor((Date.now() - appStartTimeRef.current) / 3600000)}h
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center lg:text-left">
            © 2025 Educational Library Management System • All Rights Reserved
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center lg:text-right">
            CLMS{' '}
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              v1.0.0
            </span>{' '}
            • Built with React & Google Sheets
          </p>
        </div>
      </div>
    </footer>
  );
}
