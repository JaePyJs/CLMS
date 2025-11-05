import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Types for our application state
export interface Student {
  id: string;
  name: string;
  gradeLevel: string;
  gradeCategory: 'primary' | 'gradeSchool' | 'juniorHigh' | 'seniorHigh';
  barcode?: string;
}

export interface Equipment {
  id: string;
  type: 'computer' | 'gaming' | 'avr';
  name: string;
  status: 'available' | 'in-use' | 'maintenance' | 'offline';
  currentSession?: EquipmentSession;
}

export interface EquipmentSession {
  id: string;
  studentId: string;
  startTime: Date;
  endTime?: Date;
  timeLimitMinutes: number;
  status: 'active' | 'completed' | 'expired';
}

export interface Activity {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  gradeCategory: string;
  activityType:
    | 'borrowing'
    | 'returning'
    | 'computer'
    | 'gaming'
    | 'avr'
    | 'recreation'
    | 'study'
    | 'general';
  equipmentId?: string;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  timeLimitMinutes?: number;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
}

export interface AutomationJob {
  id: string;
  name: string;
  type: 'backup' | 'notification' | 'sync' | 'cleanup';
  status: 'running' | 'completed' | 'failed' | 'queued';
  lastRun?: Date;
  nextRun?: Date;
  duration?: number;
  errorMessage?: string;
}

export interface AppNotification {
  id: string;
  userId?: string;
  type:
    | 'OVERDUE_BOOK'
    | 'FINE_ADDED'
    | 'FINE_WAIVED'
    | 'BOOK_DUE_SOON'
    | 'EQUIPMENT_EXPIRING'
    | 'SYSTEM_ALERT'
    | 'INFO'
    | 'WARNING'
    | 'ERROR'
    | 'SUCCESS';
  title: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  read: boolean;
  readAt?: string;
  actionUrl?: string;
  metadata?: any;
  createdAt: string;
  expiresAt?: string;
}

// App store interface
interface AppStore {
  // UI State
  isOnline: boolean;
  connectedToBackend: boolean;
  isDarkMode: boolean;

  // Offline Sync State
  offlineQueueCount: number;
  lastSyncTime: number | null;
  syncInProgress: boolean;

  // Data State
  students: Student[];
  equipment: Equipment[];
  activities: Activity[];
  automationJobs: AutomationJob[];
  notifications: AppNotification[];

  // Scanning State
  isScanning: boolean;
  lastScanResult: string;
  scanQueue: any[];

  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  setBackendConnection: (connected: boolean) => void;
  setDarkMode: (isDark: boolean) => void;
  toggleDarkMode: () => void;
  setOfflineQueueCount: (count: number) => void;
  setLastSyncTime: (time: number | null) => void;
  setSyncInProgress: (inProgress: boolean) => void;
  setStudents: (students: Student[]) => void;
  setEquipment: (equipment: Equipment[]) => void;
  setActivities: (activities: Activity[]) => void;
  setAutomationJobs: (jobs: AutomationJob[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setScanning: (scanning: boolean) => void;
  setLastScanResult: (result: string) => void;
  addToScanQueue: (item: any) => void;
  clearScanQueue: () => void;
}

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // Initial state
      isOnline: navigator.onLine,
      connectedToBackend: false,
      isDarkMode: false,
      offlineQueueCount: 0,
      lastSyncTime: null,
      syncInProgress: false,
      students: [],
      equipment: [],
      activities: [],
      automationJobs: [],
      notifications: [],
      isScanning: false,
      lastScanResult: '',
      scanQueue: [],

      // Actions
      setOnlineStatus: (isOnline) => set({ isOnline }),
      setBackendConnection: (connected) =>
        set({ connectedToBackend: connected }),
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setOfflineQueueCount: (count) => set({ offlineQueueCount: count }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
      setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),
      setStudents: (students) => set({ students }),
      setEquipment: (equipment) => set({ equipment }),
      setActivities: (activities) => set({ activities }),
      setAutomationJobs: (automationJobs) => set({ automationJobs }),
      setNotifications: (notifications) => set({ notifications }),
      setScanning: (scanning) => set({ isScanning: scanning }),
      setLastScanResult: (result) => set({ lastScanResult: result }),
      addToScanQueue: (item) =>
        set((state) => ({
          scanQueue: [...state.scanQueue, item],
        })),
      clearScanQueue: () => set({ scanQueue: [] }),
    }),
    {
      name: 'clms-store',
    }
  )
);
