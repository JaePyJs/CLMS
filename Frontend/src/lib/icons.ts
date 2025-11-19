/**
 * Centralized icon management system for the CLMS frontend
 * Eliminates import bloat across components
 */

// Simple icon factory that can be used across components
export const createIcon = (
  iconName: string,
  props: { className?: string } = {}
) => {
  // This is a placeholder - in practice, you'd import specific icons as needed
  // The goal is to reduce the massive import lists in components
  const iconClassName = props.className || '';
  const iconMethods = {
    success: () => `<CheckCircle className="${iconClassName}" />`,
    error: () => `<XCircle className="${iconClassName}" />`,
    warning: () => `<AlertTriangle className="${iconClassName}" />`,
    info: () => `<Info className="${iconClassName}" />`,
    loading: () => `<Loader2 className="${iconClassName}" />`,
  };

  // Use the iconName parameter to return the appropriate method
  return iconMethods[iconName as keyof typeof iconMethods] || iconMethods.error;
};

// Icon usage patterns that can be refactored
export const ICON_USAGE_PATTERNS = {
  // Status indicators
  SUCCESS: 'CheckCircle',
  ERROR: 'XCircle',
  WARNING: 'AlertTriangle',
  INFO: 'Info',
  LOADING: 'Loader2',

  // Navigation
  DASHBOARD: 'LayoutDashboard',
  ANALYTICS: 'BarChart3',
  USERS: 'Users',
  BOOKS: 'BookOpen',
  EQUIPMENT: 'Monitor',
  SETTINGS: 'Settings',
  REPORTS: 'FileText',
  SCANNER: 'Scan',
  NOTIFICATIONS: 'Bell',

  // System
  PERFORMANCE: 'Activity',
  MONITORING: 'Zap',
  SPEED: 'Gauge',
  TARGET: 'Target',
  CLOCK: 'Clock',
  DATABASE: 'Database',

  // Actions
  ADD: 'Plus',
  EDIT: 'Edit',
  DELETE: 'Trash2',
  DOWNLOAD: 'Download',
  UPLOAD: 'Upload',
  PRINT: 'Printer',
  EXPORT: 'FileSpreadsheet',
  REFRESH: 'RefreshCw',

  // Connection
  CONNECTED: 'Wifi',
  DISCONNECTED: 'WifiOff',
  CONNECTING: 'Loader2',
  CHAT: 'MessageSquare',
};

// Example refactoring guide
export const REFACTORING_GUIDE = {
  // Before: Component with massive import list
  BEFORE: `
    import { 
      Users, Monitor, Clock, TrendingUp, AlertCircle, CheckCircle, 
      Activity, Wifi, CalendarDays, FileText, Shield, Download, 
      Printer, Maximize2, Minimize2, AlertTriangle, Settings, 
      BarChart3, Eye, Edit, ExternalLink, Bell 
    } from 'lucide-react';
  `,

  // After: Simplified import
  AFTER: `
    import { Icons, ICON_USAGE_PATTERNS } from '@/lib/icons';
    // Use ICON_USAGE_PATTERNS.SUCCESS instead of CheckCircle
  `,
};

export type IconName =
  (typeof ICON_USAGE_PATTERNS)[keyof typeof ICON_USAGE_PATTERNS];
export type IconProps = { className?: string };
