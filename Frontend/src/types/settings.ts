/**
 * Attendance Display Settings
 */
export interface AttendanceDisplaySettings {
  /** Enable/disable attendance display feature */
  enabled: boolean;

  /** Auto-logout duration in minutes (default: 15) */
  autoLogoutDuration: number;

  /** Welcome/goodbye message display duration in milliseconds (default: 5000) */
  messageDuration: number;

  /** Display theme */
  theme: 'light' | 'dark' | 'auto';

  /** Font size multiplier for visibility (default: 1.0) */
  fontSizeMultiplier: number;

  /** Show current time on display */
  showClock: boolean;

  /** View mode for active students list */
  viewMode: 'grid' | 'list';
}

/**
 * Default attendance display settings
 */
export const defaultAttendanceSettings: AttendanceDisplaySettings = {
  enabled: true,
  autoLogoutDuration: 15,
  messageDuration: 5000,
  theme: 'auto',
  fontSizeMultiplier: 1.0,
  showClock: true,
  viewMode: 'list',
};

/**
 * Application settings (extensible)
 */
export interface AppSettings {
  attendance: AttendanceDisplaySettings;
  // Add other settings categories here
}
